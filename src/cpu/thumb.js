const thumb = function(cpu, mmu) {
	this.cpu = cpu;
	this.mmu = mmu;
	this.registers = cpu.registers;

	this.shiftCarryFlag = undefined;
	this.initFnTable();
	this.initLUT();
};

thumb.prototype.thumbLUT = new Uint8Array(1024);

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
	//if cflag / vflag not provided, keep the current flag value
	cflag = (cflag === undefined) ? (this.registers[16][0] & 0x20000000) : (cflag ? 0x20000000 : 0);
	vflag = (vflag === undefined) ? (this.registers[16][0] & 0x10000000) : (vflag ? 0x10000000 : 0);

  this.registers[16][0] &= 0x00FFFFFF; //set first byte to zero
  this.registers[16][0] = this.registers[16][0] | (nflag ? 0x80000000 : 0) | (zflag ? 0x40000000 : 0) | cflag | vflag; //add new flags to CPSR
};

//THUMB.1------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode0 = function (instr) { //0 - LSL IMM5 Rd,Rs,#Offset 
	let offset = bitSlice(instr, 6, 10);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][0] << offset;
	
	this.setNZCV(bitSlice(result, 31, 31), result === 0, offset === 0 ? undefined : bitSlice(this.registers[rs][0], 32 - offset, 32 - offset));
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode1 = function (instr) { //1 - LSR IMM5 Rd,Rs,#Offset (shifts in zeroes)
	let offset = bitSlice(instr, 6, 10);
			offset = offset === 0 ? 32 : offset;
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = offset === 32 ? 0 : this.registers[rs][0] >>> offset;
	
	this.setNZCV(bitSlice(result, 31, 31), result === 0, bitSlice(this.registers[rs][0], offset - 1, offset - 1));
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode2 = function (instr) { //2 - ASR IMM5 Rd,Rs,#Offset (shifts in most significant bit)
	let offset = bitSlice(instr, 6, 10);
			offset = offset === 0 ? 32 : offset;
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = offset === 32 ? ((this.registers[rs][0] >>> 31) === 1 ? 0xFFFFFFFF : 0) : this.registers[rs][0] >> offset;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, bitSlice(this.registers[rs][0], offset - 1, offset - 1));
	this.registers[rd][0] = result;
};

//THUMB.2------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode3 = function (instr) { //3 - ADD REGISTER Rd=Rs+Rn
	let rn = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][0] + this.registers[rn][0];
		let vflag = bitSlice(this.registers[rs][0], 31, 31) + bitSlice(this.registers[rn][0], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode4 = function (instr) { //4 - SUBTRACT REGISTER Rd=Rs-Rn
	let rn = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (this.registers[rs][0] - this.registers[rn][0]) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rs][0], 31, 31) + (bitSlice(this.registers[rn][0], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][0] <= this.registers[rs][0], (vflag === 0) || (vflag === 3));
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode5 = function (instr) { //5 - ADD IMM3 Rd=Rs+nn
	let imm = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][0] + imm;
	let vflag = bitSlice(this.registers[rs][0], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, vflag === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode6 = function (instr) { //6 - SUB IMM3 Rd=Rs-nn
	let imm = bitSlice(instr, 6, 8);
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (this.registers[rs][0] - imm) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rs][0], 31, 31) + 1 + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, imm <= this.registers[rs][0], vflag === 3);
	this.registers[rd][0] = result;
};

//THUMB.3------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode7 = function (instr) { //7 - MOV IMM8 Rd   = #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	this.setNZCV(false, imm === 0);
	this.registers[rd][0] = imm;
};

thumb.prototype.executeOpcode8 = function (instr) { //8 - CMP IMM8 Void = Rd - #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	let result = this.registers[rd][0] - imm;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, imm <= this.registers[rd][0], bitSlice(this.registers[rd][0], 31, 31) && (!bitSlice(result, 31, 31)));
};

thumb.prototype.executeOpcode9 = function (instr) { //9 - ADD IMM8 Rd   = Rd + #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	let result = this.registers[rd][0] + imm
	let vflag = bitSlice(this.registers[rd][0], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, vflag === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode10 = function (instr) { //10 - SUB IMM8 Rd   = Rd - #nn
	let rd = bitSlice(instr, 8, 10);
	let imm = bitSlice(instr, 0, 7);

	let result = (this.registers[rd][0] - imm) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][0], 31, 31) + 1 + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, imm <= this.registers[rd][0], vflag === 3);
	this.registers[rd][0] = result;
};

//THUMB.4------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode11 = function (instr) { //11 - AND  Rd = Rd AND Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][0] & this.registers[rs][0];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode12 = function (instr) { //12 - XOR Rd = Rd XOR Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][0] ^ this.registers[rs][0];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode13 = function (instr) { //13 - LSL Rd = Rd << (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let sh = this.registers[rs][0] & 0xFF;
	let result = this.LSLRegByReg(this.registers[rd][0], sh);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode14 = function (instr) { //14 - LSR Rd = Rd >> (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let sh = this.registers[rs][0] & 0xFF;
	let result = this.LSRRegByReg(this.registers[rd][0], sh);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode15 = function (instr) { //15 - ASR Rd = Rd SAR (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let sh = this.registers[rs][0] & 0xFF;
	let result = this.ASRRegByReg(this.registers[rd][0], sh);
	
	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode16 = function (instr) { //16 - ADC Rd = Rd + Rs + Cy
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = (this.registers[rd][0] + this.registers[rs][0] + carryFlag);
	let vflag = bitSlice(this.registers[rd][0], 31, 31) + bitSlice(this.registers[rs][0], 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode17 = function (instr) { //17 - SBC Rd = Rd - Rs - NOT Cy
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);
	let negCarryFlag = bitSlice(this.registers[16][0], 29, 29) === 0 ? 1 : 0;

	let result = (this.registers[rd][0] - (this.registers[rs][0] + negCarryFlag)) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][0], 31, 31) + ((bitSlice(this.registers[rs][0] + negCarryFlag, 31, 31)) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rs][0] + negCarryFlag) <= this.registers[rd][0], (vflag === 0) || (vflag === 3));
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode18 = function (instr) { //18 - ROTATE RIGHT Rd = Rd ROR (Rs AND 0FFh)
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let ro = (this.registers[rs][0] & 0xFF);
	let result = this.RORRegByReg(this.registers[rd][0], ro);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode19 = function (instr) { //19 - TST Void = Rd AND Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][0] & this.registers[rs][0];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
};

thumb.prototype.executeOpcode20 = function (instr) { //20 - NEG Rd = 0 - Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (0 - this.registers[rs][0]) & 0xFFFFFFFF;
	let vflag = (bitSlice(this.registers[rs][0], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, result === 0, vflag === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode21 = function (instr) { //21 - CMP Void = Rd - Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = (this.registers[rd][0] - this.registers[rs][0]) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][0], 31, 31) + (bitSlice(this.registers[rs][0], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rs][0] <= this.registers[rd][0], (vflag === 0) || (vflag === 3));
};

thumb.prototype.executeOpcode22 = function (instr) { //22 - NEGCMP Void = Rd + Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][0] + this.registers[rs][0];
		let vflag = bitSlice(this.registers[rd][0], 31, 31) + bitSlice(this.registers[rs][0], 31, 31) + (bitSlice(result, 31, 31) ^ 1);
		// console.log("rd: " + this.registers[rd][0].toString(16));
		// console.log("rs: " + this.registers[rs][0].toString(16));
		// console.log("result: " + result.toString(16));
		// console.log("vflag: "+ vflag);
	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF ) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
};

thumb.prototype.executeOpcode23 = function (instr) { //23 - OR Rd = Rd OR Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rs][0] | this.registers[rd][0];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode24 = function (instr) { //24 - MUL Rd = Rd * Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = Number((BigInt(this.registers[rd][0]) * BigInt(this.registers[rs][0])) & 0xFFFFFFFFn);

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode25 = function (instr) { //25 - BIT CLEAR Rd = Rd AND NOT Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = this.registers[rd][0] & (~this.registers[rs][0]);

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][0] = result;
};

thumb.prototype.executeOpcode26 = function (instr) { //26 - NOT Rd = NOT Rs
	let rs = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let result = ~this.registers[rs][0];

	this.setNZCV(bitSlice(result, 31, 31), result === 0);
	this.registers[rd][0] = result;
};

//THUMB.5------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode27 = function (instr) { //27 - ADD check needed Rd = Rd+Rs
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

	this.registers[rd][0] += this.registers[rs][0];
	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}
};

thumb.prototype.executeOpcode28 = function (instr) { //28 - CMP check needed Void = Rd-Rs  ;CPSR affected
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

	let result = (this.registers[rd][0] - this.registers[rs][0]) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rd][0], 31, 31) + (bitSlice(this.registers[rs][0], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rs][0] <= this.registers[rd][0], (vflag === 0) || (vflag === 3));
};

thumb.prototype.executeOpcode29 = function (instr) { //29 - MOV check needed Rd = Rs
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	let rd = bitSlice(instr, 0, 2) + (bitSlice(instr, 7, 7) << 3); //add the msbd 

	this.registers[rd][0] = this.registers[rs][0];
	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}
};

thumb.prototype.executeOpcode30 = function (instr) { //30 - BX check needed PC = Rs     ;may switch THUMB/ARM
	let rs = bitSlice(instr, 3, 6); //msbs and rs are grouped together already
	// When using R15 (PC) as operand, the value will be the address of the instruction plus 4 (ie. $+4). Except for BX R15: CPU switches to ARM state, and PC is auto-aligned as (($+4) AND NOT 2).
	// For BX/BLX, when Bit 0 of the value in Rs is zero:
	// Processor will be switched into ARM mode!
	// If so, Bit 1 of Rs must be cleared (32bit word aligned).
	// Thus, BX PC (switch to ARM) may be issued from word-aligned address ?????
	// only, the destination is PC+4 (ie. the following halfword is skipped).

	this.registers[15][0] = this.registers[rs][0];
	if (bitSlice(this.registers[rs][0], 0, 0) === 0) //if bit 0 of rs is 0, switch to arm state
	{
		this.cpu.changeState(this.cpu.stateENUMS["ARM"]);
	}

	this.cpu.resetPipeline();
};

//THUMB.6------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode31 = function (instr) { //31 - LDR IMM (PC) Rd = WORD[PC+nn]
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two
	let addr = ((this.registers[15][0] & ~2) + offset);
	//console.log("hello1");
	let data = this.mmu.read32(addr);		
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][0] = data;
};

//THUMB.7/8------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode32 = function (instr) { //32 - STR REG OFFSET WORD[Rb+Ro] = Rd
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write32((this.registers[rb][0] + this.registers[ro][0]) & 0xFFFFFFFC, this.registers[rd][0]);
};

thumb.prototype.executeOpcode33 = function (instr) { //33 - STRH REG OFFSET HALFWORD[Rb+Ro] = Rd
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write16((this.registers[rb][0] + this.registers[ro][0]) & 0xFFFFFFFE, this.registers[rd][0]);
};

thumb.prototype.executeOpcode34 = function (instr) { //34 - STRB REG OFFSET BYTE[Rb+Ro] = Rd
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write8((this.registers[rb][0] + this.registers[ro][0]), this.registers[rd][0]);
};

thumb.prototype.executeOpcode35 = function (instr) { //35 - LDSB REG OFFSET Rd = BYTE[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let byte = this.mmu.read8((this.registers[rb][0] + this.registers[ro][0]));
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	
	this.registers[rd][0] = byte;
};

thumb.prototype.executeOpcode36 = function (instr) { //36 - LDR REG OFFSET Rd = WORD[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][0] + this.registers[ro][0];
	
	let data = this.mmu.read32(addr & 0xFFFFFFFC);
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][0] = data;
};

thumb.prototype.executeOpcode37 = function (instr) { //37 - LDRH REG OFFSET Rd = HALFWORD[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][0] + this.registers[ro][0];
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][0] = data;
};

thumb.prototype.executeOpcode38 = function (instr) { //38 - LDRB REG OFFSET Rd = BYTE[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.registers[rd][0] = this.mmu.read8(this.registers[rb][0] + this.registers[ro][0]);
};

thumb.prototype.executeOpcode39 = function (instr) { //39 - LDSH REG OFFSET Rd = HALFWORD[Rb+Ro]
	let ro = bitSlice(instr, 6, 8);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][0] + this.registers[ro][0];

	if (addr & 1)
	{
		let byte = this.mmu.read8(addr);
		byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
		this.registers[rd][0] = byte;
	}
	else
	{
		let halfword = this.mmu.read16(addr);
		halfword += halfword & 32768 ? 0xFFFF0000 : 0; //sign extend halfword
		this.registers[rd][0] = halfword;
	}
};

//THUMB.9------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode40 = function (instr) { //40 - STR IMM OFFSET WORD[Rb+nn] = Rd
	let offset = bitSlice(instr, 6, 10) << 2;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write32((this.registers[rb][0] + offset) & 0xFFFFFFFC, this.registers[rd][0]);
};

thumb.prototype.executeOpcode41 = function (instr) { //41 - LDR IMM OFFSET Rd = WORD[Rb+nn]
	let offset = bitSlice(instr, 6, 10) << 2;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);
	let addr = this.registers[rb][0] + offset;

	let data = this.mmu.read32(addr & 0xFFFFFFFC);
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][0] = data;
};

thumb.prototype.executeOpcode42 = function (instr) { //42 - STRB IMM OFFSET BYTE[Rb+nn] = Rd
	let offset = bitSlice(instr, 6, 10);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write8(this.registers[rb][0] + offset, this.registers[rd][0]);
};

thumb.prototype.executeOpcode43 = function (instr) { //43 - LDRB IMM OFFSET Rd = BYTE[Rb+nn]
	let offset = bitSlice(instr, 6, 10);
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.registers[rd][0] = this.mmu.read8(this.registers[rb][0] + offset);
};

//THUMB.10------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode44 = function (instr) { //44 - STRH IMM OFFSET HALFWORD[Rb+nn] = Rd
	let offset = bitSlice(instr, 6, 10) << 1;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	this.mmu.write16((this.registers[rb][0] + offset) & 0xFFFFFFFE, this.registers[rd][0]);
};

thumb.prototype.executeOpcode45 = function (instr) { //45 - LDRH IMM OFFSET Rd = HALFWORD[Rb+nn]
	let offset = bitSlice(instr, 6, 10) << 1;
	let rb = bitSlice(instr, 3, 5);
	let rd = bitSlice(instr, 0, 2);

	let addr = this.registers[rb][0] + offset;
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][0] = data;
};

//THUMB.11------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode46 = function (instr) { //46 - STR IMM OFFSET (SP) WORD[SP+nn] = Rd
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

	this.mmu.write32((this.registers[13][0] + offset) & 0xFFFFFFFC, this.registers[rd][0]);
};

thumb.prototype.executeOpcode47 = function (instr) { //47 - LDR IMM OFFSET (SP) Rd = WORD[SP+nn]
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two
	let addr = this.registers[13][0] + offset;

	let data = this.mmu.read32(addr & 0xFFFFFFFC);
	data = rotateRight(data, (addr & 3) << 3);

	this.registers[rd][0] = data;
};

//THUMB.12------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode48 = function (instr) { //48 - ADD RD PC IMM Rd = (($+4) AND NOT 2) + nn
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

	this.registers[rd][0] = (this.registers[15][0] & 0xFFFFFFFC) + offset;
};

thumb.prototype.executeOpcode49 = function (instr) { //49 - ADD RD SP IMM Rd = SP + nn
	let rd = bitSlice(instr, 8, 10);
	let offset = bitSlice(instr, 0, 7) << 2; //offset is 10 bits, lower 2 bits are zero, so we shift left two

	this.registers[rd][0] = this.registers[13][0] + offset;
};

//THUMB.13------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode50 = function (instr) { //50 - ADD SP IMM SP = SP + nn
	let offset = bitSlice(instr, 0, 6) << 2; //offset is 9 bits, lower 2 bits are zero, so we shift left two

	this.registers[13][0] += offset;
};

thumb.prototype.executeOpcode51 = function (instr) { //51 - ADD SP -IMM SP = SP - nn
	let offset = bitSlice(instr, 0, 6) << 2; //offset is 9 bits, lower 2 bits are zero, so we shift left two

	this.registers[13][0] -= offset;
};

//THUMB.14------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode52 = function (instr) { //52 - PUSH store in memory, decrements SP (R13) STMDB=PUSH
	let pclrbit = bitSlice(instr, 8, 8);
	if (pclrbit)
	{
		this.registers[13][0] -= 4;
		//console.log("pushing register 14 to mem addr 0x" + this.registers[13][0].toString(16));
		this.mmu.write32(this.registers[13][0] & 0xFFFFFFFC, this.registers[14][0]);
	}
	for (let i = 7; i > -1; i --)
	{
		if (bitSlice(instr, i, i))
		{
			this.registers[13][0] -= 4;
			//console.log("pushing register " + i + " to mem addr 0x" + this.registers[13][0].toString(16));
			this.mmu.write32(this.registers[13][0] & 0xFFFFFFFC, this.registers[i][0]);
		}
	}
};

thumb.prototype.executeOpcode53 = function (instr) { //53 - POP load from memory, increments SP (R13) LDMIA=POP
	let pclrbit = bitSlice(instr, 8, 8);
	for (let i = 0; i < 8; i ++)
	{
		if (bitSlice(instr, i, i))
		{
			//console.log("popping register " + i + " from mem addr 0x" + this.registers[13][0].toString(16));
			this.registers[i][0] = this.mmu.read32(this.registers[13][0] & 0xFFFFFFFC)
			this.registers[13][0] += 4;
		}
	}
	if (pclrbit)
	{
		//console.log("popping register 15 from mem addr 0x" + this.registers[13][0].toString(16));
		this.registers[15][0] = this.mmu.read32(this.registers[13][0] & 0xFFFFFFFC);
		this.registers[13][0] += 4;
		this.cpu.resetPipeline();
	}
};

//THUMB.15------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode54 = function (instr) { //54 - STMIA store in memory, increments Rb
	let rb = bitSlice(instr, 8, 10);
	let addr = this.registers[rb][0]; 
	let addrb;

	if (!bitSlice(instr, 0, 7)) //empty rlist
	{
		this.mmu.write32(addr & 0xFFFFFFFC, this.registers[15][0] + 2);
		this.registers[rb][0] += 0x40;
	}
	else
	{
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				if (i === rb)
							addrb = addr;
				this.mmu.write32(addr & 0xFFFFFFFC, this.registers[i][0]);
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
		this.registers[rb][0] = addr;
	}
};

thumb.prototype.executeOpcode55 = function (instr) { //55 - LDMIA load from memory, increments Rb
	let rb = bitSlice(instr, 8, 10);
	let addr = this.registers[rb][0];

	if (!bitSlice(instr, 0, 7)) //empty rlist
	{
		this.registers[15][0] = this.mmu.read32(addr & 0xFFFFFFFC);
		this.registers[rb][0] += 0x40;
		this.cpu.resetPipeline();
	}
	else
	{
		for (let i = 0; i < 8; i ++)
		{
			if (bitSlice(instr, i, i))
			{
				this.registers[i][0] = this.mmu.read32(addr & 0xFFFFFFFC)
				addr += 4;
			}
		}
		if (!bitSlice(instr, rb, rb)) //only write back final addr if rb not in rlist
		{
			this.registers[rb][0] = addr;
		}
	}
};

//THUMB.16------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode56 = function (instr) { //56 - CONDITIONAL BRANCH
	let condition = bitSlice(instr, 8, 11);
	let offset =  bitSlice(instr, 7, 7) ? (((bitSlice(instr, 0, 7) - 1) ^ 0xFF) * -1) << 1 : bitSlice(instr, 0, 6) << 1;
	let flags = bitSlice(this.registers[16][0], 28, 31); //N, Z, C, V
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
		this.cpu.resetPipeline();
	}
};

//THUMB.17------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode57 = function (instr) { //57 - SWI
	this.cpu.startSWI(bitSlice(instr, 0, 7));
};

//THUMB.18------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode58 = function (instr) { //58 - UNCONDITIONAL BRANCH
	//offset is signed
	let offset =  bitSlice(instr, 10, 10) ? (((~(bitSlice(instr, 0, 10) - 1)) & 0x7FF) * -1) << 1 : bitSlice(instr, 0, 9) << 1;
	this.registers[15][0] += offset;
	this.cpu.resetPipeline();
};

//THUMB.19------------------------------------------------------------------------------------------------------
thumb.prototype.executeOpcode59 = function (instr) { //59 - LONG BRANCH 1
	let offset = bitSlice(instr, 0, 10) << 12;

	if (bitSlice(offset, 22, 22)) //msb set, negative offset
	{
		let offset2 = bitSlice(this.mmu.read16(this.registers[15][0] - 2), 0, 10) << 1; //get offset in the next instruction

		offset += offset2;
		offset = (~(offset - 1)) & 0x7FFFFF; //convert offset to its absolute value

		//long branch 2 will be adding offset2, so we subtract it to cancel it out
		this.registers[14][0] = this.registers[15][0] - (offset + offset2);
	}
	else //dont have to do anything for positive offset
	{
		this.registers[14][0] = this.registers[15][0] + offset;
	}
};

thumb.prototype.executeOpcode60 = function (instr) { //60 - LONG BRANCH 2
	let offset = bitSlice(instr, 0, 10) << 1;

	let temp = this.registers[14][0];
	this.registers[14][0] = (this.registers[15][0] - 2) | 1;
	this.registers[15][0] = (temp + offset);
	this.cpu.resetPipeline();
};

thumb.prototype.decode = function (instr) {
	return this.thumbLUT[bitSlice(instr, 6, 15)];
};

thumb.prototype.execute = function (instr, opcode) {
	this.executeOpcode[opcode](instr);
};
	
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

thumb.prototype.initLUT = function () {
	const thumbtable = 
	[
	'0000 0fff ffss sddd - LSL IMM5',
	'0000 1fff ffss sddd - LSR IMM5', 
	'0001 0fff ffss sddd - ASR IMM5',

	'0001 100n nnss sddd - ADD REGISTER',
	'0001 101n nnss sddd - SUBTRACT REGISTER',
	'0001 110n nnss sddd - ADD IMM3',
	'0001 111n nnss sddd - SUB IMM3',

	'0010 0ddd nnnn nnnn - MOV IMM8',
	'0010 1ddd nnnn nnnn - CMP IMM8',
	'0011 0ddd nnnn nnnn - ADD IMM8',
	'0011 1ddd nnnn nnnn - SUB IMM8',

	'0100 0000 00ss sddd - AND',
	'0100 0000 01ss sddd - XOR',
	'0100 0000 10ss sddd - LSL',
	'0100 0000 11ss sddd - LSR',
	'0100 0001 00ss sddd - ASR',
	'0100 0001 01ss sddd - ADC',
	'0100 0001 10ss sddd - SBC',
	'0100 0001 11ss sddd - ROTATE RIGHT',
	'0100 0010 00ss sddd - TST',
	'0100 0010 01ss sddd - NEG',
	'0100 0010 10ss sddd - CMP',
	'0100 0010 11ss sddd - NEGCMP',
	'0100 0011 00ss sddd - OR',
	'0100 0011 01ss sddd - MUL',
	'0100 0011 10ss sddd - BIT CLEAR',
	'0100 0011 11ss sddd - NOT',

	'0100 0100 xxss sddd - ADD hi register',
	'0100 0101 xxss sddd - CMP hi register',
	'0100 0110 xxss sddd - MOV hi register',
	'0100 0111 0sss s000 - BX only uses rs',

	'0100 1ddd nnnn nnnn - LDR IMM (PC)',

	'0101 000s ssbb bddd - STR REG OFFSET',
	'0101 001s ssbb bddd - STRH REG OFFSET',

	'0101 010s ssbb bddd - STRB REG OFFSET',
	'0101 011s ssbb bddd - LDSB REG OFFSET',

	'0101 100s ssbb bddd - LDR REG OFFSET',
	'0101 101s ssbb bddd - LDRH REG OFFSET',

	'0101 110s ssbb bddd - LDRB REG OFFSET',
	'0101 111s ssbb bddd - LDSH REG OFFSET',

	'0110 0sss ssbb bddd - STR IMM OFFSET',
	'0110 1sss ssbb bddd - LDR IMM OFFSET ',
	'0111 0sss ssbb bddd - STRB IMM OFFSET',
	'0111 1sss ssbb bddd - LDRB IMM OFFSET',

	'1000 0sss ssbb bddd - STRH IMM OFFSET',
	'1000 1sss ssbb bddd - LDRH IMM OFFSET',


	'1001 0ddd nnnn nnnn - STR IMM OFFSET(SP)',
	'1001 1ddd nnnn nnnn - LDR IMM OFFSET(SP)',


	'1010 0ddd nnnn nnnn - ADD RD PC IMM',
	'1010 1ddd nnnn nnnn - ADD RD SP IMM',


	'1011 0000 0nnn nnnn - ADD SP IMM',
	'1011 0000 1nnn nnnn - ADD SP -IMM',


	'1011 010p rrrr rrrr - PUSH',
	'1011 110p rrrr rrrr - POP',


	'1100 0bbb rrrr rrrr - STMIA',
	'1100 1bbb rrrr rrrr - LDMIA',

	'1101 oooo ssss ssss - CONDITIONAL BRANCH',
	'1101 1111 nnnn nnnn - SW INTR',


	'1110 0sss ssss ssss - UNCONDITIONAL BRANCH',


	'1111 0nnn nnnn nnnn - LONG BRANCH 1',
	'1111 1nnn nnnn nnnn - LONG BRANCH 2',
	];

	const parsethumb = function (str) {
	return str.substring(0,12).split(" ").join("");
	}

	const isNum =  function (char) {
		return (char >= '0') && (char <= '9');
	}

	const getIndices = function (str) {
		let arr = [];
		for (let i = 0; i < str.length; i++)
		{
			if (!isNum(str[i]))
			{
				arr.push(i);
			}
		}
		return arr;
	}

	const generateAllNums = function (str) {
		let arr = [];
		let indices = getIndices(str);
		let chararr = str.split("");

		if (indices.length === 0)
		{
			return [parseInt(str, 2)];
		}

		let range = Math.pow(2, indices.length);
		for (let i = 0; i < range; i ++)
		{
			let fillnum = i.toString(2).padStart(indices.length, "0");
			for (let i = 0; i < indices.length; i ++)
			{
				chararr[indices[i]] = fillnum[i];
			}
			arr.push(parseInt(chararr.join(""), 2));
		}
		return arr;
	}

	this.thumbLUT.fill(100);
	for (let i = 0; i < thumbtable.length; i ++)
	{
		thumbtable[i] = parsethumb(thumbtable[i]);
		let allNums = generateAllNums(thumbtable[i]);
		for (let p = 0; p < allNums.length; p ++)
		{
			this.thumbLUT[allNums[p]] = i;
		}
	}
}