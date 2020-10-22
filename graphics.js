// LCD screen 240px wide x 160px high 
// 15 bit colors 
// 59.73 fps
// scanline -> entire row of pixels 
// screen is updated by updating scanline by scanline (160 scanlines)
// after each scanline is a pause called HBLANK
// after 160 scanlines is a pause called VBLANK, which is usually when the screen data is updated to prevent "tearing"
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

//tiled backgrounds made up of tiles (8x8 pixel bitmap)


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




//video modes 0, 1, 2




//BACKGROUND

//BG0-BG3CNT R/W Control addr - 0x40000008, 0x...A, 0x...C, 0x...E (two bytes)
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

  }



  //graphics stuff
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

  this.frameComplete = false;


  //graphics hardware configuration
  this.mode = 4;
  this.displayFrame = 0;

  this.hblankIRQEnable = false;
  this.vblankIRQEnable = false;
  this.vCountIRQEnable = false;

  this.vCountSetting = 0;


  //graphics hardware ioregs
  this.dispcnt = this.ioregion.getIOReg("DISPCNT");
  this.dispcnt.addCallback((dispcntVal) => {
    this.mode = dispcntVal & this.displayENUMS["BGMODE"];
    this.frame = dispcntVal & this.displayENUMS["DISPLAYFRAME"];
  });

  this.dispstat = this.ioregion.getIOReg("DISPSTAT");
  this.dispstatByte1 = this.dispstat.regIndex;
  this.dispstatByte2 = this.dispstat.regIndex + 1;

  this.vcount = this.ioregion.getIOReg("VCOUNT");
  this.vcountByte1 = this.vcount.regIndex;


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
  //if (this.scanline > 127) return;
  let vramMem = this.vramMem;
  let imageDataArr = this.imageDataArr;
  let convertColor = this.convertColor;

  let imageDataPos = this.scanline * 240;
  let vramPos = (this.scanline * 160 * 2) + (this.frame ? 0xA000 : 0);
  let color;

  for (let i = 0; i < 240; i ++)
  {
    color = (vramMem[vramPos + 1] << 8) + vramMem[vramPos];
    imageDataArr[imageDataPos] = convertColor[color];

    imageDataPos ++;
    vramPos += 2;
  }
}

graphics.prototype.renderScanline = function (mode) {
  switch (mode)
  {
    case 0:
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

graphics.prototype.finishDraw = function () {
  this.context.putImageData(this.imageData, 0, 0);
  this.setFrameComplete();
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


//let arr8 = new Uint8Array(2);
//let arr16 = new Uint16Array(arr8.buffer);
// let objects = [{"hello" : 5}, {"asdfasfasdfasfdasf" : "asdfa"}, {"fffffffffffffff" : {}}, {"fasdfasdfadsf" : []}]
// for (let i = 0; i < 100; i ++)
// {
//   arr.push(objects[Math.floor(Math.random() * 4)]);
// }


// let func = function () {let somevar = 4; return somevar};
// let funcArr = [];
// funcArr[5] = func;

// let somevar;
// let timenow = (new Date).getTime();

// for (let i = 0; i < 1000000000; i++)
// {
//   funcArr[5]();
// }
// console.log((new Date).getTime() - timenow);

// timenow = (new Date).getTime();
// for (let i = 0; i < 1000000000; i++)
// {
//   func();
// }
// console.log((new Date).getTime() - timenow);
