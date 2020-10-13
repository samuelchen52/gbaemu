


const mmu = function() {

	const memENUMS = ["BIOS", "BOARDWORKRAM", "CHIPWORKRAM", "IOREGISTERS", "PALETTERAM", "VRAM", "OAM", "ROM", "ROM2", "SRAM"];

	const memory = [
	new Uint8Array(16 * 1024), //16 kb of BIOS
	new Uint8Array(256 * 1024), //256 kb of on board work ram (EWRAM)
	new Uint8Array(32 * 1024), //32 kb of on chip work ram (IEWRAM)
	new Uint8Array(1023), //1023 bytes for io registers
	new Uint8Array(1 * 1024), //1 kb for palette ram
	new Uint8Array(96 * 1024), //96 kb for vram
	new Uint8Array(1 * 1024), //1kb for oam
	new Uint8Array(16 * 1024 * 1024), //first 16 mb of game rom
	new Uint8Array(16 * 1024 * 1024), //second 16 mb of game rom
	new Uint8Array(64 * 1024) //64 kb for sram
	];

	
	let maskedAddr;
	//returns the memory region that the memory address refers to, and sets
	//maskedAddr above to an address that accounts for memory mirrors
	const decodeAddr = function (memAddr) {
		switch (memAddr & 0xFF000000)
		{
			case 0: //BIOS (16 KB, not mirrored)
			if (memAddr > 0x3FFF)
			{
				throw Error("accessing invalid BIOS memory at addr 0x" + memAddr.toString(16) + "!");
			}
			maskedAddr = memAddr;
			return 0;
			break;

			case 0x2000000: //EWRAM (256 KB, mirrored completely across 2XXXXXX)
			maskedAddr = memAddr & 0x3FFFF;
			return 1;
			break;

			case 0x3000000: //IWRAM (32 KB, mirrored completely across 3XXXXXX)
			maskedAddr = memAddr & 0x7FFF;
			return 2;
			break;

			case 0x4000000: //IOREGS (not mirrored, except for 0x400800 ??)
			if ((memAddr & 0xFFFFFF) > 0x3FE)
			{
				throw Error("accessing invalid IO memory at addr 0x" + memAddr.toString(16) + "!");
			}
			maskedAddr = memAddr & 0xFFFFFF;
			return 3;
			break;

			case 0x5000000: //PALETTERAM (1 KB, mirrored completely across 5XXXXXX)	
			maskedAddr = memAddr & 0x3FF;
			return 4;
			break;

			case 0x6000000: //VRAM (96 KB, mirrored completely across 6XXXXXX, every 128 KB, made up of 64 KB, 32KB, 32KB, where 32 KB chunks mirror each other)
			memAddr &= 0x1FFFF;
			maskedAddr = (memAddr & 0x10000) ? (memAddr & 0x17FFF) : memAddr;
			return 5;
			break;

			case 0x7000000:  //OAM (1 KB, mirrored completely across 7XXXXX)
			maskedAddr = memAddr & 0x3FF;
			return 6;
			break;

			case 0x8000000: //ROM1, first 16 MB (takes up whole 24 bit address space)
			maskedAddr = memAddr & 0xFFFFFF;
			return 7;
			break;

			case 0x9000000: //ROM2, second 16 MB (takes up whole 24 bit address space)
			maskedAddr = memAddr & 0xFFFFFF;		
			return 8;
			break;

			case 0xE000000: //SRAM (64 KB, mirrored?)
			if ((memAddr & 0xFFFFFF) > 0xFFFF)
			{
				throw Error("accessing invalid SRAM at memory addr 0x" + memAddr.toString(16) + "!");
			}
			maskedAddr = memAddr & 0xFFFFFF;
			return 9;
			break;

		}
		console.log("accessing unused memory: 0x" + (memAddr).toString(16) + "!");
		return 10;
	}


	return {

		read: function (memAddr, numBytes) {
			if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}
			let memRegion = memory[decodeAddr(memAddr)];
			if (memRegion === undefined)
				return 0;
			switch(numBytes)
			{
				case 1: //byte
				return memRegion[maskedAddr];
				break;

				case 2: //halfword
				return memRegion[maskedAddr] + (memRegion[(maskedAddr + 1)] << 8);
				break;

				case 4: //word
				return memRegion[maskedAddr] + (memRegion[(maskedAddr + 1)] << 8) + (memRegion[(maskedAddr + 2)] << 16) + (memRegion[(maskedAddr + 3)] << 24);
				break;
			}
			throw Error("reading invalid number of bytes!");
		},

		read8 : function(memAddr) {
			let memRegion = memory[decodeAddr(memAddr)];
			return memRegion[maskedAddr];
		},

		read16: function(memAddr) {
			if (memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[decodeAddr(memAddr)];
			return memRegion[maskedAddr] + (memRegion[(maskedAddr + 1)] << 8);
		},

		read32: function(memAddr) {
			if (memAddr & 3)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[decodeAddr(memAddr)];
			return memRegion[maskedAddr] + (memRegion[(maskedAddr + 1)] << 8) + (memRegion[(maskedAddr + 2)] << 16) + (memRegion[(maskedAddr + 3)] << 24);
		},

		write: function(memAddr, val, numBytes) {
			if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
			{
				throw Error("memory address is not aligned!");
			}
			let memRegion = memory[decodeAddr(memAddr)];
			if (memRegion === undefined)
				return;
			switch(numBytes)
			{
				case 1: //byte
				memRegion[maskedAddr] = val & 0xFF;
				return;
				break;

				case 2: //halfword
				memRegion[maskedAddr] = val & 0xFF;
				memRegion[(maskedAddr + 1)] = (val & 0xFF00) >> 8;
				return;
				break;

				case 4: //word
				memRegion[maskedAddr] = val & 0xFF;
				memRegion[(maskedAddr + 1)] = (val & 0xFF00) >> 8;
				memRegion[(maskedAddr + 2)] = (val & 0xFF0000) >> 16;
				memRegion[(maskedAddr + 3)] = (val & 0xFF000000) >> 24;
				return;
				break;
			}
			throw Error("writing invalid number of bytes!");
		},

		write8 : function(memAddr, val) {
			let memRegion = memory[decodeAddr(memAddr)];
			memRegion[maskedAddr] = val & 0xFF;
		},

		write16: function(memAddr, val) {
			if (memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[decodeAddr(memAddr)];
			memRegion[maskedAddr] = val & 0xFF;
			memRegion[(maskedAddr + 1)] = (val & 0xFF00) >> 8;
		},

		write32: function(memAddr, val) {
			if (memAddr & 3)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}
			let memRegion = memory[decodeAddr(memAddr)];
			memRegion[maskedAddr] = val & 0xFF;
			memRegion[(maskedAddr + 1)] = (val & 0xFF00) >> 8;
			memRegion[(maskedAddr + 2)] = (val & 0xFF0000) >> 16;
			memRegion[(maskedAddr + 3)] = (val & 0xFF000000) >> 24;
		},

		getMemoryRegion: function(region)
		{
			if (memENUMS.indexOf(region) === -1)
			{
				throw Error("mem region doesnt exist");
			}
			else
			{
				return memory[memENUMS.indexOf(region)];
			}
		}


	}
}