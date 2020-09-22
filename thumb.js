const thumb = function(mmu, registers, changeState, changeMode, setNZCV, registerIndices, pipeline) {
	
	//resets pipeline by filling it with nops (for branching instructions)
	//nops are based on which state is passed in
	const resetPipeline = function (state){
		if (state) //thumb nops
		{
			pipeline[0] = 0x46C0;
			pipeline[1] = 0x46C0;
			pipeline[2] = 29;
		}
		else //arm nops
		{
			pipeline[0] = 0xE1A00000;
			pipeline[1] = 0xE1A00000;
			pipeline[2] = 51;
		}
	};
	
	//THUMB.1------------------------------------------------------------------------------------------------------
	const executeOpcode0 = function (instr, mode) { //0 - LSL IMM5 Rd,Rs,#Offset 
		let offset = bitSlice(instr, 6, 10);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rs][registerIndices[mode][rs]] << offset) & 0xFFFFFFFF;
		
		setNZCV(bitSlice(result, 31, 31), result === 0, offset === 0 ? undefined : bitSlice(registers[rs][registerIndices[mode][rs]], 32 - offset, 32 - offset));
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode1 = function (instr, mode) { //1 - LSR IMM5 Rd,Rs,#Offset (shifts in zeroes)
		let offset = bitSlice(instr, 6, 10);
				offset = offset ? offset : 32;
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = registers[rs][registerIndices[mode][rs]] >>> offset;
		
		setNZCV(bitSlice(result, 31, 31), result === 0, bitSlice(registers[rs][registerIndices[mode][rs]], offset - 1, offset - 1));
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode2 = function (instr, mode) { //2 - ASR IMM5 Rd,Rs,#Offset (shifts in most significant bit)
		let offset = bitSlice(instr, 6, 10);
				offset = offset ? offset : 32;
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let sigbit = bitSlice(registers[rs][registerIndices[mode][rs]], 31 , 31);
		let result = registers[rs][registerIndices[mode][rs]] >>> offset + (sigbit ? (((1 << offset) - 1) << (32 - offset)) : 0); //we shift right by offset bits, then add the sig bits to the left

		setNZCV(bitSlice(result, 31, 31), result === 0, bitSlice(registers[rs][registerIndices[mode][rs]], offset - 1, offset - 1));
		registers[rd][registerIndices[mode][rd]] = result;
	}

	//THUMB.2------------------------------------------------------------------------------------------------------
	const executeOpcode3 = function (instr, mode) { //3 - ADD REGISTER Rd=Rs+Rn
		let rn = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rs][registerIndices[mode][rs]] + registers[rn][registerIndices[mode][rn]]) & 0xFFFFFFFF;
 		let vflag = bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, result < registers[rs][registerIndices[mode][rs]], (vflag === 0) || (vflag === 3));
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode4 = function (instr, mode) { //4 - SUBTRACT REGISTER Rd=Rs-Rn
		let rn = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rs][registerIndices[mode][rs]] - registers[rn][registerIndices[mode][rn]]) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + (bitSlice(registers[rn][registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, registers[rn][registerIndices[mode][rn]] <= registers[rs][registerIndices[mode][rs]], (vflag === 0) || (vflag === 3));
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode5 = function (instr, mode) { //5 - ADD IMM3 Rd=Rs+nn
		let imm = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rs][registerIndices[mode][rs]] + imm) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, result < imm, vflag === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode6 = function (instr, mode) { //6 - SUB IMM3 Rd=Rs-nn
		let imm = bitSlice(instr, 6, 8);
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rs][registerIndices[mode][rs]] - imm) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + 1 + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, registers[rn][registerIndices[mode][rn]] <= registers[rs][registerIndices[mode][rs]], vflag === 3);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	//THUMB.3------------------------------------------------------------------------------------------------------
	const executeOpcode7 = function (instr, mode) { //7 - MOV IMM8 Rd   = #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		setNZCV(bitSlice(imm, 7, 7), imm === 0);
		registers[rd][registerIndices[mode][rd]] = imm;
	}

	const executeOpcode8 = function (instr, mode) { //8 - CMP IMM8 Void = Rd - #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		let result = registers[rd][registerIndices[mode][rd]] - imm;

		setNZCV(bitSlice(result, 31, 31), result === 0, imm > registers[rs][registerIndices[mode][rs]], bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) && (!bitSlice(result, 31, 31)));
	}

	const executeOpcode9 = function (instr, mode) { //9 - ADD IMM8 Rd   = Rd + #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		let result = (registers[rd][registerIndices[mode][rd]] + imm) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, result < imm, vflag === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode10 = function (instr, mode) { //10 - SUB IMM8 Rd   = Rd - #nn
		let rd = bitSlice(instr, 8, 10);
		let imm = bitSlice(instr, 0, 7);

		let result = (registers[rd][registerIndices[mode][rd]] - imm) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + 1 + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, imm <= registers[rd][registerIndices[mode][rd]], vflag === 3);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	//THUMB.4------------------------------------------------------------------------------------------------------
	const executeOpcode11 = function (instr, mode) { //11 - AND  Rd = Rd AND Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = registers[rd][registerIndices[mode][rd]] & registers[rs][registerIndices[mode][rs]];

		setNZCV(bitSlice(result, 31, 31), result === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode12 = function (instr, mode) { //12 - XOR Rd = Rd XOR Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = registers[rd][registerIndices[mode][rd]] ^ registers[rs][registerIndices[mode][rs]];

		setNZCV(bitSlice(result, 31, 31), result === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	const executeOpcode13 = function (instr, mode) { //13 - LSL Rd = Rd << (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let sh = (registers[rs][registerIndices[mode][rs]] & 0xFF) % 32;
		let result = (registers[rd][registerIndices[mode][rd]] << sh) & 0xFFFFFFFF;

		setNZCV(bitSlice(result, 31, 31), result === 0, sh === 0 ? undefined : bitSlice(registers[rd][registerIndices[mode][rd]], 32 - sh, 32 - sh));
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode14 = function (instr, mode) { //14 - LSR Rd = Rd >> (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let sh = (registers[rs][registerIndices[mode][rs]] & 0xFF) % 32;
		let result = registers[rd][registerIndices[mode][rd]] >>> sh;

		setNZCV(bitSlice(result, 31, 31), result === 0, sh === 0 ? undefined : bitSlice(registers[rd][registerIndices[mode][rd]], offset - 1, offset - 1));
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode15 = function (instr, mode) { //15 - ASR Rd = Rd SAR (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let sh = (registers[rs][registerIndices[mode][rs]] & 0xFF);
		let result = (registers[rd][registerIndices[mode][rd]] >>> sh) + (sigbit ? (((1 << offset) - 1) << (32 - offset)) : 0);
		
		setNZCV(bitSlice(result, 31, 31), result === 0, sh === 0 ? undefined : bitSlice(registers[rd][registerIndices[mode][rd]], offset - 1, offset - 1));
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode16 = function (instr, mode) { //16 - ADC Rd = Rd + Rs + Cy
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);
		let carryFlag = bitSlice(registers[16][0], 29, 29);

		let result = (registers[rd][registerIndices[mode][rd]] + registers[rs][registerIndices[mode][rs]] + carryFlag);
		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result >>> 32, (vflag === 0) || (vflag === 3));
		registers[rd][registerIndices[mode][rd]] = result;
	} 
	const executeOpcode17 = function (instr, mode) { //17 - SBC Rd = Rd - Rs - NOT Cy
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);
		let negCarryFlag = bitSlice(registers[16][0], 29, 29) === 0 ? 1 : 0;

		let result = (registers[rd][registerIndices[mode][rd]] - (registers[rs][registerIndices[mode][rs]] + negCarryFlag)) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + ((bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + negCarryFlag) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, (registers[rs][registerIndices[mode][rs]] + negCarryFlag) <= registers[rd][registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode18 = function (instr, mode) { //18 - ROTATE RIGHT Rd = Rd ROR (Rs AND 0FFh)
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let ro = (registers[rs][registerIndices[mode][rs]] & 0xFF);
		let result = rotateRight(registers[rd][registerIndices[mode][rd]], (registers[rs][registerIndices[mode][rs]] & 0xFF));

		setNZCV(bitSlice(result, 31, 31), result === 0, ro === 0 ? undefined : bitSlice(registers[rd][registerIndices[mode][rd]], offset - 1, offset - 1));
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode19 = function (instr, mode) { //19 - TST Void = Rd AND Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = registers[rd][registerIndices[mode][rd]] & registers[rs][registerIndices[mode][rs]];

		setNZCV(bitSlice(result, 31, 31), result === 0);
	}
	const executeOpcode20 = function (instr, mode) { //20 - NEG Rd = 0 - Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (0 - registers[rs][registerIndices[mode][rs]]) & 0xFFFFFFFF;
		let vflag = (bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, result !== 0, vflag === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode21 = function (instr, mode) { //21 - CMP Void = Rd - Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rd][registerIndices[mode][rd]] - registers[rs][registerIndices[mode][rs]]) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + (bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, registers[rs][registerIndices[mode][rs]] > registers[rd][registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
	}
	const executeOpcode22 = function (instr, mode) { //22 - NEGCMP Void = Rd + Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rd][registerIndices[mode][rd]] + registers[rs][registerIndices[mode][rs]]) & 0xFFFFFFFF;
 		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, result < registers[rd][registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
	}
	const executeOpcode23 = function (instr, mode) { //23 - OR Rd = Rd OR Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		result |= registers[rs][registerIndices[mode][rs]];

		setNZCV(bitSlice(result, 31, 31), result === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode24 = function (instr, mode) { //24 - MUL Rd = Rd * Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = (registers[rd][registerIndices[mode][rd]] * registers[rs][registerIndices[mode][rs]]) & 0xFFFFFFFF;

		setNZCV(bitSlice(result, 31, 31), result === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode25 = function (instr, mode) { //25 - BIT CLEAR Rd = Rd AND NOT Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = registers[rd][registerIndices[mode][rd]] & (~registers[rs][registerIndices[mode][rs]]);

		setNZCV(bitSlice(result, 31, 31), result === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}
	const executeOpcode26 = function (instr, mode) { //26 - NOT Rd = NOT Rs
		let rs = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let result = ~registers[rs][registerIndices[mode][rs]];

		setNZCV(bitSlice(result, 31, 31), result === 0);
		registers[rd][registerIndices[mode][rd]] = result;
	}

	//THUMB.5------------------------------------------------------------------------------------------------------
	const executeOpcode27 = function (instr, mode) { //27 - ADD check needed Rd = Rd+Rs
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

		registers[rd][registerIndices[mode][rd]] += registers[rs][registerIndices[mode][rs]];
		if (rd === 15)
		{
			registers[15][registerIndices[mode][15]] &= 0xFFFFFFFE; //forcibly half-word align the address by zeroing out bit 0
		}
	}

	const executeOpcode28 = function (instr, mode) { //28 - CMP check needed Void = Rd-Rs  ;CPSR affected
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

		let result = (registers[rd][registerIndices[mode][rd]] - registers[rs][registerIndices[mode][rs]]) & 0xFFFFFFFF;
		let vflag = bitSlice(registers[rd][registerIndices[mode][rd]], 31, 31) + (bitSlice(registers[rs][registerIndices[mode][rs]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

		setNZCV(bitSlice(result, 31, 31), result === 0, registers[rs][registerIndices[mode][rs]] > registers[rd][registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
	}

	const executeOpcode29 = function (instr, mode) { //29 - MOV check needed Rd = Rs
		let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
		let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

		registers[rd][registerIndices[mode][rd]] = registers[rs][registerIndices[mode][rs]];
		if (rd === 15)
		{
			registers[15][registerIndices[mode][15]] &= 0xFFFFFFFE; //forcibly half-word align the address by zeroing out bit 0
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

		registers[15][registerIndices[mode][15]] &= registers[rs][registerIndices[mode][rs]];
		if (bitSlice(rs, 0, 0) === 0) //if bit 0 of rs is 0, switch to arm state
		{
			changeState("ARM");
			registers[15][registerIndices[mode][15]] &= 0xFFFFFFFC; //forcibly word align the address by zeroing out the bits 1 and 0
		}
		else
		{
			registers[15][registerIndices[mode][15]] &= 0xFFFFFFFE; //forcibly half-word align the address by zeroing out bit 0
		}
	}

	//THUMB.6------------------------------------------------------------------------------------------------------
	const executeOpcode31 = function (instr, mode) { //31 - LDR IMM (PC) Rd = WORD[PC+nn]
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

		registers[rd][registerIndices[mode][rd]] += mmu.readMem(registers[15][registerIndices[mode][15]] + offset, 4);
	}

	//THUMB.7/8------------------------------------------------------------------------------------------------------
	const executeOpcode32 = function (instr, mode) { //32 - STR REG OFFSET WORD[Rb+Ro] = Rd
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]) & 0xFFFFFFFC,
			registers[rd][registerIndices[mode][rd]], 
			4);
	}

	const executeOpcode33 = function (instr, mode) { //33 - STRH REG OFFSET HALFWORD[Rb+Ro] = Rd
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]) & 0xFFFFFFFE,
			registers[rd][registerIndices[mode][rd]], 
			2);
	}

	const executeOpcode34 = function (instr, mode) { //34 - STRB REG OFFSET BYTE[Rb+Ro] = Rd
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]),
			registers[rd][registerIndices[mode][rd]], 
			1);
	}

	const executeOpcode35 = function (instr, mode) { //35 - LDSB REG OFFSET Rd = BYTE[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let byte = mmu.readMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]), 1);
		byte += byte & 128 ? (0xFFFFFF << 24) : 0; //sign extend byte
		
		registers[rd][registerIndices[mode][rd]] = byte;
	}

	const executeOpcode36 = function (instr, mode) { //36 - LDR REG OFFSET Rd = WORD[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][registerIndices[mode][rd]] = mmu.readMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]) & 0xFFFFFFFC, 4);
	}

	const executeOpcode37 = function (instr, mode) { //37 - LDRH REG OFFSET Rd = HALFWORD[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let data = mmu.readMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]) & 0xFFFFFFFE, 2);
		
		if ((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]) & 1)
		{
			data = rotateRight(data, 8);
		}
		registers[rd][registerIndices[mode][rd]] = data;
	}

	const executeOpcode38 = function (instr, mode) { //38 - LDRB REG OFFSET Rd = BYTE[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][registerIndices[mode][rd]] = mmu.readMem(registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]], 1);
	}

	const executeOpcode39 = function (instr, mode) { //39 - LDSH REG OFFSET Rd = HALFWORD[Rb+Ro]
		let ro = bitSlice(instr, 6, 8);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let halfword = mmu.readMem((registers[rb][registerIndices[mode][rb]] + registers[ro][registerIndices[mode][ro]]) & 0xFFFFFFFE, 2);
		halfword += halfword & 32768 ? (0xFFFFFF << 16) : 0; //sign extend halfword
		
		registers[rd][registerIndices[mode][rd]] = halfword;
	}

	//THUMB.9------------------------------------------------------------------------------------------------------
	const executeOpcode40 = function (instr, mode) { //40 - STR IMM OFFSET WORD[Rb+nn] = Rd
		let offset = bitSlice(instr, 6, 10);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][registerIndices[mode][rb]] + offset) & 0xFFFFFFFC,
			registers[rd][registerIndices[mode][rd]], 
			4);

	}

	const executeOpcode41 = function (instr, mode) { //41 - LDR IMM OFFSET Rd = WORD[Rb+nn]
		let offset = bitSlice(instr, 6, 10);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][registerIndices[mode][rd]] = mmu.readMem((registers[rb][registerIndices[mode][rb]] + offset) & 0xFFFFFFFC, 4);
	}

	const executeOpcode42 = function (instr, mode) { //42 - STRB IMM OFFSET BYTE[Rb+nn] = Rd
		let offset = bitSlice(instr, 6, 10);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem(registers[rb][registerIndices[mode][rb]] + offset,
			registers[rd][registerIndices[mode][rd]], 
			1);
	}

	const executeOpcode43 = function (instr, mode) { //43 - LDRB IMM OFFSET Rd = BYTE[Rb+nn]
		let offset = bitSlice(instr, 6, 10);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		registers[rd][registerIndices[mode][rd]] = mmu.readMem(registers[rb][registerIndices[mode][rb]] + offset, 1);
	}

	//THUMB.10------------------------------------------------------------------------------------------------------
	const executeOpcode44 = function (instr, mode) { //44 - STRH IMM OFFSET HALFWORD[Rb+nn] = Rd
		let offset = bitSlice(instr, 6, 10);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		mmu.writeMem((registers[rb][registerIndices[mode][rb]] + offset) & 0xFFFFFFFC,
			registers[rd][registerIndices[mode][rd]], 
			2);
	}

	const executeOpcode45 = function (instr, mode) { //45 - LDRH IMM OFFSET Rd = HALFWORD[Rb+nn]
		let offset = bitSlice(instr, 6, 10);
		let rb = bitSlice(instr, 3, 5);
		let rd = bitSlice(instr, 0, 2);

		let data = mmu.readMem((registers[rb][registerIndices[mode][rb]] + offset) & 0xFFFFFFFE, 2);
		
		if ((registers[rb][registerIndices[mode][rb]] + offset) & 1)
		{
			data = rotateRight(data, 8);
		}
		registers[rd][registerIndices[mode][rd]] = data;
	}

	//THUMB.11------------------------------------------------------------------------------------------------------
	const executeOpcode46 = function (instr, mode) { //46 - STR IMM OFFSET (SP) WORD[SP+nn] = Rd
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

		mmu.writeMem((registers[13][registerIndices[mode][13]] + offset) & 0xFFFFFFFC,
			registers[rd][registerIndices[mode][rd]], 
			4);
	}

	const executeOpcode47 = function (instr, mode) { //47 - LDR IMM OFFSET (SP) Rd = WORD[SP+nn]
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

		registers[rd][registerIndices[mode][rd]] = mmu.readMem((registers[13][registerIndices[mode][13]] + offset) & 0xFFFFFFFC, 4);
	}

	//THUMB.12------------------------------------------------------------------------------------------------------
	const executeOpcode48 = function (instr, mode) { //48 - ADD RD PC IMM Rd = (($+4) AND NOT 2) + nn
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

		registers[rd][registerIndices[mode][rd]] = (registers[15][registerIndices[mode][15]] & 0xFFFFFFFC) + offset;
	}

	const executeOpcode49 = function (instr, mode) { //49 - ADD RD SP IMM Rd = SP + nn
		let rd = bitSlice(instr, 8, 10);
		let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

		registers[rd][registerIndices[mode][rd]] = registers[13][registerIndices[mode][13]] + offset;
	}

	//THUMB.13------------------------------------------------------------------------------------------------------
	const executeOpcode50 = function (instr, mode) { //50 - ADD SP IMM SP = SP + nn
		let offset = bitSlice(instr, 0, 6) << 2; //offset is 9 bits, lower 2 bits are zero, so we shift left two

		registers[13][registerIndices[mode][13]] += offset;
	}

	const executeOpcode51 = function (instr, mode) { //51 - ADD SP -IMM SP = SP - nn
		let offset = bitSlice(instr, 0, 6) << 2; //offset is 9 bits, lower 2 bits are zero, so we shift left two

		registers[13][registerIndices[mode][13]] -= offset;
	}

	//THUMB.14------------------------------------------------------------------------------------------------------
	const executeOpcode52 = function (instr, mode) { //52 - PUSH store in memory, decrements SP (R13) STMDB=PUSH
		let pclrbit = bitSlice(instr, 8, 8);
		for (let i = 7; i > -1; i --)
		{
			if (bitSlice(instr, i, i))
			{
				registers[13][registerIndices[mode][13]] -= 4;
				mmu.writeMem(registers[13][registerIndices[mode][13]] & 0xFFFFFFFC,
				registers[i][registerIndices[mode][i]], 
				4);
			}
		}
		if (pclrbit)
		{
			registers[13][registerIndices[mode][13]] -= 4;
			mmu.writeMem(registers[14][registerIndices[mode][14]] & 0xFFFFFFFC,
				registers[i][registerIndices[mode][i]], 
				4);
		}
	}

	const executeOpcode53 = function (instr, mode) { //53 - POP load from memory, increments SP (R13) LDMIA=POP
		let pclrbit = bitSlice(instr, 8, 8);
		if (pclrbit)
		{
			registers[15][registerIndices[mode][15]] = mmu.readMem(registers[13][registerIndices[mode][13]] & 0xFFFFFFFC, 4)
			registers[13][registerIndices[mode][13]] += 4;
		}
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				registers[i][registerIndices[mode][i]] = mmu.readMem(registers[13][registerIndices[mode][13]] & 0xFFFFFFFC, 4)
				registers[13][registerIndices[mode][13]] += 4;
			}
		}
	}

	//THUMB.15------------------------------------------------------------------------------------------------------
	const executeOpcode54 = function (instr, mode) { //54 - STMIA store in memory, increments Rb
		let rb = bitSlice(instr, 8, 10);
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				mmu.writeMem(registers[rb][registerIndices[mode][rb]] & 0xFFFFFFFC,
				registers[i][registerIndices[mode][i]], 
				4);
				registers[rb][registerIndices[mode][rb]] += 4;
			}
		}
	}

	const executeOpcode55 = function (instr, mode) { //55 - LDMIA load from memory, increments Rb
		let rb = bitSlice(instr, 8, 10);
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				registers[i][registerIndices[mode][i]] = mmu.readMem(registers[rb][registerIndices[mode][rb]] & 0xFFFFFFFC, 4)
				registers[rb][registerIndices[mode][rb]] += 4;
			}
		}
	}

	//THUMB.16------------------------------------------------------------------------------------------------------
	const executeOpcode56 = function (instr, mode) { //56 - CONDITIONAL BRANCH
		let condition = bitSlice(instr, 8, 11);
		let offset =  bitSlice(instr, 7, 7) ? (((bitSlice(instr, 0, 7) - 1) ^ 0xFF) * -1) << 1 : bitSlice(instr, 0, 6) << 1;
		let flags = bitSlice(registers[16][registerIndices[mode][16]], 28, 31); //N, Z, C, V
		let execute = false;

		switch(condition)
		{
			case 0: execute = flags & 0x4 ? true : false; //BEQ Z=1
			break;
			case 1: execute = flags & 0x4 ? false : true; //BNE Z=0
			break;
			case 2: execute = flags & 0x2 ? true : false; //BCS/BHS C=1
			break;
			case 3: execute = flags & 0x2 ? false : true; //BCC/BLO C=0
			break;
			case 4: execute = flags & 0x8 ? true : false; //BMI N=1
			break;
			case 5: execute = flags & 0x8 ? false : true; //BPL N=0
			break;
			case 6: execute = flags & 0x1 ? true : false; //BVS V=1
			break;
			case 7: execute = flags & 0x1 ? false : true; //BVC V=0
			break;
			case 8: execute = (flags & 0x2) && !(flags & 0x4) ? true : false; //BHI C=1, Z=0 
			break;
			case 9: execute = !(flags & 0x2) && (flags & 0x4) ? true : false; //BLS C=0, Z=1
			break;
			case 10: execute = (flags & 0x8) === (flags & 0x1) ? true : false; //BGE N=V
			break;
			case 11: execute = (flags & 0x8) !== (flags & 0x1) ? true : false; //BLT N<>V
			break;
			case 12: execute = ((flags & 0x8) === (flags & 0x1)) && !(flags & 0x4) ? true : false; //BGT N=V, Z=0
			break;
			case 13: execute = ((flags & 0x8) !== (flags & 0x1)) || (flags & 0x4) ? true : false; //BGT N<>V or Z=1
			break;
			case 14: throw Error("invalid opcode (0xE) with THUMB conditional branch");
			break;
			case 15: throw Error("error with parsing, decode returned opcode for conditional branch instead of SWI");
			break;
		}
		registers[15][registerIndices[mode][15]] += execute ? offset : 0;

	}

	//THUMB.17------------------------------------------------------------------------------------------------------
	const executeOpcode57 = function (instr, mode) { //57 - SWI
		//exception handling not implemented yet
	}

	//THUMB.18------------------------------------------------------------------------------------------------------
	const executeOpcode58 = function (instr, mode) { //58 - UNCONDITIONAL BRANCH
		let offset =  bitSlice(instr, 10, 10) ? (((bitSlice(instr, 0, 10) - 1) ^ 0xFF) * -1) << 1 : bitSlice(instr, 0, 9) << 1;
		registers[15][registerIndices[mode][15]] += offset;
	}

	//THUMB.19------------------------------------------------------------------------------------------------------
	const executeOpcode59 = function (instr, mode) { //59 - LONG BRANCH 1
		let offset = bitSlice(instr, 0, 10) << 12;
		registers[14][registerIndices[mode][14]] = registers[15][registerIndices[mode][15]] + offset;
	}

	const executeOpcode60 = function (instr, mode) { //60 - LONG BRANCH 2
		let offset = bitSlice(instr, 0, 10) << 1;

		let temp = registers[14][registerIndices[mode][14]];
		registers[14][registerIndices[mode][14]] = (registers[15][registerIndices[mode][15]] - 2) | 1;
		registers[15][registerIndices[mode][15]] = temp + offset;
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
				default: throw Error("invalid thumb opcode: " + opcode);
			}
		}
	}
}