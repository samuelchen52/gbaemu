


const mmu = function(memory) {


	// const kb = 1024 - 1;
	// const kb32 = (1024 * 32) - 1;
	// const kb64 = (1024 * 64) - 1;
	// const kb128 = (1024 * 128) - 1;
	// const kb256 = (1024 * 256) - 1;

	const memENUMS = ["BIOS", "BOARDWORKRAM", "CHIPWORKRAM", "IOREGISTERS", "PALETTERAM", "VRAM", "OAM", "ROM", "SRAM"];

	let mirrorMasks = [
		0xFFFFFF,
		(1024 * 256) - 1,
		(1024 * 32) - 1,
		0xFFFFFF,
		1023,
		(1024 * 128) - 1,
		1023
	];

	

	//checks that a memory address refers to a usable portion of memory (taking into account mirrors)
	//returns an index into the memory array that refers to that region of memory
	const checkMemBounds = function (memAddr, numBytes) {
		let region = (memAddr & 0xFF000000) >>> 0;
		memAddr &= 0xFFFFFF;
		switch (region)
		{
			case 0: //BIOS (not mirrored)
			if ((memAddr + numBytes - 1) > 0x003FFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 0;
			break;

			case 0x2000000: //EWRAM
			if ((memAddr + numBytes - 1) > 0x03FFFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 1;
			break;

			case 0x3000000: //IWRAM
			if ((memAddr + numBytes - 1) > 0x007FFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 2;
			break;

			case 0x4000000: //IOREGS (not mirrored, except for 0x400800)
			if ((memAddr + numBytes - 1) > 0x0003FE)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 3;
			break;

			case 0x5000000: //PALETTERAM
			if ((memAddr + numBytes - 1) > 0x0003FF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 4;
			break;

			case 0x6000000: //VRAM
			if ((memAddr + numBytes - 1) > 0x017FFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			//console.log("VRAM AT addr 0x" + memAddr.toString(16));
			return 5;
			break;

			case 0x7000000:  //OAM
			if ((memAddr + numBytes - 1) > 0x0003FF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 6;
			break;

			case 0x8000000: //ROM
			if ((memAddr + numBytes - 1) > 0x9FFFFFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 7;
			break;

			// case 0x9000000: //ROM, second 16 MB
			// if ((memAddr + numBytes - 1) > 0x9FFFFFF)
			// {
			// 	throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			// }
			// return 8;
			// break;

			case 0xE000000: //SRAM
			if ((memAddr + numBytes - 1) > 0xE00FFFF)
			{
				throw Error("accessing invalid memory addr 0x" + memAddr.toString(16) + "!");
			}
			return 8;
			break;

		}
		console.log("accessing unused memory: 0x" + (region + memAddr).toString(16) + "!");
		return 10;
	}


	return {

		read: function (memAddr, numBytes) {
			if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}
			let memRegion = memory[checkMemBounds(memAddr, numBytes)];
			if (memRegion === undefined)
				return 0;
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
			let memRegion = memory[checkMemBounds(memAddr, 1)];
			return memRegion[memAddr & 0x00FFFFFF];
		},

		read16: function(memAddr) {
			if (memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[checkMemBounds(memAddr, 2)];
			return memRegion[memAddr & 0x00FFFFFF] + (memRegion[(memAddr + 1) & 0x00FFFFFF] << 8);
		},

		read32: function(memAddr) {
			if (memAddr & 3)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[checkMemBounds(memAddr, 4)];
			return memRegion[memAddr & 0x00FFFFFF] + (memRegion[(memAddr + 1) & 0x00FFFFFF] << 8) + (memRegion[(memAddr + 2) & 0x00FFFFFF] << 16) + (memRegion[(memAddr + 3) & 0x00FFFFFF] << 24);
		},

		write: function(memAddr, val, numBytes) {
			if (numBytes === 4 ? memAddr & 3 : (numBytes === 2 ? memAddr & 1 : 0))
			{
				throw Error("memory address is not aligned!");
			}
			let memRegion = memory[checkMemBounds(memAddr, numBytes)];
			if (memRegion === undefined)
				return;
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
			let memRegion = memory[checkMemBounds(memAddr, 1)];
			memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
			if (checkMemBounds(memAddr, 1) === 5)
			{
				//console.log("8 VRAM AT addr 0x" + memAddr.toString(16));
			}
		},

		write16: function(memAddr, val) {
			if (memAddr & 1)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}

			let memRegion = memory[checkMemBounds(memAddr, 2)];
			memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
			memRegion[(memAddr + 1) & 0x00FFFFFF] = (val & 0xFF00) >> 8;
			if (checkMemBounds(memAddr, 2) === 5)
			{
				//console.log("16 VRAM AT addr 0x" + memAddr.toString(16));
			}
		},

		write32: function(memAddr, val) {
			if (memAddr & 3)
			{
				throw Error("memory address 0x" + memAddr.toString(16) + " is not aligned!");
			}
			let memRegion = memory[checkMemBounds(memAddr, 4)];
			memRegion[memAddr & 0x00FFFFFF] = val & 0xFF;
			memRegion[(memAddr + 1) & 0x00FFFFFF] = (val & 0xFF00) >> 8;
			memRegion[(memAddr + 2) & 0x00FFFFFF] = (val & 0xFF0000) >> 16;
			memRegion[(memAddr + 3) & 0x00FFFFFF] = (val & 0xFF000000) >> 24;
			if (checkMemBounds(memAddr, 4) === 5)
			{
				//console.log("32 VRAM AT addr 0x" + memAddr.toString(16));
			}
			if (memAddr === 0x02000340)
			{
				//throw Error("poopoo");
			}
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