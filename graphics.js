// LCD screen 240px wide x 160px high 
// 15 bit colors 
// 59.73 fps
// scanline -> entire row of pixels 
// screen is updated by updating scanline by scanline (160 scanlines)
// after each scanline is a pause called HBLANK (an interrupt)
// after 160 scanlines is a pause called VBLANK (also an interrupt), which is usually when the screen data is updated to prevent "tearing"
// hblank and vblank are 68 pixels

//each pixel takes 4 cycles, so entire scanline takes (240 + 68) * 4 = 1232 cycles, thus 228 (160 + VBLANK) scanlines (entire screen)
//takes 1232 * 228 = 280896 cycles 
//gba cpu runs at 16.73 MHZ -> 59.55 frames per second

//16 bit colors xbbbbbgggggrrrr, last bit (left-most) unused

//two palettes, one for sprites and one for backgrounds
//each palette takes up 512 bytes
//palette is either one palette of 256 colors, or 16 sub-palettes of 16 colors each
//sprite palette follows immediately after background palette at 0x5000200
//index 0 is transparency index?

//3 types of graphics -> bitmaps, tiled backgrounds, and sprites
//bitmaps and tiled backgrounds are for the background (only one can be used at a time), sprites can be used with either

//REG_DISPCNT - 0x00 - 0x01
//D-F Enables the use of windows 0, 1 and Object window, respectively. Windows can be used to mask out certain areas
//8-B Enables rendering of the corresponding background and sprites.
//7   Force a screen blank
//6   Object mapping mode
//5   allows access to OAM in Hblan. OAM is normally locked in VDraw
//4   Page select. Modes 4 and 5 can use page flipping for smoother animation
//3   set if cartridge is GBC game
//0-2 Sets video mode. 0, 1, 2 are tiled modes; 3, 4, 5 are bitmap modes.
//REG_DISPSTAT - 0x04 - 0x05
//8-F VCount trigger value. if scanline is this value, bit 2 is set
//5   Vcount interrupt request. if set, interrupt fired if bit 2 is set
//4   Hblank interrupt request
//3   Vblank interrupt request
//2   Vcount trigger status = Vcount trigger value = vcount
//1   Hblank status, read only
//0   Vblank status, read only
//REG_VCOUNT - 0x06
//0-7 vcount (scanline number) -> range is [0, 227]

//video modes 3, 4, 5 (bitmap modes) VRAM is at 0x6000000
//3- 240x160 16bpp -> 0x12C00 bytes no page flip
//4- 240x160 8bpp -> 0x9600 * 2 bytes (page flip)
//5- 160x128 16bpp -> 0xA000 * 2 bytes (page flip)

//3 interprets the 0x12C00 bytes starting at VRAM as a grid of pixels (16 bits per pixel)
//4 interprets the 0x9600 * 2 bytes as palette indices (8 bits per pixel / index)
//  8 bits -> 256 possible indices -> corresponds to 256 (16 bit) colors in palette
//5 works the same as 3, but has page flipping and a smaller resolution (for shifting magic)

const graphics = function(mmu, registers) {

	const registersDOM = $(".register");
	const cpsrDOM = $(".statusregister"); //N, Z, C, V, Q, I, F, T, Mode, all

	const screenDOM = document.getElementById("screen").getContext("2d");
	// screenDOM.fillStyle = 'rgb(255, 165, 0)';
	// screenDOM.fillStyle = '#FFA500';
	// screenDOM.fillRect(0, 0, 50, 50);

	const valToMode = []; //modes indexed by their value in the CPSR
  valToMode[31] = "SYSTEM";
  valToMode[16] = "USER";
  valToMode[17] = "FIQ"; //never used
  valToMode[19] = "SVC";
  valToMode[23] = "ABT";
  valToMode[18] = "IRQ";
  valToMode[27] = "UND";

	const registerIndices = [
    //                     1 1 1 1 1 1
    //r0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 C S 
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"]
      [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0], //modeENUMS["FIQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,1], //modeENUMS["SVC"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,2], //modeENUMS["ABT"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,3], //modeENUMS["IRQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,0,4], //modeENUMS["UND"]
    ];

  const ioregs = mmu.getMemoryRegion("IOREGISTERS"); //0x4000000
  const paletteram = mmu.getMemoryRegion("PALETTERAM"); //0x5000000
  const vram = mmu.getMemoryRegion("VRAM"); //0x6000000
  const oam = mmu.getMemoryRegion("OAM"); //0x7000000

  const drawMode3 = function()
  {	
  	console.log("video mode 3...");
  	for (let i = 0; i < 0x12C00; i += 2)
  	{
  		//xbbbbbgggggrrrrr
  		let color = (vram[i + 1] << 8)  + vram[i];
  		let row = Math.floor(i / 480);
  		let col = (i % 480) / 2
  		screenDOM.fillStyle = rgb(color);
  		screenDOM.fillRect(col, row, 1, 1);
  	}
  }
	return {

		//displays register values on screen for current mode
		updateRegisters : function(mode) {
			for (let i = 0; i <= 15; i++)
			{
				registersDOM[i].textContent = parseInt(registers[i][registerIndices[mode][i]]).toString(16);
			}
			let CPSR = registers[16][0];
			cpsrDOM[0].textContent = bitSlice(CPSR, 31, 31);
			cpsrDOM[1].textContent = bitSlice(CPSR, 30, 30);
			cpsrDOM[2].textContent = bitSlice(CPSR, 29, 29);
			cpsrDOM[3].textContent = bitSlice(CPSR, 28, 28);
			cpsrDOM[5].textContent = bitSlice(CPSR, 7, 7);
			cpsrDOM[6].textContent = bitSlice(CPSR, 6, 6);
			cpsrDOM[7].textContent = bitSlice(CPSR, 5, 5);
			cpsrDOM[8].textContent = valToMode[bitSlice(CPSR, 0, 4)] + "(" + bitSlice(CPSR, 0, 4) + ")";
			cpsrDOM[9].textContent = getBytes(CPSR, 0);
		},

		updateScreen : function(){
			switch (bitSlice(ioregs[1], 0, 2))
			{
				case 0:
				//alert("0");
				//drawMode3();
				break;

				case 1:
				alert("1");
				//drawMode3();
				break;

				case 2:
				alert("2");
				//drawMode3();
				break;

				case 3:
				alert("3");
				drawMode3();
				break;

				case 4:
				alert("4");
				//drawMode3();
				break;

				case 5:
				alert("5");
				//drawMode3();
				break;
			}
		}
	}

}