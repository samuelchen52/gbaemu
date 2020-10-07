const arm = function(mmu, registers, changeState, changeMode, setNZCV, setPipelineResetFlag, registerIndices) {
	
	let shiftCarryFlag = undefined;

	const shiftRegByImm = function (register, shiftamt, type) {
		if (shiftamt === 0)
		{
			if (type === 0) //LSL #0, do nothing
			{
				shiftCarryFlag = undefined;
				return register;
			}
			else
			{
				shiftamt = 32; //LSR, ASR, ROR #0 -> LSR, ASR, ROR #32
			}
		}

		switch(type)
		{
			case 0: //LSL #[1,31]
			shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
			return register << shiftamt;
			break;

			case 1: //LSR #[1,32]
			shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return shiftamt === 32 ? 0 : register >>> shiftamt;
			break;

			case 2: //ASR #[1,32]
			shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return shiftamt === 32 ? (shiftCarryFlag === 1 ? 0xFFFFFFFF : 0) : register >> shiftamt;
			break;

			case 3: //ROR #[1,32]
			shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return rotateRight(register, shiftamt);
			break;

			default:
			throw Error("invalid shift type!");
		}
	}

	//shiftamt will be contained in bottom byte of a register (0 - 255)
	const shiftRegByReg = function (register, shiftamt, type) {
		//if shift register bottom byte is zero, do nothing
		if (shiftamt === 0)
		{
			shiftCarryFlag = undefined;
			return register;
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
			else //1-32
			{ 
				shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
				return shiftamt === 32 ? 0 : register << shiftamt;
			}
			break;

			case 1: //LSR
			if (gt32)
			{
				shiftCarryFlag = 0;
				return 0;
			}
			else //1-32
			{
				shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
				return shiftamt === 32 ? 0 : register >>> shiftamt;
			}
			break;

			case 2: //ASR
			if (gt32 || (shiftamt === 32))
			{
				shiftCarryFlag = register >>> 31;
				return shiftCarryFlag ? 4294967295 : 0; //2 ^ 32 - 1 === 4294967295
			}
			else //1-31
			{
				shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
				return register >> shiftamt;
			}
			break;

			case 3: //ROR
			shiftamt %= 32;
			if (shiftamt === 0) //if shiftamt is zero here, then it was a multiple of 32
			{
				shiftCarryFlag = register >>> 31;
				return register;
			}
			else//1-31
			{
				shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
				return rotateRight(register, shiftamt);
			}
			break;

			default:
			throw Error("invalid shift type!");
		}

	}

	//returns true if condition is met
	const checkCondition = function (condition)
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
			case 13: return (((flags & 0x8) !== (flags & 0x1)) || (flags & 0x4)) ? true : false; //BLE N<>V or Z=1
			break;
			case 14: return true;
			break;
			case 15: return false;
			break;
		}
		return true;
		throw Error("condition wasnt a 4 bit number?");
	}

	//ARM[5]-----------------------------------------------------------------------------------------------------
	const executeOpcode0 = function (instr, mode) { //0 - UMULL / UMLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
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
				setNZCV((result & 0x8000000000000000n) != 0, result == 0);
			}
			registers[rdhi][registerIndices[mode][rdhi]] = Number(result >> 32n);
			registers[rdlo][registerIndices[mode][rdlo]] = Number(result & 0xFFFFFFFFn);
		}
	

	const executeOpcode1 = function (instr, mode) { //1 - MUL / MLA Rd=Rm*Rs Rd=Rm*Rs+Rn
			let rd = bitSlice(instr, 16, 19);
			let rn = bitSlice(instr, 12, 15);
			let rs = bitSlice(instr, 8, 11);
			let rm = bitSlice(instr, 0, 3);

			let result = BigInt(registers[rm][registerIndices[mode][rm]]) * BigInt(registers[rs][registerIndices[mode][rs]]);
			if (bitSlice(instr, 21, 21)) //accumulate bit
			{
				result += BigInt(registers[rn][registerIndices[mode][rn]]);
			}
			result = Number(result & 0xFFFFFFFFn);

			if (bitSlice(instr, 20, 20))
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, true);
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[8]-----------------------------------------------------------------------------------------------------
	//p = 0 -> post, add offset after transfer (writeback is always enabled)
	//i = 0 -> register offset
	//i = 1 -> imm offset
	//writeback -> write address into base
	const executeOpcode2 = function (instr, mode) { //2 - STRH p=0 i=0 [a]=Rd
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			mmu.write16(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
		}
	

	const executeOpcode3 = function (instr, mode) { //3 - LDRH p=0 i=0 Load Unsigned halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let data = mmu.read16(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE);
			registers[rd][registerIndices[mode][rd]] = data;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
		}
	

	const executeOpcode4 = function (instr, mode) { //4 - STRH p=0 i=1 [a]=Rd
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			mmu.write16(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
		}
	

	const executeOpcode5 = function (instr, mode) { //5 - LDRH p=0 i=1 Load Unsigned halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			//console.log(registers[rn][registerIndices[mode][rn]].toString(16));
			let data = mmu.read16(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE);
			registers[rd][registerIndices[mode][rd]] = data;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
		}
	

	const executeOpcode6 = function (instr, mode) { //6 - LDRSB p=0 i=0 Load Signed Byte
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let byte = mmu.read8(registers[rn][registerIndices[mode][rn]]);
			byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
			registers[rd][registerIndices[mode][rd]] = byte;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);

		}
	

	const executeOpcode7 = function (instr, mode) { //7 - LDRSB p=0 i=1 Load Signed Byte
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let byte = mmu.read8(registers[rn][registerIndices[mode][rn]]);
			byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
			registers[rd][registerIndices[mode][rd]] = byte;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}
			
			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);

		}
	

	const executeOpcode8 = function (instr, mode) { //8 - LDRSH p=0 i=0 Load Signed halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let halfword = mmu.read16(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE);
			halfword += halfword & 32768 ? 0xFFFF0000 : 0; //sign extend halfword
			registers[rd][registerIndices[mode][rd]] = halfword;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);

		}
	

	const executeOpcode9 = function (instr, mode) { //9 - LDRSH p=0 i=1 Load Signed halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

			let halfword = mmu.read16(registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFE);
			halfword += halfword & 32768 ? 0xFFFF0000 : 0; //sign extend halfword
			registers[rd][registerIndices[mode][rd]] = halfword;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);

		}
	

	//ARM[4]------------------------second operand register, shifted by register (opcodes 0 - 7)-----------------
	const executeOpcode10 = function (instr, mode) { //10 - AND 0tt1 Rd = Rn AND Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let result = registers[rn][registerIndices[mode][rn]] 
			& shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode11 = function (instr, mode) { //11 - EOR 0tt1 Rd = Rn XOR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let result = registers[rn][registerIndices[mode][rn]] 
			^ shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode12 = function (instr, mode) { //12 - SUB 0tt1 Rd = Rn-Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode13 = function (instr, mode) { //13 - RSB 0tt1 Rd = Op2-Rn
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = (secondOperand - registers[rn][registerIndices[mode][rn]]) & 0xFFFFFFFF;

			let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, registers[rn][registerIndices[mode][rn]] <= secondOperand, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode14 = function (instr, mode) { //14 - ADD 0tt1 Rd = Rn+Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = registers[rn][registerIndices[mode][rn]] + secondOperand;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode15 = function (instr, mode) { //15 - ADC 0tt1 Rd = Rn+Op2+Cy
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = registers[rn][registerIndices[mode][rn]] + secondOperand + carryFlag;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode16 = function (instr, mode) { //16 - SBC 0tt1 Rd = Rn-Op2+Cy-1
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= registers[rn][registerIndices[mode][rn]] + carryFlag, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode17 = function (instr, mode) { //17 - RSC 0tt1 Rd = Op2-Rn+Cy-1
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = (secondOperand - registers[rn][registerIndices[mode][rn]]  + carryFlag - 1) & 0xFFFFFFFF;

			let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]] + carryFlag - 1, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, (registers[rn][registerIndices[mode][rn]] + 1) <= secondOperand + carryFlag, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[4]------------------------second operand register, shifted by IMM (opcodes 0 - 7)-----------------
	const executeOpcode18 = function (instr, mode) { //18 - AND stt0 Rd = Rn AND Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] 
			& shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode19 = function (instr, mode) { //19 - EOR stt0 Rd = Rn XOR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] 
			^ shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode20 = function (instr, mode) { //20 - SUB stt0 Rd = Rn-Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode21 = function (instr, mode) { //21 - RSB stt0 Rd = Op2-Rn
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = (secondOperand - registers[rn][registerIndices[mode][rn]]) & 0xFFFFFFFF;

			let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, registers[rn][registerIndices[mode][rn]] <= secondOperand, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode22 = function (instr, mode) { //22 - ADD stt0 Rd = Rn+Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = registers[rn][registerIndices[mode][rn]] + secondOperand;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode23 = function (instr, mode) { //23 - ADC stt0 Rd = Rn+Op2+Cy
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = registers[rn][registerIndices[mode][rn]] + secondOperand + carryFlag;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode24 = function (instr, mode) { //24 - SBC stt0 Rd = Rn-Op2+Cy-1
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= registers[rn][registerIndices[mode][rn]] + carryFlag , (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode25 = function (instr, mode) { //25 - RSC stt0 Rd = Op2-Rn+Cy-1
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = (secondOperand - registers[rn][registerIndices[mode][rn]]  + carryFlag - 1) & 0xFFFFFFFF;

			let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]] + carryFlag - 1, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, (registers[rn][registerIndices[mode][rn]] + 1) <= secondOperand + carryFlag, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[4]-----------second operand register, shifted by register (opcodes 8 - 15)---------- & ARM[2]----------------------------------------
	const executeOpcode26 = function (instr, mode) { //26 - TST 0tt1 Void = Rn AND Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			registers[15][0] += 4;

			let result = registers[rn][registerIndices[mode][rn]] 
			& shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			registers[15][0] -= 4;

			setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
		}
	

	const executeOpcode27 = function (instr, mode) { //27 - TEQ 0tt1 Void = Rn XOR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			registers[15][0] += 4;

			let result = registers[rn][registerIndices[mode][rn]] 
			^ shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			registers[15][0] -= 4;

			setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
		}
	

	const executeOpcode28 = function (instr, mode) { //28 - BX PC=Rn T=Rn[0]
			let rn = bitSlice(instr, 0, 3);

			if (registers[rn][registerIndices[mode][rn]] & 1)
			{
				registers[15][0] = registers[rn][registerIndices[mode][rn]] - 1; //clear bit 0
				changeState("THUMB");
			}
			else
			{
				registers[15][0] = registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFC; //clear bottom two bits
			}
			setPipelineResetFlag();
		}
	

	const executeOpcode29 = function (instr, mode) { //29 - CMP 0tt1 Void = Rn-Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			registers[15][0] -= 4;

			setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
		}
	

	const executeOpcode30 = function (instr, mode) { //30 - CMN 0tt1 Void = Rn+Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type

			registers[15][0] += 4;

			let secondOperand = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);
			let result = registers[rn][registerIndices[mode][rn]] + secondOperand;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

 			registers[15][0] -= 4;

			setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
		}
	

	const executeOpcode31 = function (instr, mode) { //31 - ORR 0tt1 Rd = Rn OR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let result = registers[rn][registerIndices[mode][rn]] 
			| shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode32 = function (instr, mode) { //32 - MOV 0tt1 Rd = Op2
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let result = shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode33 = function (instr, mode) { //33 - BIC 0tt1 Rd = Rn AND NOT Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let result = registers[rn][registerIndices[mode][rn]] 
			& ~shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode34 = function (instr, mode) { //34 - MVN 0tt1 Rd = NOT Op2
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			registers[15][0] += 4;

			let result = ~shiftRegByReg(registers[rm][registerIndices[mode][rm]], registers[rs][registerIndices[mode][rs]], st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			else
			{
				registers[15][0] -= 4;
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[10]------------------------------------------------------------------------------------------------
	const executeOpcode35 = function (instr, mode) { //35 - SWP Rd=[Rn], [Rn]=Rm
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3);
			let b = bitSlice(instr, 22, 22) ? 1 : 4;
			let mask = (b === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);

			let data = mmu.read(registers[rn][registerIndices[mode][rn]] & mask, b); //LDR
			data = rotateRight(data, (registers[rn][registerIndices[mode][rn]] & 3) << 3);
			registers[rd][registerIndices[mode][rd]] = data;

			mmu.write(registers[rn][registerIndices[mode][rn]] & mask, registers[rm][registerIndices[mode][rm]], b); //STR
		}
	

	//ARM[8]-----------------------------------------------------------------------------------------------------
	//p = 1 -> pr, add offset before transfer
	//i = 0 -> register offset
	//i = 1 -> imm offset
	//writeback -> write address into base
	const executeOpcode36 = function (instr, mode) { //36 - STRH p=1 i=0 [a]=Rd
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			mmu.write16((registers[rn][registerIndices[mode][rn]] + registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1)) & 0xFFFFFFFE, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
			}
		}
	

	const executeOpcode37 = function (instr, mode) { //37 - LDRH p=1 i=0 Load Unsigned halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			let data = mmu.read16((registers[rn][registerIndices[mode][rn]] + registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1)) & 0xFFFFFFFE);
			registers[rd][registerIndices[mode][rd]] = data;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
			}
		}
	

	const executeOpcode38 = function (instr, mode) { //38 - STRH p=1 i=1 [a]=Rd
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			mmu.write16((registers[rn][registerIndices[mode][rn]] + offset * (u ? 1 : -1)) & 0xFFFFFFFE, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
			}
		}
	

	const executeOpcode39 = function (instr, mode) { //39 - LDRH p=1 i=1 Load Unsigned halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			let data = mmu.read16((registers[rn][registerIndices[mode][rn]] + offset * (u ? 1 : -1)) & 0xFFFFFFFE);
			registers[rd][registerIndices[mode][rd]] = data;

			// console.log("base: " + rn);
			// console.log("offset: " + offset);
			// console.log("dest: " + rd);
			// console.log("addr: " + (registers[rn][registerIndices[mode][rn]] + offset * (u ? 1 : -1)).toString(16));
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
			}
		}
	

	const executeOpcode40 = function (instr, mode) { //40 - LDRSB p=1 i=0 Load Signed Byte
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			let byte = mmu.read8(registers[rn][registerIndices[mode][rn]] + registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1));
			byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
			registers[rd][registerIndices[mode][rd]] = byte;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
			}
		}
	

	const executeOpcode41 = function (instr, mode) { //41 - LDRSB p=1 i=1 Load Signed Byte
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			let byte = mmu.read8(registers[rn][registerIndices[mode][rn]] + offset * (u ? 1 : -1));
			byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
			registers[rd][registerIndices[mode][rd]] = byte;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}
			
			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
			}

		}
	

	const executeOpcode42 = function (instr, mode) { //42 - LDRSH p=1 i=0 Load Signed halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 8, 11); //offset
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			let halfword = mmu.read16((registers[rn][registerIndices[mode][rn]] + registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1)) & 0xFFFFFFFE);
			halfword += halfword & 32768 ? 0xFFFF0000 : 0; //sign extend halfword
			registers[rd][registerIndices[mode][rd]] = halfword;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += registers[rm][registerIndices[mode][rm]] * (u ? 1 : -1);
			}

		}
	

	const executeOpcode43 = function (instr, mode) { //43 - LDRSH p=1 i=1 Load Signed halfword
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
			let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
			let w = bitSlice(instr, 21, 21); //writeback

			let halfword = mmu.read16((registers[rn][registerIndices[mode][rn]] + offset * (u ? 1 : -1)) & 0xFFFFFFFE);
			halfword += halfword & 32768 ? 0xFFFF0000 : 0; //sign extend halfword
			registers[rd][registerIndices[mode][rd]] = halfword;
			if (rd === 15)
			{
				setPipelineResetFlag();
			}

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] += offset * (u ? 1 : -1);
			}

		}
	

	//ARM[6]-----------------------------------------------------------------------------------------------------
	const executeOpcode44 = function (instr, mode) { //44 - MRS Rd = Psr
			let psrBit = bitSlice(instr, 22, 22);
			let rd = bitSlice(instr, 12, 15);

			registers[rd][registerIndices[mode][rd]] = registers[16 + psrBit][registerIndices[mode][16 + psrBit]];
			if (registers[rd][registerIndices[mode][rd]] === undefined)
			{
				throw Error("trying to access PSR in MRS with psr bit set when in USER/SYSTEM MODE");
			}
		}
	
	const executeOpcode45 = function (instr, mode) { //45 - MSR register Psr[field] = Op
			let psrBit = bitSlice(instr, 22, 22);
			let rd = bitSlice(instr, 12, 15);
			let fsxc = bitSlice(instr, 16, 19);
			let p = bitSlice(registers[16][0], 0, 4) === 16 ? 0 : 1; //privileged

			let op = registers[bitSlice(instr, 0, 3)][registerIndices[mode][bitSlice(instr, 0, 3)]];
			let psr = registers[16 + psrBit][registerIndices[mode][16 + psrBit]];
			if (psr === undefined)
			{
				throw Error("trying to change PSR in MSR with psr bit set when in USER/SYSTEM MODE");
			}

			if (fsxc & 0x8) //set CPSR_flg
			{
				psr = (psr & 0x00FFFFFF) + (op & 0xFF000000);
			}
			if ((fsxc & 0x4) && (p)) //set CPSR_res_1 (shouldnt be used)
			{
				psr = (psr & 0xFF00FFFF) + (op & 0x00FF0000);
			}
			if ((fsxc & 0x2) && (p)) //set CPSR_res_2 (shouldnt be used)
			{
				psr = (psr & 0xFFFF00FF) + (op & 0x0000FF00);
			}
			if ((fsxc & 0x1) && (p)) //set CPSR_ctl
			{
				psr = (psr & 0xFFFFFF20) + (op & 0x000000DF); //20 -> 00100000 DF -> 11011111 to keep the t bit intact
				if (!psrBit)
				{
					changeMode(psr & 31);
				}

			}

			registers[16 + psrBit][registerIndices[mode][16 + psrBit]] = psr;
		}
	

	//ARM[4]-----------second operand register, shifted by IMM(opcodes 8 - 15)----------------------------------------------------------
	const executeOpcode46 = function (instr, mode) { //46 - TST stt0 Void = Rn AND Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type

			let result = registers[rn][registerIndices[mode][rn]] 
			& shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
		}
	

	const executeOpcode47 = function (instr, mode) { //47 - TEQ stt0 Void = Rn XOR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type

			let result = registers[rn][registerIndices[mode][rn]] 
			^ shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
		}
	


	const executeOpcode48 = function (instr, mode) { //48 - CMP stt0 Void = Rn-Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
		}
	

	const executeOpcode49 = function (instr, mode) { //49 - CMN stt0 Void = Rn+Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type

			let secondOperand = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);
			let result = registers[rn][registerIndices[mode][rn]] + secondOperand;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
		}
	

	const executeOpcode50 = function (instr, mode) { //50 - ORR stt0 Rd = Rn OR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] 
			| shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode51 = function (instr, mode) { //51 - MOV stt0 Rd = Op2
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let result = shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode52 = function (instr, mode) { //52 - BIC stt0 Rd = Rn AND NOT Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] 
			& ~shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode53 = function (instr, mode) { //53 - MVN stt0 Rd = NOT Op2
			let rd = bitSlice(instr, 12, 15);
			let rm = bitSlice(instr, 0, 3); //second operand
			let imm = bitSlice(instr, 7, 11); //shift amt (imm)
			let st = bitSlice(instr, 5, 6); //shift type
			let s = bitSlice(instr, 20, 20);

			let result = ~shiftRegByImm(registers[rm][registerIndices[mode][rm]], imm, st);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[4]------------------------second operand IMM (opcodes 0 - 7)---------------------------------
	const executeOpcode54 = function (instr, mode) { //54 - AND imm Rd = Rn AND Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] & secondOperand;

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode55 = function (instr, mode) { //55 - EOR imm Rd = Rn XOR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] ^ secondOperand;

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode56 = function (instr, mode) { //56 - SUB imm Rd = Rn-Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode57 = function (instr, mode) { //57 - RSB imm Rd = Op2-Rn
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = (secondOperand - registers[rn][registerIndices[mode][rn]]) & 0xFFFFFFFF;

			let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, registers[rn][registerIndices[mode][rn]] <= secondOperand, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode58 = function (instr, mode) { //58 - ADD imm Rd = Rn+Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] + secondOperand;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode59 = function (instr, mode) { //59 - ADC imm Rd = Rn+Op2+Cy
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			let result = registers[rn][registerIndices[mode][rn]] + secondOperand + carryFlag;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode60 = function (instr, mode) { //60 - SBC imm Rd = Rn-Op2+Cy-1
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= registers[rn][registerIndices[mode][rn]] + carryFlag , (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode61 = function (instr, mode) { //61 - RSC imm Rd = Op2-Rn+Cy-1
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);
			let carryFlag = bitSlice(registers[16][0], 29, 29);

			let result = (secondOperand - registers[rn][registerIndices[mode][rn]]  + carryFlag - 1) & 0xFFFFFFFF;

			let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]] + carryFlag - 1, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, (registers[rn][registerIndices[mode][rn]] + 1) <= secondOperand + carryFlag, (vflag === 0) || (vflag === 3));
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[4]-----------second operand IMM (opcodes 8 - 15)-------------------------------------------------------- & ARM[6]----------------------------------------
	const executeOpcode62 = function (instr, mode) { //62 - TST imm Void = Rn AND Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

			let result = registers[rn][registerIndices[mode][rn]] & secondOperand;

			setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
		}
	

	const executeOpcode63 = function (instr, mode) { //63 - MSR imm Psr[field] = Op
			let psrBit = bitSlice(instr, 22, 22);
			let rd = bitSlice(instr, 12, 15);
			let fsxc = bitSlice(instr, 16, 19);
			let p = bitSlice(registers[16][0], 0, 4) === 16 ? 0 : 1; //privileged

			let op = rotateRight(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1);
			let psr = registers[16 + psrBit][registerIndices[mode][16 + psrBit]];
			if (psr === undefined)
			{
				throw Error("trying to change PSR in MSR with psr bit set when in USER/SYSTEM MODE");
			}

			if (fsxc & 0x8) //set CPSR_flg
			{
				psr = (psr & 0x00FFFFFF) + (op & 0xFF000000);
			}
			if ((fsxc & 0x4) && (p)) //set CPSR_res_1 (shouldnt be used)
			{
				psr = (psr & 0xFF00FFFF) + (op & 0x00FF0000);
			}
			if ((fsxc & 0x2) && (p)) //set CPSR_res_2 (shouldnt be used)
			{
				psr = (psr & 0xFFFF00FF) + (op & 0x0000FF00);
			}
			if ((fsxc & 0x1) && (p)) //set CPSR_ctl
			{
				psr = (psr & 0xFFFFFF20) + (op & 0x000000DF);  //20 -> 00100000 DF -> 11011111 to keep the t bit intact
				if (!psrBit)
				{
					changeMode(psr & 31);
				}
			}

			registers[16 + psrBit][registerIndices[mode][16 + psrBit]] = psr;
		}
	

	const executeOpcode64 = function (instr, mode) { //64 - TEQ imm Void = Rn XOR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

			let result = registers[rn][registerIndices[mode][rn]] ^ secondOperand;

			setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
		}
	

	const executeOpcode65 = function (instr, mode) { //65 - CMP imm Void = Rn-Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

			let result = (registers[rn][registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

			setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= registers[rn][registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
		}
	

	const executeOpcode66 = function (instr, mode) { //66 - CMN imm Void = Rn+Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

			let result = registers[rn][registerIndices[mode][rn]] + secondOperand;

 			let vflag = bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

			setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
		}
	

	const executeOpcode67 = function (instr, mode) { //67 - ORR imm Rd = Rn OR Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] | secondOperand;

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode68 = function (instr, mode) { //68 - MOV imm  Rd = Op2
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);	

			let result = secondOperand;

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode69 = function (instr, mode) { //69 - BIC imm Rd = Rn AND NOT Op2
			let rn = bitSlice(instr, 16, 19);
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = registers[rn][registerIndices[mode][rn]] & ~secondOperand;

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	const executeOpcode70 = function (instr, mode) { //70 - MVN imm Rd = NOT Op2
			let rd = bitSlice(instr, 12, 15);
			let secondOperand = shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
			let s = bitSlice(instr, 20, 20);

			let result = ~secondOperand;

			if (s)
			{
				setNZCV(bitSlice(result, 31, 31), result === 0, shiftCarryFlag);
			}
			if (rd === 15)
			{
				setPipelineResetFlag();
				if (s) //set CPSR to SPSR_current_mode
				{
					registers[16][0] = registers[17][registerIndices[mode][17]];
				}
			}
			registers[rd][registerIndices[mode][rd]] = result;
		}
	

	//ARM[7]-------------------------------------------------------------------------------------------------------------------------------------------------------
	const executeOpcode71 = function (instr, mode) { //71 - LDR / STR i=0
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let offset = bitSlice(instr, 0, 11); //imm offset
			let p = bitSlice(instr, 24, 24); //pre/post
			let sign = bitSlice(instr, 23, 23) ? 1 : -1; //0 = subtract, 1 = add
			let size = bitSlice(instr, 22, 22) ? 1 : 4; //byte / word
			let mask = (size === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);
			let w = bitSlice(instr, 21, 21); //writeback

			//console.log("base: " + rn);
			//console.log("offset: " + offset);
			//console.log("size: " + size);
			//console.log("dest: " + rd);


			if (bitSlice(instr, 20, 20)) //LDR
			{
				if (!p) //add offset after (writeback always enabled)
				{
					let addr = registers[rn][registerIndices[mode][rn]];
					//console.log("addr1: " + addr.toString(16));
					let data = mmu.read(addr & mask, size);
					if (size === 4)
					data = rotateRight(data, (addr & 3) << 3);
					registers[rd][registerIndices[mode][rd]] = data;

					registers[rn][registerIndices[mode][rn]] += sign * offset;
				}
				else //add offset before (check if writeback enabled)
				{
					let addr = (registers[rn][registerIndices[mode][rn]] + (offset * sign));
					//console.log("addr2: " + addr.toString(16));
					let data = mmu.read(addr & mask, size);
					if (size === 4)
					data = rotateRight(data, (addr & 3) << 3);
					registers[rd][registerIndices[mode][rd]] = data;

					if (w)
					{
						registers[rn][registerIndices[mode][rn]] += sign * offset;
					}
				}

				if (rd === 15)
				{
					setPipelineResetFlag();
				}
			}
			else //STR
			{
				if (!p) //add offset after (writeback always enabled)
				{
					mmu.write(registers[rn][registerIndices[mode][rn]] & mask, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0), size);
					registers[rn][registerIndices[mode][rn]] += sign * offset;
				}
				else //add offset before (check if writeback enabled)
				{
					mmu.write((registers[rn][registerIndices[mode][rn]] + offset * sign) & mask, registers[rd][registerIndices[mode][rd]]  + (rd === 15 ? 4 : 0), size);
					if (w)
					{
						registers[rn][registerIndices[mode][rn]] += sign * offset;
					}
				}
			}
		}
	

	const executeOpcode72 = function (instr, mode) { //72 - LDR / STR i=1
			let rn = bitSlice(instr, 16, 19); //base
			let rd = bitSlice(instr, 12, 15); //destination
			let rm = bitSlice(instr, 0 ,3); //offset reg
			let offset = shiftRegByImm(registers[rm][registerIndices[mode][rm]], bitSlice(instr, 7, 11), bitSlice(instr, 5, 6), 1); //register shifted by imm as offset
			let p = bitSlice(instr, 24, 24); //pre/post
			let sign = bitSlice(instr, 23, 23) ? 1 : -1; //0 = subtract, 1 = add
			let size = bitSlice(instr, 22, 22) ? 1 : 4; //byte / word
			let mask = (size === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);
			let w = bitSlice(instr, 21, 21); //writeback

			if (bitSlice(instr, 20, 20)) //LDR
			{
				if (!p) //add offset after (writeback always enabled)
				{
					let addr = registers[rn][registerIndices[mode][rn]]
					let data = mmu.read(addr & mask, size);
					if (size === 4)
					data = rotateRight(data, (addr & 3) << 3);
					registers[rd][registerIndices[mode][rd]] = data;

					registers[rn][registerIndices[mode][rn]] += sign * offset;
				}
				else //add offset before (check if writeback enabled)
				{
					let addr = registers[rn][registerIndices[mode][rn]] + offset * sign;
					let data = mmu.read(addr & mask, size);
					if (size === 4)
					data = rotateRight(data, (addr & 3) << 3);
					registers[rd][registerIndices[mode][rd]] = data;

					if (w)
					{
						registers[rn][registerIndices[mode][rn]] += sign * offset;
					}
				}

				if (rd === 15)
				{
					setPipelineResetFlag();
				}
			}
			else //STR
			{
				if (!p) //add offset after (writeback always enabled)
				{
					mmu.write(registers[rn][registerIndices[mode][rn]] & mask, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0), size);
					registers[rn][registerIndices[mode][rn]] += sign * offset;
				}
				else //add offset before (check if writeback enabled)
				{
					mmu.write((registers[rn][registerIndices[mode][rn]] + offset * sign) & mask, registers[rd][registerIndices[mode][rd]] + (rd === 15 ? 4 : 0), size);
					if (w)
					{
						registers[rn][registerIndices[mode][rn]] += sign * offset;
					}
				}
			}
		}
	

	//ARM[9]-------------------------------------------------------------------------------------------------------------------------------------------------------
	//IB p = 1 u = 1 -> descending empty stack
	//IA p = 0 u = 1 -> descending full stack
	//DB p = 1 u = 0 -> ascending empty stack
	//DA p = 0 u = 0 -> ascending full stack
	const executeOpcode73 = function (instr, mode) { //73 - LDM / STM 
			let p = bitSlice(instr, 24, 24);
			let incramt = bitSlice(instr, 23, 23) ? 4 : -4;
			let s = bitSlice(instr, 22, 22);
			let w = bitSlice(instr, 21, 21); //if set, writeback final address into rn
			let rn = bitSlice(instr, 16, 19); //base address
			let rlist = bitSlice(instr, 0, 15); //register list, each bit corresponds to register (by position)
			let l = bitSlice(instr, 20, 20);

			let addr = registers[rn][registerIndices[mode][rn]] & 0xFFFFFFFC;

			// console.log("rn: " + rn);
			// console.log("incramt: " + incramt);
			// console.log("rlist: " + rlist);
			// console.log("writeback ?" + w);
			// console.log("increment after? " + p);

			if (!rlist) //empty rlist strange effect
			{
				instr &= 0xFFFF7FFF; //11111111111111110111111111111111 -> insert r15 into rlist
				incramt <<= 4; //
				if (l)
				{
					setPipelineResetFlag();
				}
			}

			if (l) //LDM
			{
				if (p) //IB/DB
				{
					addr += incramt;
				}

				if (incramt === 4) //start from bottom of list
				{
					for (let i = 0; i <= 15; i++)
					{
						if (bitSlice(instr, i, i))
						{
							//console.log(addr.toString(16));
							registers[i][registerIndices[mode][i]] = mmu.read32(addr);
							addr += incramt;
						}
					}
				}
				else 
				{
					for (let i = 15; i >= 0; i--) //start from top of list
					{
						if (bitSlice(instr, i, i))
						{
							registers[i][registerIndices[mode][i]] = mmu.read32(addr);
							addr += incramt;
						}
					}
				}

				if (p)
				{
					addr -= incramt;
				}
			}
			else //STM
			{
				if (p) //IB/DB
				{
					addr += incramt;
				}

				if (incramt === 4) //start from bottom of list
				{
					for (let i = 0; i <= 15; i++)
					{
						if (bitSlice(instr, i, i))
						{
							//console.log("pushing " + i + "...")
							mmu.write32(addr, registers[i][registerIndices[mode][i]]);
							addr += incramt;
						}
					}
				}
				else
				{
					for (let i = 15; i >= 0; i--) //start from top of list
					{
						//console.log(addr.toString(16));
						if (bitSlice(instr, i, i))
						{
							//console.log("pushing " + i + " to mem addr 0x" + addr.toString(16));
							mmu.write32(addr, registers[i][registerIndices[mode][i]]);
							addr += incramt;
						}
					}
				}

				if (p)
				{
					addr -= incramt;
				}
			}

			if (w)
			{
				registers[rn][registerIndices[mode][rn]] = addr;
			}

		}
	
	//ARM[1]-------------------------------------------------------------------------------------------------------------------------------------------------------
	const executeOpcode74 = function (instr, mode) { //74 - B / BL
			let signedOffset = bitSlice(instr, 0 , 23);
			if (signedOffset >>> 23)
			{
				signedOffset = -1 * ((~(signedOffset - 1)) & 0xFFFFFF);
			}

			if (bitSlice(instr, 24, 24)) //BL, set link register
			{
				registers[14][registerIndices[mode][14]] = registers[15][registerIndices[mode][15]] - 4;
			}
			
			registers[15][registerIndices[mode][15]] += (signedOffset << 2);
			setPipelineResetFlag();
		}
	
	//ARM[11]-------------------------------------------------------------------------------------------------------------------------------------------------------
	const executeOpcode75 = function (instr, mode) { //75 - LDC / STC
		//gba does not use this instruction
	}

	const executeOpcode76 = function (instr, mode) { //76 - CDP
		//gba does not use this instruction
	}

	const executeOpcode77 = function (instr, mode) { //77 - MRC / MCR
		//gba does not use this instruction
	}

	//ARM[11]-------------------------------------------------------------------------------------------------------------------------------------------------------
	const executeOpcode78 = function (instr, mode) { //78 - SWI
		
	}

	//ARM[5]-----------------------------------------------------------------------------------------------------
	const executeOpcode79 = function (instr, mode) { //79 - SMULL / SMLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
			let rdhi = bitSlice(instr, 16, 19);
			let rdlo = bitSlice(instr, 12, 15);
			let rs = bitSlice(instr, 8, 11);
			let rm = bitSlice(instr, 0, 3);

			let result = BigInt(registers[rm][registerIndices[mode][rm]] >> 0) * BigInt(registers[rs][registerIndices[mode][rs]] >> 0);
			if (bitSlice(instr, 21, 21)) //accumulate bit
			{
				result += (BigInt(registers[rdhi][registerIndices[mode][rdhi]]) << 32n) + BigInt(registers[rdlo][registerIndices[mode][rdlo]]);
			}

			if (bitSlice(instr, 20, 20))
			{
				setNZCV((result & 0x8000000000000000n) != 0, result == 0);
			}
			registers[rdhi][registerIndices[mode][rdhi]] = Number(result >> 32n);
			registers[rdlo][registerIndices[mode][rdlo]] = Number(result & 0xFFFFFFFFn);
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
							switch (bitSlice(instr, 22, 23))
							{
								case 0: return 1; break;	//MUL / MLA

								case 2: return 0; break;	//UMULL / UMLAL

								case 3: return 79; break;	//SMULL / SMLAL
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
					if (!bitSlice(instr, 7, 7))
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
							switch ((bitSlice(instr, 22, 22) << 1) + bitSlice(instr, 20, 20))
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
			return 100;
		},
		execute : function (instr, opcode, mode) {
			if (!checkCondition(bitSlice(instr, 28, 31)))
			{
				return;
			}
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
				case 79: executeOpcode79(instr, mode); break;
				case 100: throw Error("executing undefined instruction");
				default: throw Error("invalid arm opcode: " + opcode); //should never happen
			}
		}
	}
}