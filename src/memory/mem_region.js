const memRegion = function(name, size) {
	this.name = name;
	this.memory = new Uint8Array(size);
	this.memory16 = new Uint16Array(this.memory.buffer);
	this.memory32 = new Uint32Array(this.memory.buffer);
}

memRegion.prototype.read8 = function (memAddr) {
	return this.memory[memAddr];
}
memRegion.prototype.read16 = function (memAddr) {
	return this.memory16[memAddr >>> 1];
}
memRegion.prototype.read32 = function (memAddr) {
	return this.memory32[memAddr >>> 2];
}

memRegion.prototype.write8 = function (memAddr, val) {
	this.memory[memAddr] = val & 0xFF;
}
memRegion.prototype.write16 = function (memAddr, val) {
	this.memory16[memAddr >>> 1] = val;
}
memRegion.prototype.write32 = function (memAddr, val) {
	this.memory32[memAddr >>> 2] = val;
}

memRegion.prototype.dumpMemory = function (memAddr) {
	let memory = this.memory;
	let numBytes = 12 * 16 + memAddr;
	for (let i = memAddr; i < numBytes; i += 16)
	{
		let str = "";
		for (let p = 0; p < 16; p ++)
		{
			str += memory[i + p].toString(16).padStart(2, "0") + " "; 
		}
		console.log((i & 0xFF).toString(16).padStart(2, "0") + ": " + str);
	}
};

//returns JSON of inner state
memRegion.prototype.serialize = function() {
	let copy = {};

	copy.memory = [...compressBinaryData(this.memory, 1)];

	return copy;
}
  
memRegion.prototype.setState = function(saveState) {
	copyArrIntoArr(decompressBinaryData(new Uint8Array(saveState.memory), 1), this.memory);
}

// memRegion.prototype.serialize = function() {
// 	let copy = {};

// 	copy.memory = serializeBinaryData32((compressBinaryData(this.memory)));

// 	//copy.memory = [...this.memory];

// 	return JSON.stringify(copy);
// }
  
// memRegion.prototype.setState = function(saveState) {
// 	//copyArrIntoArr(new Uint32Array(decompressBinaryData(new Uint8Array(new Uint32Array(saveState.memory).buffer), 1).buffer), new Uint32Array(this.memory));
// 	copyArrIntoArr(decompressBinaryData(deserializeBinaryData32(saveState.memory), 1), 1, this.memory);
// }


//VRAM and PALETTERAM
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
const memRegionSRAM = function (size) {
	this.memory = new Uint8Array(size);
}

memRegionSRAM.prototype = Object.create(memRegion.prototype);
memRegionSRAM.constructor = memRegionSRAM;

memRegionSRAM.prototype.read8 = function (memAddr, val) {
	if (memAddr === 0x0000000)
	{
		return 0x62;
	}
	else if (memAddr === 0x0000001)
	{
		return 0x13;
	}
	else if (memAddr === 0x005555)
	{
		console.log("FLASH1!");
	}
	else if (memAddr === 0x002AAA)
	{
		console.log("FLASH2!");
	}
	return this.memory[memAddr];
	//throw Error("SRAM not implemented")
	return 0x09;
	return 0xC2;
	//throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.read16 = function (memAddr, val) {
	console.log("error: reading halfword at: SRAM");
	//throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.read32 = function (memAddr, val) {
	console.log("error: reading word at: SRAM");
	//throw Error("SRAM not implemented")
}

// memRegionSRAM.prototype.write8 = function (memAddr, val) {
// 	throw Error("SRAM not implemented")
// }

memRegionSRAM.prototype.write16 = function (memAddr, val) {
	console.log("error: writing halfword to: SRAM");
	//throw Error("SRAM not implemented")
}

memRegionSRAM.prototype.write32 = function (memAddr, val) {
	console.log("error: writing word to: SRAM");
	//throw Error("SRAM not implemented")
}

//unused memory
const memRegionUndefined = function () {
	this.memory = new Uint8Array(0);
}

memRegionUndefined.prototype = Object.create(memRegion.prototype);
memRegionUndefined.constructor = memRegionUndefined;

memRegionUndefined.prototype.read8 = function (memAddr, val) {
	console.log("not implemented: reading byte at UNDEFINED" + " at mem addr: " + (memAddr >>> 0).toString(16));
	return 0;
}

memRegionUndefined.prototype.read16 = function (memAddr, val) {
	console.log("not implemented: reading halfword at UNDEFINED" + " at mem addr: " + (memAddr >>> 0).toString(16));
	return 0;
}

memRegionUndefined.prototype.read32 = function (memAddr, val) {
	console.log("not implemented: reading word at UNDEFINED" + " at mem addr: " + (memAddr >>> 0).toString(16));
	return 0;
}

memRegionUndefined.prototype.write8 = function (memAddr, val) {
	console.log("ignored: writing byte to UNDEFINED" + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionUndefined.prototype.write16 = function (memAddr, val) {
	console.log("ignored: writing halfword to UNDEFINED" + " at mem addr: " + (memAddr >>> 0).toString(16));
}

memRegionUndefined.prototype.write32 = function (memAddr, val) {
	console.log("ignored: writing word to UNDEFINED" + " at mem addr: " + (memAddr >>> 0).toString(16));
}
