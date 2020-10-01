


const mmu = function(memory) {

	const memENUMS = ["BIOS", null, "BOARDWORKRAM", "CHIPWORKRAM", "IOREGISTERS", "PALETTERAM", "VRAM", "OAM", "ROM", null, null, null, null, null, "SRAM"];

	//checks that a memory address refers to a usable portion of memory (taking into account mirrors)
	//returns an index into the memory array that refers to said portion of memory
	const checkMemBounds = function (memAddr, numBytes)
	{
		switch ((memAddr & 0xFF000000) >> 24)
		{
			case 0: //BIOS
			if ((memAddr + numBytes - 1) > 0x3FFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 0;
			break;

			case 2: //EWRAM
			if ((memAddr + numBytes - 1) > 0x203FFFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 2;
			break;

			case 3: //IWRAM
			if ((memAddr + numBytes - 1) > 0x3007FFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 3;
			break;

			case 4: //IOREGS
			if ((memAddr + numBytes - 1) > 0x40003FE)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 4;
			break;

			case 5: //PALETTERAM
			if ((memAddr + numBytes - 1) > 0x50003FF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 5;
			break;

			case 6: //VRAM
			if ((memAddr + numBytes - 1) > 0x6017FFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 6;
			break;

			case 7:  //OAM
			if ((memAddr + numBytes - 1) > 0x70003FF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 7;
			break;

			case 8: //ROM
			if ((memAddr + numBytes - 1) > 0x9FFFFFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 8;
			break;

			case 14: //SRAM
			if ((memAddr + numBytes - 1) > 0xE00FFFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 14;
			break;

		}
		throw Error("accessing unused memory: 0x " + memAddr.toString(16) + "!");
	}


	return {

		read: function (memAddr, numBytes) {
			if (numBytes === 4 ? memAddr & 3 : memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}
			let memRegion = memory[memENUMS[checkMemBounds(memAddr, numBytes)]];
			switch(numBytes)
			{
				case 1: //byte
				return memRegion[memAddr & 0x00FFFFFF];
				break;

				case 2: //halfword
				return memRegion[memAddr & 0x00FFFFFF] + (memRegion[(memAddr + 1) & 0x00FFFFFF] << 8);
				break;

				case 4: //word
				return memRegion[memAddr & 0x00FFFFFF] + (memRegion[(memAddr + 1) & 0x00FFFFFF] << 8) + (memRegion[(memAddr + 2) & 0x00FFFFFF] << 16) + (memRegion[(memAddr + 3) & 0x00FFFFFF] << 24);
				break;
			}
			throw Error("reading invalid number of bytes!");
		},

		read8 : function(memAddr) {
			let memRegion = memory[memENUMS[checkMemBounds(memAddr, 1)]];
			return memRegion[memAddr & 0x00FFFFFF];
		},

		read16: function(memAddr) {
			if (memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[memENUMS[checkMemBounds(memAddr, 2)]];
			return memRegion[memAddr & 0x00FFFFFF] + (memRegion[(memAddr + 1) & 0x00FFFFFF] << 8);
		},

		read32: function(memAddr) {
			if (memAddr & 3)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[memENUMS[checkMemBounds(memAddr, 4)]];
			return memRegion[memAddr & 0x00FFFFFF] + (memRegion[(memAddr + 1) & 0x00FFFFFF] << 8) + (memRegion[(memAddr + 2) & 0x00FFFFFF] << 16) + (memRegion[(memAddr + 3) & 0x00FFFFFF] << 24);
		},

		write: function(memAddr, val, numBytes) {
			if (numBytes === 4 ? memAddr & 3 : memAddr & 1)
			{
				throw Error("memory address is not aligned!");
			}
			let memRegion = memory[memENUMS[checkMemBounds(memAddr, numBytes)]];
			switch(numBytes)
			{
				case 1: //byte
				memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
				return;
				break;

				case 2: //halfword
				memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
				memRegion[(memAddr + 1) & 0x00FFFFFF] = (val & 0xFF00) >> 8;
				return;
				break;

				case 4: //word
				memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
				memRegion[(memAddr + 1) & 0x00FFFFFF] = (val & 0xFF00) >> 8;
				memRegion[(memAddr + 2) & 0x00FFFFFF] = (val & 0xFF0000) >> 16;
				memRegion[(memAddr + 3) & 0x00FFFFFF] = (val & 0xFF000000) >> 24;
				return;
				break;
			}
			throw Error("writing invalid number of bytes!");
		},

		write8 : function(memAddr, val) {
			let memRegion = memory[memENUMS[checkMemBounds(memAddr, 1)]];
			memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
		},

		write16: function(memAddr, val) {
			if (memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[memENUMS[checkMemBounds(memAddr, 2)]];
			memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
			memRegion[(memAddr + 1) & 0x00FFFFFF] = (val & 0xFF00) >> 8;
		},

		write32: function(memAddr, val) {
			if (memAddr & 3)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}
			let memRegion = memory[memENUMS[checkMemBounds(memAddr, 4)]];
			memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
			memRegion[(memAddr + 1) & 0x00FFFFFF] = (val & 0xFF00) >> 8;
			memRegion[(memAddr + 2) & 0x00FFFFFF] = (val & 0xFF0000) >> 16;
			memRegion[(memAddr + 3) & 0x00FFFFFF] = (val & 0xFF000000) >> 24;
		},

		getMemoryRegion: function(region)
		{
			if (memENUMS.indexOf(region) === -1)
			{
				throw Error("mem region doesnt exist");
			}
			else
			{
				return memory[memENUMS[memENUMS.indexOf(region)]];
			}
		}


	}
}