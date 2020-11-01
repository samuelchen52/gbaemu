const arm = function(mmu, registers, changeState, changeMode, resetPipeline, startSWI, registerIndices) {
	
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

arm.prototype.shiftRegByImm = function (register, shiftamt, type) {
	if (shiftamt === 0)
	{
		if (type === 0) //LSL #0, do nothing
		{
			this.shiftCarryFlag = undefined;
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
		this.shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
		return register << shiftamt;
		break;

		case 1: //LSR #[1,32]
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return shiftamt === 32 ? 0 : register >>> shiftamt;
		break;

		case 2: //ASR #[1,32]
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return shiftamt === 32 ? (this.shiftCarryFlag === 1 ? 0xFFFFFFFF : 0) : register >> shiftamt;
		break;

		case 3: //ROR #[1,32]
		if (shiftamt === 32)
		{
			this.shiftCarryFlag = bitSlice(register, 0, 0);
			let cflag = bitSlice(this.registers[16][0], 29, 29);
			let result = rotateRight(register, 1);
			result &= 0x7FFFFFFF;
			result += cflag << 31;
			return result;
		}
		else
		{
			this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return rotateRight(register, shiftamt);
		}
		break;

		default:
		throw Error("invalid shift type!");
	}
};

//shiftamt will be contained in bottom byte of a register (0 - 255)
arm.prototype.shiftRegByReg = function (register, shiftamt, type) {
	//if shift register bottom byte is zero, do nothing
	if (shiftamt === 0)
	{
		this.shiftCarryFlag = undefined;
		return register;
	}
	//shiftamt nonzero
	let gt32 = shiftamt > 32;
	switch(type)
	{
		case 0: //LSL
		if (gt32)
		{
			this.shiftCarryFlag = 0;
			return 0;
		}
		else //1-32
		{ 
			this.shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
			return shiftamt === 32 ? 0 : register << shiftamt;
		}
		break;

		case 1: //LSR
		if (gt32)
		{
			this.shiftCarryFlag = 0;
			return 0;
		}
		else //1-32
		{
			this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return shiftamt === 32 ? 0 : register >>> shiftamt;
		}
		break;

		case 2: //ASR
		if (gt32 || (shiftamt === 32))
		{
			this.shiftCarryFlag = register >>> 31;
			return this.shiftCarryFlag ? 4294967295 : 0; //2 ^ 32 - 1 === 4294967295
		}
		else //1-31
		{
			this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return register >> shiftamt;
		}
		break;

		case 3: //ROR
		shiftamt %= 32;
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
		break;

		default:
		throw Error("invalid shift type!");
	}
};

//returns true if condition is met
arm.prototype.checkCondition = function (condition)
{
	let flags = bitSlice(this.registers[16][0], 28, 31); //N, Z, C, V
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
		case 8: return ((flags & 0x2) && !(flags & 0x4)) ? true : false; //BHI C=1 and Z=0 
		break;
		case 9: return (!(flags & 0x2) || (flags & 0x4)) ? true : false; //BLS C=0 or Z=1
		break;
		case 10: return (!!(flags & 0x8) === !!(flags & 0x1)) ? true : false; //BGE N=V
		break;
		case 11: return (!!(flags & 0x8) !== !!(flags & 0x1)) ? true : false; //BLT N<>V
		break;
		case 12: return ((!!(flags & 0x8) === !!(flags & 0x1)) && !(flags & 0x4)) ? true : false; //BGT N=V and Z=0
		break;
		case 13: return ((!!(flags & 0x8) !== !!(flags & 0x1)) || (flags & 0x4)) ? true : false; //BLE N<>V or Z=1
		break;
		case 14: return true;
		break;
		case 15: return false;
		break;
	}
	return true;
	throw Error("condition wasnt a 4 bit number?");
};

arm.prototype.SPSRtoCPSR = function (mode) {
	if (mode === 0) //SPSR does not exist
	{
		console.log("transferring user/system SPSR?");
	}
	else //set CPSR to SPSR and update CPU state and mode
	{
		this.registers[16][0] = this.registers[17][this.registerIndices[mode][17]];
		this.changeState(bitSlice(this.registers[16][0], 5, 5) ? "THUMB" : "ARM");
		this.changeMode(this.registers[16][0] & 31);
	}
};

//CPSR nzcv xxxx xxxx xxxx xxxx xxxx xxxx xxxx 
arm.prototype.setNZCV = function (nflag, zflag, cflag, vflag) { 
  let newNZCV = 0;

  newNZCV = nflag ? 1 : 0;
  newNZCV = zflag ? ((newNZCV << 1) + 1) : newNZCV << 1;
  newNZCV = cflag === undefined ? ((newNZCV << 1) + bitSlice(this.registers[16][0], 29, 29)) : (cflag ? ((newNZCV << 1) + 1) : newNZCV << 1);
  newNZCV = vflag === undefined ? ((newNZCV << 1) + bitSlice(this.registers[16][0], 28, 28)) : (vflag ? ((newNZCV << 1) + 1) : newNZCV << 1);

  this.registers[16][0] &= 0x00FFFFFF; //set first byte to zero
  this.registers[16][0] += (newNZCV << 28); //add new flags to CPSR
};

//ARM[5]-----------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode0 = function (instr, mode) { //0 - UMULL / UMLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
	let rdhi = bitSlice(instr, 16, 19);
	let rdlo = bitSlice(instr, 12, 15);
	let rs = bitSlice(instr, 8, 11);
	let rm = bitSlice(instr, 0, 3);

	let result = BigInt(this.registers[rm][this.registerIndices[mode][rm]]) * BigInt(this.registers[rs][this.registerIndices[mode][rs]]);
	if (bitSlice(instr, 21, 21)) //accumulate bit
	{
		result += (BigInt(this.registers[rdhi][this.registerIndices[mode][rdhi]]) << 32n) + BigInt(this.registers[rdlo][this.registerIndices[mode][rdlo]]);
	}

	if (bitSlice(instr, 20, 20))
	{
		this.setNZCV((result & 0x8000000000000000n) != 0, result == 0);
	}
	this.registers[rdhi][this.registerIndices[mode][rdhi]] = Number(result >> 32n);
	this.registers[rdlo][this.registerIndices[mode][rdlo]] = Number(result & 0xFFFFFFFFn);
};

arm.prototype.executeOpcode1 = function (instr, mode) { //1 - MUL / MLA Rd=Rm*Rs Rd=Rm*Rs+Rn
	let rd = bitSlice(instr, 16, 19);
	let rn = bitSlice(instr, 12, 15);
	let rs = bitSlice(instr, 8, 11);
	let rm = bitSlice(instr, 0, 3);

	let result = BigInt(this.registers[rm][this.registerIndices[mode][rm]]) * BigInt(this.registers[rs][this.registerIndices[mode][rs]]);
	if (bitSlice(instr, 21, 21)) //accumulate bit
	{
		result += BigInt(this.registers[rn][this.registerIndices[mode][rn]]);
	}
	result = Number(result & 0xFFFFFFFFn);

	if (bitSlice(instr, 20, 20))
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, true);
	}
	this.registers[rd][this.registerIndices[mode][rd]] = result;
};


//ARM[8]-----------------------------------------------------------------------------------------------------
//p = 0 -> post, add offset after transfer (writeback is always enabled)
//i = 0 -> register offset
//i = 1 -> imm offset
//writeback -> write address into base
arm.prototype.executeOpcode2 = function (instr, mode) { //2 - STRH p=0 i=0 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	this.mmu.write16(this.registers[rn][this.registerIndices[mode][rn]] & 0xFFFFFFFE, this.registers[rd][this.registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

	this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
};

arm.prototype.executeOpcode3 = function (instr, mode) { //3 - LDRH p=0 i=0 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][this.registerIndices[mode][rn]];
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode4 = function (instr, mode) { //4 - STRH p=0 i=1 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	this.mmu.write16(this.registers[rn][this.registerIndices[mode][rn]] & 0xFFFFFFFE, this.registers[rd][this.registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

	this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
};

arm.prototype.executeOpcode5 = function (instr, mode) { //5 - LDRH p=0 i=1 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][this.registerIndices[mode][rn]];
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode6 = function (instr, mode) { //6 - LDRSB p=0 i=0 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let byte = this.mmu.read8(this.registers[rn][this.registerIndices[mode][rn]]);
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][this.registerIndices[mode][rd]] = byte;
	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode7 = function (instr, mode) { //7 - LDRSB p=0 i=1 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let byte = this.mmu.read8(this.registers[rn][this.registerIndices[mode][rn]]);
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][this.registerIndices[mode][rd]] = byte;
	if (rd === 15)
	{
		this.resetPipeline();
	}
	
	if (rn !== rd)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode8 = function (instr, mode) { //8 - LDRSH p=0 i=0 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][this.registerIndices[mode][rn]];

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

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode9 = function (instr, mode) { //9 - LDRSH p=0 i=1 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][this.registerIndices[mode][rn]];

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

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

//ARM[4]------------------------second operand register, shifted by register (opcodes 0 - 7)-----------------
arm.prototype.executeOpcode10 = function (instr, mode) { //10 - AND 0tt1 Rd = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][this.registerIndices[mode][rn]] & this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode11 = function (instr, mode) { //11 - EOR 0tt1 Rd = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][this.registerIndices[mode][rn]] ^ this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode12 = function (instr, mode) { //12 - SUB 0tt1 Rd = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][this.registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
	}
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode13 = function (instr, mode) { //13 - RSB 0tt1 Rd = Op2-Rn
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = (secondOperand - this.registers[rn][this.registerIndices[mode][rn]]) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][this.registerIndices[mode][rn]] <= secondOperand, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode14 = function (instr, mode) { //14 - ADD 0tt1 Rd = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand;
		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode15 = function (instr, mode) { //15 - ADC 0tt1 Rd = Rn+Op2+Cy
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand + carryFlag;
		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode16 = function (instr, mode) { //16 - SBC 0tt1 Rd = Rn-Op2+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= this.registers[rn][this.registerIndices[mode][rn]] + carryFlag, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode17 = function (instr, mode) { //17 - RSC 0tt1 Rd = Op2-Rn+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = (secondOperand - this.registers[rn][this.registerIndices[mode][rn]]  + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]] + carryFlag - 1, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rn][this.registerIndices[mode][rn]] + 1) <= secondOperand + carryFlag, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

//ARM[4]------------------------second operand register, shifted by IMM (opcodes 0 - 7)-----------------
arm.prototype.executeOpcode18 = function (instr, mode) { //18 - AND stt0 Rd = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] & this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode19 = function (instr, mode) { //19 - EOR stt0 Rd = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] ^ this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode20 = function (instr, mode) { //20 - SUB stt0 Rd = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][this.registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode21 = function (instr, mode) { //21 - RSB stt0 Rd = Op2-Rn
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = (secondOperand - this.registers[rn][this.registerIndices[mode][rn]]) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][this.registerIndices[mode][rn]] <= secondOperand, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode22 = function (instr, mode) { //22 - ADD stt0 Rd = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand;
		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode23 = function (instr, mode) { //23 - ADC stt0 Rd = Rn+Op2+Cy
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand + carryFlag;
		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode24 = function (instr, mode) { //24 - SBC stt0 Rd = Rn-Op2+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= this.registers[rn][this.registerIndices[mode][rn]] + carryFlag , (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode25 = function (instr, mode) { //25 - RSC stt0 Rd = Op2-Rn+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = (secondOperand - this.registers[rn][this.registerIndices[mode][rn]]  + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]] + carryFlag - 1, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rn][this.registerIndices[mode][rn]] + 1) <= secondOperand + carryFlag, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

//ARM[4]-----------second operand register, shifted by register (opcodes 8 - 15)---------- & ARM[2]----------------------------------------
arm.prototype.executeOpcode26 = function (instr, mode) { //26 - TST 0tt1 Void = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let result = this.registers[rn][this.registerIndices[mode][rn]] & this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
};

arm.prototype.executeOpcode27 = function (instr, mode) { //27 - TEQ 0tt1 Void = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let result = this.registers[rn][this.registerIndices[mode][rn]] ^ this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
};

arm.prototype.executeOpcode28 = function (instr, mode) { //28 - BX PC=Rn T=Rn[0]
	let rn = bitSlice(instr, 0, 3);

	if (this.registers[rn][this.registerIndices[mode][rn]] & 1)
	{
		this.registers[15][0] = this.registers[rn][this.registerIndices[mode][rn]]; //clear bit 0
		this.changeState("THUMB");
	}
	else
	{
		this.registers[15][0] = this.registers[rn][this.registerIndices[mode][rn]]; //clear bottom two bits
	}
	this.resetPipeline();
};

arm.prototype.executeOpcode29 = function (instr, mode) { //29 - CMP 0tt1 Void = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][this.registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
};

arm.prototype.executeOpcode30 = function (instr, mode) { //30 - CMN 0tt1 Void = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand;

		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

		this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, (vflag === 0) || (vflag === 3));
};

arm.prototype.executeOpcode31 = function (instr, mode) { //31 - ORR 0tt1 Rd = Rn OR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][this.registerIndices[mode][rn]] | this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode32 = function (instr, mode) { //32 - MOV 0tt1 Rd = Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode33 = function (instr, mode) { //33 - BIC 0tt1 Rd = Rn AND NOT Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][this.registerIndices[mode][rn]] & ~this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

arm.prototype.executeOpcode34 = function (instr, mode) { //34 - MVN 0tt1 Rd = NOT Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = ~this.shiftRegByReg(this.registers[rm][this.registerIndices[mode][rm]], this.registers[rs][this.registerIndices[mode][rs]] & 0xFF, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}
};

//ARM[10]------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode35 = function (instr, mode) { //35 - SWP Rd=[Rn], [Rn]=Rm
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3);
	let b = bitSlice(instr, 22, 22) ? 1 : 4;
	let mask = (b === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);

	let data = this.mmu.read(this.registers[rn][this.registerIndices[mode][rn]] & mask, b); //LDR
	data = rotateRight(data, b === 1 ? 0 : (this.registers[rn][this.registerIndices[mode][rn]] & 3) << 3);

	this.mmu.write(this.registers[rn][this.registerIndices[mode][rn]] & mask, this.registers[rm][this.registerIndices[mode][rm]], b); //STR

	this.registers[rd][this.registerIndices[mode][rd]] = data;
};


//ARM[8]-----------------------------------------------------------------------------------------------------
//p = 1 -> pr, add offset before transfer
//i = 0 -> register offset
//i = 1 -> imm offset
//writeback -> write address into base
arm.prototype.executeOpcode36 = function (instr, mode) { //36 - STRH p=1 i=0 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	this.mmu.write16((this.registers[rn][this.registerIndices[mode][rn]] + this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1)) & 0xFFFFFFFE, this.registers[rd][this.registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

	if (w)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode37 = function (instr, mode) { //37 - LDRH p=1 i=0 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][this.registerIndices[mode][rn]] + (this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1));
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode38 = function (instr, mode) { //38 - STRH p=1 i=1 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	this.mmu.write16((this.registers[rn][this.registerIndices[mode][rn]] + offset * (u ? 1 : -1)) & 0xFFFFFFFE, this.registers[rd][this.registerIndices[mode][rd]] + (rd === 15 ? 4 : 0));

	if (w)
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode39 = function (instr, mode) { //39 - LDRH p=1 i=1 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][this.registerIndices[mode][rn]] + (offset * (u ? 1 : -1));
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][this.registerIndices[mode][rd]] = data;
	// console.log("base: " + rn);
	// console.log("offset: " + offset);
	// console.log("dest: " + rd);
	// console.log("addr: " + (this.registers[rn][this.registerIndices[mode][rn]] + offset * (u ? 1 : -1)).toString(16));
	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode40 = function (instr, mode) { //40 - LDRSB p=1 i=0 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let byte = this.mmu.read8(this.registers[rn][this.registerIndices[mode][rn]] + this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1));
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][this.registerIndices[mode][rd]] = byte;
	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode41 = function (instr, mode) { //41 - LDRSB p=1 i=1 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let byte = this.mmu.read8(this.registers[rn][this.registerIndices[mode][rn]] + offset * (u ? 1 : -1));
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][this.registerIndices[mode][rd]] = byte;
	if (rd === 15)
	{
		this.resetPipeline();
	}
	
	if (w && (rn !== rd))
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode42 = function (instr, mode) { //42 - LDRSH p=1 i=0 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][this.registerIndices[mode][rn]] + (this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1));

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

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][this.registerIndices[mode][rn]] += this.registers[rm][this.registerIndices[mode][rm]] * (u ? 1 : -1);
	}
};

arm.prototype.executeOpcode43 = function (instr, mode) { //43 - LDRSH p=1 i=1 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][this.registerIndices[mode][rn]] + (offset * (u ? 1 : -1));

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

	if (rd === 15)
	{
		this.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][this.registerIndices[mode][rn]] += offset * (u ? 1 : -1);
	}
};

//ARM[6]-----------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode44 = function (instr, mode) { //44 - MRS Rd = Psr
	let psrBit = bitSlice(instr, 22, 22);
	let rd = bitSlice(instr, 12, 15);

	this.registers[rd][this.registerIndices[mode][rd]] = this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]];
	if (this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]] === undefined)
	{
		this.registers[rd][this.registerIndices[mode][rd]] = this.registers[16][0]; //read from CPSR if no SPSR
		console.log("trying to move PSR to rd in MRS with psr bit set when in USER/SYSTEM MODE");
	}
};

arm.prototype.executeOpcode45 = function (instr, mode) { //45 - MSR register Psr[field] = Op
	let psrBit = bitSlice(instr, 22, 22);
	let rd = bitSlice(instr, 12, 15);
	let fsxc = bitSlice(instr, 16, 19);
	let p = bitSlice(this.registers[16][0], 0, 4) === 16 ? 0 : 1; //privileged

	let op = this.registers[bitSlice(instr, 0, 3)][this.registerIndices[mode][bitSlice(instr, 0, 3)]];
	let psr = this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]];
	if (psr === undefined)
	{
		psr = this.registers[16][0];  //read from CPSR if no SPSR
		console.log("trying to change PSR in MSR with psr bit set when in USER/SYSTEM MODE");
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
			this.changeMode(psr & 31);
		}

	}

	this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]] = psr;
};

//ARM[4]-----------second operand register, shifted by IMM(opcodes 8 - 15)----------------------------------------------------------
arm.prototype.executeOpcode46 = function (instr, mode) { //46 - TST stt0 Void = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let result = this.registers[rn][this.registerIndices[mode][rn]] 
	& this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
};

arm.prototype.executeOpcode47 = function (instr, mode) { //47 - TEQ stt0 Void = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let result = this.registers[rn][this.registerIndices[mode][rn]] 
	^ this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
};

arm.prototype.executeOpcode48 = function (instr, mode) { //48 - CMP stt0 Void = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][this.registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
};

arm.prototype.executeOpcode49 = function (instr, mode) { //49 - CMN stt0 Void = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let secondOperand = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand;

		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
};

arm.prototype.executeOpcode50 = function (instr, mode) { //50 - ORR stt0 Rd = Rn OR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] | this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode51 = function (instr, mode) { //51 - MOV stt0 Rd = Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode52 = function (instr, mode) { //52 - BIC stt0 Rd = Rn AND NOT Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] & ~this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode53 = function (instr, mode) { //53 - MVN stt0 Rd = NOT Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = ~this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], imm, st);
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

//ARM[4]------------------------second operand IMM (opcodes 0 - 7)---------------------------------
arm.prototype.executeOpcode54 = function (instr, mode) { //54 - AND imm Rd = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] & secondOperand;
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode55 = function (instr, mode) { //55 - EOR imm Rd = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] ^ secondOperand;
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode56 = function (instr, mode) { //56 - SUB imm Rd = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][this.registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode57 = function (instr, mode) { //57 - RSB imm Rd = Op2-Rn
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = (secondOperand - this.registers[rn][this.registerIndices[mode][rn]]) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][this.registerIndices[mode][rn]] <= secondOperand, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		this.resetPipeline();
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);			
		}
	}
};

arm.prototype.executeOpcode58 = function (instr, mode) { //58 - ADD imm Rd = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand;
		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode59 = function (instr, mode) { //59 - ADC imm Rd = Rn+Op2+Cy
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand + carryFlag;
		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode60 = function (instr, mode) { //60 - SBC imm Rd = Rn-Op2+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= this.registers[rn][this.registerIndices[mode][rn]] + carryFlag , (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode61 = function (instr, mode) { //61 - RSC imm Rd = Op2-Rn+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = (secondOperand - this.registers[rn][this.registerIndices[mode][rn]]  + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand, 31, 31) + (bitSlice(this.registers[rn][this.registerIndices[mode][rn]] + carryFlag - 1, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rn][this.registerIndices[mode][rn]] + 1) <= secondOperand + carryFlag, (vflag === 0) || (vflag === 3));
	}

	this.registers[rd][this.registerIndices[mode][rd]] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

//ARM[4]-----------second operand IMM (opcodes 8 - 15)-------------------------------------------------------- & ARM[6]----------------------------------------
arm.prototype.executeOpcode62 = function (instr, mode) { //62 - TST imm Void = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = this.registers[rn][this.registerIndices[mode][rn]] & secondOperand;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
};

arm.prototype.executeOpcode63 = function (instr, mode) { //63 - MSR imm Psr[field] = Op
	let psrBit = bitSlice(instr, 22, 22);
	let rd = bitSlice(instr, 12, 15);
	let fsxc = bitSlice(instr, 16, 19);
	let p = bitSlice(this.registers[16][0], 0, 4) === 16 ? 0 : 1; //privileged

	let op = rotateRight(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1);
	let psr = this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]];
	if (psr === undefined)
	{
		psr = this.registers[16][0]; //read from CPSR if no SPSR
		console.log("trying to change PSR in MSR with psr bit set when in USER/SYSTEM MODE");
	}

	//console.log("flags: " + (op >>> 0).toString(16));
	//console.log("old psr: " + (psr >>> 0).toString(16));

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
			this.changeMode(psr & 31); //31 === 11111b
		}
	}
	//console.log(this.checkCondition(10));
	this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]] = psr;
	// console.log("new psr: " + (psr >>> 0).toString(16));
	// console.log(this.checkCondition(10));
	// console.log("");
	//this.registers[16 + psrBit][this.registerIndices[mode][16 + psrBit]] = psr;
};

arm.prototype.executeOpcode64 = function (instr, mode) { //64 - TEQ imm Void = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = this.registers[rn][this.registerIndices[mode][rn]] ^ secondOperand;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
};

arm.prototype.executeOpcode65 = function (instr, mode) { //65 - CMP imm Void = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = (this.registers[rn][this.registerIndices[mode][rn]] - secondOperand) & 0xFFFFFFFF;

	let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + (bitSlice(secondOperand, 31, 31) ^ 1) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][this.registerIndices[mode][rn]], (vflag === 0) || (vflag === 3));
};

arm.prototype.executeOpcode66 = function (instr, mode) { //66 - CMN imm Void = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = this.registers[rn][this.registerIndices[mode][rn]] + secondOperand;

		let vflag = bitSlice(this.registers[rn][this.registerIndices[mode][rn]], 31, 31) + bitSlice(secondOperand, 31, 31) + (bitSlice(result, 31, 31) ^ 1);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, (vflag === 0) || (vflag === 3));
};

arm.prototype.executeOpcode67 = function (instr, mode) { //67 - ORR imm Rd = Rn OR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] | secondOperand;
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode68 = function (instr, mode) { //68 - MOV imm  Rd = Op2
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);	

	let result = secondOperand;
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode69 = function (instr, mode) { //69 - BIC imm Rd = Rn AND NOT Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][this.registerIndices[mode][rn]] & ~secondOperand;
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

arm.prototype.executeOpcode70 = function (instr, mode) { //70 - MVN imm Rd = NOT Op2
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = ~secondOperand;
	this.registers[rd][this.registerIndices[mode][rd]] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR(mode);
		}
		this.resetPipeline();
	}
};

//ARM[7]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode71 = function (instr, mode) { //71 - LDR / STR i=0
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = bitSlice(instr, 0, 11); //imm offset
	let p = bitSlice(instr, 24, 24); //pre/post
	let sign = bitSlice(instr, 23, 23) ? 1 : -1; //0 = subtract, 1 = add
	let size = bitSlice(instr, 22, 22) ? 1 : 4; //byte / word
	let mask = (size === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);
	let w = bitSlice(instr, 21, 21); //writeback

	//console.log((rn === 15)  && (!p || w) );
	//console.log("base: " + rn);
	//console.log("offset: " + offset);
	//console.log("size: " + size);
	//console.log("dest: " + rd);
	//if (rd === rn){
		//console.log("hallo");
	//}

	if (bitSlice(instr, 20, 20)) //LDR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			if (w) //w serves as t bit
			{
				mode = 0; //force non-priveleged access
			}
			let addr = this.registers[rn][this.registerIndices[mode][rn]];
			//console.log("addr1: " + addr.toString(16));
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][this.registerIndices[mode][rd]] = data;

			if (rd !== rn) //dont overwrite loaded value (occurs when rd === rn)
			{
				this.registers[rn][this.registerIndices[mode][rn]] += sign * offset;
			}
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = (this.registers[rn][this.registerIndices[mode][rn]] + (offset * sign));
			//console.log("addr2: " + addr.toString(16));
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][this.registerIndices[mode][rd]] = data;

			if (w && (rd !== rn)) //dont overwrite loaded value if w enabled (occurs when rd === rn)
			{
				this.registers[rn][this.registerIndices[mode][rn]] += sign * offset;
			}
		}

		if (rd === 15)
		{
			this.resetPipeline();
		}
	}
	else //STR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			if (w) //w serves as t bit
			{
				mode = 0; //force non-priveleged access
			}
			this.mmu.write(this.registers[rn][this.registerIndices[mode][rn]] & mask, this.registers[rd][this.registerIndices[mode][rd]] + (rd === 15 ? 4 : 0), size);
			this.registers[rn][this.registerIndices[mode][rn]] += sign * offset;
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = this.registers[rn][this.registerIndices[mode][rn]] + sign * offset;
			this.mmu.write(addr & mask, this.registers[rd][this.registerIndices[mode][rd]]  + (rd === 15 ? 4 : 0), size);
			if (w) //if no writeback, revert the offset added to rn, otherwise, leave it as is
			{
				this.registers[rn][this.registerIndices[mode][rn]] = addr;
			}
		}
	}
};

arm.prototype.executeOpcode72 = function (instr, mode) { //72 - LDR / STR i=1
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset reg
	let offset = this.shiftRegByImm(this.registers[rm][this.registerIndices[mode][rm]], bitSlice(instr, 7, 11), bitSlice(instr, 5, 6)); //register shifted by imm as offset
	let p = bitSlice(instr, 24, 24); //pre/post
	let sign = bitSlice(instr, 23, 23) ? 1 : -1; //0 = subtract, 1 = add
	let size = bitSlice(instr, 22, 22) ? 1 : 4; //byte / word
	let mask = (size === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);
	let w = bitSlice(instr, 21, 21); //writeback

	if (bitSlice(instr, 20, 20)) //LDR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			if (w) //w serves as t bit
			{
				mode = 0; //force non-priveleged access
			}
			let addr = this.registers[rn][this.registerIndices[mode][rn]];
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][this.registerIndices[mode][rd]] = data;

			if (rd !== rn)
			{
				this.registers[rn][this.registerIndices[mode][rn]] += sign * offset;
			}
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = this.registers[rn][this.registerIndices[mode][rn]] + offset * sign;
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][this.registerIndices[mode][rd]] = data;

			if (w && (rd !== rn))
			{
				this.registers[rn][this.registerIndices[mode][rn]] += sign * offset;
			}
		}

		if (rd === 15)
		{
			this.resetPipeline();
		}
	}
	else //STR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			if (w) //w serves as t bit
			{
				mode = 0; //force non-priveleged access
			}
			this.mmu.write(this.registers[rn][this.registerIndices[mode][rn]] & mask, this.registers[rd][this.registerIndices[mode][rd]] + (rd === 15 ? 4 : 0), size);
			this.registers[rn][this.registerIndices[mode][rn]] += sign * offset;
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = this.registers[rn][this.registerIndices[mode][rn]] + sign * offset;
			this.mmu.write(addr & mask, this.registers[rd][this.registerIndices[mode][rd]]  + (rd === 15 ? 4 : 0), size);
			if (w) //if no writeback, revert the offset added to rn, otherwise, leave it as is
			{
				this.registers[rn][this.registerIndices[mode][rn]] = addr;
			}
		}
	}
};

//ARM[9]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode73 = function (instr, mode) { //73 - LDM / STM 
	let p = bitSlice(instr, 24, 24);
	let incramt = bitSlice(instr, 23, 23) ? 4 : -4;
	let s = bitSlice(instr, 22, 22);
	let w = bitSlice(instr, 21, 21); //if set, writeback final address into rn
	let rn = bitSlice(instr, 16, 19); //base address
	let rlist = bitSlice(instr, 0, 15); //register list, each bit corresponds to register (by position)
	let l = bitSlice(instr, 20, 20);

	let addrn; //if stm and rn in rlist, will hold address where rn is stored (super scuffed)
	let baseAddr = this.registers[rn][this.registerIndices[mode][rn]];
	let addr = this.registers[rn][this.registerIndices[mode][rn]] & 0xFFFFFFFC;

	//handle empty rlist
	if (!rlist)
	{
		console.log("empty rlist...");
		let positive = incramt === 4 ? 1 : 0;
		switch((positive << 1) + p)
		{
			case 0: //00 -> da
			addr = baseAddr - 0x3C;
			break;

			case 1: //01 -> db
			addr = baseAddr - 0x40;
			break;

			case 2: //10 -> ia
			addr = baseAddr + 0x00;
			break;

			case 3: //11 -> ib
			addr = baseAddr + 0x04;
			break;
		}

		if (l)
		{
			this.registers[15][0] = this.mmu.read32(addr & 0xFFFFFFFC);
			this.resetPipeline();
		}
		else
		{
			this.mmu.write32(addr & 0xFFFFFFFC, this.registers[15][0] + 4);
		}
		this.registers[rn][this.registerIndices[mode][rn]] += (incramt << 4);
		return;
	}

	if (s)
	{
		if (l && (bitSlice(rlist, 15, 15)))
		{
			this.SPSRtoCPSR(mode);
		}
		else
		{
			mode = 0; //set mode for this instruction to 0 for user bank register transfer
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
				if (bitSlice(rlist, i, i))
				{
					this.registers[i][this.registerIndices[mode][i]] = this.mmu.read32(addr);
					addr += incramt;
				}
			}
		}
		else 
		{
			for (let i = 15; i >= 0; i--) //start from top of list
			{
				if (bitSlice(rlist, i, i))
				{
					this.registers[i][this.registerIndices[mode][i]] = this.mmu.read32(addr);
					addr += incramt;
				}
			}
		}

		if (p)
		{
			addr -= incramt;
		}

		if (rlist & 32768) //if r15 loaded
		{
			this.resetPipeline();
		}
	}
	else //STM
	{
		this.registers[15][0] += 4; //set r15 to instruction address + 12

		if (p) //IB/DB
		{
			addr += incramt;
		}

		if (incramt === 4) //start from bottom of list
		{
			for (let i = 0; i <= 15; i++)
			{
				if (bitSlice(rlist, i, i))
				{
					if (i === rn)
						addrn = addr;
					this.mmu.write32(addr, this.registers[i][this.registerIndices[mode][i]]);
					addr += incramt;
				}
			}
		}
		else
		{
			for (let i = 15; i >= 0; i--) //start from top of list
			{
				//console.log(addr.toString(16));
				if (bitSlice(rlist, i, i))
				{
					if (i === rn)
						addrn = addr;
					this.mmu.write32(addr, this.registers[i][this.registerIndices[mode][i]]);
					addr += incramt;
				}
			}
		}

		if (p)
		{
			addr -= incramt;
		}

		this.registers[15][0] -= 4; //set r15 back to instruction address + 8
	}

	if (w) //handle writeback
	{
		if (bitSlice(rlist, rn, rn)) //handle base reg in rlist
		{
			if (!l) //STM 
			{
				if ((rn !== 0) && bitSlice(rlist, 0, rn - 1)) //if base reg not first entry in rlist, store modified base
				{
					this.mmu.write32(addrn, addr | (baseAddr & 3));
				}
				this.registers[rn][this.registerIndices[mode][rn]] = addr | (baseAddr & 3);
			}
			//do nothing if LDM
		}
		else
		{
			this.registers[rn][this.registerIndices[mode][rn]] = addr | (baseAddr & 3);
		}
	}
};

//ARM[1]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode74 = function (instr, mode) { //74 - B / BL
	let signedOffset = bitSlice(instr, 0 , 23);
	if (signedOffset >>> 23)
	{
		signedOffset = -1 * ((~(signedOffset - 1)) & 0xFFFFFF);
	}

	if (bitSlice(instr, 24, 24)) //BL, set link register
	{
		this.registers[14][this.registerIndices[mode][14]] = this.registers[15][this.registerIndices[mode][15]] - 4;
	}
	
	this.registers[15][this.registerIndices[mode][15]] += (signedOffset << 2);
	this.resetPipeline();
};

//ARM[11]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode75 = function (instr, mode) { //75 - LDC / STC
	//gba does not use this instruction
	console.log("???1");
};

arm.prototype.executeOpcode76 = function (instr, mode) { //76 - CDP
	//gba does not use this instruction
	console.log("???2");
};

arm.prototype.executeOpcode77 = function (instr, mode) { //77 - MRC / MCR
	//gba does not use this instruction
	console.log("???3");
};

//ARM[11]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode78 = function (instr, mode) { //78 - SWI
	this.startSWI();
	//filler code for SWI #6h (used by gba-suite )
	// let numerator = this.registers[0][this.registerIndices[mode][0]];
	// let denominator = this.registers[1][this.registerIndices[mode][1]];

	// this.registers[0][this.registerIndices[mode][0]] = Math.floor(numerator / denominator);
	// this.registers[1][this.registerIndices[mode][1]] = numerator % denominator;
	// this.registers[3][this.registerIndices[mode][3]] = Math.abs(Math.floor(numerator / denominator));
};

//ARM[5]-----------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode79 = function (instr, mode) { //79 - SMULL / SMLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
	let rdhi = bitSlice(instr, 16, 19);
	let rdlo = bitSlice(instr, 12, 15);
	let rs = bitSlice(instr, 8, 11);
	let rm = bitSlice(instr, 0, 3);

	let result = BigInt(this.registers[rm][this.registerIndices[mode][rm]] >> 0) * BigInt(this.registers[rs][this.registerIndices[mode][rs]] >> 0);
	if (bitSlice(instr, 21, 21)) //accumulate bit
	{
		result += (BigInt(this.registers[rdhi][this.registerIndices[mode][rdhi]]) << 32n) + BigInt(this.registers[rdlo][this.registerIndices[mode][rdlo]]);
	}

	if (bitSlice(instr, 20, 20))
	{
		this.setNZCV((result & 0x8000000000000000n) != 0, result == 0);
	}
	this.registers[rdhi][this.registerIndices[mode][rdhi]] = Number(result >> 32n);
	this.registers[rdlo][this.registerIndices[mode][rdlo]] = Number(result & 0xFFFFFFFFn);
}

arm.prototype.decode = function (instr) {
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
					switch (bitSlice(instr, 20, 20) + (bitSlice(instr, 22, 22) << 1))
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
					switch (bitSlice(instr, 20, 20) + (bitSlice(instr, 22, 22) << 1))
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
};

// arm.prototype.execute = function (instr, opcode, mode) {
// 	if (!this.checkCondition(bitSlice(instr, 28, 31)))
// 	{
// 		return;
// 	}
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
// 		case 61: this.executeOpcode61(instr, mode); break;
// 		case 62: this.executeOpcode62(instr, mode); break;
// 		case 63: this.executeOpcode63(instr, mode); break;
// 		case 64: this.executeOpcode64(instr, mode); break;
// 		case 65: this.executeOpcode65(instr, mode); break;
// 		case 66: this.executeOpcode66(instr, mode); break;
// 		case 67: this.executeOpcode67(instr, mode); break;
// 		case 68: this.executeOpcode68(instr, mode); break;
// 		case 69: this.executeOpcode69(instr, mode); break;
// 		case 70: this.executeOpcode70(instr, mode); break;
// 		case 71: this.executeOpcode71(instr, mode); break;
// 		case 72: this.executeOpcode72(instr, mode); break;
// 		case 73: this.executeOpcode73(instr, mode); break;
// 		case 74: this.executeOpcode74(instr, mode); break;
// 		case 75: this.executeOpcode75(instr, mode); break;
// 		case 76: this.executeOpcode76(instr, mode); break;
// 		case 77: this.executeOpcode77(instr, mode); break;
// 		case 78: this.executeOpcode78(instr, mode); break;
// 		case 79: this.executeOpcode79(instr, mode); break;
// 		case 100: throw Error("executing undefined instruction");
// 		default: throw Error("invalid arm opcode: " + opcode); //should never happen
// 	}
// };

arm.prototype.execute = function (instr, opcode, mode) {
	if (this.checkCondition(bitSlice(instr, 28, 31)))
	{
		this.executeOpcode[opcode](instr, mode);
	}
};
	
arm.prototype.initFnTable = function () {
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
	this.executeOpcode.push(this.executeOpcode61.bind(this));
	this.executeOpcode.push(this.executeOpcode62.bind(this));
	this.executeOpcode.push(this.executeOpcode63.bind(this));
	this.executeOpcode.push(this.executeOpcode64.bind(this));
	this.executeOpcode.push(this.executeOpcode65.bind(this));
	this.executeOpcode.push(this.executeOpcode66.bind(this));
	this.executeOpcode.push(this.executeOpcode67.bind(this));
	this.executeOpcode.push(this.executeOpcode68.bind(this));
	this.executeOpcode.push(this.executeOpcode69.bind(this));
	this.executeOpcode.push(this.executeOpcode70.bind(this));
	this.executeOpcode.push(this.executeOpcode71.bind(this));
	this.executeOpcode.push(this.executeOpcode72.bind(this));
	this.executeOpcode.push(this.executeOpcode73.bind(this));
	this.executeOpcode.push(this.executeOpcode74.bind(this));
	this.executeOpcode.push(this.executeOpcode75.bind(this));
	this.executeOpcode.push(this.executeOpcode76.bind(this));
	this.executeOpcode.push(this.executeOpcode77.bind(this));
	this.executeOpcode.push(this.executeOpcode78.bind(this));
	this.executeOpcode.push(this.executeOpcode79.bind(this));
}
