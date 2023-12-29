//waitstates for each memory region (accessing mem region takes 1 + waitstate cycles)
//accessing memory region takes 1 + waitstate cycles, N / S cycles have separate timings for Flash and ROM
//external work RAM, ROM, Flash, and SRAM have configurable waitstates (WAITCNT)
//ROM is mirrored to two additional address regions at 0Axxxxxx and 0Cxxxxxxxx
//these three ROM memory regions each have configurable waitstates

//actual cycles = cycle + 1
//gamepak ROM is 16 bit bus
//gamepak ram is 8 bit bus

//waitstate0 n cycle 4,3,2,8
//waitstate0 s cycle 2,1
//waitstate1 n cycle 4,3,2,8
//waitstate1 s cycle 4,1
//waitstate2 n cycle 4,3,2,8
//waitstate2 s cycle 8,1

//s cycles and n cycles same for all other regions
//have n cycle wrapper called in reset pipeline for n cycles


const mmu = function() {
	this.memRegions = [
		new memRegionBIOS("BIOS", 16 * 1024), //16 kb of BIOS
		null,
		new memRegion("BOARDWORKRAM", 256 * 1024), //256 kb of on board work ram (EWRAM)
		new memRegion("CHIPWORKRAM", 32 * 1024), //32 kb of on chip work ram (IEWRAM)
		new ioRegion(), //1023 bytes for io registers
		new memRegionDisplay("PALETTERAM", 1 * 1024), //1 kb for palette ram
		new memRegionDisplay("VRAM", 96 * 1024), //96 kb for vram
		new oamRegion(), //1kb for oam
		new memRegionROM("ROM1", 16 * 1024 * 1024), //first 16 mb of game rom
		new memRegionROM("ROM2", 16 * 1024 * 1024), //second 16 mb of game rom
		new memRegionSRAM(64 * 1024), //64 kb for sram (unimplemented)
		new memRegionUndefined() //dummy region
	];

	this.getMemoryRegion("IOREGISTERS").getIOReg("WAITCNT").addCallback((newWAITCNTVal) => {this.updateWAITCNT(newWAITCNTVal)});

	this.numCycles = 0;
	this.maskedAddr;
	this.lastAccesssedAddr = 0x0; //s-cycle if next address is 0 - 4 bytes ahead of last accessed address, else n-cycle
	this.waitState0NSEQ = 4;
	this.waitState1NSEQ = 4;
	this.waitState2NSEQ = 4;
	this.waitStateSRAM = 4;
};

// 	 0-1   SRAM Wait Control          (0..3 = 4,3,2,8 cycles)
//   2-3   Wait State 0 First Access  (0..3 = 4,3,2,8 cycles)
//   4     Wait State 0 Second Access (0..1 = 2,1 cycles)
//   5-6   Wait State 1 First Access  (0..3 = 4,3,2,8 cycles)
//   7     Wait State 1 Second Access (0..1 = 4,1 cycles; unlike above WS0)
//   8-9   Wait State 2 First Access  (0..3 = 4,3,2,8 cycles)
//   10    Wait State 2 Second Access (0..1 = 8,1 cycles; unlike above WS0,WS1)
//   11-12 PHI Terminal Output        (0..3 = Disable, 4.19MHz, 8.38MHz, 16.78MHz)
//   13    Not used
//   14    Game Pak Prefetch Buffer (Pipe) (0=Disable, 1=Enable)
//   15    Game Pak Type Flag  (Read Only) (0=GBA, 1=CGB) (IN35 signal)
//   16-31 Not used

//00000000000000000000000000000011
//00000000000000000000000000001100
//00000000000000000000000000010000
//00000000000000000000000001100000
//00000000000000000000000010000000
//00000000000000000000001100000000
//00000000000000000000010000000000


//indices of name correspond to mem region array
mmu.prototype.memRegionNames = ["BIOS", "NULL", "BOARDWORKRAM", "CHIPWORKRAM", "IOREGISTERS", "PALETTERAM", "VRAM", "OAM", "ROM1", "ROM2", "SRAM", "UNDEFINED"];
mmu.prototype.memENUMS = {
  //WAITCNT
  SRAMWAIT : 3,
  WAITSTATE0NSEQ : 12,
  WAITSTATE0SEQ : 16,
  WAITSTATE1NSEQ : 96,
  WAITSTATE1SEQ : 128,
  WAITSTATE2NSEQ : 768,
  WAITSTATE2SEQ : 1024,
};

	// n and s cycles are the SAME, EXCEPT for ROM / FLASH (take up the same memory)!!!
	// n cycles for ROM are displayed below

  // Region        Bus   Read      Write     Cycles
  // BIOS ROM      32    8/16/32   -         1/1/1
  // Work RAM 32K  32    8/16/32   8/16/32   1/1/1
  // I/O           32    8/16/32   8/16/32   1/1/1
  // OAM           32    8/16/32   16/32     1/1/1 *

  // Work RAM 256K 16    8/16/32   8/16/32   3/3/6 **
  // Palette RAM   16    8/16/32   16/32     1/1/2 *
  // VRAM          16    8/16/32   16/32     1/1/2 *
  // GamePak ROM   16    8/16/32   -         5/5/8 **/***
  // GamePak Flash 16    8/16/32   16/32     5/5/8 **/***


  // GamePak SRAM  8     8         8         5     **


//waitstates for memory regions with different timings based on data size (s cycles)
//indexed first by memory region index, then by size of the data (8/16/32)
mmu.prototype.waitStates = [
	new Uint8Array(3).fill(3), //EWRAM
	new Uint8Array(3).fill(1), //PALETTE RAM / VIDEO RAM
	new Uint8Array(3).fill(3), //ROM waitstate 0
	new Uint8Array(3).fill(5), //ROM waitstate 1
	new Uint8Array(3).fill(9), //ROM waitstate 2
];

//set timings for 32 bit R/W
mmu.prototype.waitStates[0][2] = 6;
mmu.prototype.waitStates[1][2] = 2;
mmu.prototype.waitStates[2][2] = 6;
mmu.prototype.waitStates[3][2] = 10;
mmu.prototype.waitStates[4][2] = 18;

//WAITCNT waitstate control
// 	 0-1   SRAM Wait Control          (0..3 = 4,3,2,8 cycles)
//   2-3   Wait State 0 First Access  (0..3 = 4,3,2,8 cycles)
//   4     Wait State 0 Second Access (0..1 = 2,1 cycles)
//   5-6   Wait State 1 First Access  (0..3 = 4,3,2,8 cycles)
//   7     Wait State 1 Second Access (0..1 = 4,1 cycles; unlike above WS0)
//   8-9   Wait State 2 First Access  (0..3 = 4,3,2,8 cycles)
//   10    Wait State 2 Second Access (0..1 = 8,1 cycles; unlike above WS0,WS1)
//   11-12 PHI Terminal Output        (0..3 = Disable, 4.19MHz, 8.38MHz, 16.78MHz)
//   13    Not used
//   14    Game Pak Prefetch Buffer (Pipe) (0=Disable, 1=Enable)
//   15    Game Pak Type Flag  (Read Only) (0=GBA, 1=CGB) (IN35 signal)
//   16-31 Not used

mmu.prototype.updateWAITCNT = function (newWAITCNTVal) {
	// SRAMWAIT : 3,
 //  WAITSTATE0NSEQ : 12,
 //  WAITSTATE0SEQ : 16,
 //  WAITSTATE1NSEQ : 96,
 //  WAITSTATE1SEQ : 128,
 //  WAITSTATE2NSEQ : 768,
 //  WAITSTATE2SEQ : 1024,

 //set n cycle timings for ROM
	this.waitState0NSEQ = (newWAITCNTVal & this.memENUMS["WAITSTATE0NSEQ"]) >>> 2;
	this.waitState0NSEQ = (this.waitState0NSEQ === 3) ? 9 : 5 - this.waitState0NSEQ;
	this.waitState1NSEQ = (newWAITCNTVal & this.memENUMS["WAITSTATE1NSEQ"]) >>> 5;
	this.waitState1NSEQ = (this.waitState1NSEQ === 3) ? 9 : 5 - this.waitState1NSEQ;
	this.waitState2NSEQ = (newWAITCNTVal & this.memENUMS["WAITSTATE2NSEQ"]) >>> 8;
	this.waitState2NSEQ = (this.waitState2NSEQ === 3) ? 9 : 5 - this.waitState2NSEQ;

	//set s cycle timings for ROM
	this.waitStates[2].fill((newWAITCNTVal & this.memENUMS["WAITSTATE0SEQ"]) ? 3 : 1);
	this.waitStates[2][2] <<= 1;

	this.waitStates[3].fill( (newWAITCNTVal & this.memENUMS["WAITSTATE1SEQ"]) ? 5 : 1);
	this.waitStates[3][2] <<= 1;

	this.waitStates[4].fill( (newWAITCNTVal & this.memENUMS["WAITSTATE2SEQ"]) ? 9 : 1);
	this.waitStates[4][2] <<= 1;

	//set timings for SRAM
	this.waitStateSRAM = newWAITCNTVal & this.memENUMS["SRAMWAIT"];
	this.waitStateSRAM = (this.waitStateSRAM === 3) ? 9 : 5 - this.waitStateSRAM;
};

//returns the memory region that the memory address refers to
//sets maskedAddr above to an address that accounts for memory mirrors
//sets numcycles to number of cycles it took to access mem region (based on size as well)
//datasize 0-2, -> 8/16/32 bits
//for now, when accessing rom, we'll just treat it as an s-cycle for simplicity
//timings are not exactly accurate but good enough
mmu.prototype.accessMemRegion = function (memAddr, dataSize) {
	if (typeof dataSize !== "number")
	{
		console.log(dataSize);
		alert(typeof dataSize !== "number");
		throw Error();
	}
	if (dataSize < 0 || dataSize > 2)
		throw Error();
	switch (memAddr & 0xFF000000)
	{
		case 0: //BIOS (16 KB, not mirrored)
		if (memAddr > 0x3FFF)
		{
			console.log("accessing invalid BIOS memory at addr 0x" + memAddr.toString(16) + "!");
			//throw Error("accessing invalid BIOS memory at addr 0x" + memAddr.toString(16) + "!");
		}
		this.maskedAddr = memAddr;
		this.numCycles += 1;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[0];
		break;
		
		case 0x2000000: //EWRAM (256 KB, mirrored completely across 2XXXXXX)
		this.maskedAddr = memAddr & 0x3FFFF;
		this.numCycles += this.waitStates[0][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[2];
		break;
		
		case 0x3000000: //IWRAM (32 KB, mirrored completely across 3XXXXXX)
		this.maskedAddr = memAddr & 0x7FFF;
		this.numCycles += 1;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[3];
		break;
		
		case 0x4000000: //IOREGS (not mirrored, except for 0x400800 ??)
		this.maskedAddr = memAddr & 0xFFFFFF;
		this.numCycles += 1;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[4];
		break;
		
		case 0x5000000: //PALETTERAM (1 KB, mirrored completely across 5XXXXXX)	
		this.maskedAddr = memAddr & 0x3FF;
		this.numCycles += this.waitStates[1][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[5];
		break;
		
		case 0x6000000: //VRAM (96 KB, mirrored completely across 6XXXXXX, every 128 KB, made up of 64 KB, 32KB, 32KB, where 32 KB chunks mirror each other)
		memAddr &= 0x1FFFF;
		this.maskedAddr = (memAddr & 0x10000) ? (memAddr & 0x17FFF) : memAddr;
		this.numCycles += this.waitStates[1][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[6];
		break;
		
		case 0x7000000:  //OAM (1 KB, mirrored completely across 7XXXXX)
		this.maskedAddr = memAddr & 0x3FF;
		this.numCycles += 1;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[7];
		break;
		
		case 0x8000000: //ROM1 waitstate 0, first 16 MB
		this.maskedAddr = memAddr & 0xFFFFFF;
		this.numCycles += this.waitStates[2][dataSize];
		// this.numCycles += 1;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[8];
		break;
		
		case 0x9000000: //ROM2 waitstate 0, second 16 MB
		this.maskedAddr = memAddr & 0xFFFFFF;		
		this.numCycles += this.waitStates[2][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[9];
		break;

		case 0xA000000: //ROM1 wait state 1
		this.maskedAddr = memAddr & 0xFFFFFF;
		this.numCycles += this.waitStates[3][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[8];
		break;

		case 0xB000000: //ROM2 wait state 1
		this.numCycles += this.waitStates[3][dataSize];
		return this.memRegions[9];
		break;

		case 0xC000000: //ROM1 wait state 2
		this.maskedAddr = memAddr & 0xFFFFFF;
		this.numCycles += this.waitStates[4][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[8];
		break;

		case 0xD000000: //ROM2 wait state 2
		this.maskedAddr = memAddr & 0xFFFFFF;		
		this.numCycles += this.waitStates[4][dataSize];
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[9];
		break;
		
		case 0xE000000: //SRAM (64 KB, mirrored?)
		if ((memAddr & 0xFFFFFF) > 0xFFFF)
		{
			throw Error("accessing invalid SRAM at memory addr 0x" + memAddr.toString(16) + "!");
		}
		this.maskedAddr = memAddr & 0xFFFFFF;
		this.numCycles += this.waitStateSRAM;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[10];
		break;

		default: 
		this.maskedAddr = memAddr;
		//this.lastAccesssedAddr = memAddr;
		return this.memRegions[11];
	}
	throw Error("This should NEVER happen!");
};


mmu.prototype.read = function (memAddr, numBytes) {
	if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}

	let memRegion = this.accessMemRegion(memAddr, (numBytes === 4) ? 2 : numBytes - 1);
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
	let memRegion = this.accessMemRegion(memAddr, 0);
	return memRegion.read8(this.maskedAddr);
};

mmu.prototype.read16 = function(memAddr) {
	if (memAddr & 1)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.accessMemRegion(memAddr, 1);
	return memRegion.read16(this.maskedAddr);
};

mmu.prototype.read32 = function(memAddr) {
	if (memAddr & 3)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.accessMemRegion(memAddr, 2);
	return memRegion.read32(this.maskedAddr);
};

mmu.prototype.write = function(memAddr, val, numBytes) {
	if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
	{
		throw Error("memory address is not aligned!");
	}
	
	let memRegion = this.accessMemRegion(memAddr, (numBytes === 4) ? 2 : numBytes - 1);
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
};

mmu.prototype.write8 = function(memAddr, val) {
	let memRegion = this.accessMemRegion(memAddr, 0);
	memRegion.write8(this.maskedAddr, val);
};

mmu.prototype.write16 = function(memAddr, val) {
	if (memAddr & 1)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.accessMemRegion(memAddr, 1);
	memRegion.write16(this.maskedAddr, val);
};

mmu.prototype.write32 = function(memAddr, val) {
	if (memAddr & 3)
	{
		throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
	}
	let memRegion = this.accessMemRegion(memAddr, 2);
	memRegion.write32(this.maskedAddr, val);
};

mmu.prototype.getMemoryRegion = function(region)
{
	if (this.memRegionNames.indexOf(region) === -1)
	{
		throw Error("mem region doesnt exist");
	}
	else
	{
		return this.memRegions[this.memRegionNames.indexOf(region)];
	}
};

mmu.prototype.serialize = function() {
	let copy = {};

	copy.memRegions = this.memRegions.map(x => x === null ? null : x.serialize());

	copy.numCycles = this.numCycles;
	copy.maskedAddr = this.maskedAddr;
	copy.lastAccesssedAddr = this.lastAccesssedAddr;
	copy.waitState0NSEQ = this.waitState0NSEQ;
	copy.waitState1NSEQ = this.waitState1NSEQ;
	copy.waitState2NSEQ = this.waitState2NSEQ;
	copy.waitStateSRAM = this.waitStateSRAM;

	return copy;
}
  
mmu.prototype.setState = function(saveState) {
	saveState.memRegions.forEach((x, index) => {
		if (x)
			this.memRegions[index].setState(x);
	});

	this.numCycles = saveState.numCycles;
	this.maskedAddr = saveState.maskedAddr;
	this.lastAccesssedAddr = saveState.lastAccesssedAddr;
	this.waitState0NSEQ = saveState.waitState0NSEQ;
	this.waitState1NSEQ = saveState.waitState1NSEQ;
	this.waitState2NSEQ = saveState.waitState2NSEQ;
	this.waitStateSRAM = saveState.waitStateSRAM;
}