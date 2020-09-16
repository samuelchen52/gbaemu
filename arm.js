const arm = function(mmu, registers, changeState, changeMode, setNZCV) {

	//returns true if condition is met
	const checkCondition (condition)
	{
		let flags = bitSlice(registers[16][0], 28, 31); //N, Z, C, V
		switch(condition)
		{
			case 0: return (flags & 0x4) ? true : false; //BEQ Z=1
			break;
			case 1: return (flags & 0x4) ? false : true; //BNE Z=0
			break;
			case 2: return (flags & 0x2) ? true : false; //BCS/BHS C=1
			break;
			case 3: return (flags & 0x2) ? false : true; //BCC/BLO C=0
			break;
			case 4: return (flags & 0x8) ? true : false; //BMI N=1
			break;
			case 5: return (flags & 0x8) ? false : true; //BPL N=0
			break;
			case 6: return (flags & 0x1) ? true : false; //BVS V=1
			break;
			case 7: return (flags & 0x1) ? false : true; //BVC V=0
			break;
			case 8: return ((flags & 0x2) && !(flags & 0x4)) ? true : false; //BHI C=1, Z=0 
			break;
			case 9: return (!(flags & 0x2) && (flags & 0x4)) ? true : false; //BLS C=0, Z=1
			break;
			case 10: return ((flags & 0x8) === (flags & 0x1)) ? true : false; //BGE N=V
			break;
			case 11: return ((flags & 0x8) !== (flags & 0x1)) ? true : false; //BLT N<>V
			break;
			case 12: return (((flags & 0x8) === (flags & 0x1)) && !(flags & 0x4)) ? true : false; //BGT N=V, Z=0
			break;
			case 13: return (((flags & 0x8) !== (flags & 0x1)) || (flags & 0x4)) ? true : false; //BGT N<>V or Z=1
			break;
			case 14: throw Error("invalid opcode (0xE) with THUMB conditional branch");
			break;
			case 15: throw Error("error with parsing, decode returned opcode for conditional branch instead of SWI");
			break;
		}
		throw Error("error with parsing, decode returned opcode for conditional branch instead of SWI");
	}

	var shiftCarryFlag = undefined;
	//if imm flag is toggled, if shiftamt is 0, it will be set to 32 for shift type 1 and 2
	const shiftReg = function (register, shiftamt, type, immflag)
	{
		//usually only LSL #0, but for register shifted by bottom byte of register, other ops with #0 are possible, behavior same?
		if (shiftamt === 0)
		{
			if ((!type) || (!immflag)) //if LSL0 or immflag not set
			{
				shiftCarryFlag = undefined;
				return register;
			}
			else if ((type === 1) || (type === 2))
			{
				shiftamt = 32;
			}
		}

		//shiftamt nonzero
		let gt32 = shiftamt > 32;
		switch(type)
		{
			case 0: //LSL
			if (gt32)
			{
				shiftCarryFlag = 0;
				return 0;
			}
			else
			{ 
				shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
				return register << shiftamt;
			}
			break;

			case 1: //LSR
			if (gt32)
			{
				shiftCarryFlag = 0;
				return 0;
			}
			else
			{
				shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
				return register >>> shiftamt;
			}
			break;

			case 2:
			if (gt32)
			{
				shiftCarryFlag = register >>> 31;
				return shiftCarryFlag ? 4294967295 : 0; //2 ^ 32 - 1 === 4294967295
			}
			else
			{
				shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
				return (register >>> shiftamt) + ((register >> 31) ? (((1 << shiftamt) - 1) << (32 - shiftamt)) : 0);
			}
			break;

			case 3:
			if (shiftamt === 0) //if shiftamt is 0 here, then immflag must be set (otherwise this would have returned already)
			{
				let result = register >>> 1;
				result += bitSlice(registers[16][0], 29, 29) ? 2147483648 : 0;
				shiftCarryFlag = bitSlice(register, 0, 0);
				return result;
			}
			else
			{
				shiftamt %= 32; //0 to 31
				if (!shiftamt) //if shiftamt is zero here, then it was a multiple of 32
				{
					shiftCarryFlag = register >>> shiftamt;
					return register;
				}
				else
				{
					shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
					return rotateRight(register, shiftamt);
				}
			}
			break;

			default:
			throw Error("invalid shift type!");
		}
	}
	//ARM[5]-----------------------------------------------------------------------------------------------------
	const executeOpcode0 = function (instr, mode) { //0 - MULL / MLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rdhi = bitSlice(instr, 16, 19);
			let rdlo = bitSlice(instr, 12, 15);
			let rs = bitSlice(instr, 8, 11);
			let rm = bitSlice(instr, 0, 3);

			let result = BigInt(registers[rm][registerIndices[mode][rm]]) * BigInt(registers[rs][registerIndices[mode][rs]]);
			if (bitSlice(instr, 21, 21)) //accumulate bit
			{
				result += (BigInt(registers[rdhi][registerIndices[mode][rdhi]]) << 32n) + BigInt(registers[rdlo][registerIndices[mode][rdlo]]);
			}

			if (bitSlice(instr, 20, 20))
			{
				setNZCV((result >> 63n) == 1, result == 0);
			}
			registers[rdhi][registerIndices[mode][rdhi]] = Number(result >> 32n);
			registers[rdlo][registerIndices[mode][rdlo]] = Number(result & 0xFFFFFFFFn);
		}
	}

	const executeOpcode1 = function (instr, mode) { //1 - MUL / MLA Rd=Rm*Rs Rd=Rm*Rs+Rn
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rd = bitSlice(instr, 16, 19);
			let rn = bitSlice(instr, 12, 15);
			let rs = bitSlice(instr, 8, 11);
			let rm = bitSlice(instr, 0, 3);

			let result = BigInt(registers[rm][registerIndices[mode][rm]]) * BigInt(registers[rs][registerIndices[mode][rs]]);
			if (bitSlice(instr, 21, 21)) //accumulate bit
			{
				result += registers[rn][registerIndices[mode][rn]];
			}
			result = Number(result & 0xFFFFFFFFn);

			if (bitSlice(instr, 20, 20))
			{
				setNZCV(bitSlice(result, 31, 31), result === 0);
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	}

	//ARM[8]-----------------------------------------------------------------------------------------------------
	//p = 0 -> post, add offset after transfer (writeback is always enabled)
	//i = 0 -> register offset
	//writeback -> write address into base
	const executeOpcode2 = function (instr, mode) { //2 - STRH p=0 i=0 [a]=Rd
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			mmu.writeMem(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE,
			registers[rd][registerIndices[mode][rd]], 
			2);

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
		}
	}

	const executeOpcode3 = function (instr, mode) { //3 - LDRH p=0 i=0 Load Unsigned halfword
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			registers[rd][registerIndices[mode][rd]] = mmu.readMem(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE , 2);

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
		}
	}

	const executeOpcode4 = function (instr, mode) { //4 - STRH p=0 i=1 [a]=Rd
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			mmu.writeMem(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE,
			registers[rd][registerIndices[mode][rd]], 
			2);

			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
		}
	}

	const executeOpcode5 = function (instr, mode) { //5 - LDRH p=0 i=1 Load Unsigned halfword
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			registers[rd][registerIndices[mode][rd]] = mmu.readMem(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE , 2);

			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
		}
	}

	const executeOpcode6 = function (instr, mode) { //6 - LDRSB p=0 i=0 Load Signed Byte
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let byte = mmu.readMem(registers[rn][registerIndices[mode][rn]], 1);
			byte += byte & 128 ? (0xFFFFFF << 24) : 0; //sign extend byte
			registers[rd][registerIndices[mode][rd]] = byte;

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);

		}
	}

	const executeOpcode7 = function (instr, mode) { //7 - LDRSB p=0 i=1 Load Signed Byte
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let byte = mmu.readMem(registers[rn][registerIndices[mode][rn]], 1);
			byte += byte & 128 ? (0xFFFFFF << 24) : 0; //sign extend byte
			registers[rd][registerIndices[mode][rd]] = byte;
			
			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);

		}
	}

	const executeOpcode8 = function (instr, mode) { //8 - LDRSH p=0 i=0 Load Signed halfword
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let halfword = mmu.readMem(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE, 2);
			halfword += halfword & 32768 ? (0xFFFFFF << 16) : 0; //sign extend halfword
			registers[rd][registerIndices[mode][rd]] = halfword;

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);

		}
	}

	const executeOpcode9 = function (instr, mode) { //9 - LDRSH p=0 i=1 Load Signed halfword
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let halfword = mmu.readMem(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE, 2);
			halfword += halfword & 32768 ? (0xFFFFFF << 16) : 0; //sign extend halfword
			registers[rd][registerIndices[mode][rd]] = halfword;

			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);

		}
	}

	//ARM[4]------------------------second operand register, shifted by register (opcodes 0 - 7)-----------------
	const executeOpcode10 = function (instr, mode) { //10 - AND 0tt1 Rd = Rn AND Op2
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			let result = registers[rn][registerIndices[mode][rn]] 
			& shiftReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st, 0);

			if (bitSlice(instr, 20, 20))
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	}

	const executeOpcode11 = function (instr, mode) { //11 - EOR 0tt1 Rd = Rn XOR Op2
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			let result = registers[rn][registerIndices[mode][rn]] 
			^ shiftReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st, 0);

			if (bitSlice(instr, 20, 20))
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	}

	const executeOpcode12 = function (instr, mode) { //12 - SUB 0tt1 Rd = Rn-Op2
		if (checkCondition(bitSlice(instr, 28, 31)))
		{
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			let secondOperand = shiftReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st, 0);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (bitSlice(instr, 20, 20))
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand > registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	}
	return {
		decode : function (instr) {
			//3322 2222 2222 1111 1111 1100 0000 0000
			//1098 7654 3210 9876 5432 1098 7654 3210
			//xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx

			//stt0 -> use register after shifting with 5 bits
			//0tt1 -> use register after shifting with bottom byte of another register
			//mmmm mmmm -> use 8 bit imm after 4 bit imm shift

			switch (bitSlice(instr, 24, 27)) //MAIN SWITCH
			{
				case 0: //FIRST GROUP OF INSTRUCTIONS
				if (bitSlice(instr, 4, 4))
				{
					if (bitSlice(instr, 7, 7))
					{
						switch (bitSlice(instr, 4, 7))
						{
							case 9: 
							if (bitSlice(instr, 23, 23)) //MULL / MLAL
							{
								return 0;
							}
							else //MUL / MLA
							{ 
								return 1;
							}
							break;

							case 11:
							switch (bitSlice(instr, 20, 22))
							{
								case 0: return 2; break;	//STRH p=0 i=0, check if bits 8 - 11 are set to 0

								case 1: return 3; break;	//LDRH p=0 i=0, check if bits 8 - 11 are set to 0

								case 4: return 4; break;	//STRH p=0 i=1

								case 5: return 5; break;	//LDRH p=0 i=1
							}
							break;

							case 13: 
							switch (bitSlice(instr, 20, 22))
							{

								case 1: return 6; break;	//LDRSB p=0 i=0, check if bits 8 - 11 are set to 0

								case 5: return 7; break;	//LDRSB p=0 i=1
							}
							break;

							case 15:
							switch (bitSlice(instr, 20, 22))
							{

								case 1: return 8; break;	//LDRSH p=0 i=0, check if bits 8 - 11 are set to 0

								case 5: return 9; break;	//LDRSH p=0 i=1
							} 
							break;
						}
					}
					else
					{
						switch (bitSlice(instr, 21, 23))
						{
							case 0: return 10; break;	//AND 0tt1

							case 1: return 11; break;	//EOR 0tt1

							case 2: return 12; break;	//SUB 0tt1 

							case 3: return 13; break;	//RSB 0tt1 

							case 4: return 14; break;	//ADD 0tt1 

							case 5: return 15; break;	//ADC 0tt1 

							case 6: return 16; break;	//SBC 0tt1 

							case 7: return 17; break;	//RSC 0tt1 
						}
					}
				}
				else
				{
					switch (bitSlice(instr, 21, 23))
					{
						case 0: return 18; break;	//AND stt0

						case 1: return 19; break;	//EOR stt0

						case 2: return 20; break;	//SUB stt0 

						case 3: return 21; break;	//RSB stt0 

						case 4: return 22; break;	//ADD stt0 

						case 5: return 23; break;	//ADC stt0 

						case 6: return 24; break;	//SBC stt0 

						case 7: return 25; break;	//RSC stt0 
					}
				}
				break;
				//3322 2222 2222 1111 1111 1100 0000 0000
				//1098 7654 3210 9876 5432 1098 7654 3210
				//xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx
				case 1:
				if (bitSlice(instr, 4, 4))
				{
					if (bitSlice(instr, 7, 7))
					{
						switch (bitSlice(instr, 21, 23))
						{
							case 0: return 26; break;	//TST 0tt1 check if S bit has been set to 1

							case 1: 
							if (bitSlice(instr, 20, 20)) //S bit differentiates TEQ from BRANCH AND EXCHANGE with this parsing
							{
								return 27; //TEQ 0tt1
							}
							else
							{
								return 28; //BRANCH AND EXCHANGE check if a whole bunch of bits are set
							}
							break;

							case 2: return 29; break;	//CMP 0tt1 check if S bit has been set to 1

							case 3: return 30; break;	//CMN 0tt1 check if S bit has been set to 1

							case 4: return 31; break;	//ORR 0tt1 

							case 5: return 32; break;	//MOV 0tt1 check if some bits are set to zero

							case 6: return 33; break;	//BIC 0tt1 

							case 7: return 34; break;	//MVN 0tt1 check if some bits are set to zero
						}
					}
					else
					{
						switch (bitSlice(instr, 5, 6))
						{
							case 0:
							return 35;
							break;	//SWP check if a bunch of bits are zero

							case 1:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 0:
								return 36;
								break;	//STRH p=1 i=0 check if bits are zero 

								case 1:
								return 37;
								break;	//LDRH p=1 i=0 check if bits are zero

								case 2:
								return 38;
								break;	//STRH p=1 i=1

								case 3:
								return 39;
								break;	//LDRH p=1 i=1
							}
							break;

							case 2:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 1:
								return 40;
								break;	//LDRSB p=1 i=0	check if bits are zero

								case 3:
								return 41;
								break;	//LDRSB p=1 i=1
							}
							break;

							case 3:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 1:
								return 42;
								break;	//LDRSH p=1 i=0	check if bits are zero

								case 3:
								return 43;
								break;	//LDRSH p=1 i=1
							}
							break;
						}
					}
				}
				else
				{
					switch(bitSlice(instr, 20, 23))
					{
						case 0:
						case 4:
						return 44;
						break;	//MRS check if a whole bunch of bits are set
						
						case 2:
						case 6:
						return 45;
						break;	//MRS register check if a whole bunch of bits are set

						case 1:
						return 46;
						break;	//TST stt0

						case 3:
						return 47;
						break;	//TEQ stt0

						case 5:
						return 48;
						break;	//CMP stt0

						case 7:
						return 49;
						break;	//CMN stt0

						case 8:
						case 9:
						return 50;
						break;	//ORR stt0

						case 10:
						case 11:
						return 51;
						break;	//MOV stt0 check if some bits are set to zero

						case 12:
						case 13:
						return 52;
						break;	//BIC stt0

						case 14:
						case 15:
						return 53;
						break;	//MVN stt0 check if some bits are set to zero

					}
				}
				break;

				case 2:
				switch (bitSlice(instr, 21, 23))
				{
					case 0: return 54; break;	//AND imm
					case 1: return 55; break;	//EOR imm
					case 2: return 56; break;	//SUB imm 
					case 3: return 57; break;	//RSB imm 
					case 4: return 58; break;	//ADD imm 
					case 5: return 59; break;	//ADC imm 
					case 6: return 60; break;	//SBC imm 
					case 7: return 61; break;	//RSC imm 
				}
				break;

				case 3:
				switch (bitSlice(instr, 21, 23))
				{
					case 0: return 62; break;	//TST imm check if 20th bit zero
					case 1: return bitSlice(instr, 20, 20) === 0 ? 63 : 64; break;	//TEQ imm or MSR imm (if 20th bit is 0)
					case 2: return 65; break;	//CMP imm check if 20th bit zero
					case 3: return bitSlice(instr, 20, 20) === 0 ? 63 : 66; break;	//CMN imm or MSR imm (if 20th bit is 0)
					case 4: return 67; break;	//ORR imm 
					case 5: return 68; break;	//MOV imm check if some bits are set to zero
					case 6: return 69; break;	//BIC imm 
					case 7: return 70; break;	//MVN imm check if some bits are set to zero
				}
				break;

				//LDR / STR i=0
				case 4:
				case 5:
				return 71;
				break;

				//LDR / STR i=1 check if bit is zero
				case 6:
				case 7:
				return 72;
				break;

				//LDM / STM
				case 8:
				case 9:
				return 73;
				break;

				//B / BL
				case 10:
				case 11:
				return 74;
				break;

				//LDC / STC
				case 12:
				case 13:
				return 75;
				break;

				//MRC / MCR	/ CDP
				case 14:
				//return 4th is zero ? CDP : MRC / MCR
				return bitSlice(instr, 4, 4) === 0 ? 76 : 77;
				break;

				//SW INTERRUPT
				case 15:
				return 78;
				break;

			}
			//undefined instruction
			throw Error("encountered undefined instruction!");
		},
		execute : function (instr, opcode, mode) {
			switch (opcode)
			{
				case 0: executeOpcode0(instr, mode); break;
				case 1: executeOpcode1(instr, mode); break;
				case 2: executeOpcode2(instr, mode); break;
				case 3: executeOpcode3(instr, mode); break;
				case 4: executeOpcode4(instr, mode); break;
				case 5: executeOpcode5(instr, mode); break;
				case 6: executeOpcode6(instr, mode); break;
				case 7: executeOpcode7(instr, mode); break;
				case 8: executeOpcode8(instr, mode); break;
				case 9: executeOpcode9(instr, mode); break;
				case 10: executeOpcode10(instr, mode); break;
				case 11: executeOpcode11(instr, mode); break;
				case 12: executeOpcode12(instr, mode); break;
				case 13: executeOpcode13(instr, mode); break;
				case 14: executeOpcode14(instr, mode); break;
				case 15: executeOpcode15(instr, mode); break;
				case 16: executeOpcode16(instr, mode); break;
				case 17: executeOpcode17(instr, mode); break;
				case 18: executeOpcode18(instr, mode); break;
				case 19: executeOpcode19(instr, mode); break;
				case 20: executeOpcode20(instr, mode); break;
				case 21: executeOpcode21(instr, mode); break;
				case 22: executeOpcode22(instr, mode); break;
				case 23: executeOpcode23(instr, mode); break;
				case 24: executeOpcode24(instr, mode); break;
				case 25: executeOpcode25(instr, mode); break;
				case 26: executeOpcode26(instr, mode); break;
				case 27: executeOpcode27(instr, mode); break;
				case 28: executeOpcode28(instr, mode); break;
				case 29: executeOpcode29(instr, mode); break;
				case 30: executeOpcode30(instr, mode); break;
				case 31: executeOpcode31(instr, mode); break;
				case 32: executeOpcode32(instr, mode); break;
				case 33: executeOpcode33(instr, mode); break;
				case 34: executeOpcode34(instr, mode); break;
				case 35: executeOpcode35(instr, mode); break;
				case 36: executeOpcode36(instr, mode); break;
				case 37: executeOpcode37(instr, mode); break;
				case 38: executeOpcode38(instr, mode); break;
				case 39: executeOpcode39(instr, mode); break;
				case 40: executeOpcode40(instr, mode); break;
				case 41: executeOpcode41(instr, mode); break;
				case 42: executeOpcode42(instr, mode); break;
				case 43: executeOpcode43(instr, mode); break;
				case 44: executeOpcode44(instr, mode); break;
				case 45: executeOpcode45(instr, mode); break;
				case 46: executeOpcode46(instr, mode); break;
				case 47: executeOpcode47(instr, mode); break;
				case 48: executeOpcode48(instr, mode); break;
				case 49: executeOpcode49(instr, mode); break;
				case 50: executeOpcode50(instr, mode); break;
				case 51: executeOpcode51(instr, mode); break;
				case 52: executeOpcode52(instr, mode); break;
				case 53: executeOpcode53(instr, mode); break;
				case 54: executeOpcode54(instr, mode); break;
				case 55: executeOpcode55(instr, mode); break;
				case 56: executeOpcode56(instr, mode); break;
				case 57: executeOpcode57(instr, mode); break;
				case 58: executeOpcode58(instr, mode); break;
				case 59: executeOpcode59(instr, mode); break;
				case 60: executeOpcode60(instr, mode); break;
				case 61: executeOpcode61(instr, mode); break;
				case 62: executeOpcode62(instr, mode); break;
				case 63: executeOpcode63(instr, mode); break;
				case 64: executeOpcode64(instr, mode); break;
				case 65: executeOpcode65(instr, mode); break;
				case 66: executeOpcode66(instr, mode); break;
				case 67: executeOpcode67(instr, mode); break;
				case 68: executeOpcode68(instr, mode); break;
				case 69: executeOpcode69(instr, mode); break;
				case 70: executeOpcode70(instr, mode); break;
				case 71: executeOpcode71(instr, mode); break;
				case 72: executeOpcode72(instr, mode); break;
				case 73: executeOpcode73(instr, mode); break;
				case 74: executeOpcode74(instr, mode); break;
				case 75: executeOpcode75(instr, mode); break;
				case 76: executeOpcode76(instr, mode); break;
				case 77: executeOpcode77(instr, mode); break;
				case 78: executeOpcode78(instr, mode); break;
				default: throw Error("invalid thumb opcode: " + opcode);
			}
	}
}