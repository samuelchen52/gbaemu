//represents a halfword-sized IO register that is both readable and writable
//used for OAM and IO memory region
const ioReg = function(name, ioRegion, regIndex) {
	this.name = name;
	this.ioRegionMemory = ioRegion.memory;
	this.ioRegionMemory16 = ioRegion.memory16;
	this.ioRegionMemory32 = ioRegion.memory32;
	this.ioRegs = ioRegion.ioRegs;
	this.regIndex = regIndex;
	this.callbacks = [];
}

ioReg.prototype.addCallback = function (fn) {
	this.callbacks.push(fn);
}

ioReg.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory16[this.regIndex >>> 1];
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioReg.prototype.read8 = function (memAddr) {
	return this.ioRegionMemory[memAddr];
}

ioReg.prototype.read16 = function (memAddr) {
	return this.ioRegionMemory16[memAddr >>> 1];
}

ioReg.prototype.read32 = function (memAddr) {
	return this.ioRegionMemory16[memAddr >>> 1] + (this.ioRegs[this.regIndex + 2].read16(memAddr + 2) << 16);
}

ioReg.prototype.write8 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val;
	this.triggerCallbacks();
}

ioReg.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory16[memAddr >>> 1] = val;
	this.triggerCallbacks();
}

ioReg.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory16[memAddr >>> 1] = val;
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}

//for now, assuming writes to read only / unused mem dont do anything, and reading from write only / unused mem just returns 0

//represents a halfword-sized IO register that is only readable (used only for KEYINPUT)
const ioRegReadOnly = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegReadOnly.prototype = Object.create(ioReg.prototype);
ioRegReadOnly.prototype.constructor = ioRegReadOnly;

ioRegReadOnly.prototype.write8 = function (memAddr, val) {
	console.log("ignored: writing byte to " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
}

ioRegReadOnly.prototype.write16 = function (memAddr, val) {
	console.log("ignored: writing halfword to " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
}

ioRegReadOnly.prototype.write32 = function (memAddr, val) {
	console.log("ignored: writing word to " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
}



//represents a halfword-sized IO register that is only writable
const ioRegWriteOnly = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegWriteOnly.prototype = Object.create(ioReg.prototype);
ioRegWriteOnly.prototype.constructor = ioRegWriteOnly;

ioRegWriteOnly.prototype.read8 = function (memAddr) {
	//console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWriteOnly.prototype.read16 = function (memAddr) {
	//console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWriteOnly.prototype.read32 = function (memAddr) {
	//console.log("not implemented: reading word at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
	return 0;
}



//represents a word-sized IO register that is both readable and writable
const ioRegWord = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegWord.prototype = Object.create(ioReg.prototype);
ioRegWord.prototype.constructor = ioRegWord;

ioRegWord.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory32[this.regIndex >>> 2];
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegWord.prototype.read32 = function (memAddr) {
	return this.ioRegionMemory32[memAddr >>> 2];
}

ioRegWord.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory32[memAddr >>> 2] = val;
	this.triggerCallbacks();
}



//represents a word-sized IO register that is only writable
const ioRegWordWriteOnly = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegWordWriteOnly.prototype = Object.create(ioReg.prototype);
ioRegWordWriteOnly.prototype.constructor = ioRegWordWriteOnly;

ioRegWordWriteOnly.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory32[this.regIndex >>> 2];
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegWordWriteOnly.prototype.read8 = function (memAddr) {
	//console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWordWriteOnly.prototype.read16 = function (memAddr) {
	//console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWordWriteOnly.prototype.read32 = function (memAddr) {
	//console.log("not implemented: reading word at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
	return 0;
}

ioRegWordWriteOnly.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory32[memAddr >>> 2] = val;
	this.triggerCallbacks();
}



//represents a byte-sized IO register that is both readable and writable (used only for POSTFLG)
const ioRegByte = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegByte.prototype = Object.create(ioReg.prototype);
ioRegByte.prototype.constructor = ioRegByte;

ioRegByte.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory[this.regIndex];
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegByte.prototype.read16 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegs[this.regIndex + 1].read8(memAddr + 1) << 8);
}

ioRegByte.prototype.read32 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegs[this.regIndex + 1].read8(memAddr + 1) << 8) + (this.ioRegs[this.regIndex + 2].read16(memAddr + 2) << 16);
}

ioRegByte.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
}

ioRegByte.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}



//represents a byte-sized IO register that is only writable (used only for HALTCNT)
const ioRegByteWriteOnly = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegByteWriteOnly.prototype = Object.create(ioReg.prototype);
ioRegByteWriteOnly.prototype.constructor = ioRegByteWriteOnly;

ioRegByteWriteOnly.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory[this.regIndex];
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegByteWriteOnly.prototype.read8 = function (memAddr) {
	console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegByteWriteOnly.prototype.read16 = function (memAddr) {
	console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegByteWriteOnly.prototype.read32 = function (memAddr) {
	console.log("not implemented: reading word at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
	return 0;
}

ioRegByteWriteOnly.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
}

ioRegByteWriteOnly.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}



//represents register IF (writes to this IO register specifically are wonky)
const ioRegIF = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegIF.prototype = Object.create(ioReg.prototype);
ioRegIF.prototype.constructor = ioRegIF;

ioRegIF.prototype.write8 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
	this.triggerCallbacks();
}

ioRegIF.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory16[memAddr >>> 1] = (this.ioRegionMemory16[memAddr >>> 1] ^ (val & 0xFFFF)) & this.ioRegionMemory16[memAddr >>> 1];
	this.triggerCallbacks();
}

ioRegIF.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory16[memAddr >>> 1] = (this.ioRegionMemory16[memAddr >>> 1] ^ (val & 0xFFFF)) & this.ioRegionMemory16[memAddr >>> 1];
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}

//represents register DISPSTAT (bits 0 - 2 are read only)
const ioRegDISPSTAT = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegDISPSTAT.prototype = Object.create(ioReg.prototype);
ioRegDISPSTAT.prototype.constructor = ioRegDISPSTAT;

ioRegDISPSTAT.prototype.write8 = function (memAddr, val) {
	if (memAddr === this.regIndex) //writing to lower byte with 3 read only bits (0 - 2)
	{
		val &= ~7; //11111000
		this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] & 7) + val;
	}
	else
	{
		this.ioRegionMemory[memAddr] = val;
	}
	this.triggerCallbacks();
}

ioRegDISPSTAT.prototype.write16 = function (memAddr, val) {
	val &= ~7;
	this.ioRegionMemory16[memAddr >>> 1] = (this.ioRegionMemory16[memAddr >>> 1] & 7) + val;
	this.triggerCallbacks();
}

ioRegDISPSTAT.prototype.write32 = function (memAddr, val) {
	val &= ~7;
	this.ioRegionMemory16[memAddr >>> 1] = (this.ioRegionMemory16[memAddr >>> 1] & 7) + val;
	this.triggerCallbacks();

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}

//read write registers
//we're not going to enforce the write only bits, as i'll assume games won't rely on reading write only bits as the data would be unreliable anyway 

//represents a byte sized register where specific bits are read and/or write
ioRegByteReadWrite = function (name, ioRegion, regIndex, readOnlyBitMask, writeOnlyBitMask) {
	ioRegByte.call(this, name, ioRegion, regIndex);

	this.readOnlyBitMask = readOnlyBitMask;
	this.writeOnlyBitMask = writeOnlyBitMask;
}

ioRegByteReadWrite.prototype = Object.create(ioRegByte.prototype);
ioRegByteReadWrite.prototype.constructor = ioRegByteReadWrite;

ioRegByteReadWrite.prototype.write8 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] & this.readOnlyBitMask) + (val & ~this.readOnlyBitMask);
	this.triggerCallbacks();
}

ioRegByteReadWrite.prototype.write16 = function (memAddr, val) {
	this.write8(memAddr, val);
	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
}

ioRegByteReadWrite.prototype.write32 = function (memAddr, val) {
	this.write16(memAddr, val);
	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}

//represents a half word sized register where specific bits are read and/or write
ioRegReadWrite = function (name, ioRegion, regIndex, readOnlyBitMask, writeOnlyBitMask) {
	ioReg.call(this, name, ioRegion, regIndex);

	this.readOnlyBitMask = readOnlyBitMask;
	this.writeOnlyBitMask = writeOnlyBitMask;
}

ioRegReadWrite.prototype = Object.create(ioReg.prototype);
ioRegReadWrite.prototype.constructor = ioRegReadWrite;

ioRegReadWrite.prototype.write8 = function (memAddr, val) {
	//if we're writing to an address that is not half-word aligned, we have to shift the mask to the relevant bits
	let shift = (memAddr - this.regIndex) * 8;

	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] & (this.readOnlyBitMask >>> shift)) + (val & ~(this.readOnlyBitMask >>> shift));
	this.triggerCallbacks();
}

ioRegReadWrite.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory16[memAddr >>> 1] = (this.ioRegionMemory[memAddr >>> 1] & this.readOnlyBitMask) + (val & ~this.readOnlyBitMask);
	this.triggerCallbacks();
}

ioRegReadWrite.prototype.write32 = function (memAddr, val) {
	this.write16(memAddr, val);
	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
}

//represents a word sized register where specific bits are read and/or write
ioRegWordReadWrite = function (name, ioRegion, regIndex, readOnlyBitMask, writeOnlyBitMask) {
	ioRegWord.call(this, name, ioRegion, regIndex);

	this.readOnlyBitMask = readOnlyBitMask;
	this.writeOnlyBitMask = writeOnlyBitMask;
}

ioRegWordReadWrite.prototype = Object.create(ioRegWord.prototype);
ioRegWordReadWrite.prototype.constructor = ioRegWordReadWrite;

ioRegWordReadWrite.prototype.write8 = function (memAddr, val) {
	//if we're writing to an address that is not word aligned, we have to shift the mask to the relevant bits
	let shift = (memAddr - this.regIndex) * 8;
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] & (this.readOnlyBitMask >>> shift)) + (val & ~(this.readOnlyBitMask >>> shift));
	this.triggerCallbacks();
}

ioRegWordReadWrite.prototype.write16 = function (memAddr, val) {
	//if we're writing to an address that is not word aligned, we have to shift the mask to the relevant bits
	let shift = (memAddr - this.regIndex) * 8;
	this.ioRegionMemory16[memAddr >>> 1] = (this.ioRegionMemory16[memAddr >>> 1] & (this.readOnlyBitMask >>> shift)) + (val & ~(this.readOnlyBitMask >>> shift));
	this.triggerCallbacks();
}

ioRegWordReadWrite.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory32[memAddr >>> 2] = (this.ioRegionMemory[memAddr >>> 2] & this.readOnlyBitMask) + (val & ~this.readOnlyBitMask);
	this.triggerCallbacks();
}

//represents register IOREGTMCNTL
const ioRegTMCNTL = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegTMCNTL.prototype = Object.create(ioReg.prototype);
ioRegTMCNTL.prototype.constructor = ioRegTMCNTL;

ioRegTMCNTL.prototype.addTimer = function (timer) {
	this.timer = timer;
}

ioRegTMCNTL.prototype.read8 = function (memAddr) {
	if (memAddr === this.regIndex)
	{
		return this.timer.counter & 0xFF;
	}
	else
	{
		return (this.timer.counter >>> 8) & 0xFF;
	}
}

ioRegTMCNTL.prototype.read16 = function (memAddr) {
	return this.timer.counter;
}

ioRegTMCNTL.prototype.read32 = function (memAddr) {
	return this.timer.counter + (this.ioRegs[this.regIndex + 2].read16(memAddr + 2) << 16);
}

//represents an unused IO register
const ioRegUnused = function (name, ioRegion, regIndex) {
	ioReg.call(this, name, ioRegion, regIndex);
}

ioRegUnused.prototype = Object.create(ioReg.prototype);
ioRegUnused.prototype.constructor = ioRegUnused;

ioRegUnused.prototype.triggerCallbacks = function (memAddr) {
	return;
}

ioRegUnused.prototype.read8 = function (memAddr) {
	console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegUnused.prototype.read16 = function (memAddr) {
	//console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegUnused.prototype.read32 = function (memAddr) {
	console.log("not implemented: reading word at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
	return 0;
}

ioRegUnused.prototype.write8 = function (memAddr, val) {
	//console.log("ignored: writing byte to " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
}

ioRegUnused.prototype.write16 = function (memAddr, val) {
	//console.log("ignored: writing halfword to " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
}

ioRegUnused.prototype.write32 = function (memAddr, val) {
	//console.log("ignored: writing word to " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
}