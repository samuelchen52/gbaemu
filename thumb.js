const thumb = function(mmu, registers, changeState, changeMode) {
	
	const modeToRegisterIndex = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"] or modeENUMS["SYSTEM"];
      [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0], //modeENUMS["FIQ"];
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,1], //modeENUMS["SVC"];
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,2], //modeENUMS["ABT"];
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,3], //modeENUMS["IRQ"];
      [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,0,4], //modeENUMS["UND"];
  ];
	// Overflow flag - set if positive + positive = negative, or if negative + negative = positive
	// Carry flag - set when borrow or carry with most sig bit
	// Zero flag - set if result is zero
	// Negative flag - set if most significant bit is 1
	// THUMB instructions do not execute conditionally (except for branch)


	//THUMB.1------------------------------------------------------------------------------------------------------
	const executeOpcode0 = function (instr, mode) { //0 - LSL IMM5 Rd,Rs,#Offset   (logical/arithmetic shift left)
		let offset = bitSlice(instr, 6, 10);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] << offset;
	}

	const executeOpcode1 = function (instr, mode) { //1 - LSR IMM5 Rd,Rs,#Offset   (logical    shift right)
		let offset = bitSlice(instr, 6, 10);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] >>> offset;
	}

	const executeOpcode2 = function (instr, mode) { //2 - ASR IMM5 Rd,Rs,#Offset   (arithmetic shift right)
		let offset = bitSlice(instr, 6, 10);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] >> offset;
	}

	//THUMB.2------------------------------------------------------------------------------------------------------
	const executeOpcode3 = function (instr, mode) { //3 - ADD REGISTER Rd=Rs+Rn
		let rn = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] + registers[rn][modeToRegisterIndex[mode][rn]];
	}

	const executeOpcode4 = function (instr, mode) { //4 - SUBTRACT REGISTER Rd=Rs-Rn
		let rn = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] - registers[rn][modeToRegisterIndex[mode][rn]];
	}

	const executeOpcode5 = function (instr, mode) { //5 - ADD IMM3 Rd=Rs+nn
		let imm = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] + imm;
	}

	const executeOpcode6 = function (instr, mode) { //6 - SUB IMM3 Rd=Rs-nn
		let imm = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]] - imm;
	}

	//THUMB.3------------------------------------------------------------------------------------------------------
	const executeOpcode7 = function (instr, mode) { //7 - MOV IMM8 Rd   = #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		registers[rd][modeToRegisterIndex[mode][rd]] = imm;
	}

	const executeOpcode8 = function (instr, mode) { //8 - CMP IMM8 Void = Rd - #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		//this instruction only changes flags, no change to registers
	}

	const executeOpcode9 = function (instr, mode) { //9 - ADD IMM8 Rd   = Rd + #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		registers[rd][modeToRegisterIndex[mode][rd]] += imm; 
	}

	const executeOpcode10 = function (instr, mode) { //10 - SUB IMM8 Rd   = Rd - #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		registers[rd][modeToRegisterIndex[mode][rd]] -= imm;
	}

	//THUMB.4------------------------------------------------------------------------------------------------------
	const executeOpcode11 = function (instr, mode) { //11 - AND  Rd = Rd AND Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] &= registers[rs][modeToRegisterIndex[mode][rs]];
	}

	const executeOpcode12 = function (instr, mode) { //12 - XOR Rd = Rd XOR Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] ^= registers[rs][modeToRegisterIndex[mode][rs]];
	}

	const executeOpcode13 = function (instr, mode) { //13 - LSL Rd = Rd << (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] <<= (registers[rs][modeToRegisterIndex[mode][rs]] & 0xFF);
	}
	const executeOpcode14 = function (instr, mode) { //14 - LSR Rd = Rd >> (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] >>>= (registers[rs][modeToRegisterIndex[mode][rs]] & 0xFF);
	}
	const executeOpcode15 = function (instr, mode) { //15 - ASR Rd = Rd SAR (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] >>= (registers[rs][modeToRegisterIndex[mode][rs]] & 0xFF);
	}
	const executeOpcode16 = function (instr, mode) { //16 - ADC Rd = Rd + Rs + Cy
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);
		let carryFlag = bitSlice(registers[16][0], 29, 29);

		registers[rd][modeToRegisterIndex[mode][rd]] += registers[rs][modeToRegisterIndex[mode][rs]] + carryFlag;
	} 
	const executeOpcode17 = function (instr, mode) { //17 - SBC Rd = Rd - Rs - NOT Cy
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);
		let negCarryFlag = bitSlice(registers[16][0], 29, 29) === 0 ? 1 : 0;

		registers[rd][modeToRegisterIndex[mode][rd]] -= (registers[rs][modeToRegisterIndex[mode][rs]] + negCarryFlag);

	}
	const executeOpcode18 = function (instr, mode) { //18 - ROTATE RIGHT Rd = Rd ROR (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = 
		rotateRight(registers[rd][modeToRegisterIndex[mode][rd]], (registers[rs][modeToRegisterIndex[mode][rs]] & 0xFF));

	}
	const executeOpcode19 = function (instr, mode) { //19 - TST Void = Rd AND Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		//this instruction only changes flags, no change to registers
	}
	const executeOpcode20 = function (instr, mode) { //20 - NEG Rd = 0 - Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = 0 - registers[rs][modeToRegisterIndex[mode][rs]];
	}
	const executeOpcode21 = function (instr, mode) { //21 - CMP Void = Rd - Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		//this instruction only changes flags, no change to registers
	}
	const executeOpcode22 = function (instr, mode) { //22 - NEGCMP Void = Rd + Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		//this instruction only changes flags, no change to registers
	}
	const executeOpcode23 = function (instr, mode) { //23 - OR Rd = Rd OR Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] |= registers[rs][modeToRegisterIndex[mode][rs]];
	}
	const executeOpcode24 = function (instr, mode) { //24 - MUL Rd = Rd * Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] *= registers[rs][modeToRegisterIndex[mode][rs]];
	}
	const executeOpcode25 = function (instr, mode) { //25 - BIT CLEAR Rd = Rd AND NOT Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rd][modeToRegisterIndex[mode][rd]] & (~registers[rs][modeToRegisterIndex[mode][rs]]);
	}
	const executeOpcode26 = function (instr, mode) { //26 - NOT Rd = NOT Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] = ~registers[rs][modeToRegisterIndex[mode][rs]];
	}

	//THUMB.5------------------------------------------------------------------------------------------------------
	const executeOpcode27 = function (instr, mode) { //27 - ADD check needed Rd = Rd+Rs
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

		registers[rd][modeToRegisterIndex[mode][rd]] += registers[rs][modeToRegisterIndex[mode][rs]];
		if (rd === 15)
		{
			registers[15][modeToRegisterIndex[mode][15]] &= 0xFFFFFFFE; //forcibly half-word align the address by zeroing out bit 0
		}
	}

	const executeOpcode28 = function (instr, mode) { //28 - CMP check needed Void = Rd-Rs  ;CPSR affected
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

		//this instruction only changes flags, no change to registers
	}

	const executeOpcode29 = function (instr, mode) { //29 - MOV check needed Rd = Rs
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

		registers[rd][modeToRegisterIndex[mode][rd]] = registers[rs][modeToRegisterIndex[mode][rs]];
		if (rd === 15)
		{
			registers[15][modeToRegisterIndex[mode][15]] &= 0xFFFFFFFE; //forcibly half-word align the address by zeroing out bit 0
		}
	}

	const executeOpcode30 = function (instr, mode) { //30 - BX check needed PC = Rs     ;may switch THUMB/ARM
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		// When using R15 (PC) as operand, the value will be the address of the instruction plus 4 (ie. $+4). Except for BX R15: CPU switches to ARM state, and PC is auto-aligned as (($+4) AND NOT 2).
		// For BX/BLX, when Bit 0 of the value in Rs is zero:
  	// Processor will be switched into ARM mode!
  	// If so, Bit 1 of Rs must be cleared (32bit word aligned).
  	// Thus, BX PC (switch to ARM) may be issued from word-aligned address ?????
  	// only, the destination is PC+4 (ie. the following halfword is skipped).

		registers[15][modeToRegisterIndex[mode][15]] &= registers[rs][modeToRegisterIndex[mode][rs]];
		if (bitSlice(rs, 0, 0) === 0) //if bit 0 of rs is 0, switch to arm state
		{
			changeMode("ARM");
			registers[15][modeToRegisterIndex[mode][15]] &= 0xFFFFFFFC; //forcibly word align the address by zeroing out the bits 1 and 0
		}
		else
		{
			registers[15][modeToRegisterIndex[mode][15]] &= 0xFFFFFFFE; //forcibly half-word align the address by zeroing out bit 0
		}
	}

	//THUMB.6------------------------------------------------------------------------------------------------------
	const executeOpcode31 = function (instr, mode) { //31 - LDR IMM (PC) Rd = WORD[PC+nn]
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

		registers[rd][modeToRegisterIndex[mode][rd]] += mmu.readMem(registers[15][modeToRegisterIndex[mode][15]] + offset, 4);
	}

	//THUMB.7/8------------------------------------------------------------------------------------------------------
	const executeOpcode32 = function (instr, mode) { //32 - STR REG OFFSET WORD[Rb+Ro] = Rd
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][modeToRegisterIndex[mode][rb]] + registers[ro][modeToRegisterIndex[mode][ro]]) & 0xFFFFFFFC,
			registers[rd][modeToRegisterIndex[mode][rd]], 
			4);
	}

	const executeOpcode33 = function (instr, mode) { //33 - STRH REG OFFSET HALFWORD[Rb+Ro] = Rd
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][modeToRegisterIndex[mode][rb]] + registers[ro][modeToRegisterIndex[mode][ro]]) & 0xFFFFFFFE,
			registers[rd][modeToRegisterIndex[mode][rd]], 
			2);
	}

	const executeOpcode34 = function (instr, mode) { //34 - STRB REG OFFSET BYTE[Rb+Ro] = Rd
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][modeToRegisterIndex[mode][rb]] + registers[ro][modeToRegisterIndex[mode][ro]]),
			registers[rd][modeToRegisterIndex[mode][rd]], 
			1);
	}

	const executeOpcode35 = function (instr, mode) { //35 - LDSB REG OFFSET Rd = BYTE[Rb+Ro]
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero  

		registers[rd][modeToRegisterIndex[mode][rd]] += mmu.readMem(registers[15][modeToRegisterIndex[mode][15]] + offset, 4);
	}

	const executeOpcode36 = function (instr, mode) { //36 - LDR REG OFFSET Rd = WORD[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] += mmu.readMem((registers[rb][modeToRegisterIndex[mode][rb]] + registers[ro][modeToRegisterIndex[mode][ro]]) & 0xFFFFFFFC, 4);
	}

	const executeOpcode37 = function (instr, mode) { //37 - LDRH REG OFFSET Rd = HALFWORD[Rb+Ro]
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero  

		registers[rd][modeToRegisterIndex[mode][rd]] += mmu.readMem(registers[15][modeToRegisterIndex[mode][15]] + offset, 4);
	}

	const executeOpcode38 = function (instr, mode) { //38 - LDRB REG OFFSET Rd = BYTE[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][modeToRegisterIndex[mode][rd]] += mmu.readMem(registers[rb][modeToRegisterIndex[mode][rb]] + registers[ro][modeToRegisterIndex[mode][ro]], 1);
	}

	const executeOpcode39 = function (instr, mode) { //39 - LDSH REG OFFSET Rd = HALFWORD[Rb+Ro]
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero  

		registers[rd][modeToRegisterIndex[mode][rd]] += mmu.readMem(registers[15][modeToRegisterIndex[mode][15]] + offset, 4);
	}



	return {
		decode : function (instr) {
			// 1111 1100 0000 0000
			// 5432 1098 7654 3210
			// xxxx xxxx xxxx xxxx
			switch (bitSlice(instr, 13, 15)) //MAIN SWITCH
			{
				case 0:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 0; break; //LSL IMM5

					case 1: return 1; break; //LSR IMM5

					case 2: return 2; break; //ASR IMM5

					case 3:
					switch (bitSlice(instr, 9, 10))
					{
						case 0: return 3; break; //ADD REGISTER

						case 1: return 4; break; //SUBTRACT REGISTER

						case 2: return 5; break; //ADD IMM3

						case 3: return 6; break; //SUB IMM3
					}
					break;
				}
				break;

				case 1:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 7; break; //MOV IMM8

					case 1: return 8; break; //CMP IMM8

					case 2: return 9; break; //ADD IMM8

					case 3: return 10; break; //SUB IMM8
				}
				break;

				case 2:
				switch (bitSlice(instr, 10, 12))
				{
					case 0:
					switch(bitSlice(instr, 6, 9))
					{
						case 0:  return 11; break; //AND
						case 1:  return 12; break; //XOR
						case 2:  return 13; break; //LSL
						case 3:  return 14; break; //LSR
						case 4:  return 15; break; //ASR
						case 5:  return 16; break; //ADC
						case 6:  return 17; break; //SBC
						case 7:  return 18; break; //ROTATE RIGHT
						case 8:  return 19; break; //TST
						case 9:  return 20; break; //NEG
						case 10: return 21; break; //CMP
						case 11: return 22; break; //NEGCMP
						case 12: return 23; break; //OR
						case 13: return 24; break; //MUL
						case 14: return 25; break; //BIT CLEAR
						case 15: return 26; break; //NOT
					}
					break;

					case 1:
					switch(bitSlice(instr, 8, 9))
					{
						case 0: return 27; break; //ADD check if there is a 1 in next two bits

						case 1: return 28; break; //CMP check if there is a 1 in next two bits

						case 2: return 29; break; //MOV check if there is a 1 in next two bits

						case 3: return 30; break; //BX check if some bits are zero
					}

					case 2:
					case 3:
					return 31;
					break; //LDR IMM (PC)

					case 4:
					return bitSlice(instr, 9, 9) === 0 ? 32 : 33;
					break; //return bit 9 === 0 ? STR REG OFFSET : STRH REG OFFSET

					case 5:
					return bitSlice(instr, 9, 9) === 0 ? 34 : 35;
					break; //return bit 9 === 0 ? STRB REG OFFSET : LDSB REG OFFSET

					case 6:
					return bitSlice(instr, 9, 9) === 0 ? 36 : 37;
					break; //return bit 9 === 0 ? LDR REG OFFSET : LDRH REG OFFSET

					case 7:
					return bitSlice(instr, 9, 9) === 0 ? 38 : 39;
					break; //return bit 9 === 0 ? LDRB REG OFFSET : LDSH REG OFFSET
				}
				break;

				case 3:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: return 40; break; //STR IMM OFFSET
					case 1: return 41; break; //LDR IMM OFFSET
					case 2: return 42; break; //STRB IMM OFFSET
					case 3: return 43; break; //LDRB IMM OFFSET
				}
				break;

				case 4:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: return 44; break; //STRH IMM OFFSET
					case 1: return 45; break; //LDRH IMM OFFSET
					case 2: return 46; break; //STR IMM OFFSET(SP)
					case 3: return 47; break; //LDR IMM OFFSET(SP)
				}
				break;

				case 5:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: return 48; break; //ADD RD PC IMM
					case 1: return 49; break; //ADD RD SP IMM
					case 2:
					return bitSlice(instr, 10, 10) === 0 ? (bitSlice(instr, 7, 7) === 0 ? 50 : 51) : 52;
					//return if bit 10 === 0 ? (bit 7 === 0 ? ADD SP IMM : ADD SP -IMM) : PUSH
					break;
					case 3: return 53; break; //POP
				} 
				break;

				case 6:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 54; break; //STMIA
					case 1: return 55; break; //LDMIA
					case 2: return 56; break; //CONDITIONAL BRANCH
					case 3: 
					return bitSlice(instr, 8, 10) === 7 ? 57 : 56;
					break; //return bits 8 - 10 are all 1 ? SW INTR : CONDITIONAL BRANCH
				}
				break;

				case 7:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 58; break; //UNCONDITIONAL BRANCH
					case 2: return 59; break; //LONG BRANCH 1
					case 3: return 60; break; //LONG BRANCH 2
				}
				break;
			}
			//undefined instruction
			throw Error("encountered undefined instruction!");
		},
		execute : function (opcode) {

			switch (opcode)
			{
				case 0: executeOpcode0(); break;
				case 1: executeOpcode1(); break;
				case 2: executeOpcode2(); break;
				case 3: executeOpcode3(); break;
				case 4: executeOpcode4(); break;
				case 5: executeOpcode5(); break;
				case 6: executeOpcode6(); break;
				case 7: executeOpcode7(); break;
				case 8: executeOpcode8(); break;
				case 9: executeOpcode9(); break;
				case 10: executeOpcode10(); break;
				case 11: executeOpcode11(); break;
				case 12: executeOpcode12(); break;
				case 13: executeOpcode13(); break;
				case 14: executeOpcode14(); break;
				case 15: executeOpcode15(); break;
				case 16: executeOpcode16(); break;
				case 17: executeOpcode17(); break;
				case 18: executeOpcode18(); break;
				case 19: executeOpcode19(); break;
				case 20: executeOpcode20(); break;
				case 21: executeOpcode21(); break;
				case 22: executeOpcode22(); break;
				case 23: executeOpcode23(); break;
				case 24: executeOpcode24(); break;
				case 25: executeOpcode25(); break;
				case 26: executeOpcode26(); break;
				case 27: executeOpcode27(); break;
				case 28: executeOpcode28(); break;
				case 29: executeOpcode29(); break;
				case 30: executeOpcode30(); break;
				case 31: executeOpcode31(); break;
				case 32: executeOpcode32(); break;
				case 33: executeOpcode33(); break;
				case 34: executeOpcode34(); break;
				case 35: executeOpcode35(); break;
				case 36: executeOpcode36(); break;
				case 37: executeOpcode37(); break;
				case 38: executeOpcode38(); break;
				case 39: executeOpcode39(); break;
				case 40: executeOpcode40(); break;
				case 41: executeOpcode41(); break;
				case 42: executeOpcode42(); break;
				case 43: executeOpcode43(); break;
				case 44: executeOpcode44(); break;
				case 45: executeOpcode45(); break;
				case 46: executeOpcode46(); break;
				case 47: executeOpcode47(); break;
				case 48: executeOpcode48(); break;
				case 49: executeOpcode49(); break;
				case 50: executeOpcode50(); break;
				case 51: executeOpcode51(); break;
				case 52: executeOpcode52(); break;
				case 53: executeOpcode53(); break;
				case 54: executeOpcode54(); break;
				case 55: executeOpcode55(); break;
				case 56: executeOpcode56(); break;
				case 57: executeOpcode57(); break;
				case 58: executeOpcode58(); break;
				case 59: executeOpcode59(); break;
				case 60: executeOpcode60(); break;
			}
		}
	}
}