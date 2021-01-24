const arm = function(cpu, mmu) {
	this.cpu = cpu;
	this.mmu = mmu;
	this.registers = cpu.registers;
	this.userRegisters = [...cpu.registers];

	this.shiftCarryFlag = undefined;
	this.initFnTable();
	this.initLUT();
};

arm.prototype.armLUT = new Uint8Array(4096);

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
		return (register << shiftamt) >>> 0;
		break;

		case 1: //LSR #[1,32]
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return shiftamt === 32 ? 0 : register >>> shiftamt;
		break;

		case 2: //ASR #[1,32]
		this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
		return shiftamt === 32 ? (bitSlice(register, 31, 31) ? 0xFFFFFFFF : 0) : (register >> shiftamt) >>> 0;
		break;

		case 3: //ROR #[1,32]
		if (shiftamt === 32)
		{
			this.shiftCarryFlag = bitSlice(register, 0, 0);
			let cflag = bitSlice(this.registers[16][0], 29, 29);
			let result = rotateRight(register, 1);
			result &= 0x7FFFFFFF;
			result += cflag << 31;
			return result >>> 0;
		}
		else
		{
			this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return rotateRight(register, shiftamt) >>> 0;
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
	
	switch(type)
	{
		case 0: //LSL
		if (shiftamt > 32)
		{
			this.shiftCarryFlag = 0;
			return 0;
		}
		else //1-32
		{ 
			this.shiftCarryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
			return shiftamt === 32 ? 0 : (register << shiftamt) >>> 0;
		}
		break;

		case 1: //LSR
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
		break;

		case 2: //ASR
		if (shiftamt >= 32)
		{
			this.shiftCarryFlag = register >>> 31;
			return this.shiftCarryFlag ? 4294967295 : 0; //2 ^ 32 - 1 === 4294967295
		}
		else //1-31
		{
			this.shiftCarryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return (register >> shiftamt) >>> 0;
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
			return rotateRight(register, shiftamt) >>> 0;
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
		case 15: throw Error("invalid condition (reserved)");
		break;
		default: throw Error("condition wasnt a 4 bit number");
	}
};

//restore CPSR
arm.prototype.SPSRtoCPSR = function () {
	let SPSR = this.registers[17][0];
	if (SPSR === null) //SPSR does not exist
	{
		console.log("transferring user/system SPSR?");
		throw Error();
	}
	else //set CPSR to SPSR and update CPU state and mode
	{
		this.cpu.changeState(bitSlice(SPSR, 5, 5) ? this.cpu.stateENUMS["THUMB"] : this.cpu.stateENUMS["ARM"]);
		this.cpu.setCPSR(SPSR);
	}
};

//CPSR nzcv xxxx xxxx xxxx xxxx xxxx xxxx xxxx 
arm.prototype.setNZCV = function (nflag, zflag, cflag, vflag) { 
	//if cflag / vflag not provided, keep the current flag value
	cflag = (cflag === undefined) ? (this.registers[16][0] & 0x20000000) : (cflag ? 0x20000000 : 0);
	vflag = (vflag === undefined) ? (this.registers[16][0] & 0x10000000) : (vflag ? 0x10000000 : 0);

  this.registers[16][0] &= 0x0FFFFFFF; //set first halfbyte to zero
  this.registers[16][0] = this.registers[16][0] | (nflag ? 0x80000000 : 0) | (zflag ? 0x40000000 : 0) | cflag | vflag; //add new flags to CPSR
};

//ARM[5]-----------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode0 = function (instr) { //0 - UMULL / UMLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
	let rdhi = bitSlice(instr, 16, 19);
	let rdlo = bitSlice(instr, 12, 15);
	let rs = bitSlice(instr, 8, 11);
	let rm = bitSlice(instr, 0, 3);
	let accumulate = bitSlice(instr, 21, 21);

	let result = BigInt(this.registers[rm][0]) * BigInt(this.registers[rs][0]);
	if (accumulate) //accumulate bit
	{
		result += (BigInt(this.registers[rdhi][0]) << 32n) + BigInt(this.registers[rdlo][0]);
	}

	if (bitSlice(instr, 20, 20))
	{
		this.setNZCV((result & 0x8000000000000000n) != 0, result == 0);
	}
	this.registers[rdhi][0] = Number((result >> 32n) & 0xFFFFFFFFn);
	this.registers[rdlo][0] = Number(result & 0xFFFFFFFFn);

	return accumulate ? 3 : 2;
};

arm.prototype.executeOpcode1 = function (instr) { //1 - MUL / MLA Rd=Rm*Rs Rd=Rm*Rs+Rn
	let rd = bitSlice(instr, 16, 19);
	let rn = bitSlice(instr, 12, 15);
	let rs = bitSlice(instr, 8, 11);
	let rm = bitSlice(instr, 0, 3);
	let accumulate = bitSlice(instr, 21, 21);

	let result = BigInt(this.registers[rm][0]) * BigInt(this.registers[rs][0]);
	if (accumulate)
	{
		result += BigInt(this.registers[rn][0]);
	}
	result = Number(result & 0xFFFFFFFFn);

	if (bitSlice(instr, 20, 20))
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, true);
	}

	this.registers[rd][0] = result;

	return accumulate ? 2 : 1;
};


//ARM[8]-----------------------------------------------------------------------------------------------------
//p = 0 -> post, add offset after transfer (writeback is always enabled)
//i = 0 -> register offset
//i = 1 -> imm offset
//writeback -> write address into base
arm.prototype.executeOpcode2 = function (instr) { //2 - STRH p=0 i=0 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	this.mmu.write16(this.registers[rn][0] & 0xFFFFFFFE, this.registers[rd][0] + (rd === 15 ? 4 : 0));

	this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);

	return 0;
};

arm.prototype.executeOpcode3 = function (instr) { //3 - LDRH p=0 i=0 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][0];
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][0] = data;

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode4 = function (instr) { //4 - STRH p=0 i=1 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	this.mmu.write16(this.registers[rn][0] & 0xFFFFFFFE, this.registers[rd][0] + (rd === 15 ? 4 : 0));

	this.registers[rn][0] += offset * (u ? 1 : -1);

	return 0;
};

arm.prototype.executeOpcode5 = function (instr) { //5 - LDRH p=0 i=1 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][0];
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][0] = data;

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode6 = function (instr) { //6 - LDRSB p=0 i=0 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let byte = this.mmu.read8(this.registers[rn][0]);
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][0] = byte;
	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode7 = function (instr) { //7 - LDRSB p=0 i=1 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let byte = this.mmu.read8(this.registers[rn][0]);
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][0] = byte;
	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}
	
	if (rn !== rd)
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode8 = function (instr) { //8 - LDRSH p=0 i=0 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][0];

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

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode9 = function (instr) { //9 - LDRSH p=0 i=1 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add

	let addr = this.registers[rn][0];

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

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (rn !== rd)
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 1;
};

//ARM[4]------------------------second operand register, shifted by register (opcodes 0 - 7)-----------------
arm.prototype.executeOpcode10 = function (instr) { //10 - AND 0tt1 Rd = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][0] & this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode11 = function (instr) { //11 - EOR 0tt1 Rd = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][0] ^ this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode12 = function (instr) { //12 - SUB 0tt1 Rd = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = (this.registers[rn][0] - secondOperand) & 0xFFFFFFFF;
	let vflag =  bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][0], vflag);
	}
	this.registers[rd][0] = result;

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode13 = function (instr) { //13 - RSB 0tt1 Rd = Op2-Rn
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = (secondOperand - this.registers[rn][0]) & 0xFFFFFFFF;
	let vflag =  bitSlice(secondOperand ^ this.registers[rn][0], 31, 31) && bitSlice(secondOperand ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][0] <= secondOperand, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode14 = function (instr) { //14 - ADD 0tt1 Rd = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = this.registers[rn][0] + secondOperand;
	let vflag =  !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode15 = function (instr) { //15 - ADC 0tt1 Rd = Rn+Op2+Cy
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = this.registers[rn][0] + secondOperand + carryFlag;
	let vflag =  !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode16 = function (instr) { //16 - SBC 0tt1 Rd = Rn-Op2+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = (this.registers[rn][0] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;
	let vflag =  bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= (this.registers[rn][0] + carryFlag), vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode17 = function (instr) { //17 - RSC 0tt1 Rd = Op2-Rn+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = (secondOperand - this.registers[rn][0]  + carryFlag - 1) & 0xFFFFFFFF;
	let vflag =  bitSlice(secondOperand ^ this.registers[rn][0], 31, 31) && bitSlice(secondOperand ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rn][0] + 1) <= (secondOperand + carryFlag), vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

//ARM[4]------------------------second operand register, shifted by IMM (opcodes 0 - 7)-----------------
arm.prototype.executeOpcode18 = function (instr) { //18 - AND stt0 Rd = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] & this.shiftRegByImm(this.registers[rm][0], imm, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode19 = function (instr) { //19 - EOR stt0 Rd = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] ^ this.shiftRegByImm(this.registers[rm][0], imm, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode20 = function (instr) { //20 - SUB stt0 Rd = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = (this.registers[rn][0] - secondOperand) & 0xFFFFFFFF;
	let vflag =  bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][0], vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode21 = function (instr) { //21 - RSB stt0 Rd = Op2-Rn
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = (secondOperand - this.registers[rn][0]) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand ^ this.registers[rn][0], 31, 31) && bitSlice(secondOperand ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][0] <= secondOperand, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode22 = function (instr) { //22 - ADD stt0 Rd = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = this.registers[rn][0] + secondOperand;
	let vflag = !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode23 = function (instr) { //23 - ADC stt0 Rd = Rn+Op2+Cy
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = this.registers[rn][0] + secondOperand + carryFlag;
	let vflag =  !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode24 = function (instr) { //24 - SBC stt0 Rd = Rn-Op2+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = (this.registers[rn][0] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= (this.registers[rn][0] + carryFlag) , vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode25 = function (instr) { //25 - RSC stt0 Rd = Op2-Rn+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = (secondOperand - this.registers[rn][0]  + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand ^ this.registers[rn][0], 31, 31) && bitSlice(secondOperand ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rn][0] + 1) <= (secondOperand + carryFlag), vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

//ARM[4]-----------second operand register, shifted by register (opcodes 8 - 15)---------- & ARM[2]----------------------------------------
arm.prototype.executeOpcode26 = function (instr) { //26 - TST 0tt1 Void = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let result = this.registers[rn][0] & this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);

	return 1;
};

arm.prototype.executeOpcode27 = function (instr) { //27 - TEQ 0tt1 Void = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let result = this.registers[rn][0] ^ this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);

	return 1;
};

arm.prototype.executeOpcode28 = function (instr) { //28 - BX PC=Rn T=Rn[0]
	let rn = bitSlice(instr, 0, 3);

	if (this.registers[rn][0] & 1)
	{
		this.registers[15][0] = this.registers[rn][0]; //clear bit 0
		this.cpu.changeState(this.cpu.stateENUMS["THUMB"]);
	}
	else
	{
		this.registers[15][0] = this.registers[rn][0]; //clear bottom two bits
	}
	this.cpu.resetPipeline();

	return 0;
};

arm.prototype.executeOpcode29 = function (instr) { //29 - CMP 0tt1 Void = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = (this.registers[rn][0] - secondOperand) & 0xFFFFFFFF;

	let vflag = bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][0], vflag);

	return 1;
};

arm.prototype.executeOpcode30 = function (instr) { //30 - CMN 0tt1 Void = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type

	this.registers[15][0] += 4;

	let secondOperand = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	let result = this.registers[rn][0] + secondOperand;

	let vflag = !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	this.registers[15][0] -= 4;

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0, result > 4294967295, vflag);

	return 1;
};

arm.prototype.executeOpcode31 = function (instr) { //31 - ORR 0tt1 Rd = Rn OR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][0] | this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode32 = function (instr) { //32 - MOV 0tt1 Rd = Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode33 = function (instr) { //33 - BIC 0tt1 Rd = Rn AND NOT Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = this.registers[rn][0] & ~this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

arm.prototype.executeOpcode34 = function (instr) { //34 - MVN 0tt1 Rd = NOT Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let rs = bitSlice(instr, 8, 11); //register holding shift amount (bottom byte used)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	this.registers[15][0] += 4;

	let result = ~this.shiftRegByReg(this.registers[rm][0], this.registers[rs][0] & 0xFF, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}
	else
	{
		this.registers[15][0] -= 4;
	}

	return 1;
};

//ARM[10]------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode35 = function (instr) { //35 - SWP Rd=[Rn], [Rn]=Rm
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3);
	let b = bitSlice(instr, 22, 22) ? 1 : 4;
	let mask = (b === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);

	let data = this.mmu.read(this.registers[rn][0] & mask, b); //LDR
	data = rotateRight(data, b === 1 ? 0 : (this.registers[rn][0] & 3) << 3);

	this.mmu.write(this.registers[rn][0] & mask, this.registers[rm][0], b); //STR

	this.registers[rd][0] = data;

	return 1;
};


//ARM[8]-----------------------------------------------------------------------------------------------------
//p = 1 -> pr, add offset before transfer
//i = 0 -> register offset
//i = 1 -> imm offset
//writeback -> write address into base
arm.prototype.executeOpcode36 = function (instr) { //36 - STRH p=1 i=0 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	this.mmu.write16((this.registers[rn][0] + this.registers[rm][0] * (u ? 1 : -1)) & 0xFFFFFFFE, this.registers[rd][0] + (rd === 15 ? 4 : 0));

	if (w)
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode37 = function (instr) { //37 - LDRH p=1 i=0 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][0] + (this.registers[rm][0] * (u ? 1 : -1));
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][0] = data;

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode38 = function (instr) { //38 - STRH p=1 i=1 [a]=Rd
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	this.mmu.write16((this.registers[rn][0] + offset * (u ? 1 : -1)) & 0xFFFFFFFE, this.registers[rd][0] + (rd === 15 ? 4 : 0));

	if (w)
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 0;
};

arm.prototype.executeOpcode39 = function (instr) { //39 - LDRH p=1 i=1 Load Unsigned halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][0] + (offset * (u ? 1 : -1));
	let data = rotateRight(this.mmu.read16(addr & 0xFFFFFFFE), (addr & 1) << 3);

	this.registers[rd][0] = data;

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode40 = function (instr) { //40 - LDRSB p=1 i=0 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let byte = this.mmu.read8(this.registers[rn][0] + this.registers[rm][0] * (u ? 1 : -1));
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][0] = byte;
	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode41 = function (instr) { //41 - LDRSB p=1 i=1 Load Signed Byte
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let byte = this.mmu.read8(this.registers[rn][0] + offset * (u ? 1 : -1));
	byte += byte & 128 ? 0xFFFFFF00 : 0; //sign extend byte
	this.registers[rd][0] = byte;
	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}
	
	if (w && (rn !== rd))
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode42 = function (instr) { //42 - LDRSH p=1 i=0 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][0] + (this.registers[rm][0] * (u ? 1 : -1));

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

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][0] += this.registers[rm][0] * (u ? 1 : -1);
	}

	return 1;
};

arm.prototype.executeOpcode43 = function (instr) { //43 - LDRSH p=1 i=1 Load Signed halfword
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = (bitSlice(instr, 8, 11) << 4) + bitSlice(instr, 0, 3);
	let u = bitSlice(instr, 23, 23); //0 = subtract, 1 = add
	let w = bitSlice(instr, 21, 21); //writeback

	let addr = this.registers[rn][0] + (offset * (u ? 1 : -1));

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

	if (rd === 15)
	{
		this.cpu.resetPipeline();
	}

	if (w && (rn !== rd))
	{
		this.registers[rn][0] += offset * (u ? 1 : -1);
	}

	return 1;
};

//ARM[6]-----------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode44 = function (instr) { //44 - MRS Rd = Psr
	let psrBit = bitSlice(instr, 22, 22);
	let rd = bitSlice(instr, 12, 15);

	this.registers[rd][0] = this.registers[16 + psrBit][0];
	if (this.registers[16 + psrBit][0] === null)
	{
		this.registers[rd][0] = this.registers[16][0]; //read from CPSR if no SPSR
		console.log("trying to move PSR to rd in MRS with psr bit set when in USER/SYSTEM MODE");
	}

	return 0;
};

arm.prototype.executeOpcode45 = function (instr) { //45 - MSR register Psr[field] = Op
	let psrBit = bitSlice(instr, 22, 22);
	let rd = bitSlice(instr, 12, 15);
	let fsxc = bitSlice(instr, 16, 19);
	let p = bitSlice(this.registers[16][0], 0, 4) === 16 ? 0 : 1; //privileged

	let op = this.registers[bitSlice(instr, 0, 3)][0];
	let psr = this.registers[16 + psrBit][0];
	if (psr === null)
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
		console.log("MSR changing unused status field...");
		psr = (psr & 0xFF00FFFF) + (op & 0x00FF0000);
	}
	if ((fsxc & 0x2) && (p)) //set CPSR_res_2 (shouldnt be used)
	{
		console.log("MSR changing unused extension field...");
		psr = (psr & 0xFFFF00FF) + (op & 0x0000FF00);
	}
	if ((fsxc & 0x1) && (p)) //set CPSR_ctl
	{
		//psr = (psr & 0xFFFFFF20) + (op & 0x000000DF); //20 -> 00100000 DF -> 11011111 to keep the t bit intact
		if (!psrBit && ((psr & 32) !== (op & 32)))
		{
			throw Error("t bit in cpsr is being changed, should not be happening");
		}	
		psr = (psr & 0xFFFFFF00) + (op & 0x000000FF);
	}

	if (psrBit) //set SPSR
	{
		this.registers[17][0] = psr;
	}
	else //set CPSR
	{
		this.cpu.setCPSR(psr);
	}

	return 0;
};

//ARM[4]-----------second operand register, shifted by IMM(opcodes 8 - 15)----------------------------------------------------------
arm.prototype.executeOpcode46 = function (instr) { //46 - TST stt0 Void = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let result = this.registers[rn][0] 
	& this.shiftRegByImm(this.registers[rm][0], imm, st);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);

	return 0;
};

arm.prototype.executeOpcode47 = function (instr) { //47 - TEQ stt0 Void = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let result = this.registers[rn][0] 
	^ this.shiftRegByImm(this.registers[rm][0], imm, st);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);

	return 0;
};

arm.prototype.executeOpcode48 = function (instr) { //48 - CMP stt0 Void = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = (this.registers[rn][0] - secondOperand) & 0xFFFFFFFF;

	let vflag =  bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][0], vflag);

	return 0;
};

arm.prototype.executeOpcode49 = function (instr) { //49 - CMN stt0 Void = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type

	let secondOperand = this.shiftRegByImm(this.registers[rm][0], imm, st);
	let result = this.registers[rn][0] + secondOperand;

	let vflag = !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);

	return 0;
};

arm.prototype.executeOpcode50 = function (instr) { //50 - ORR stt0 Rd = Rn OR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] | this.shiftRegByImm(this.registers[rm][0], imm, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode51 = function (instr) { //51 - MOV stt0 Rd = Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.shiftRegByImm(this.registers[rm][0], imm, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode52 = function (instr) { //52 - BIC stt0 Rd = Rn AND NOT Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] & ~this.shiftRegByImm(this.registers[rm][0], imm, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode53 = function (instr) { //53 - MVN stt0 Rd = NOT Op2
	let rd = bitSlice(instr, 12, 15);
	let rm = bitSlice(instr, 0, 3); //second operand
	let imm = bitSlice(instr, 7, 11); //shift amt (imm)
	let st = bitSlice(instr, 5, 6); //shift type
	let s = bitSlice(instr, 20, 20);

	let result = ~this.shiftRegByImm(this.registers[rm][0], imm, st);
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

//ARM[4]------------------------second operand IMM (opcodes 0 - 7)---------------------------------
arm.prototype.executeOpcode54 = function (instr) { //54 - AND imm Rd = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] & secondOperand;
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode55 = function (instr) { //55 - EOR imm Rd = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] ^ secondOperand;
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode56 = function (instr) { //56 - SUB imm Rd = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = (this.registers[rn][0] - secondOperand) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][0], vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode57 = function (instr) { //57 - RSB imm Rd = Op2-Rn
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = (secondOperand - this.registers[rn][0]) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand ^ this.registers[rn][0], 31, 31) && bitSlice(secondOperand ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.registers[rn][0] <= secondOperand, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		this.cpu.resetPipeline();
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();			
		}
	}

	return 0;
};

arm.prototype.executeOpcode58 = function (instr) { //58 - ADD imm Rd = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] + secondOperand;
	let vflag = !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode59 = function (instr) { //59 - ADC imm Rd = Rn+Op2+Cy
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = this.registers[rn][0] + secondOperand + carryFlag;
	let vflag = !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);


	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode60 = function (instr) { //60 - SBC imm Rd = Rn-Op2+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = (this.registers[rn][0] - secondOperand + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (secondOperand + 1) <= (this.registers[rn][0] + carryFlag) , vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode61 = function (instr) { //61 - RSC imm Rd = Op2-Rn+Cy-1
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);
	let carryFlag = bitSlice(this.registers[16][0], 29, 29);

	let result = (secondOperand - this.registers[rn][0]  + carryFlag - 1) & 0xFFFFFFFF;
	let vflag = bitSlice(secondOperand ^ this.registers[rn][0], 31, 31) && bitSlice(secondOperand ^ result, 31, 31);

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, (this.registers[rn][0] + 1) <= (secondOperand + carryFlag), vflag);
	}

	this.registers[rd][0] = result;
	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

//ARM[4]-----------second operand IMM (opcodes 8 - 15)-------------------------------------------------------- & ARM[6]----------------------------------------
arm.prototype.executeOpcode62 = function (instr) { //62 - TST imm Void = Rn AND Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = this.registers[rn][0] & secondOperand;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);

	return 0;
};

arm.prototype.executeOpcode63 = function (instr) { //63 - MSR imm Psr[field] = Op
	let psrBit = bitSlice(instr, 22, 22);
	let rd = bitSlice(instr, 12, 15);
	let fsxc = bitSlice(instr, 16, 19);
	let p = bitSlice(this.registers[16][0], 0, 4) === 16 ? 0 : 1; //privileged

	if (!p)
	{
		console.log("????");
	}

	let op = rotateRight(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1);
	let psr = this.registers[16 + psrBit][0];
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
		console.log("MSR changing unused status field...");
		psr = (psr & 0xFF00FFFF) + (op & 0x00FF0000);
	}
	if ((fsxc & 0x2) && (p)) //set CPSR_res_2 (shouldnt be used)
	{
		console.log("MSR changing unused extension field...");
		psr = (psr & 0xFFFF00FF) + (op & 0x0000FF00);
	}
	if ((fsxc & 0x1) && (p)) //set CPSR_ctl
	{
		//psr = (psr & 0xFFFFFF20) + (op & 0x000000DF);  //20 -> 00100000 DF -> 11011111 to keep the t bit intact
		if (!psrBit && ((psr & 32) !== (op & 32)))
		{
			throw Error("t bit in cpsr is being changed, should not be happening");
		}	
		psr = (psr & 0xFFFFFF00) + (op & 0x000000FF);
	}
	
	if (psrBit) //set SPSR
	{
		this.registers[17][0] = psr;
	}
	else //set CPSR
	{
		this.cpu.setCPSR(psr);
	}

	return 0;
};

arm.prototype.executeOpcode64 = function (instr) { //64 - TEQ imm Void = Rn XOR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = this.registers[rn][0] ^ secondOperand;

	this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);

	return 0;
};

arm.prototype.executeOpcode65 = function (instr) { //65 - CMP imm Void = Rn-Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = (this.registers[rn][0] - secondOperand) & 0xFFFFFFFF;

	let vflag = bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	this.setNZCV(bitSlice(result, 31, 31), result === 0, secondOperand <= this.registers[rn][0], vflag);

	return 0;
};

arm.prototype.executeOpcode66 = function (instr) { //66 - CMN imm Void = Rn+Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);

	let result = this.registers[rn][0] + secondOperand;

	let vflag = !bitSlice(this.registers[rn][0] ^ secondOperand, 31, 31) && bitSlice(this.registers[rn][0] ^ result, 31, 31);

	this.setNZCV(bitSlice(result, 31, 31), (result & 0xFFFFFFFF) === 0,  result > 4294967295, vflag);

	return 0;
};

arm.prototype.executeOpcode67 = function (instr) { //67 - ORR imm Rd = Rn OR Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] | secondOperand;
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode68 = function (instr) { //68 - MOV imm  Rd = Op2
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);	

	let result = secondOperand;
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode69 = function (instr) { //69 - BIC imm Rd = Rn AND NOT Op2
	let rn = bitSlice(instr, 16, 19);
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = this.registers[rn][0] & ~secondOperand;
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

arm.prototype.executeOpcode70 = function (instr) { //70 - MVN imm Rd = NOT Op2
	let rd = bitSlice(instr, 12, 15);
	let secondOperand = this.shiftRegByReg(bitSlice(instr, 0, 7), bitSlice(instr, 8, 11) << 1, 3);
	let s = bitSlice(instr, 20, 20);

	let result = ~secondOperand;
	this.registers[rd][0] = result;

	if (s)
	{
		this.setNZCV(bitSlice(result, 31, 31), result === 0, this.shiftCarryFlag);
	}

	if (rd === 15)
	{
		if (s) //set CPSR to SPSR_current_mode
		{
			this.SPSRtoCPSR();
		}
		this.cpu.resetPipeline();
	}

	return 0;
};

//ARM[7]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode71 = function (instr) { //71 - LDR / STR i=0
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let offset = bitSlice(instr, 0, 11); //imm offset
	let p = bitSlice(instr, 24, 24); //pre/post
	let sign = bitSlice(instr, 23, 23) ? 1 : -1; //0 = subtract, 1 = add
	let size = bitSlice(instr, 22, 22) ? 1 : 4; //byte / word
	let mask = (size === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);
	let w = bitSlice(instr, 21, 21); //writeback

	if (bitSlice(instr, 20, 20)) //LDR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			let addr = this.registers[rn][0];
			//console.log("addr1: " + addr.toString(16));
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][0] = data;

			if (rd !== rn) //dont overwrite loaded value (occurs when rd === rn)
			{
				this.registers[rn][0] += sign * offset;
			}
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = (this.registers[rn][0] + (offset * sign));
			//console.log("addr2: " + addr.toString(16));
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][0] = data;

			if (w && (rd !== rn)) //dont overwrite loaded value if w enabled (occurs when rd === rn)
			{
				this.registers[rn][0] += sign * offset;
			}
		}

		if (rd === 15)
		{
			this.cpu.resetPipeline();
		}

		return 1;
	}
	else //STR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			this.mmu.write(this.registers[rn][0] & mask, this.registers[rd][0] + (rd === 15 ? 4 : 0), size);
			this.registers[rn][0] += sign * offset;
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = this.registers[rn][0] + sign * offset;
			this.mmu.write(addr & mask, this.registers[rd][0]  + (rd === 15 ? 4 : 0), size);
			if (w) //if no writeback, revert the offset added to rn, otherwise, leave it as is
			{
				this.registers[rn][0] = addr;
			}
		}

		return 0;
	}
};

arm.prototype.executeOpcode72 = function (instr) { //72 - LDR / STR i=1
	let rn = bitSlice(instr, 16, 19); //base
	let rd = bitSlice(instr, 12, 15); //destination
	let rm = bitSlice(instr, 0, 3); //offset reg
	let offset = this.shiftRegByImm(this.registers[rm][0], bitSlice(instr, 7, 11), bitSlice(instr, 5, 6)); //register shifted by imm as offset
	let p = bitSlice(instr, 24, 24); //pre/post
	let sign = bitSlice(instr, 23, 23) ? 1 : -1; //0 = subtract, 1 = add
	let size = bitSlice(instr, 22, 22) ? 1 : 4; //byte / word
	let mask = (size === 1 ? 0xFFFFFFFF : 0xFFFFFFFC);
	let w = bitSlice(instr, 21, 21); //writeback

	if (bitSlice(instr, 20, 20)) //LDR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			let addr = this.registers[rn][0];
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][0] = data;

			if (rd !== rn)
			{
				this.registers[rn][0] += sign * offset;
			}
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = this.registers[rn][0] + offset * sign;
			let data = this.mmu.read(addr & mask, size);
			data = size === 4 ? rotateRight(data, (addr & 3) << 3) : data;
			this.registers[rd][0] = data;

			if (w && (rd !== rn))
			{
				this.registers[rn][0] += sign * offset;
			}
		}

		if (rd === 15)
		{
			this.cpu.resetPipeline();
		}

		return 1;
	}
	else //STR
	{
		if (!p) //add offset after (writeback always enabled)
		{
			this.mmu.write(this.registers[rn][0] & mask, this.registers[rd][0] + (rd === 15 ? 4 : 0), size);
			this.registers[rn][0] += sign * offset;
		}
		else //add offset before (check if writeback enabled)
		{
			let addr = this.registers[rn][0] + sign * offset;
			this.mmu.write(addr & mask, this.registers[rd][0]  + (rd === 15 ? 4 : 0), size);
			if (w) //if no writeback, revert the offset added to rn, otherwise, leave it as is
			{
				this.registers[rn][0] = addr;
			}
		}

		return 0;
	}
};

//ARM[9]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode73 = function (instr) { //73 - LDM / STM 
	let p = bitSlice(instr, 24, 24);
	let incramt = bitSlice(instr, 23, 23) ? 4 : -4;
	let s = bitSlice(instr, 22, 22);
	let w = bitSlice(instr, 21, 21); //if set, writeback final address into rn
	let rn = bitSlice(instr, 16, 19); //base address
	let rlist = bitSlice(instr, 0, 15); //register list, each bit corresponds to register (by position)
	let l = bitSlice(instr, 20, 20);
	let registers = this.registers;

	let addrn; //if stm and rn in rlist, will hold address where rn is stored (super scuffed)
	let baseAddr = registers[rn][0];
	let addr = registers[rn][0] & 0xFFFFFFFC;

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
			registers[15][0] = this.mmu.read32(addr & 0xFFFFFFFC);
			this.cpu.resetPipeline();
		}
		else
		{
			this.mmu.write32(addr & 0xFFFFFFFC, registers[15][0] + 4);
		}
		registers[rn][0] += (incramt << 4);
		return 0;
	}

	if (s)
	{
		console.log("fancy");
		if (l && (bitSlice(rlist, 15, 15)))
		{
			this.SPSRtoCPSR();
		}
		else
		{
			registers = this.userRegisters //switch to user mode registers
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
					registers[i][0] = this.mmu.read32(addr);
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
					registers[i][0] = this.mmu.read32(addr);
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
			this.cpu.resetPipeline();
		}
	}
	else //STM
	{
		registers[15][0] += 4; //set r15 to instruction address + 12

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
					this.mmu.write32(addr, registers[i][0]);
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
					this.mmu.write32(addr, registers[i][0]);
					addr += incramt;
				}
			}
		}

		if (p)
		{
			addr -= incramt;
		}

		registers[15][0] -= 4; //set r15 back to instruction address + 8
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
				registers[rn][0] = addr | (baseAddr & 3);
			}
			//do nothing if LDM
		}
		else
		{
			registers[rn][0] = addr | (baseAddr & 3);
		}
	}

	return 1;
};

//ARM[1]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode74 = function (instr) { //74 - B / BL
	let signedOffset = bitSlice(instr, 0 , 23);
	if (signedOffset >>> 23)
	{
		signedOffset = -1 * ((~(signedOffset - 1)) & 0xFFFFFF);
	}

	if (bitSlice(instr, 24, 24)) //BL, set link register
	{
		this.registers[14][0] = this.registers[15][0] - 4;
	}
	
	this.registers[15][0] += (signedOffset << 2);
	this.cpu.resetPipeline();

	return 0;
};

//ARM[11]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode75 = function (instr) { //75 - LDC / STC
	//gba does not use this instruction
	throw Error("LDC/STC not implemented");
};

arm.prototype.executeOpcode76 = function (instr) { //76 - CDP
	//gba does not use this instruction
	throw Error("CDP not implemented");
};

arm.prototype.executeOpcode77 = function (instr) { //77 - MRC / MCR
	//gba does not use this instruction
	throw Error("MRC / MCR not implemented");
};

//ARM[11]-------------------------------------------------------------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode78 = function (instr) { //78 - SWI
	this.cpu.startSWI(bitSlice(instr, 0, 23));

	return 0;
};

//ARM[5]-----------------------------------------------------------------------------------------------------
arm.prototype.executeOpcode79 = function (instr) { //79 - SMULL / SMLAL RdHiLo=Rm*Rs / RdHiLo=Rm*Rs+RdHiLo
	let rdhi = bitSlice(instr, 16, 19);
	let rdlo = bitSlice(instr, 12, 15);
	let rs = bitSlice(instr, 8, 11);
	let rm = bitSlice(instr, 0, 3);
	let accumulate = bitSlice(instr, 21, 21);

	let result = BigInt(this.registers[rm][0] >> 0) * BigInt(this.registers[rs][0] >> 0);
	if (accumulate) //accumulate bit
	{
		result += (BigInt(this.registers[rdhi][0]) << 32n) + BigInt(this.registers[rdlo][0]);
	}

	if (bitSlice(instr, 20, 20))
	{
		this.setNZCV((result & 0x8000000000000000n) != 0, result == 0);
	}
	this.registers[rdhi][0] = Number(result >> 32n);
	this.registers[rdlo][0] = Number(result & 0xFFFFFFFFn);

	return accumulate ? 3 : 2;
}

arm.prototype.fetch = function () {
	return this.mmu.read32(this.registers[15][0]);
};


arm.prototype.decode = function (instr) {
	return this.armLUT[((bitSlice(instr, 20, 27) << 4) + bitSlice(instr, 4, 7))];
};

arm.prototype.execute = function (instr, opcode) {
	if (this.checkCondition(bitSlice(instr, 28, 31)))
	{
		let num = this.executeOpcode[opcode](instr);
		if (num === undefined)
			throw Error(num);
		return num;
	}
	return 0;
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

arm.prototype.initLUT = function () {
	const armtable = 
	[
	'0000 10as 1001 |MULTIPLY LONG AND MULTIPLY-ACCUMULATE LONG',
	'0000 00as 1001 |MULTIPLY AND MULTIPLY-ACCUMULATE',
	'0000 u000 1011 |p=0 i=0 STRH',
	'0000 u001 1011 |p=0 i=0 LDRH',
	'0000 u100 1011 |p=0 i=1 STRH',
	'0000 u101 1011 |p=0 i=1 LDRH',
	'0000 u001 1101 |p=0 i=0 LDRSB',
	'0000 u101 1101 |p=0 i=1 LDRSB',
	'0000 u001 1111 |p=0 i=0 LDRSH',
	'0000 u101 1111 |p=0 i=1 LDRSH',
	'0000 000S 0tt1 |AND and',
	'0000 001S 0tt1 |EOR exclusive or',
	'0000 010S 0tt1 |SUB subtract',
	'0000 011S 0tt1 |RSB reverse subtract',
	'0000 100S 0tt1 |ADD addition',
	'0000 101S 0tt1 |ADC add with carry',
	'0000 110S 0tt1 |SBC subtract with carry',
	'0000 111S 0tt1 |RSC reverse subtract with carry',
	'0000 000S stt0 |AND and',
	'0000 001S stt0 |EOR exclusive or',
	'0000 010S stt0 |SUB subtract',
	'0000 011S stt0 |RSB reverse subtract',
	'0000 100S stt0 |ADD addition',
	'0000 101S stt0 |ADC add with carry',
	'0000 110S stt0 |SBC subtract with carry',
	'0000 111S stt0 |RSC reverse subtract with carry',

	'0001 0001 0tt1 |TST test bits (dddd is either all 0s or 1s)',
	'0001 0011 0tt1 |TEQ test bitwise equality (dddd is either all 0s or 1s)',
	'0001 0010 0001 |BRANCH AND EXCHANGE',
	'0001 0101 0tt1 |CMP compare (dddd is either all 0s or 1s)',
	'0001 0111 0tt1 |CMN compare negative (dddd is either all 0s or 1s)',
	'0001 100S 0tt1 |ORR or',
	'0001 101S 0tt1 |MOV move register or constant',
	'0001 110S 0tt1 |BIC bit clear',
	'0001 111S 0tt1 |MVN move negative register',
	'0001 0b00 1001 |SWP',
	'0001 u0w0 1011 |p=1 i=0 STRH',
	'0001 u0w1 1011 |p=1 i=0 LDRH',
	'0001 u1w0 1011 |p=1 i=1 STRH',
	'0001 u1w1 1011 |p=1 i=1 LDRH',
	'0001 u0w1 1101 |p=1 i=0 LDRSB',
	'0001 u1w1 1101 |p=1 i=1 LDRSB',
	'0001 u0w1 1111 |p=1 i=0 LDRSH',
	'0001 u1w1 1111 |p=1 i=1 LDRSH',
	'0001 0p00 0000 |MRS',
	'0001 0p10 0000 |MSR register',
	'0001 0001 stt0 |TST test bits (dddd is either all 0s or 1s)',
	'0001 0011 stt0 |TEQ test bitwise equality (dddd is either all 0s or 1s)',
	'0001 0101 stt0 |CMP compare (dddd is either all 0s or 1s)',
	'0001 0111 stt0 |CMN compare negative (dddd is either all 0s or 1s)',
	'0001 100S stt0 |ORR or',
	'0001 101S stt0 |MOV move register or constant',
	'0001 110S stt0 |BIC bit clear',
	'0001 111S stt0 |MVN move negative register',


	'0010 000S mmmm |AND and',
	'0010 001S mmmm |EOR exclusive or',
	'0010 010S mmmm |SUB subtract',
	'0010 011S mmmm |RSB reverse subtract',
	'0010 100S mmmm |ADD addition',
	'0010 101S mmmm |ADC add with carry',
	'0010 110S mmmm |SBC subtract with carry',
	'0010 111S mmmm |RSC reverse subtract with carry',

	'0011 0001 mmmm |TST test bits (dddd is either all 0s or 1s)',
	'0011 0p10 mmmm |MSR imm',
	'0011 0011 mmmm |TEQ test bitwise equality (dddd is either all 0s or 1s)',
	'0011 0101 mmmm |CMP compare (dddd is either all 0s or 1s)',
	'0011 0111 mmmm |CMN compare negative (dddd is either all 0s or 1s)',
	'0011 100S mmmm |ORR or',
	'0011 101S mmmm |MOV move register or constant',
	'0011 110S mmmm |BIC bit clear',
	'0011 111S mmmm |MVN move negative register',

	'010p ubwl oooo |LDR / STR i = 0',
	'011p ubwl stt0 |LDR / STR i = 1',

	'100p uswl rrrr |LDM, STM',
	'101L oooo oooo |BRANCH / BRANCH AND LINK',
	'110p unwo mmmm |LDC / STC',
	'1110 oooo iii0 |CDP',
	'1110 oooa iii1 |MRC / MCR',
	'1111 xxxx xxxx |SOFTWARE INTERRUPT',

	'0000 11as 1001 |SIGNED MULTIPLY LONG AND MULTIPLY-ACCUMULATE LONG',
	];

	const parsearm = function (str) {
		return str.substring(0,14).split(" ").join("");
	}

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

	this.armLUT.fill(100);
	for (let i = 0; i < armtable.length; i ++)
	{
		armtable[i] = parsearm(armtable[i]);
		let allNums = generateAllNums(armtable[i]);
		for (let p = 0; p < allNums.length; p ++)
		{
			this.armLUT[allNums[p]] = i;
		}
	}
}
