const mmu = function() {

	//set up memory regions
	this.memENUMS = ["BIOS", "BOARDWORKRAM", "CHIPWORKRAM", "IOREGISTERS", "PALETTERAM", "VRAM", "OAM", "ROM1", "ROM2", "SRAM"];
	this.memRegions = [
	new memRegionBIOS("BIOS", 16 * 1024), //16 kb of BIOS
	new memRegion("BOARDWORKRAM", 256 * 1024), //256 kb of on board work ram (EWRAM)
	new memRegion("CHIPWORKRAM", 32 * 1024), //32 kb of on chip work ram (IEWRAM)
	new ioRegion(), //1023 bytes for io registers
	new memRegionDisplay("PALETTERAM", 1 * 1024), //1 kb for palette ram
	new memRegionDisplay("VRAM", 96 * 1024), //96 kb for vram
	new memRegionDisplay("OAM", 1 * 1024), //1kb for oam
	new memRegionROM("ROM1", 16 * 1024 * 1024), //first 16 mb of game rom
	new memRegionROM("ROM2", 16 * 1024 * 1024), //second 16 mb of game rom
	new memRegionSRAM("SRAM", 0), //64 kb for sram (unimplemented)
	new memRegionUndefined("UNUSED MEMORY", 0) //dummy region
	];

	this.maskedAddr;
};

//returns the memory region that the memory address refers to, and sets
//maskedAddr above to an address that accounts for memory mirrors
mmu.prototype.decodeAddr = function (memAddr) {
	switch (memAddr & 0xFF000000)
	{
		case 0: //BIOS (16 KB, not mirrored)
		if (memAddr > 0x3FFF)
		{
			throw Error("accessing invalid BIOS memory at addr 0x" + memAddr.toString(16) + "!");
		}
		this.maskedAddr = memAddr;
		return this.memRegions[0];
		break;
		
		case 0x2000000: //EWRAM (256 KB, mirrored completely across 2XXXXXX)
		this.maskedAddr = memAddr & 0x3FFFF;
		return this.memRegions[1];
		break;
		
		case 0x3000000: //IWRAM (32 KB, mirrored completely across 3XXXXXX)
		this.maskedAddr = memAddr & 0x7FFF;
		return this.memRegions[2];
		break;
		
		case 0x4000000: //IOREGS (not mirrored, except for 0x400800 ??)
		if ((memAddr & 0xFFFFFF) > 0x3FE)
		{
			throw Error("accessing invalid IO memory at addr 0x" + memAddr.toString(16) + "!");
		}
		this.maskedAddr = memAddr & 0xFFFFFF;
		return this.memRegions[3];
		break;
		
		case 0x5000000: //PALETTERAM (1 KB, mirrored completely across 5XXXXXX)	
		this.maskedAddr = memAddr & 0x3FF;
		return this.memRegions[4];
		break;
		
		case 0x6000000: //VRAM (96 KB, mirrored completely across 6XXXXXX, every 128 KB, made up of 64 KB, 32KB, 32KB, where 32 KB chunks mirror each other)
		memAddr &= 0x1FFFF;
		this.maskedAddr = (memAddr & 0x10000) ? (memAddr & 0x17FFF) : memAddr;
		return this.memRegions[5];
		break;
		
		case 0x7000000:  //OAM (1 KB, mirrored completely across 7XXXXX)
		this.maskedAddr = memAddr & 0x3FF;
		return this.memRegions[6];
		break;
		
		case 0x8000000: //ROM1, first 16 MB (takes up whole 24 bit address space)
		this.maskedAddr = memAddr & 0xFFFFFF;
		return this.memRegions[7];
		break;
		
		case 0x9000000: //ROM2, second 16 MB (takes up whole 24 bit address space)
		this.maskedAddr = memAddr & 0xFFFFFF;		
		return this.memRegions[8];
		break;
		
		case 0xE000000: //SRAM (64 KB, mirrored?)
		if ((memAddr & 0xFFFFFF) > 0xFFFF)
		{
			throw Error("accessing invalid SRAM at memory addr 0x" + memAddr.toString(16) + "!");
		}
		this.maskedAddr = memAddr & 0xFFFFFF;
		return this.memRegions[9];
		break;

		default: 
		this.maskedAddr = memAddr;
		return this.memRegions[10];
	}
	console.log("this should never happen");
}


mmu.prototype.read = function (memAddr, numBytes) {
	if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}

	let memRegion = this.decodeAddr(memAddr);
	switch(numBytes)
	{
		case 1: //byte
		return memRegion.read8(this.maskedAddr);
		break;
		case 2: //halfword
		return memRegion.read16(this.maskedAddr);
		break;
		case 4: //word
		return memRegion.read32(this.maskedAddr);
		break;
	}
	throw Error("reading invalid number of bytes!");
};

mmu.prototype.read8 = function(memAddr) {
	let memRegion = this.decodeAddr(memAddr);
	return memRegion.read8(this.maskedAddr);
}

mmu.prototype.read16 = function(memAddr) {
	if (memAddr & 1)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.decodeAddr(memAddr);
	return memRegion.read16(this.maskedAddr);
}

mmu.prototype.read32 = function(memAddr) {
	if (memAddr & 3)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.decodeAddr(memAddr);
	return memRegion.read32(this.maskedAddr);
}

mmu.prototype.write = function(memAddr, val, numBytes) {
	if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
	{
		throw Error("memory address is not aligned!");
	}
	
	let memRegion = this.decodeAddr(memAddr);
	switch(numBytes)
	{
		case 1: //byte
		memRegion.write8(this.maskedAddr, val);
		return;
		break;
		case 2: //halfword
		memRegion.write16(this.maskedAddr, val);
		return;
		break;
		case 4: //word
		memRegion.write32(this.maskedAddr, val);
		return;
		break;
	}
	throw Error("writing invalid number of bytes!");
}

mmu.prototype.write8 = function(memAddr, val) {
	let memRegion = this.decodeAddr(memAddr);
	memRegion.write8(this.maskedAddr, val);
}

mmu.prototype.write16 = function(memAddr, val) {
	if (memAddr & 1)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.decodeAddr(memAddr);
	memRegion.write16(this.maskedAddr, val);
}

mmu.prototype.write32 = function(memAddr, val) {
	if (memAddr & 3)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.decodeAddr(memAddr);
	memRegion.write32(this.maskedAddr, val);
}

mmu.prototype.getMemoryRegion = function(region)
{
	if (this.memENUMS.indexOf(region) === -1)
	{
		throw Error("mem region doesnt exist");
	}
	else
	{
		return this.memRegions[this.memENUMS.indexOf(region)].memory;
	}
}

