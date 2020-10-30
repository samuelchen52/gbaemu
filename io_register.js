//represents a halfword-sized IO register that is both readable and writable
const ioReg = function(name, ioRegionMemory, ioRegs, regIndex) {
	this.name = name;
	this.ioRegionMemory = ioRegionMemory;
	this.ioRegs = ioRegs;
	this.regIndex = regIndex;
	this.callbacks = [];
}

ioReg.prototype.addCallback = function (fn) {
	this.callbacks.push(fn);
}

ioReg.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory[this.regIndex] + (this.ioRegionMemory[(this.regIndex + 1)] << 8);
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioReg.prototype.read8 = function (memAddr) {
	return this.ioRegionMemory[memAddr];
}

ioReg.prototype.read16 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegionMemory[(memAddr + 1)] << 8);
}

ioReg.prototype.read32 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegionMemory[(memAddr + 1)] << 8) + (this.ioRegs[this.regIndex + 2].read16(memAddr) << 16);
}

ioReg.prototype.write8 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val;
}

ioReg.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.ioRegionMemory[(memAddr + 1)] = (val & 0xFF00) >>> 8;
}

ioReg.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.ioRegionMemory[(memAddr + 1)] = (val & 0xFF00) >>> 8;

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
	this.ioRegs[this.regIndex + 2].triggerCallbacks();
}

//for now, assuming writes to read only / unused mem dont do anything, and reading from write only / unused mem just returns 0

//represents a halfword-sized IO register that is only readable (used only for KEYINPUT)
const ioRegReadOnly = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegReadOnly.prototype = Object.create(ioReg.prototype);
ioRegReadOnly.constructor = ioRegReadOnly;

ioRegReadOnly.prototype.read8 = function (memAddr) {
	//console.log("AYOOO3");
	return this.ioRegionMemory[memAddr];
}

ioRegReadOnly.prototype.read16 = function (memAddr) {
	//console.log("AYOOO2");
	return this.ioRegionMemory[memAddr] + (this.ioRegionMemory[(memAddr + 1)] << 8);
}

ioRegReadOnly.prototype.read32 = function (memAddr) {
	//console.log("AYOOO1");
	return this.ioRegionMemory[memAddr] + (this.ioRegionMemory[(memAddr + 1)] << 8) + (this.ioRegs[this.regIndex + 2].read16(memAddr) << 16);
}

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
const ioRegWriteOnly = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegWriteOnly.prototype = Object.create(ioReg.prototype);
ioRegWriteOnly.constructor = ioRegWriteOnly;

ioRegWriteOnly.prototype.read8 = function (memAddr) {
	console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWriteOnly.prototype.read16 = function (memAddr) {
	console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWriteOnly.prototype.read32 = function (memAddr) {
	console.log("not implemented: reading word at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
	return 0;
}



//represents a word-sized IO register that is both readable and writable
const ioRegWord = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegWord.prototype = Object.create(ioReg.prototype);
ioRegWord.constructor = ioRegWord;

ioRegWord.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory[this.regIndex] + (this.ioRegionMemory[(this.regIndex + 1)] << 8) + (this.ioRegionMemory[(this.regIndex + 2)] << 16) + (this.ioRegionMemory[(this.regIndex + 3)] << 24);
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegWord.prototype.read32 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegionMemory[(memAddr + 1)] << 8) + (this.ioRegionMemory[(memAddr + 2)] << 16) + (this.ioRegionMemory[(memAddr + 3)] << 24);
}

ioRegWord.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.ioRegionMemory[(memAddr + 1)] = (val & 0xFF00) >>> 8;
	this.ioRegionMemory[(memAddr + 2)] = (val & 0xFF0000) >>> 16;
	this.ioRegionMemory[(memAddr + 3)] = (val & 0xFF000000) >>> 24;
}



//represents a word-sized IO register that is only writable
const ioRegWordWriteOnly = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegWordWriteOnly.prototype = Object.create(ioReg.prototype);
ioRegWordWriteOnly.constructor = ioRegWordWriteOnly;

ioRegWordWriteOnly.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory[this.regIndex] + (this.ioRegionMemory[(this.regIndex + 1)] << 8) + (this.ioRegionMemory[(this.regIndex + 2)] << 16) + (this.ioRegionMemory[(this.regIndex + 3)] << 24);
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegWordWriteOnly.prototype.read8 = function (memAddr) {
	console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWordWriteOnly.prototype.read16 = function (memAddr) {
	console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegWordWriteOnly.prototype.read32 = function (memAddr) {
	console.log("not implemented: reading word at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16)); 
	return 0;
}

ioRegWordWriteOnly.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;
	this.ioRegionMemory[(memAddr + 1)] = (val & 0xFF00) >>> 8;
	this.ioRegionMemory[(memAddr + 2)] = (val & 0xFF0000) >>> 16;
	this.ioRegionMemory[(memAddr + 3)] = (val & 0xFF000000) >>> 24;
}



//represents a byte-sized IO register that is both readable and writable (used only for POSTFLG)
const ioRegByte = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegByte.prototype = Object.create(ioReg.prototype);
ioRegByte.constructor = ioRegByte;

ioRegByte.prototype.triggerCallbacks = function () {
	let val = this.ioRegionMemory[this.regIndex];
	for (let i = 0; i < this.callbacks.length; i ++)
	{
		this.callbacks[i](val);
	}
}

ioRegByte.prototype.read16 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegs[this.regIndex + 1].read8(memAddr) << 8);
}

ioRegByte.prototype.read32 = function (memAddr) {
	return this.ioRegionMemory[memAddr] + (this.ioRegs[this.regIndex + 1].read8(memAddr) << 8) + (this.ioRegs[this.regIndex + 2].read16(memAddr) << 16);
}

ioRegByte.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
	this.ioRegs[this.regIndex + 1].triggerCallbacks();
}

ioRegByte.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
	this.ioRegs[this.regIndex + 1].triggerCallbacks();

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
	this.ioRegs[this.regIndex + 2].triggerCallbacks();
}



//represents a byte-sized IO register that is only writable (used only for HALTCNT)
const ioRegByteWriteOnly = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegByteWriteOnly.prototype = Object.create(ioReg.prototype);
ioRegByteWriteOnly.constructor = ioRegByteWriteOnly;

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

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
	this.ioRegs[this.regIndex + 1].triggerCallbacks();
}

ioRegByteWriteOnly.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = val & 0xFF;

	this.ioRegs[this.regIndex + 1].write8(memAddr + 1, (val & 0xFF00) >>> 8); 
	this.ioRegs[this.regIndex + 1].triggerCallbacks();

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
	this.ioRegs[this.regIndex + 2].triggerCallbacks();
}



//represents register IF (writes to this IO register specifically are wonky)
const ioRegIF = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegIF.prototype = Object.create(ioReg.prototype);
ioRegIF.constructor = ioRegIF;

ioRegIF.prototype.write8 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
}

ioRegIF.prototype.write16 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
	this.ioRegionMemory[(memAddr + 1)] = (this.ioRegionMemory[memAddr + 1] ^ ((val & 0xFF00) >>> 8)) & this.ioRegionMemory[memAddr + 1];
}

ioRegIF.prototype.write32 = function (memAddr, val) {
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
	this.ioRegionMemory[(memAddr + 1)] = (this.ioRegionMemory[memAddr + 1] ^ ((val & 0xFF00) >>> 8)) & this.ioRegionMemory[memAddr + 1];

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
	this.ioRegs[this.regIndex + 2].triggerCallbacks();
}

//represents register DISPSTAT (bits 0 - 2 are read only)
const ioRegDISPSTAT = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegDISPSTAT.prototype = Object.create(ioReg.prototype);
ioRegDISPSTAT.constructor = ioRegDISPSTAT;

ioRegDISPSTAT.prototype.write8 = function (memAddr, val) {
	if (memAddr === this.regIndex) //writing to lower byte with read only bits
	{
		val &= ~7;
	}
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
}

ioRegDISPSTAT.prototype.write16 = function (memAddr, val) {
	val &= ~7;
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
	this.ioRegionMemory[(memAddr + 1)] = (this.ioRegionMemory[memAddr + 1] ^ ((val & 0xFF00) >>> 8)) & this.ioRegionMemory[memAddr + 1];
}

ioRegDISPSTAT.prototype.write32 = function (memAddr, val) {
	val &= ~7;
	this.ioRegionMemory[memAddr] = (this.ioRegionMemory[memAddr] ^ (val & 0xFF)) & this.ioRegionMemory[memAddr];
	this.ioRegionMemory[(memAddr + 1)] = (this.ioRegionMemory[memAddr + 1] ^ ((val & 0xFF00) >>> 8)) & this.ioRegionMemory[memAddr + 1];

	this.ioRegs[this.regIndex + 2].write16(memAddr + 2, (val & 0xFFFF0000) >>> 16); 
	this.ioRegs[this.regIndex + 2].triggerCallbacks();
}

//represents an unused IO register
const ioRegUnused = function (name, ioRegionMemory, ioRegs, regIndex) {
	ioReg.call(this, name, ioRegionMemory, ioRegs, regIndex);
}

ioRegUnused.prototype = Object.create(ioReg.prototype);
ioRegUnused.constructor = ioRegUnused;

ioRegUnused.prototype.triggerCallbacks = function (memAddr) {
	return;
}

ioRegUnused.prototype.read8 = function (memAddr) {
	console.log("not implemented: reading byte at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
	return 0;
}

ioRegUnused.prototype.read16 = function (memAddr) {
	console.log("not implemented: reading halfword at " + this.name + " at mem addr: 0x" + (memAddr >>> 0).toString(16));
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