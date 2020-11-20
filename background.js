const background = function(bgcnt, bghofs, bgvofs, bgx, bgy, bgpa, bgpb, bgpc, bgpd, vramMem, paletteRamMem, bgNum) {

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

  if (bgNum >= 2)
  {
    this.internalRefX = 0;
    this.internalRefY = 0;
    this.refX = 0;
    this.refY = 0;
    this.bgpa = 0;
    this.bgpb = 0;
    this.bgpc = 0;
    this.bgpd = 0;

    bgx.addCallback((newBGXVal) => {this.updateBGX(newBGXVal)});
    bgy.addCallback((newBGYVal) => {this.updateBGY(newBGYVal)});
    bgpa.addCallback((newBGPAVal) => {this.updateBGPA(newBGPAVal)});
    bgpb.addCallback((newBGPBVal) => {this.updateBGPB(newBGPBVal)});
    bgpc.addCallback((newBGPCVal) => {this.updateBGPC(newBGPCVal)});
    bgpd.addCallback((newBGPDVal) => {this.updateBGPD(newBGPDVal)});
  }

  this.vramMem8 = vramMem;
	this.vramMem16 = new Uint16Array(vramMem.buffer);
	this.paletteRamMem16 = new Uint16Array(paletteRamMem.buffer);
  this.scanlineArr = new Uint16Array(248); //extra 8 for misaligned tiles
  this.seArr = new Uint16Array(31);

  //indexed by bg size
  this.getScreenEntries = [
	  this.getScreenEntriesSize0,
	  this.getScreenEntriesSize1,
	  this.getScreenEntriesSize0,
	  this.getScreenEntriesSize3
  ];

  //indexed by wrap
  this.getColor = [
    this.getColorNoWrap,
    this.getColorWrap
  ];

  //indexed by bpp8
  this.writeTileToScanline = [
	  this.writeTileToScanlineBPP4,
	  this.writeTileToScanlineBPP8
  ];

  //indexed by bg display 
  this.renderScanlineBGMode0 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode0.bind(this)
  ];
  // this.renderScanlineBGMode1 = [
  //   () => {return this.transparentScanline;},
  //   this.renderScanlineMode1.bind(this)
  // ];
  this.renderScanlineBGMode2 = [
    () => {return this.transparentScanline;},
    this.renderScanlineMode2.bind(this)
  ];
  this.renderScanlineBGMode3 = [
    () => {return this.transparentScanline;},
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

background.prototype.transparentScanline = new Uint16Array(248).fill(0x8000);

background.prototype.updateBGCNT = function (newBGCNTVal) {
  this.prio = newBGCNTVal & this.backgroundENUMS["BGPRIO"];
  this.CBB = (newBGCNTVal & this.backgroundENUMS["CBB"]) >>> 2;
  this.mosaic = newBGCNTVal & this.backgroundENUMS["MOSAIC"];
  this.bpp8 = (newBGCNTVal & this.backgroundENUMS["BPP8"]) >>> 7;
  this.SBB = (newBGCNTVal & this.backgroundENUMS["SBB"]) >>> 8;
  this.wrapAround = (newBGCNTVal & this.backgroundENUMS["WRAPAROUND"]) >>> 13;
  this.screenSize = (newBGCNTVal & this.backgroundENUMS["SCREENSIZE"]) >>> 14;

  this.screenSizeAffine = 128 << this.screenSize;
}

background.prototype.updateBGHOFS = function (newBGHOFSVal) {
  this.hOffset = newBGHOFSVal & this.backgroundENUMS["HOFFSET"];
  //console.log(this.hOffset);
}

background.prototype.updateBGVOFS = function (newBGVOFSVal) {
  this.vOffset = newBGVOFSVal & this.backgroundENUMS["VOFFSET"];
  //console.log(this.vOffset);
}

background.prototype.updateBGX = function (newBGXVal) {
  this.refX = newBGXVal & 0x8000000 ? -1 * (~(newBGXVal - 1) & 0xFFFFFFF) : newBGXVal & 0xFFFFFFF;
  this.internalRefX = this.refX;
}

background.prototype.updateBGY = function (newBGYVal) {
  this.refY = newBGYVal & 0x8000000 ? -1 * (~(newBGYVal - 1) & 0xFFFFFFF) : newBGYVal & 0xFFFFFFF;
  this.internalRefY = this.refY;
}

background.prototype.updateBGPA = function (newBGPAVal) {
  this.bgpa = newBGPAVal & 32768 ? -1 * (~(newBGPAVal - 1) & 0xFFFF) : newBGPAVal;
}

background.prototype.updateBGPB = function (newBGPBVal) {
  this.bgpb = newBGPBVal & 32768 ? -1 * (~(newBGPBVal - 1) & 0xFFFF) : newBGPBVal;
}

background.prototype.updateBGPC = function (newBGPCVal) {
  this.bgpc = newBGPCVal & 32768 ? -1 * (~(newBGPCVal - 1) & 0xFFFF) : newBGPCVal;
}

background.prototype.updateBGPD = function (newBGPDVal) {
  this.bgpd = newBGPDVal & 32768 ? -1 * (~(newBGPDVal - 1) & 0xFFFF) : newBGPDVal;
}

//tiles (screen entries) are 16 bits
//0-9 tile index
//A-B horizontal / vertical flip
//C-F palette bank index (for 4bpp)
background.prototype.renderScanlineMode0 = function (scanline) {
	let seArr = this.seArr;
  let seArrLength = (this.hOffset & 7) ? 31 : 30;
	this.getScreenEntries[this.screenSize](scanline, this.hOffset, this.vOffset, this.SBB, this.vramMem16, seArr); //retrieve screen entries (tiles) from screenblock (tilemap)

	let bpp8 = this.bpp8;
	let tileLine = (this.vOffset + scanline) % 8;
	let tileSize = this.bpp8 ? 0x40 : 0x20;
	let tileBase = this.CBB * 0x4000;
	let vramMem8 = this.vramMem8;
	let paletteRamMem16 = this.paletteRamMem16;
	let scanlineArr = this.scanlineArr;

  let screenEntry = seArr[0];
  let scanlineArrIndex =  8 - (this.hOffset & 7);
  this.writeTileToScanline[bpp8](tileBase + ((screenEntry & 1023) * tileSize), tileLine, 0, vramMem8, paletteRamMem16, scanlineArr, screenEntry & 1024, screenEntry & 2048, (this.hOffset & 7), (screenEntry >>> 12));

	for (let i = 1; i < seArrLength; i ++)
	{
	 let screenEntry = seArr[i];
	 this.writeTileToScanline[bpp8](tileBase + ((screenEntry & 1023) * tileSize), tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, screenEntry & 1024, screenEntry & 2048, 0, (screenEntry >>> 12));
	 scanlineArrIndex += 8;
  }

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

background.prototype.writeTileToScanlineBPP4 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip, startPixel, palBankIndex) {
  tileAddr += 4 * (vflip ? (7 - tileLine) : tileLine);
  palBankIndex <<= 4;
  if (hflip)
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = (vramMem8[tileAddr + ((7 - i) >>> 1)] >>> (4 * ((i + 1) & 1)) ) & 15;
      scanlineArr[scanlineArrIndex] = paletteIndex ? paletteRamMem16[paletteIndex + palBankIndex] : 0x8000;
      scanlineArrIndex ++;
    }
  }
  else
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = (vramMem8[tileAddr + (i >>> 1)] >>> (4 * (i & 1))) & 15;
      scanlineArr[scanlineArrIndex] = paletteIndex ? paletteRamMem16[paletteIndex + palBankIndex] : 0x8000;
      scanlineArrIndex ++;
    }
  }
}

background.prototype.writeTileToScanlineBPP8 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip, startPixel) {
  tileAddr += 8 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = vramMem8[tileAddr + 7 - i];
      scanlineArr[scanlineArrIndex] = paletteIndex ? paletteRamMem16[paletteIndex] : 0x8000;
      scanlineArrIndex ++;
    }
  }
  else
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = vramMem8[tileAddr + i];
      scanlineArr[scanlineArrIndex] = paletteIndex ? paletteRamMem16[paletteIndex] : 0x8000;
      scanlineArrIndex ++;
    }
  }
}

//mode 0 will render text background, mode 2 will render affine
// background.prototype.renderScanlineMode1 = function(scanline) { 
// //regular and affine rendering
// };

background.prototype.renderScanlineMode2 = function(scanline) { 
  let tileBase = this.CBB * 0x4000;
  let screenAddr = this.SBB * 2048;
  let vramMem8 = this.vramMem8;
  let paletteRamMem16 = this.paletteRamMem16;
  let scanlineArr = this.scanlineArr;
  let screenSize = this.screenSizeAffine;

  let refX = this.internalRefX;
  let refY = this.internalRefY;

  let bgpa = this.bgpa;
  let bgpb = this.bgpb;
  let bgpc = this.bgpc;
  let bgpd = this.bgpd;

  let pa = 0;
  let pc = 0;

  for (let i = 0; i < 240; i ++)
  {
    let textureXCoord = (pa + bgpb + refX) >> 8;
    let textureYCoord = (pc + bgpd + refY) >> 8;

    scanlineArr[i] = this.getColor[this.wrapAround](textureXCoord, textureYCoord, screenSize, screenAddr, tileBase, vramMem8, paletteRamMem16);
    pa += bgpa;
    pc += bgpc;
  }

  this.internalRefX += bgpb;
  this.internalRefY += bgpd;

  return scanlineArr; 
};

background.prototype.getColorNoWrap = function(xCoord, yCoord, screenSize, screenAddr, tileBase, vramMem8, paletteRamMem16) {
  if ((xCoord >= 0) && (xCoord < screenSize) && (yCoord >= 0) && (yCoord < screenSize))
  {
    let screenEntry = vramMem8[screenAddr + (xCoord >>> 3) + ((yCoord >>> 3) * (screenSize >>> 3))];
    let tileAddr = tileBase + (screenEntry * 0x40);
    let color = vramMem8[tileAddr + (xCoord & 7) + ((yCoord & 7) * 8)];
    return paletteRamMem16[color];
  }
  return 0x8000;
};

background.prototype.getColorWrap = function(xCoord, yCoord, screenSize, screenAddr, tileBase, vramMem8, paletteRamMem16) {
  xCoord = (xCoord % screenSize) + (xCoord < 0 ? screenSize : 0);
  yCoord = (yCoord % screenSize) + (yCoord < 0 ? screenSize : 0);

  let screenEntry = vramMem8[screenAddr + (xCoord >>> 3) + ((yCoord >>> 3) * (screenSize >>> 3))];
  let tileAddr = tileBase + (screenEntry * 0x40);
  let color = vramMem8[tileAddr + (xCoord & 7) + ((yCoord & 7) * 8)];
  return paletteRamMem16[color];
};

background.prototype.renderScanlineMode3 = function(scanline) { 
  let vramMem16 = this.vramMem16;
  let scanlineArr = this.scanlineArr;

  let vramPos = scanline * 240;

  for (let i = 0; i < 240; i ++)
  {
    scanlineArr[i] = vramMem16[vramPos] & 0x7FFF;
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

background.prototype.copyRefPoint = function () {
  this.internalRefX = this.refX;
  this.internalRefY = this.refY;
};