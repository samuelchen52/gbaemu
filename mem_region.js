const memRegion = function(name, size) {
	this.name = name;
	this.memory = new Uint8Array(size);
}

memRegion.prototype.read8 = function (memAddr) {
	return this.memory[memAddr];
}
memRegion.prototype.read16 = function (memAddr) {
	return this.memory[memAddr] + (this.memory[(memAddr + 1)] << 8);
}
memRegion.prototype.read32 = function (memAddr) {
	return this.memory[memAddr] + (this.memory[(memAddr + 1)] << 8) + (this.memory[(memAddr + 2)] << 16) + (this.memory[(memAddr + 3)] << 24);
}

memRegion.prototype.write8 = function (memAddr, val) {
	this.memory[memAddr] = val & 0xFF;
}
memRegion.prototype.write16 = function (memAddr, val) {
	this.memory[memAddr] = val & 0xFF;
	this.memory[(memAddr + 1)] = (val & 0xFF00) >>> 8;
}
memRegion.prototype.write32 = function (memAddr, val) {
	this.memory[memAddr] = val & 0xFF;
	this.memory[(memAddr + 1)] = (val & 0xFF00) >>> 8;
	this.memory[(memAddr + 2)] = (val & 0xFF0000) >>> 16;
	this.memory[(memAddr + 3)] = (val & 0xFF000000) >>> 24;
}


//VRAM, OAM, and PALETTERAM
const memRegionDisplay = function (name, size) {
	memRegion.call(this, name, size);
}

memRegionDisplay.prototype = Object.create(memRegion.prototype);
memRegionDisplay.constructor = memRegionDisplay;

memRegionDisplay.prototype.write8 = function (memAddr, val) {
	console.log("not implemented: writing byte to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

//BIOS
const memRegionBIOS = function (name, size) {
	memRegion.call(this, name, size);
}

memRegionBIOS.prototype = Object.create(memRegion.prototype);
memRegionBIOS.constructor = memRegionBIOS;

memRegionBIOS.prototype.write8 = function (memAddr, val) {
	console.log("ignored: writing byte to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionBIOS.prototype.write16 = function (memAddr, val) {
	console.log("ignored: writing halfword to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionBIOS.prototype.write32 = function (memAddr, val) {
	console.log("ignored: writing word to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

//ROM1 / ROM2 
const memRegionROM = function (name, size) {
	memRegion.call(this, name, size);
}

memRegionROM.prototype = Object.create(memRegion.prototype);
memRegionROM.constructor = memRegionROM;

memRegionROM.prototype.write8 = function (memAddr, val) {
	console.log("ignored: writing byte to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionROM.prototype.write16 = function (memAddr, val) {
	console.log("ignored: writing halfword to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionROM.prototype.write32 = function (memAddr, val) {
	console.log("ignored: writing word to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

//SRAM
const memRegionSRAM = function (name, size) {
	memRegion.call(this, name, size);
}

memRegionSRAM.prototype = Object.create(memRegion.prototype);
memRegionSRAM.constructor = memRegionSRAM;

memRegionSRAM.prototype.read8 = function (memAddr, val) {
	throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.read16 = function (memAddr, val) {
	console.log("error: reading halfword at: " + this.name);
	throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.read32 = function (memAddr, val) {
	console.log("error: reading word at: " + this.name);
	throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.write8 = function (memAddr, val) {
	throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.write16 = function (memAddr, val) {
	console.log("error: writing halfword to: " + this.name);
	throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.write32 = function (memAddr, val) {
	console.log("error: writing word to: " + this.name);
	throw Error("SRAM not implemented")
}

//unused memory
const memRegionUndefined = function (name, size) {
	memRegion.call(this, name, size);
}

memRegionUndefined.prototype = Object.create(memRegion.prototype);
memRegionUndefined.constructor = memRegionUndefined;

memRegionUndefined.prototype.read8 = function (memAddr, val) {
	console.log("not implemented: reading byte at " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
	return 0;
}

memRegionUndefined.prototype.read16 = function (memAddr, val) {
	console.log("not implemented: reading halfword at " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
	return 0;
}

memRegionUndefined.prototype.read32 = function (memAddr, val) {
	console.log("not implemented: reading word at " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
	return 0;
}

memRegionUndefined.prototype.write8 = function (memAddr, val) {
	console.log("ignored: writing byte to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionUndefined.prototype.write16 = function (memAddr, val) {
	console.log("ignored: writing halfword to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionUndefined.prototype.write32 = function (memAddr, val) {
	console.log("ignored: writing word to " + this.name + " at mem addr: " + (memAddr >>> 0).toString(16));
}
