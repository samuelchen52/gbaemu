const mmu = function(memory) {

	const memENUMS = ["BIOS", null, "BOARDWORKRAM", "CHIPWORKRAM", "IOREGISTERS", "PALETTERAM", "VRAM", "OAM", "ROM", null, null, null, null, null, "SRAM"];

	//checks that a memory address refers to a usable portion of memory
	//returns a number representing that portion
	const checkMemBounds = function (memAddr, numBytes)
	{
		//console.log(memAddr + " " + numBytes);
		switch ((memAddr & 0xFF000000) >> 24)
		{
			case 0:
			if ((memAddr + numBytes - 1) > 0x3FFF)
			{
				throw Error("accessing invalid memory!");
			}
			return 0;
			break;

			case 2:
			if ((memAddr + numBytes - 1) > 0x203FFFF)
			{
				throw Error("accessing invalid memory!");
			}
			return 2;
			break;

			case 3:
			if ((memAddr + numBytes - 1) > 0x3007FFF)
			{
				throw Error("accessing invalid memory!");
			}
			return 3;
			break;

			case 4:
			if ((memAddr + numBytes - 1) > 0x40003FE)
			{
				throw Error("accessing invalid memory!");
			}
			return 4;
			break;

			case 5:
			if ((memAddr + numBytes - 1) > 0x50003FF)
			{
				throw Error("accessing invalid memory!");
			}
			return 5;
			break;

			case 6:
			if ((memAddr + numBytes - 1) > 0x6017FFF)
			{
				throw Error("accessing invalid memory!");
			}
			return 6;
			break;

			case 7:
			if ((memAddr + numBytes - 1) > 0x70003FF)
			{
				throw Error("accessing invalid memory!");
			}
			return 7;
			break;

			case 8:
			if ((memAddr + numBytes - 1) > 0x9FFFFFF)
			{
				throw Error("accessing invalid memory!");
			}
			return 8;
			break;

			case 14:
			if ((memAddr + numBytes - 1) > 0xE00FFFF)
			{
				throw Error("accessing invalid memory!");
			}
			return 14;
			break;

		}
		throw Error("accessing unused memory!");
	}


	return {
		//check that mem addr is aligned
		readMem: function (memAddr, numBytes){
			if (memAddr % numBytes !== 0)
			{
				throw Error("memory address is not aligned!");
			}
			let memRegion = memory[memENUMS[checkMemBounds(memAddr, numBytes)]];
			//console.log(checkMemBounds(memAddr, numBytes));
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
		//check that mem addr is aligned
		writeMem: function(memAddr, val, numBytes){
			if (memAddr % numBytes !== 0)
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
		}


	}
}