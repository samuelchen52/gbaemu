const background = function(bgcnt, bghofs, bgvofs, vramMem, paletteRamMem, bgNum) {

	this.bgNum = bgNum;

	this.prio = 0;
	this.CBB = 0;
	this.mosaic = 0;
	this.bpp8 = 0;
	this.SBB = 0;
	this.wrapAround = 0; //wraps around by default for regular bg, affine bg is transparent if no wrap
	this.screenSize = 0;

	this.hOffset = 0;
	this.vOffset = 0;

	this.mapWidth = 0;
	this.mapHeight = 0;

  bgcnt.addCallback((newBGCNTVal) => {this.updateBGCNT(newBGCNTVal)});
  bghofs.addCallback((newBGHOFSVal) => {this.updateBGHOFS(newBGHOFSVal)});
  bgvofs.addCallback((newBGVOFSVal) => {this.updateBGVOFS(newBGVOFSVal)});

  this.vramMem8 = vramMem;
	this.vramMem16 = new Uint16Array(vramMem.buffer);
	this.paletteRamMem16 = new Uint16Array(paletteRamMem.buffer);
  this.scanlineArrIndex = 0;
  this.scanlineArr = new Uint16Array(248); //extra 8 for misaligned tiles
  this.transparentScanline = new Uint16Array(248).fill(0x8000); //transparent pixel buffer
  this.seArr = new Uint16Array(31);

  this.getScreenEntries = [
	  this.getScreenEntriesSize0.bind(this),
	  this.getScreenEntriesSize1.bind(this),
	  this.getScreenEntriesSize0.bind(this),
	  this.getScreenEntriesSize3.bind(this)
  ];

  this.writeTileToScanline = [
	  this.writeTileToScanlineBPP4.bind(this),
	  this.writeTileToScanlineBPP8.bind(this)
  ];

  //background renderScanline functions indexed by bg display 
  this.renderScanlineBGMode0 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode0.bind(this)
  ];
  this.renderScanlineBGMode1 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode1.bind(this)
  ];
  this.renderScanlineBGMode2 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode2.bind(this)
  ];
  this.renderScanlineBGMode3 = [
    () => {console.log("HALLO"); return this.transparentScanline;},
    this.renderScanlineMode3.bind(this)
  ];
  this.renderScanlineBGMode4 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode4.bind(this)
  ];
  this.renderScanlineBGMode5 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode5.bind(this)
  ];
  // this.renderScanlineOBJ = [
  //   () => {return this.transparentScanline;}, //replace this with obj lyaer.renderscanline
  //   () => {return this.transparentScanline;} //replace this later with obj layer.rendertransparent,
  // ];

  // let getColorFactory = function (index) {
  //   return function (paletteRamMem16)
  //   {
  //     return paletteRamMem16[index];
  //   }
  // }
  // this.getColor = [
  //   () => {return 0x8000},
  //   ...(new Array(255)).map((curVal, index) => {return getColorFactory(index)}),
  // ];
}

background.prototype.backgroundENUMS = {
    BGPRIO : 3,
    CBB : 12, 
    MOSAIC : 64,
    BPP8 : 128,
    SBB : 7936,
    WRAPAROUND : 8192,
    SCREENSIZE : 49152,

    HOFFSET : 511,
    VOFFSET : 511,
};

background.prototype.updateBGCNT = function (newBGCNTVal) {
  this.prio = newBGCNTVal & this.backgroundENUMS["BGPRIO"];
  this.CBB = (newBGCNTVal & this.backgroundENUMS["CBB"]) >>> 2;
  this.mosaic = newBGCNTVal & this.backgroundENUMS["MOSAIC"];
  this.bpp8 = (newBGCNTVal & this.backgroundENUMS["BPP8"]) >>> 7;
  this.SBB = (newBGCNTVal & this.backgroundENUMS["SBB"]) >>> 8;
  this.wrapAround = newBGCNTVal & this.backgroundENUMS["WRAPAROUND"];
  this.screenSize = (newBGCNTVal & this.backgroundENUMS["SCREENSIZE"]) >>> 14;
}

background.prototype.updateBGHOFS = function (newBGHOFSVal) {
  this.hOffset = newBGHOFSVal & this.backgroundENUMS["HOFFSET"];
  //console.log(this.hOffset);
}

background.prototype.updateBGVOFS = function (newBGVOFSVal) {
  this.vOffset = newBGVOFSVal & this.backgroundENUMS["VOFFSET"];
  //console.log(this.vOffset);
}

//tiles (screen entries) are 16 bits
//0-9 tile index
//A-B horizontal / vertical flip
//C-F palette bank index (for 4bpp)
background.prototype.renderScanlineMode0 = function (scanline) {
	let seArr = this.seArr;
	this.getScreenEntries[this.screenSize](scanline, this.hOffset, this.vOffset, this.SBB, this.vramMem16, seArr); //retrieve screen entries (tiles) from screenblock (tilemap)

	let bpp8 = this.bpp8;
	let tileLine = (this.vOffset + scanline) % 8;
	let tileSize = this.bpp8 ? 0x40 : 0x20;
	let tileBase = this.CBB * 4000;
	let vramMem8 = this.vramMem8;
	let paletteRamMem16 = this.paletteRamMem16;
	let scanlineArr = this.scanlineArr;

	for (let i = 0; i < 31; i ++)
	{
		let screenEntry = seArr[i];
		this.writeTileToScanline[bpp8](tileBase + ((screenEntry & 1023) * tileSize), tileLine, i * 8, vramMem8, paletteRamMem16, scanlineArr, screenEntry & 1024, screenEntry & 2048, (screenEntry >>> 12) & 15);
	}

  this.scanlineArrIndex = this.hOffset % 8;
  return scanlineArr; 
}



//regular backgrounds
//hOffset and vOffset in units of pixels
//size0, hoff % 32, voff % 32
//size1, hoff % 64, voff % 32 (if hoff >= 32, add 32 * 32)
//size2, hoff % 32, voff % 64
//size3, hoff % 64, voff % 64 (if voff >= 32, add 32 * 32 * 2) (if hoff >= 32, add 32 * 32)
background.prototype.getScreenEntriesSize0 = function (scanline, hOffset, vOffset, sbb, vramMem16, seArr) {
	hOffset = (hOffset >>> 3) % 32;
	vOffset = ((vOffset + scanline) >>> 3) % (this.screenSize ? 64 : 32); //screensize is either 0 or 2 here
	let seIndex = (sbb * 1024) + (vOffset * 32);
	for (let i = 0; i < 31; i ++)
	{
		seArr[i] = vramMem16[seIndex + hOffset];
		hOffset = (hOffset + 1) % 32;
	}
}

background.prototype.getScreenEntriesSize1 = function (scanline, hOffset, vOffset, sbb, vramMem16, seArr) {
	hOffset = (hOffset >>> 3) % 64;
	vOffset = ((vOffset + scanline) >>> 3) % 32;

	let seIndex = (sbb * 1024) + (vOffset * 32);
	for (let i = 0; i < 31; i ++)
	{
		seArr[i] = vramMem16[seIndex + (hOffset % 32) + ((hOffset & 32) * 32)];
		hOffset = (hOffset + 1) % 64;
	}
}

background.prototype.getScreenEntriesSize3 = function (scanline, hOffset, vOffset, sbb, vramMem16, seArr) {
	hOffset = (hOffset >>> 3) % 64;
	vOffset = ((vOffset + scanline) >>> 3) % 64;
	let seIndex = (sbb * 1024) + (vOffset * 32) + ((vOffset & 32) * 32);
	for (let i = 0; i < 31; i ++)
	{
		seArr[i] = vramMem16[seIndex + (hOffset % 32) + ((hOffset & 32) * 32)];
		hOffset = (hOffset + 1) % 64;
	}
}

//at bpp4, one line of pixels in a tile encoded in 4 bytes
background.prototype.writeTileToScanlineBPP4 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip, palBankIndex) {
  tileAddr += 4 * (vflip ? (7 - tileLine) : tileLine);
  palBankIndex <<= 4;
  let paletteIndex0 = palBankIndex + (vramMem8[tileAddr] & 15);
  let paletteIndex1 = palBankIndex + ((vramMem8[tileAddr] >>> 4) & 15);
  let paletteIndex2 = palBankIndex + (vramMem8[tileAddr + 1] & 15);
  let paletteIndex3 = palBankIndex + ((vramMem8[tileAddr + 1] >>> 4) & 15);
  let paletteIndex4 = palBankIndex + (vramMem8[tileAddr + 2] & 15);
  let paletteIndex5 = palBankIndex + ((vramMem8[tileAddr + 2] >>> 4) & 15);
  let paletteIndex6 = palBankIndex + (vramMem8[tileAddr + 3] & 15);
  let paletteIndex7 = palBankIndex + ((vramMem8[tileAddr + 3] >>> 4) & 15);

  if (hflip)
  {
  	//b3  b2  b1  b0
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex + 7] = paletteIndex0 ? paletteRamMem16[paletteIndex0] : 0x8000;
  	scanlineArr[scanlineArrIndex + 6] = paletteIndex1 ? paletteRamMem16[paletteIndex1] : 0x8000;
  	scanlineArr[scanlineArrIndex + 5] = paletteIndex2 ? paletteRamMem16[paletteIndex2] : 0x8000;
  	scanlineArr[scanlineArrIndex + 4] = paletteIndex3 ? paletteRamMem16[paletteIndex3] : 0x8000;
  	scanlineArr[scanlineArrIndex + 3] = paletteIndex4 ? paletteRamMem16[paletteIndex4] : 0x8000;
  	scanlineArr[scanlineArrIndex + 2] = paletteIndex5 ? paletteRamMem16[paletteIndex5] : 0x8000;
  	scanlineArr[scanlineArrIndex + 1] = paletteIndex6 ? paletteRamMem16[paletteIndex6] : 0x8000; 
  	scanlineArr[scanlineArrIndex] = paletteIndex7 ? paletteRamMem16[paletteIndex7] : 0x8000;
  }
  else
  {
  	//b0  b1  b2  b3
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = paletteIndex0 ? paletteRamMem16[paletteIndex0] : 0x8000;
    scanlineArr[scanlineArrIndex + 1] = paletteIndex1 ? paletteRamMem16[paletteIndex1] : 0x8000;
    scanlineArr[scanlineArrIndex + 2] = paletteIndex2 ? paletteRamMem16[paletteIndex2] : 0x8000;
    scanlineArr[scanlineArrIndex + 3] = paletteIndex3 ? paletteRamMem16[paletteIndex3] : 0x8000;
    scanlineArr[scanlineArrIndex + 4] = paletteIndex4 ? paletteRamMem16[paletteIndex4] : 0x8000;
    scanlineArr[scanlineArrIndex + 5] = paletteIndex5 ? paletteRamMem16[paletteIndex5] : 0x8000;
    scanlineArr[scanlineArrIndex + 6] = paletteIndex6 ? paletteRamMem16[paletteIndex6] : 0x8000; 
    scanlineArr[scanlineArrIndex + 7] = paletteIndex7 ? paletteRamMem16[paletteIndex7] : 0x8000;
  }
}

//at bpp8, one line of pixels in a tile encoded in 8 bytes
background.prototype.writeTileToScanlineBPP8 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip) {
  tileAddr += 8 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
  	//b7b6b5b4b3b2b1b0
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = vramMem8[tileAddr + 7] ? paletteRamMem16[vramMem8[tileAddr + 7]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 1] = vramMem8[tileAddr + 6] ? paletteRamMem16[vramMem8[tileAddr + 6]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 2] = vramMem8[tileAddr + 5] ? paletteRamMem16[vramMem8[tileAddr + 5]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 3] = vramMem8[tileAddr + 4] ? paletteRamMem16[vramMem8[tileAddr + 4]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 4] = vramMem8[tileAddr + 3] ? paletteRamMem16[vramMem8[tileAddr + 3]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 5] = vramMem8[tileAddr + 2] ? paletteRamMem16[vramMem8[tileAddr + 2]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 6] = vramMem8[tileAddr + 1] ? paletteRamMem16[vramMem8[tileAddr + 1]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 7] = vramMem8[tileAddr] ? paletteRamMem16[vramMem8[tileAddr]] : 0x8000;
  }
  else
  {
  	//b0b1b2b3b4b5b6b7
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = vramMem8[tileAddr] ? paletteRamMem16[vramMem8[tileAddr]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 1] = vramMem8[tileAddr + 1] ? paletteRamMem16[vramMem8[tileAddr + 1]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 2] = vramMem8[tileAddr + 2] ? paletteRamMem16[vramMem8[tileAddr + 2]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 3] = vramMem8[tileAddr + 3] ? paletteRamMem16[vramMem8[tileAddr + 3]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 4] = vramMem8[tileAddr + 4] ? paletteRamMem16[vramMem8[tileAddr + 4]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 5] = vramMem8[tileAddr + 5] ? paletteRamMem16[vramMem8[tileAddr + 5]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 6] = vramMem8[tileAddr + 6] ? paletteRamMem16[vramMem8[tileAddr + 6]] : 0x8000;
  	scanlineArr[scanlineArrIndex + 7] = vramMem8[tileAddr + 7] ? paletteRamMem16[vramMem8[tileAddr + 7]] : 0x8000;
  }
}

background.prototype.renderScanlineMode1 = function(scanline) { 

};

background.prototype.renderScanlineMode2 = function(scanline) { 

};

background.prototype.renderScanlineMode3 = function(scanline) { 
  let vramMem16 = this.vramMem16;
  let scanlineArr = this.scanlineArr;

  let vramPos = scanline * 240;

  for (let i = 0; i < 240; i ++)
  {
    scanlineArr[i] = vramMem16[vramPos];
    vramPos ++;
  }

  this.scanlineArrIndex = 0;
  return scanlineArr;
};

background.prototype.renderScanlineMode4 = function(scanline, page) {
  let vramMem8 = this.vramMem8;
  let paletteRamMem16 = this.paletteRamMem16;
  let scanlineArr = this.scanlineArr;

  let vramPos = scanline * 240 + (this.page ? 0xA000 : 0);

  for (let i = 0; i < 240; i ++)
  {
    paletteIndex = vramMem8[vramPos];
    this.scanlineArr[i] = vramMem8[vramPos] ? paletteRamMem16[vramMem8[vramPos]] : 0x8000; 
    vramPos ++;
  }

  this.scanlineArrIndex = 0;
  return scanlineArr;
};

background.prototype.renderScanlineMode5 = function (scanline, page) {
  let scanlineArr = this.scanlineArr;

  if (scanline < 128) //mode 5 resolution is 160 x 128
  {
    let vramMem16 = this.vramMem16;

    let vramPos = (scanline * 160) + (this.page ? 0xA000 : 0);

    for (var i = 0; i < 160; i ++)
    {
      scanlineArr[i] = vramMem16[vramPos];
      vramPos ++;
    }
    for (i; i < 240; i ++)
    {
      scanlineArr[i] = 0x8000;
    }
  }
  else //return all transparent pixels
  {
    for (let i = 0; i < 240; i ++)
    {
      scanlineArr[i] = 0x8000;
    }
  }

  this.scanlineArrIndex = 0;
  return scanlineArr;
}