//LCD CONTROL

//REG_DISPCNT R/W addr - 0x4000000h (two bytes)
//D-F Enables the use of windows 0, 1 and Object window, respectively. Windows can be used to mask out certain areas
//8-B Enables rendering of the corresponding background and sprites.
//7   Force a screen blank
//6   Object mapping mode
//5   allows access to OAM in Hblank. OAM is normally locked in VDraw
//4   Page select. Modes 4 and 5 can use page flipping for smoother animation
//3   set if cartridge is GBC game
//0-2 Sets video mode. 0, 1, 2 are tiled modes; 3, 4, 5 are bitmap modes.

//REG_DISPSTAT R/W addr - 0x4000004h (two bytes)
//8-F VCount trigger value. if scanline is this value, bit 2 is set
//5   Vcount interrupt request. if set, interrupt fired if bit 2 is set
//4   Hblank interrupt request
//3   Vblank interrupt request
//2   Vcount trigger status = Vcount trigger value = vcount
//1   Hblank status, read only
//0   Vblank status, read only

//REG_VCOUNT R addr - 0x4000006h (one byte)
//0-7 vcount (scanline number) -> range is [0, 227]

//video modes 3, 4, 5 (bitmap modes) VRAM is at 0x6000000, only use one background -> BG_2
//for page flipping, page 1 starts at VRAM, page 2 starts at 0x600A000 (some leftover memory for mode 4)
//memory overlaps with sprite memory, so in bitmap modes can only use sprite tiles 512 to 1023
//3- 240x160 16bpp -> 0x12C00 bytes no page flip
//4- 240x160 8bpp -> 0x9600 * 2 bytes (page flip)
//5- 160x128 16bpp -> 0xA000 * 2 bytes (page flip)

//summary: check dispcnt for bg2 screen display have to set vblank (throw if irq enable), have to set hblank (throw if hblank enable)
//have to set vcounter flag if vcount === vcount setting
//bg regs dont apply to modes 3- 5

//3 interprets the 0x12C00 bytes starting at VRAM as a grid of pixels (16 bits per pixel)
//4 interprets the 0x9600 * 2 bytes as palette indices (8 bits per pixel / index)
//  8 bits -> 256 possible indices -> corresponds to 256 (16 bit) colors in palette
//5 works the same as 3, but has page flipping and a smaller resolution (for shifting magic)


//video modes 0, 1 ,2
//0 - all backgrounds used, all regular
//1 - bg 0 and bg 1 regular, bg 2 affine
//2 - bg 2 and 3 both used, both affine
//this is for regular bg:
//pixels never represent color of the pixel itself, they are all palette indices
//8bpp -> 256 colors, 
//4bpp -> index of palette in palette bank, palette bank index (4 bits) in tile or sprite oam
//tiles are 8x8 pixel bitmaps, 4bpp -> 32 bytes, 8bpp -> 64 bytes, again, each pixel is palette index
//VRAM is split up charblocks (tileset) and screenblocks (tilemap)
//each char block is 16kb (4000 bytes long), so theres space for 6
//4 charblocks for backgrounds, 2 for sprites (they are arranged this way in VRAM too)
//charblocks are where the actual tiles (8x8 pixel bitmaps are stored)
//the CBB stands for the character base block, which is the offset you need to add with tile index to reach given tile
//the CBB for sprites is always char block 4 (the first sprite char block)
//the screen blocks are where the tileMAP is stored (i.e. the index to the tiles, an 8x8 palette index matrix)
//tilemap !== screenblock, one tilemap can use multiple screenblocks
//each screen block is not just a matrix of tile indices, they also have other bits for flipping and stuff
//whereas the charblocks span the entire VRAM mem space, screen blocks only take up the first 
//64 kb of VRAM i.e. they occupy the same space as the first four character blocks
//screen blocks are also smaller, 1 charblock === 8 screenblock, 4 * 8 === 32 screenblocks total
//one tile is 16 bits, one screenblock can then hold 1024 tiles === 32x32 tiles === 256x256 pixels
//like the CBB, there is a SBB, the offset you need to add with screen block entry index
//SBB + screen block index -> tile index -> tile index + CBB -> tile -> palette
//all this stuff organized in a BACKGROUND, of which there are four of

//BACKGROUND

//BG0-BG3CNT R/W Control addr - 0x40000008, 0x...A, 0x...C, 0x...E (two bytes)
//determines priority (drawing order), has CBB, SBB, mosaic (makes tile look ugly)
//the color mode (8bpp or 4bpp), affine wrapping (regular backgrounds wrap by default)
//and finally background size, which determines how many char/screen blocks a background takes 
//up from the inital offset (CBB/ SBB)

//BG0-BG3HOFS W X-Offset addr - 0x4000010, 0x...14, 0x...18, 0x...1C (two bytes)
//BG0-BG3VOFS W Y-Offset addr - 0x4000012, 0x...16, 0x...1A, 0x...1E (two bytes)

//BG2PA-D W Rotation/Scaling Parameter addr - 0x400020, 0x...22, 0x...24, 0x...26 (two bytes)
//BG3PA-D W Rotation/Scaling Parameter addr - 0x400030, 0x...32, 0x...34, 0x...36 (two bytes)

//BG2X/Y W Reference Point Coordinate addr - 0x4000028, 0x...2C (4 bytes)
//BG3X/Y W Reference Point Coordinate addr - 0x4000038, 0x...3C (4 bytes)

//WINDOW
//WIN0/1H W Window Horizontal Dimensions addr - 0x4000040, 0x...42 (2 bytes)
//WIN0/1HV W Window Vertical Dimensions addr - 0x4000044, 0x...46 (2 bytes)
//WININ R/W Inside of Window 0 and 1 addr - 0x4000044 (2 bytes)
//WINOUT R/W Inside of OBJ Window and Outside of Windows addr - 0x400004A (2 bytes)

//COLORS
//MOSAIC W Mosaic Size addr - 0x400004C (2 bytes)
//BLDCNT R/W Color Special Effects Selection addr - 0x4000050 (2 bytes)
//BLD ALPHA R/W Alpha Blending Coefficients addr - 0x4000052 (2 bytes)
//BLDY W Brightness (Fade-In/Out) Coefficient addr - 0x4000054 (2 bytes)

const graphics = function(mmu, registers, setFrameComplete) {

  this.mmu = mmu;
  this.registers = registers;
  this.setFrameComplete = setFrameComplete;


  //debugging stuff
	this.registersDOM = $(".register");
	this.cpsrDOM = $(".statusregister"); //N, Z, C, V, Q, I, F, T, Mode, all
	this.valToMode = []; //modes indexed by their value in the CPSR
  this.valToMode[31] = "SYSTEM";
  this.valToMode[16] = "USER";
  this.valToMode[17] = "FIQ"; //never used
  this.valToMode[19] = "SVC";
  this.valToMode[23] = "ABT";
  this.valToMode[18] = "IRQ";
  this.valToMode[27] = "UND";

	this.registerIndices = [
    //                     1 1 1 1 1 1
    //r0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 C S 
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"]
      [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0], //modeENUMS["FIQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1], //modeENUMS["SVC"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,2], //modeENUMS["ABT"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,3], //modeENUMS["IRQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,4], //modeENUMS["UND"]
    ];

  this.displayENUMS = {
    VBLANKSET : 1,
    HBLANKSET : 2, 
    VCOUNTERSET : 4,
    VBLANKCLEAR : ~1,
    HBLANKCLEAR : ~2,
    VCOUNTERCLEAR : ~4,

    BGMODE : 7,
    DISPLAYFRAME : 16,

  };



  //canvas buffer
	this.context = document.getElementById("screen").getContext("2d");
	this.imageData = this.context.createImageData(240, 160);
  this.imageDataArr = new Uint32Array(this.imageData.data.buffer); //new Uint32Array(this.imageData.data.buffer);

  //graphics related memory
  this.ioregion = this.mmu.getMemoryRegion("IOREGISTERS");
  this.ioregionMem = this.ioregion.memory; //0x4000000
  this.paletteRamMem = this.mmu.getMemoryRegion("PALETTERAM").memory; //0x5000000
  this.vramMem = this.mmu.getMemoryRegion("VRAM").memory; //0x6000000
  this.oamMem = this.mmu.getMemoryRegion("OAM").memory; //0x7000000

  //state variables
  this.pixel = 0; //current pixel we are drawing on current scanline
  this.scanline = 0; //current scanline we are drawing on

  this.hblank = false;
  this.vblank = false;



  //graphics hardware configuration
  this.mode = 4;
  this.displayFrame = 0;

  this.hblankIRQEnable = false;
  this.vblankIRQEnable = false;
  this.vCountIRQEnable = false;

  this.vCountSetting = 0;


  //graphics hardware ioregs
  this.dispcnt = this.ioregion.getIOReg("DISPCNT");
  this.dispcnt.addCallback((newDISPCNTVal) => {this.updateDISPCNT(newDISPCNTVal)});

  this.dispstat = this.ioregion.getIOReg("DISPSTAT");
  this.dispstatByte1 = this.dispstat.regIndex;
  this.dispstatByte2 = this.dispstat.regIndex + 1;

  this.vcount = this.ioregion.getIOReg("VCOUNT");
  this.vcountByte1 = this.vcount.regIndex;

  //backgrounds
  this.bg0 = new background(this.ioregion.getIOReg("BG0CNT"), this.ioregion.getIOReg("BG0HOFS"), this.ioregion.getIOReg("BG0VOFS"), this.vramMem, this.paletteRamMem, 0);
  this.bg1 = new background(this.ioregion.getIOReg("BG1CNT"), this.ioregion.getIOReg("BG1HOFS"), this.ioregion.getIOReg("BG1VOFS"), this.vramMem, this.paletteRamMem, 1);
  this.bg2 = new background(this.ioregion.getIOReg("BG2CNT"), this.ioregion.getIOReg("BG2HOFS"), this.ioregion.getIOReg("BG2VOFS"), this.vramMem, this.paletteRamMem, 2);
  this.bg3 = new background(this.ioregion.getIOReg("BG3CNT"), this.ioregion.getIOReg("BG3HOFS"), this.ioregion.getIOReg("BG3VOFS"), this.vramMem, this.paletteRamMem, 3);


  this.init();

};

graphics.prototype.init = function (){
  //table for converting 15 bit colors to 32 bit abgr (alpha value set to full opacity)
  this.convertColor = new Uint32Array(32768);
  for (let i = 0; i < this.convertColor.length; i ++)
  {
    this.convertColor[i] = 0xFF000000 + ((i & 31744) << 9) + ((i & 992) << 6) + ((i & 31) << 3);
  }  
}

graphics.prototype.renderScanlineMode0 = function()
{ 
  let imageDataPos = this.scanline * 240;
  let imageDataArr = this.imageDataArr;
  let convertColor = this.convertColor;
  let bg0ScanlineArr = this.bg0.scanlineArr;
  let bg0ScanlineArrIndex = this.bg0.renderScanline(this.scanline);

  for (let i = 0; i < 240; i ++)
  {
    imageDataArr[imageDataPos] = convertColor[bg0ScanlineArr[bg0ScanlineArrIndex]];
    imageDataPos ++;
    bg0ScanlineArrIndex ++;
  }
};

graphics.prototype.renderScanlineMode3 = function()
{	
  let vramMem = this.vramMem;
  let imageDataArr = this.imageDataArr;
  let convertColor = this.convertColor;

  let imageDataPos = this.scanline * 240;
  let vramPos = imageDataPos * 2;
  let color;

  for (let i = 0; i < 240; i ++)
  {
    color = (vramMem[vramPos + 1] << 8) + vramMem[vramPos];
    imageDataArr[imageDataPos] = convertColor[color];

    imageDataPos ++;
    vramPos += 2;
  }

};

graphics.prototype.renderScanlineMode4 = function()
{
  let vramMem = this.vramMem;
  let paletteRamMem = this.paletteRamMem;
  let imageDataArr = this.imageDataArr;
  let convertColor = this.convertColor;

  let imageDataPos = this.scanline * 240;
  let vramPos = imageDataPos + (this.frame ? 0xA000 : 0);
  let paletteIndex;
  let color;

  for (let i = 0; i < 240; i ++)
  {
    paletteIndex = vramMem[vramPos] * 2;
    color = paletteRamMem[paletteIndex] + (paletteRamMem[paletteIndex + 1] << 8);
    imageDataArr[imageDataPos] = convertColor[color];

    imageDataPos ++;
    vramPos ++;
  }
};

graphics.prototype.renderScanlineMode5 = function () {
  let vramMem = this.vramMem;
  let imageDataArr = this.imageDataArr;
  let convertColor = this.convertColor;

  let imageDataPos = this.scanline * 240;
  let vramPos = (this.scanline * 160 * 2) + (this.frame ? 0xA000 : 0);
  let bgcolor = this.paletteRamMem[0] + (this.paletteRamMem[1] << 8)
  let color;

  for (var i = 0; i < 160; i ++)
  {
    color = (vramMem[vramPos + 1] << 8) + vramMem[vramPos];
    imageDataArr[imageDataPos] = convertColor[color];

    imageDataPos ++;
    vramPos += 2;
  }

  if (this.scanline > 127) //use first color in palette ram for background?
  {
    i = 0;
    imageDataPos = this.scanline * 240;
  }

  for (i; i < 240; i++)
  {
    imageDataArr[imageDataPos] = convertColor[bgcolor];
    imageDataPos ++;
  }
}

graphics.prototype.renderScanline = function (mode) {
  switch (mode)
  {
    case 0: this.renderScanlineMode0();
    break;

    case 1:
    break;

    case 2:
    break;

    case 3: this.renderScanlineMode3();
    break;

    case 4: this.renderScanlineMode4();
    break;

    case 5: this.renderScanlineMode5()
    break;
  }
}
//called every 4 cpu cycles
graphics.prototype.pushPixel = function() {
  if (this.vblank)
  {
    this.pixel ++;
    if (this.pixel === 240)
    {
      this.setHblank();
    }
    else if (this.pixel === 308)
    {
      this.pixel = 0;
      this.hblank = false;
      this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["HBLANKCLEAR"];
      this.scanline ++;
      if (this.scanline === 228)
      {
        this.scanline = 0;
        this.vblank = false;
        this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["VBLANKCLEAR"];
      }
      this.updateVCount(this.scanline);
    }
  }
  else if (this.hblank)
  {
    this.pixel ++;
    if (this.pixel === 308) //go to next scanline
    {
      this.pixel = 0;
      this.hblank = false;
      this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["HBLANKCLEAR"];
      this.scanline ++;
      if (this.scanline === 160)
      {
        this.setVblank();
        this.finishDraw();
      }
      this.updateVCount(this.scanline);
    }
  }
  else
  {
    this.pixel ++;
    if (this.pixel === 240)
    {
      this.setHblank();
      this.renderScanline(this.mode);
    }
  }
};

graphics.prototype.updateDISPCNT = function (newDISPCNTVal) {
  this.mode = newDISPCNTVal & this.displayENUMS["BGMODE"];
  this.frame = newDISPCNTVal & this.displayENUMS["DISPLAYFRAME"];
}

graphics.prototype.setHblank = function () {
  this.hblank = true;
  this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["HBLANKSET"];

  //if hblank irq, throw interrupt
};

graphics.prototype.setVblank = function () {
  this.vblank = true;
  this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["VBLANKSET"];

  //if vblank irq, throw interrupt
};

graphics.prototype.updateVCount = function (scanline) {
  if (this.vCountSetting === scanline)
  {
    this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["VCOUNTERSET"];
    //throw interrupt if vcount irq enabled
  }
  else
  {
    this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["VCOUNTERCLEAR"];
  }
  this.ioregionMem[this.vcountByte1] = scanline;
};

graphics.prototype.finishDraw = function () {
  this.context.putImageData(this.imageData, 0, 0);
  this.setFrameComplete();
}

//debugging
graphics.prototype.updateRegisters = function(mode) {
  for (let i = 0; i <= 15; i++)
  {
    this.registersDOM[i].textContent = parseInt(this.registers[i][this.registerIndices[mode][i]]).toString(16);
  }
  //show SPSR
  if (mode)
  {
    this.registersDOM[16].textContent = parseInt(this.registers[17][this.registerIndices[mode][17]]).toString(16);
  }
  let CPSR = this.registers[16][0];
  this.cpsrDOM[0].textContent = bitSlice(CPSR, 31, 31);
  this.cpsrDOM[1].textContent = bitSlice(CPSR, 30, 30);
  this.cpsrDOM[2].textContent = bitSlice(CPSR, 29, 29);
  this.cpsrDOM[3].textContent = bitSlice(CPSR, 28, 28);
  this.cpsrDOM[5].textContent = bitSlice(CPSR, 7, 7);
  this.cpsrDOM[6].textContent = bitSlice(CPSR, 6, 6);
  this.cpsrDOM[7].textContent = bitSlice(CPSR, 5, 5);
  this.cpsrDOM[8].textContent = this.valToMode[bitSlice(CPSR, 0, 4)] + "(" + bitSlice(CPSR, 0, 4) + ")";
  this.cpsrDOM[9].textContent = getBytes(CPSR, 0);
};



// let obj = new Object();
// obj.x = []
// Object.prototype.hallo = function (x) {
//   for (let i = 0; i < 100000000; i ++)
//   {
//     x[0] = 5;
//   }
// };

// Object.prototype.hallo2 = function () {
//   for (let i = 0; i < 100000000; i ++)
//   {
//     this.x[0] = 10;
//   }
// };

// let timenow = (new Date).getTime();
// obj.hallo(obj.x);
// // for (let i = 0; i < 1000000000; i++)
// // {
// //   let somevar =  ((5000 >>> 0) & (511));
// // }
// console.log((new Date).getTime() - timenow);

// timenow = (new Date).getTime();
// obj.hallo2();
// // for (let i = 0; i < 1000000000; i++)
// // {
// //   let somevar =  bitSlice(5000, 0, 8);
// // }
// console.log((new Date).getTime() - timenow);

// for (let i = 0; i <= 79; i++)
// {
//   console.log("this.executeOpcode.push(this.executeOpcode" + i + ".bind(this))");
// }


// SCANLINE: 0
// background.js:96 INDEX: 5
// background.js:96 INDEX: 6
// 22background.js:96 INDEX: 0
// background.js:96 INDEX: 1b
// background.js:96 INDEX: 1c
// 5background.js:96 INDEX: 0
