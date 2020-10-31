const thumb = function(mmu, registers, changeState, changeMode, resetPipeline, startSWI, registerIndices) {
	
	this.mmu = mmu;
	this.registers = registers;
	this.changeState = changeState;
	this.changeMode = changeMode;
	this.resetPipeline = resetPipeline;
	this.startSWI = startSWI;
	this.registerIndices = registerIndices;

	this.shiftCarryFlag = undefined;
	this.initFnTable();
};

thumb.prototype.LSLRegByReg = function (register, shiftamt) {
	if (shiftamt === 0)
	{
		this.shiftCarryFlag = undefined;
		return register;
	}
	if (shiftamt > 32)
	{
		this.shiftCarryFlag = 0;
		return 0;
	}
	else //1-32
	{ 
		this.shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
		return shiftamt === 32 ? 0 : register << shiftamt;
	}
};

thumb.prototype.LSRRegByReg = function (register, shiftamt) {
	if (shiftamt === 0)
	{
		this.shiftCarryFlag = undefined;
		return register;
	}	
	if (shiftamt > 32)
	{
		this.shiftCarryFlag = 0;
		return 0;
	}
	else //1-32
	{
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return shiftamt === 32 ? 0 : register >>> shiftamt;
	}
};

thumb.prototype.ASRRegByReg = function (register, shiftamt) {
	if (shiftamt === 0)
	{
		this.shiftCarryFlag = undefined;
		return register;
	}	
	if (shiftamt >= 32)
	{
		this.shiftCarryFlag = register >>> 31;
		return this.shiftCarryFlag ? 4294967295 : 0; //2 ^ 32 - 1 === 4294967295
	}
	else //1-31
	{
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return register >> shiftamt;
	}
};

thumb.prototype.RORRegByReg = function (register, shiftamt) {
	if (shiftamt === 0)
	{
		this.shiftCarryFlag = undefined;
		return register;
	}
	shiftamt %= 32; //1 - 31
	if (shiftamt === 0) //if shiftamt is zero here, then it was a multiple of 32
	{
		this.shiftCarryFlag = register >>> 31;
		return register;
	}
	else//1-31
	{
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return rotateRight(register, shiftamt);
	}
};

//CPSR nzcv xxxx xxxx xxxx xxxx xxxx xxxx xxxx 
thumb.prototype.setNZCV = function (nflag, zflag, cflag, vflag) { 
  let newNZCV = 0;

  newNZCV = nflag ? 1 : 0;
  newNZCV = zflag ? ((newNZCV << 1) + 1) : newNZCV << 1;
  newNZCV = cflag === undefined ? ((newNZCV << 1) + bitSlice(this.registers[16][0], 29, 29)) : (cflag ? ((newNZCV << 1) + 1) : newNZCV << 1);
  newNZCV = vflag === undefined ? ((newNZCV << 1) + bitSlice(this.registers[16][0], 28, 28)) : (vflag ? ((newNZCV << 1) + 1) : newNZCV << 1);

  this.registers[16][0] &= 0x00FFFFFF; //set first byte to zero
  this.registers[16][0] += (newNZCV << 28); //add new flags to CPSR
};

//THUMB.1------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode0 = function (instr, mode) { //0 - LSL IMM5 Rd,Rs,#Offset 
	let offset = bitSlice(instr, 6, 10);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][this.registerIndices[mode][rs]] << offset;
	
	this.setNZCV(bitSlice(result, 31, 31), result === 0, offset === 0 ? undefined : bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 32 - offset, 32 - offset));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode1 = function (instr, mode) { //1 - LSR IMM5 Rd,Rs,#Offset (shifts in zeroes)
	let offset = bitSlice(instr, 6, 10);
			offset = offset === 0 ? 32 : offset;
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = offset === 32 ? 0 : this.registers[rs][this.registerIndices[mode][rs]] >>> offset;
	
	this.setNZCV(bitSlice(result, 31, 31), result === 0, bitSlice(this.registers[rs][this.registerIndices[mode][rs]], offset - 1, offset - 1));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode2 = function (instr, mode) { //2 - ASR IMM5 Rd,Rs,#Offset (shifts in most significant bit)
	let offset = bitSlice(instr, 6, 10);
			offset = offset === 0 ? 32 : offset;
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = offset === 32 ? ((this.registers[rs][this.registerIndices[mode][rs]] >>> 31) === 1 ? 0xFFFFFFFF : 0) : this.registers[rs][this.registerIndices[mode][rs]] >> offset;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, bitSlice(this.registers[rs][this.registerIndices[mode][rs]], offset - 1, offset - 1));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

//THUMB.2------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode3 = function (instr, mode) { //3 - ADD REGISTER Rd=Rs+Rn
	let rn = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][this.registerIndices[mode][rs]] + this.registers[rn][this.registerIndices[mode][rn]];
		let vflag = bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) + bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode4 = function (instr, mode) { //4 - SUBTRACT REGISTER Rd=Rs-Rn
	let rn = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (this.registers[rs][this.registerIndices[mode][rs]] - this.registers[rn][this.registerIndices[mode][rn]]) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][this.registerIndices[mode][rn]] <= this.registers[rs][this.registerIndices[mode][rs]], (vflag === 0) || (vflag === 3));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode5 = function (instr, mode) { //5 - ADD IMM3 Rd=Rs+nn
	let imm = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][this.registerIndices[mode][rs]] + imm;
	let vflag = bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, vflag === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode6 = function (instr, mode) { //6 - SUB IMM3 Rd=Rs-nn
	let imm = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (this.registers[rs][this.registerIndices[mode][rs]] - imm) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) + 1 + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, imm <= this.registers[rs][this.registerIndices[mode][rs]], vflag === 3);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

//THUMB.3------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode7 = function (instr, mode) { //7 - MOV IMM8 Rd   = #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	this.setNZCV(false, imm === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = imm;
};

thumb.prototype.executeOpcode8 = function (instr, mode) { //8 - CMP IMM8 Void = Rd - #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	let result = this.registers[rd][this.registerIndices[mode][rd]] - imm;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, imm <= this.registers[rd][this.registerIndices[mode][rd]], bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) && (!bitSlice(result, 31, 31)));
};

thumb.prototype.executeOpcode9 = function (instr, mode) { //9 - ADD IMM8 Rd   = Rd + #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	let result = this.registers[rd][this.registerIndices[mode][rd]] + imm
	let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, vflag === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode10 = function (instr, mode) { //10 - SUB IMM8 Rd   = Rd - #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	let result = (this.registers[rd][this.registerIndices[mode][rd]] - imm) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + 1 + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, imm <= this.registers[rd][this.registerIndices[mode][rd]], vflag === 3);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

//THUMB.4------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode11 = function (instr, mode) { //11 - AND  Rd = Rd AND Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][this.registerIndices[mode][rd]] & this.registers[rs][this.registerIndices[mode][rs]];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode12 = function (instr, mode) { //12 - XOR Rd = Rd XOR Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][this.registerIndices[mode][rd]] ^ this.registers[rs][this.registerIndices[mode][rs]];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode13 = function (instr, mode) { //13 - LSL Rd = Rd << (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let sh = this.registers[rs][this.registerIndices[mode][rs]] & 0xFF;
	let result = this.LSLRegByReg(this.registers[rd][this.registerIndices[mode][rd]], sh);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode14 = function (instr, mode) { //14 - LSR Rd = Rd >> (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let sh = this.registers[rs][this.registerIndices[mode][rs]] & 0xFF;
	let result = this.LSRRegByReg(this.registers[rd][this.registerIndices[mode][rd]], sh);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode15 = function (instr, mode) { //15 - ASR Rd = Rd SAR (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let sh = this.registers[rs][this.registerIndices[mode][rs]] & 0xFF;
	let result = this.ASRRegByReg(this.registers[rd][this.registerIndices[mode][rd]], sh);
	
	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode16 = function (instr, mode) { //16 - ADC Rd = Rd + Rs + Cy
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = (this.registers[rd][this.registerIndices[mode][rd]] + this.registers[rs][this.registerIndices[mode][rs]] + carryFlag);
	let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode17 = function (instr, mode) { //17 - SBC Rd = Rd - Rs - NOT Cy
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);
	let negCarryFlag = bitSlice(this.registers[16][0], 29, 29) === 0 ? 1 : 0;

	let result = (this.registers[rd][this.registerIndices[mode][rd]] - (this.registers[rs][this.registerIndices[mode][rs]] + negCarryFlag)) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + ((bitSlice(this.registers[rs][this.registerIndices[mode][rs]] + negCarryFlag, 31, 31)) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rs][this.registerIndices[mode][rs]] + negCarryFlag) <= this.registers[rd][this.registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode18 = function (instr, mode) { //18 - ROTATE RIGHT Rd = Rd ROR (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let ro = (this.registers[rs][this.registerIndices[mode][rs]] & 0xFF);
	let result = this.RORRegByReg(this.registers[rd][this.registerIndices[mode][rd]], ro);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode19 = function (instr, mode) { //19 - TST Void = Rd AND Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][this.registerIndices[mode][rd]] & this.registers[rs][this.registerIndices[mode][rs]];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
};

thumb.prototype.executeOpcode20 = function (instr, mode) { //20 - NEG Rd = 0 - Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (0 - this.registers[rs][this.registerIndices[mode][rs]]) & 0xFFFFFFFF;
	let vflag = (bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, result === 0, vflag === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode21 = function (instr, mode) { //21 - CMP Void = Rd - Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (this.registers[rd][this.registerIndices[mode][rd]] - this.registers[rs][this.registerIndices[mode][rs]]) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + (bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rs][this.registerIndices[mode][rs]] <= this.registers[rd][this.registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
};

thumb.prototype.executeOpcode22 = function (instr, mode) { //22 - NEGCMP Void = Rd + Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][this.registerIndices[mode][rd]] + this.registers[rs][this.registerIndices[mode][rs]];
		let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) + (bitSlice(result, 31, 31) ^ 1);
		// console.log("rd: " + this.registers[rd][this.registerIndices[mode][rd]].toString(16));
		// console.log("rs: " + this.registers[rs][this.registerIndices[mode][rs]].toString(16));
		// console.log("result: " + result.toString(16));
		// console.log("vflag: "+ vflag);
	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF ) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
};

thumb.prototype.executeOpcode23 = function (instr, mode) { //23 - OR Rd = Rd OR Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][this.registerIndices[mode][rs]] | this.registers[rd][this.registerIndices[mode][rd]];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode24 = function (instr, mode) { //24 - MUL Rd = Rd * Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = Number((BigInt(this.registers[rd][this.registerIndices[mode][rd]]) * BigInt(this.registers[rs][this.registerIndices[mode][rs]])) & 0xFFFFFFFFn);

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode25 = function (instr, mode) { //25 - BIT CLEAR Rd = Rd AND NOT Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][this.registerIndices[mode][rd]] & (~this.registers[rs][this.registerIndices[mode][rs]]);

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

thumb.prototype.executeOpcode26 = function (instr, mode) { //26 - NOT Rd = NOT Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = ~this.registers[rs][this.registerIndices[mode][rs]];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};

//THUMB.5------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode27 = function (instr, mode) { //27 - ADD check needed Rd = Rd+Rs
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

	this.registers[rd][this.registerIndices[mode][rd]] += this.registers[rs][this.registerIndices[mode][rs]];
	if (rd === 15)
	{
		this.resetPipeline();
	}
};

thumb.prototype.executeOpcode28 = function (instr, mode) { //28 - CMP check needed Void = Rd-Rs  ;CPSR affected
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

	let result = (this.registers[rd][this.registerIndices[mode][rd]] - this.registers[rs][this.registerIndices[mode][rs]]) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][this.registerIndices[mode][rd]], 31, 31) + (bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rs][this.registerIndices[mode][rs]] <= this.registers[rd][this.registerIndices[mode][rd]], (vflag === 0) || (vflag === 3));
};

thumb.prototype.executeOpcode29 = function (instr, mode) { //29 - MOV check needed Rd = Rs
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

	this.registers[rd][this.registerIndices[mode][rd]] = this.registers[rs][this.registerIndices[mode][rs]];
	if (rd === 15)
	{
		this.resetPipeline();
	}
};

thumb.prototype.executeOpcode30 = function (instr, mode) { //30 - BX check needed PC = Rs     ;may switch THUMB/ARM
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	// When using R15 (PC) as operand, the value will be the address of the instruction plus 4 (ie. $+4). Except for BX R15: CPU switches to ARM state, and PC is auto-aligned as (($+4) AND NOT 2).
	// For BX/BLX, when Bit 0 of the value in Rs is zero:
	// Processor will be switched into ARM mode!
	// If so, Bit 1 of Rs must be cleared (32bit word aligned).
	// Thus, BX PC (switch to ARM) may be issued from word-aligned address ?????
	// only, the destination is PC+4 (ie. the following halfword is skipped).

	this.registers[15][this.registerIndices[mode][15]] = this.registers[rs][this.registerIndices[mode][rs]];
	if (bitSlice(this.registers[rs][this.registerIndices[mode][rs]], 0, 0) === 0) //if bit 0 of rs is 0, switch to arm state
	{
		this.changeState("ARM");
	}

	this.resetPipeline();
};

//THUMB.6------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode31 = function (instr, mode) { //31 - LDR IMM (PC) Rd = WORD[PC+nn]
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two
	let addr = ((this.registers[15][this.registerIndices[mode][15]] & ~2) + offset);
	//console.log("hello1");
	let data = this.mmu.read32(addr);		
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};

//THUMB.7/8------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode32 = function (instr, mode) { //32 - STR REG OFFSET WORD[Rb+Ro] = Rd
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write32((this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]]) & 0xFFFFFFFC, this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode33 = function (instr, mode) { //33 - STRH REG OFFSET HALFWORD[Rb+Ro] = Rd
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write16((this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]]) & 0xFFFFFFFE, this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode34 = function (instr, mode) { //34 - STRB REG OFFSET BYTE[Rb+Ro] = Rd
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write8((this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]]), this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode35 = function (instr, mode) { //35 - LDSB REG OFFSET Rd = BYTE[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let byte = this.mmu.read8((this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]]));
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	
	this.registers[rd][this.registerIndices[mode][rd]] = byte;
};

thumb.prototype.executeOpcode36 = function (instr, mode) { //36 - LDR REG OFFSET Rd = WORD[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]];
	
	let data = this.mmu.read32(addr & 0xFFFFFFFC);
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};

thumb.prototype.executeOpcode37 = function (instr, mode) { //37 - LDRH REG OFFSET Rd = HALFWORD[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]];
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};

thumb.prototype.executeOpcode38 = function (instr, mode) { //38 - LDRB REG OFFSET Rd = BYTE[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.registers[rd][this.registerIndices[mode][rd]] = this.mmu.read8(this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]]);
};

thumb.prototype.executeOpcode39 = function (instr, mode) { //39 - LDSH REG OFFSET Rd = HALFWORD[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][this.registerIndices[mode][rb]] + this.registers[ro][this.registerIndices[mode][ro]];

	if (addr & 1)
	{
		let byte = this.mmu.read8(addr);
		byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
		this.registers[rd][this.registerIndices[mode][rd]] = byte;
	}
	else
	{
		let halfword = this.mmu.read16(addr);
		halfword += halfword & 32768 ? 0xFFFF0000 : 0; //sign extend halfword
		this.registers[rd][this.registerIndices[mode][rd]] = halfword;
	}
};

//THUMB.9------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode40 = function (instr, mode) { //40 - STR IMM OFFSET WORD[Rb+nn] = Rd
	let offset = bitSlice(instr, 6, 10) << 2;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write32((this.registers[rb][this.registerIndices[mode][rb]] + offset) & 0xFFFFFFFC, this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode41 = function (instr, mode) { //41 - LDR IMM OFFSET Rd = WORD[Rb+nn]
	let offset = bitSlice(instr, 6, 10) << 2;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);
	let addr = this.registers[rb][this.registerIndices[mode][rb]] + offset;
	//console.log("hello2");
	let data = this.mmu.read32(addr & 0xFFFFFFFC);
	data = rotateRight(data, (addr & 3) << 3);

	//console.log(data);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};

thumb.prototype.executeOpcode42 = function (instr, mode) { //42 - STRB IMM OFFSET BYTE[Rb+nn] = Rd
	let offset = bitSlice(instr, 6, 10);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write8(this.registers[rb][this.registerIndices[mode][rb]] + offset, this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode43 = function (instr, mode) { //43 - LDRB IMM OFFSET Rd = BYTE[Rb+nn]
	let offset = bitSlice(instr, 6, 10);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.registers[rd][this.registerIndices[mode][rd]] = this.mmu.read8(this.registers[rb][this.registerIndices[mode][rb]] + offset);
};

//THUMB.10------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode44 = function (instr, mode) { //44 - STRH IMM OFFSET HALFWORD[Rb+nn] = Rd
	let offset = bitSlice(instr, 6, 10) << 1;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write16((this.registers[rb][this.registerIndices[mode][rb]] + offset) & 0xFFFFFFFE, this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode45 = function (instr, mode) { //45 - LDRH IMM OFFSET Rd = HALFWORD[Rb+nn]
	let offset = bitSlice(instr, 6, 10) << 1;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][this.registerIndices[mode][rb]] + offset;
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};

//THUMB.11------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode46 = function (instr, mode) { //46 - STR IMM OFFSET (SP) WORD[SP+nn] = Rd
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

	this.mmu.write32((this.registers[13][this.registerIndices[mode][13]] + offset) & 0xFFFFFFFC, this.registers[rd][this.registerIndices[mode][rd]]);
};

thumb.prototype.executeOpcode47 = function (instr, mode) { //47 - LDR IMM OFFSET (SP) Rd = WORD[SP+nn]
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two
	let addr = this.registers[13][this.registerIndices[mode][13]] + offset;

	let data = this.mmu.read32(addr & 0xFFFFFFFC);
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};

//THUMB.12------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode48 = function (instr, mode) { //48 - ADD RD PC IMM Rd = (($+4) AND NOT 2) + nn
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

	this.registers[rd][this.registerIndices[mode][rd]] = (this.registers[15][this.registerIndices[mode][15]] & 0xFFFFFFFC) + offset;
};

thumb.prototype.executeOpcode49 = function (instr, mode) { //49 - ADD RD SP IMM Rd = SP + nn
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

	this.registers[rd][this.registerIndices[mode][rd]] = this.registers[13][this.registerIndices[mode][13]] + offset;
};

//THUMB.13------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode50 = function (instr, mode) { //50 - ADD SP IMM SP = SP + nn
	let offset = bitSlice(instr, 0, 6) << 2; //offset is 9 bits, lower 2 bits are zero, so we shift left two

	this.registers[13][this.registerIndices[mode][13]] += offset;
};

thumb.prototype.executeOpcode51 = function (instr, mode) { //51 - ADD SP -IMM SP = SP - nn
	let offset = bitSlice(instr, 0, 6) << 2; //offset is 9 bits, lower 2 bits are zero, so we shift left two

	this.registers[13][this.registerIndices[mode][13]] -= offset;
};

//THUMB.14------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode52 = function (instr, mode) { //52 - PUSH store in memory, decrements SP (R13) STMDB=PUSH
	let pclrbit = bitSlice(instr, 8, 8);
	if (pclrbit)
	{
		this.registers[13][this.registerIndices[mode][13]] -= 4;
		//console.log("pushing register 14 to mem addr 0x" + this.registers[13][this.registerIndices[mode][13]].toString(16));
		this.mmu.write32(this.registers[13][this.registerIndices[mode][13]] & 0xFFFFFFFC, this.registers[14][this.registerIndices[mode][14]]);
	}
	for (let i = 7; i > -1; i --)
	{
		if (bitSlice(instr, i, i))
		{
			this.registers[13][this.registerIndices[mode][13]] -= 4;
			//console.log("pushing register " + i + " to mem addr 0x" + this.registers[13][this.registerIndices[mode][13]].toString(16));
			this.mmu.write32(this.registers[13][this.registerIndices[mode][13]] & 0xFFFFFFFC, this.registers[i][this.registerIndices[mode][i]]);
		}
	}
};

thumb.prototype.executeOpcode53 = function (instr, mode) { //53 - POP load from memory, increments SP (R13) LDMIA=POP
	let pclrbit = bitSlice(instr, 8, 8);
	for (let i = 0; i < 8; i ++)
	{
		if (bitSlice(instr, i, i))
		{
			//console.log("popping register " + i + " from mem addr 0x" + this.registers[13][this.registerIndices[mode][13]].toString(16));
			this.registers[i][this.registerIndices[mode][i]] = this.mmu.read32(this.registers[13][this.registerIndices[mode][13]] & 0xFFFFFFFC)
			this.registers[13][this.registerIndices[mode][13]] += 4;
		}
	}
	if (pclrbit)
	{
		//console.log("popping register 15 from mem addr 0x" + this.registers[13][this.registerIndices[mode][13]].toString(16));
		this.registers[15][this.registerIndices[mode][15]] = this.mmu.read32(this.registers[13][this.registerIndices[mode][13]] & 0xFFFFFFFC);
		this.registers[13][this.registerIndices[mode][13]] += 4;
		this.resetPipeline();
	}
};

//THUMB.15------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode54 = function (instr, mode) { //54 - STMIA store in memory, increments Rb
	let rb = bitSlice(instr, 8, 10);
	let addr = this.registers[rb][this.registerIndices[mode][rb]]; 
	let addrb;

	if (!bitSlice(instr, 0, 7)) //empty rlist
	{
		this.mmu.write32(addr & 0xFFFFFFFC, this.registers[15][0] + 2);
		this.registers[rb][this.registerIndices[mode][rb]] += 0x40;
	}
	else
	{
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				if (i === rb)
							addrb = addr;
				this.mmu.write32(addr & 0xFFFFFFFC, this.registers[i][this.registerIndices[mode][i]]);
				addr += 4;
			}
		}
		if (bitSlice(instr, rb, rb)) //if rb in rlist
		{
			if ((rb !== 0) && bitSlice(instr, 0, rb - 1)) //if base reg not first entry in rlist, store modified base
			{
				this.mmu.write32(addrb & 0xFFFFFFFC, addr);
			}
		}
		this.registers[rb][this.registerIndices[mode][rb]] = addr;
	}
};

thumb.prototype.executeOpcode55 = function (instr, mode) { //55 - LDMIA load from memory, increments Rb
	let rb = bitSlice(instr, 8, 10);
	let addr = this.registers[rb][this.registerIndices[mode][rb]];

	if (!bitSlice(instr, 0, 7)) //empty rlist
	{
		this.registers[15][0] = this.mmu.read32(addr & 0xFFFFFFFC);
		this.registers[rb][this.registerIndices[mode][rb]] += 0x40;
		this.resetPipeline();
	}
	else
	{
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				this.registers[i][this.registerIndices[mode][i]] = this.mmu.read32(addr & 0xFFFFFFFC)
				addr += 4;
			}
		}
		if (!bitSlice(instr, rb, rb)) //only write back final addr if rb not in rlist
		{
			this.registers[rb][this.registerIndices[mode][rb]] = addr;
		}
	}
};

//THUMB.16------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode56 = function (instr, mode) { //56 - CONDITIONAL BRANCH
	let condition = bitSlice(instr, 8, 11);
	let offset =  bitSlice(instr, 7, 7) ? (((bitSlice(instr, 0, 7) - 1) ^ 0xFF) * -1) << 1 : bitSlice(instr, 0, 6) << 1;
	let flags = bitSlice(this.registers[16][this.registerIndices[mode][16]], 28, 31); //N, Z, C, V
	let execute = false;

	switch(condition)
	{
		case 0: execute = (flags & 0x4) ? true : false; //BEQ Z=1
		break;
		case 1: execute = (flags & 0x4) ? false : true; //BNE Z=0
		break;
		case 2: execute = (flags & 0x2) ? true : false; //BCS/BHS C=1
		break;
		case 3: execute = (flags & 0x2) ? false : true; //BCC/BLO C=0
		break;
		case 4: execute = (flags & 0x8) ? true : false; //BMI N=1
		break;
		case 5: execute = (flags & 0x8) ? false : true; //BPL N=0
		break;
		case 6: execute = (flags & 0x1) ? true : false; //BVS V=1
		break;
		case 7: execute = (flags & 0x1) ? false : true; //BVC V=0
		break;
		case 8: execute = ((flags & 0x2) && !(flags & 0x4)) ? true : false; //BHI C=1 and Z=0 
		break;
		case 9: execute = (!(flags & 0x2) || (flags & 0x4)) ? true : false; //BLS C=0 or Z=1
		break;
		case 10: execute = (!!(flags & 0x8) === !!(flags & 0x1)) ? true : false; //BGE N=V
		break;
		case 11: execute = (!!(flags & 0x8) !== !!(flags & 0x1)) ? true : false; //BLT N<>V
		break;
		case 12: execute = ((!!(flags & 0x8) === !!(flags & 0x1)) && !(flags & 0x4)) ? true : false; //BGT N=V and Z=0
		break;
		case 13: execute = ((!!(flags & 0x8) !== !!(flags & 0x1)) || (flags & 0x4)) ? true : false; //BLE N<>V or Z=1
		break;
		case 14: throw Error("invalid opcode (0xE) with THUMB conditional branch");
		break;
		case 15: throw Error("error with parsing, decode returned opcode for conditional branch instead of SWI");
		break;
	}

	if (execute)
	{
		this.registers[15][0] += offset;
		this.resetPipeline();
	}
};

//THUMB.17------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode57 = function (instr, mode) { //57 - SWI
	this.startSWI();
};

//THUMB.18------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode58 = function (instr, mode) { //58 - UNCONDITIONAL BRANCH
	//offset is signed
	let offset =  bitSlice(instr, 10, 10) ? (((~(bitSlice(instr, 0, 10) - 1)) & 0x7FF) * -1) << 1 : bitSlice(instr, 0, 9) << 1;
	this.registers[15][0] += offset;
	this.resetPipeline();
};

//THUMB.19------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode59 = function (instr, mode) { //59 - LONG BRANCH 1
	let offset = bitSlice(instr, 0, 10) << 12;

	if (bitSlice(offset, 22, 22)) //msb set, negative offset
	{
		let offset2 = bitSlice(this.mmu.read16(this.registers[15][this.registerIndices[mode][15]] - 2), 0, 10) << 1; //get offset in the next instruction

		offset += offset2;
		offset = (~(offset - 1)) & 0x7FFFFF; //convert offset to its absolute value

		//long branch 2 will be adding offset2, so we subtract it to cancel it out
		this.registers[14][this.registerIndices[mode][14]] = this.registers[15][this.registerIndices[mode][15]] - (offset + offset2);
	}
	else //dont have to do anything for positive offset
	{
		this.registers[14][this.registerIndices[mode][14]] = this.registers[15][this.registerIndices[mode][15]] + offset;
	}
};

thumb.prototype.executeOpcode60 = function (instr, mode) { //60 - LONG BRANCH 2
	let offset = bitSlice(instr, 0, 10) << 1;

	let temp = this.registers[14][this.registerIndices[mode][14]];
	this.registers[14][this.registerIndices[mode][14]] = (this.registers[15][this.registerIndices[mode][15]] - 2) | 1;
	this.registers[15][0] = (temp + offset);
	this.resetPipeline();
};

thumb.prototype.decode = function (instr) {
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
	return 100;
};

thumb.prototype.execute = function (instr, opcode, mode) {
	this.executeOpcode[opcode](instr, mode);
};

// thumb.prototype.execute = function (instr, opcode, mode) {
// 	switch (opcode)
// 	{
// 		case 0: this.executeOpcode0(instr, mode); break;
// 		case 1: this.executeOpcode1(instr, mode); break;
// 		case 2: this.executeOpcode2(instr, mode); break;
// 		case 3: this.executeOpcode3(instr, mode); break;
// 		case 4: this.executeOpcode4(instr, mode); break;
// 		case 5: this.executeOpcode5(instr, mode); break;
// 		case 6: this.executeOpcode6(instr, mode); break;
// 		case 7: this.executeOpcode7(instr, mode); break;
// 		case 8: this.executeOpcode8(instr, mode); break;
// 		case 9: this.executeOpcode9(instr, mode); break;
// 		case 10: this.executeOpcode10(instr, mode); break;
// 		case 11: this.executeOpcode11(instr, mode); break;
// 		case 12: this.executeOpcode12(instr, mode); break;
// 		case 13: this.executeOpcode13(instr, mode); break;
// 		case 14: this.executeOpcode14(instr, mode); break;
// 		case 15: this.executeOpcode15(instr, mode); break;
// 		case 16: this.executeOpcode16(instr, mode); break;
// 		case 17: this.executeOpcode17(instr, mode); break;
// 		case 18: this.executeOpcode18(instr, mode); break;
// 		case 19: this.executeOpcode19(instr, mode); break;
// 		case 20: this.executeOpcode20(instr, mode); break;
// 		case 21: this.executeOpcode21(instr, mode); break;
// 		case 22: this.executeOpcode22(instr, mode); break;
// 		case 23: this.executeOpcode23(instr, mode); break;
// 		case 24: this.executeOpcode24(instr, mode); break;
// 		case 25: this.executeOpcode25(instr, mode); break;
// 		case 26: this.executeOpcode26(instr, mode); break;
// 		case 27: this.executeOpcode27(instr, mode); break;
// 		case 28: this.executeOpcode28(instr, mode); break;
// 		case 29: this.executeOpcode29(instr, mode); break;
// 		case 30: this.executeOpcode30(instr, mode); break;
// 		case 31: this.executeOpcode31(instr, mode); break;
// 		case 32: this.executeOpcode32(instr, mode); break;
// 		case 33: this.executeOpcode33(instr, mode); break;
// 		case 34: this.executeOpcode34(instr, mode); break;
// 		case 35: this.executeOpcode35(instr, mode); break;
// 		case 36: this.executeOpcode36(instr, mode); break;
// 		case 37: this.executeOpcode37(instr, mode); break;
// 		case 38: this.executeOpcode38(instr, mode); break;
// 		case 39: this.executeOpcode39(instr, mode); break;
// 		case 40: this.executeOpcode40(instr, mode); break;
// 		case 41: this.executeOpcode41(instr, mode); break;
// 		case 42: this.executeOpcode42(instr, mode); break;
// 		case 43: this.executeOpcode43(instr, mode); break;
// 		case 44: this.executeOpcode44(instr, mode); break;
// 		case 45: this.executeOpcode45(instr, mode); break;
// 		case 46: this.executeOpcode46(instr, mode); break;
// 		case 47: this.executeOpcode47(instr, mode); break;
// 		case 48: this.executeOpcode48(instr, mode); break;
// 		case 49: this.executeOpcode49(instr, mode); break;
// 		case 50: this.executeOpcode50(instr, mode); break;
// 		case 51: this.executeOpcode51(instr, mode); break;
// 		case 52: this.executeOpcode52(instr, mode); break;
// 		case 53: this.executeOpcode53(instr, mode); break;
// 		case 54: this.executeOpcode54(instr, mode); break;
// 		case 55: this.executeOpcode55(instr, mode); break;
// 		case 56: this.executeOpcode56(instr, mode); break;
// 		case 57: this.executeOpcode57(instr, mode); break;
// 		case 58: this.executeOpcode58(instr, mode); break;
// 		case 59: this.executeOpcode59(instr, mode); break;
// 		case 60: this.executeOpcode60(instr, mode); break;
// 		case 100: throw Error("executing undefined instruction");
// 		default: throw Error("invalid thumb opcode: " + opcode); //should never happen
// 	}
// };
	
thumb.prototype.initFnTable = function () {
	this.executeOpcode = [];
	this.executeOpcode.push(this.executeOpcode0.bind(this));
	this.executeOpcode.push(this.executeOpcode1.bind(this));
	this.executeOpcode.push(this.executeOpcode2.bind(this));
	this.executeOpcode.push(this.executeOpcode3.bind(this));
	this.executeOpcode.push(this.executeOpcode4.bind(this));
	this.executeOpcode.push(this.executeOpcode5.bind(this));
	this.executeOpcode.push(this.executeOpcode6.bind(this));
	this.executeOpcode.push(this.executeOpcode7.bind(this));
	this.executeOpcode.push(this.executeOpcode8.bind(this));
	this.executeOpcode.push(this.executeOpcode9.bind(this));
	this.executeOpcode.push(this.executeOpcode10.bind(this));
	this.executeOpcode.push(this.executeOpcode11.bind(this));
	this.executeOpcode.push(this.executeOpcode12.bind(this));
	this.executeOpcode.push(this.executeOpcode13.bind(this));
	this.executeOpcode.push(this.executeOpcode14.bind(this));
	this.executeOpcode.push(this.executeOpcode15.bind(this));
	this.executeOpcode.push(this.executeOpcode16.bind(this));
	this.executeOpcode.push(this.executeOpcode17.bind(this));
	this.executeOpcode.push(this.executeOpcode18.bind(this));
	this.executeOpcode.push(this.executeOpcode19.bind(this));
	this.executeOpcode.push(this.executeOpcode20.bind(this));
	this.executeOpcode.push(this.executeOpcode21.bind(this));
	this.executeOpcode.push(this.executeOpcode22.bind(this));
	this.executeOpcode.push(this.executeOpcode23.bind(this));
	this.executeOpcode.push(this.executeOpcode24.bind(this));
	this.executeOpcode.push(this.executeOpcode25.bind(this));
	this.executeOpcode.push(this.executeOpcode26.bind(this));
	this.executeOpcode.push(this.executeOpcode27.bind(this));
	this.executeOpcode.push(this.executeOpcode28.bind(this));
	this.executeOpcode.push(this.executeOpcode29.bind(this));
	this.executeOpcode.push(this.executeOpcode30.bind(this));
	this.executeOpcode.push(this.executeOpcode31.bind(this));
	this.executeOpcode.push(this.executeOpcode32.bind(this));
	this.executeOpcode.push(this.executeOpcode33.bind(this));
	this.executeOpcode.push(this.executeOpcode34.bind(this));
	this.executeOpcode.push(this.executeOpcode35.bind(this));
	this.executeOpcode.push(this.executeOpcode36.bind(this));
	this.executeOpcode.push(this.executeOpcode37.bind(this));
	this.executeOpcode.push(this.executeOpcode38.bind(this));
	this.executeOpcode.push(this.executeOpcode39.bind(this));
	this.executeOpcode.push(this.executeOpcode40.bind(this));
	this.executeOpcode.push(this.executeOpcode41.bind(this));
	this.executeOpcode.push(this.executeOpcode42.bind(this));
	this.executeOpcode.push(this.executeOpcode43.bind(this));
	this.executeOpcode.push(this.executeOpcode44.bind(this));
	this.executeOpcode.push(this.executeOpcode45.bind(this));
	this.executeOpcode.push(this.executeOpcode46.bind(this));
	this.executeOpcode.push(this.executeOpcode47.bind(this));
	this.executeOpcode.push(this.executeOpcode48.bind(this));
	this.executeOpcode.push(this.executeOpcode49.bind(this));
	this.executeOpcode.push(this.executeOpcode50.bind(this));
	this.executeOpcode.push(this.executeOpcode51.bind(this));
	this.executeOpcode.push(this.executeOpcode52.bind(this));
	this.executeOpcode.push(this.executeOpcode53.bind(this));
	this.executeOpcode.push(this.executeOpcode54.bind(this));
	this.executeOpcode.push(this.executeOpcode55.bind(this));
	this.executeOpcode.push(this.executeOpcode56.bind(this));
	this.executeOpcode.push(this.executeOpcode57.bind(this));
	this.executeOpcode.push(this.executeOpcode58.bind(this));
	this.executeOpcode.push(this.executeOpcode59.bind(this));
	this.executeOpcode.push(this.executeOpcode60.bind(this));
}
