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

	this.backgroundENUMS = {
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

  bgcnt.addCallback((newBGCNTVal) => {this.updateBGCNT(newBGCNTVal)});
  bghofs.addCallback((newBGHOFSVal) => {this.updateBGHOFS(newBGHOFSVal)});
  bgvofs.addCallback((newBGVOFSVal) => {this.updateBGVOFS(newBGVOFSVal)});

  this.vramMem8 = new Uint8Array(vramMem.buffer);
	this.vramMem16 = new Uint16Array(vramMem.buffer);
	this.paletteRamMem16 = new Uint16Array(paletteRamMem.buffer);
  this.scanlineArr = new Uint16Array(248); //extra 8 for misaligned tiles
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
}

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
background.prototype.renderScanline = function (scanline) {
	let seArr = this.seArr;
	this.getScreenEntries[this.screenSize](scanline, this.hOffset, this.vOffset, this.SBB, this.vramMem16, seArr); //retrieve screen entries (tiles) from screenblock (tilemap)

	let bpp8 = this.bpp8;
	let writeTileToScanline = this.writeTileToScanline[bpp8];
	let tileLine = (this.vOffset + scanline) % 8;
	let tileSize = this.bpp8 ? 0x40 : 0x20;
	let tileBase = this.CBB * 4000;
	let vramMem8 = this.vramMem8;
	let paletteRamMem16 = this.paletteRamMem16;
	let scanlineArr = this.scanlineArr;

	for (let i = 0; i < 31; i ++)
	{
		let screenEntry = seArr[i];
		writeTileToScanline(tileBase + ((screenEntry & 1023) * tileSize), tileLine, i * 8, vramMem8, paletteRamMem16, scanlineArr, screenEntry & 1024, screenEntry & 2048, (screenEntry >>> 12) & 15);
	}

  return this.hOffset % 8; //index at which to copy scanlineArr into corresponding scanline in imageData buffer
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
  if (hflip)
  {
  	//b3  b2  b1  b0
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex + 7] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr] & 15)];
  	scanlineArr[scanlineArrIndex + 6] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr] >>> 4) & 15)];
  	scanlineArr[scanlineArrIndex + 5] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr + 1] & 15)];
  	scanlineArr[scanlineArrIndex + 4] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr + 1] >>> 4) & 15)];
  	scanlineArr[scanlineArrIndex + 3] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr + 2] & 15)];
  	scanlineArr[scanlineArrIndex + 2] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr + 2] >>> 4) & 15)];
  	scanlineArr[scanlineArrIndex + 1] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr + 3] & 15)]; 
  	scanlineArr[scanlineArrIndex] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr + 3] >>> 4) & 15)];
  }
  else
  {
  	//b0  b1  b2  b3
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr] & 15)];
  	scanlineArr[scanlineArrIndex + 1] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr] >>> 4) & 15)];
  	scanlineArr[scanlineArrIndex + 2] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr + 1] & 15)];
  	scanlineArr[scanlineArrIndex + 3] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr + 1] >>> 4) & 15)];
  	scanlineArr[scanlineArrIndex + 4] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr + 2] & 15)];
  	scanlineArr[scanlineArrIndex + 5] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr + 2] >>> 4) & 15)];
  	scanlineArr[scanlineArrIndex + 6] = paletteRamMem16[palBankIndex + (vramMem8[tileAddr + 3] & 15)]; 
  	scanlineArr[scanlineArrIndex + 7] = paletteRamMem16[palBankIndex + ((vramMem8[tileAddr + 3] >>> 4) & 15)];
  }

}

//at bpp8, one line of pixels in a tile encoded in 8 bytes
background.prototype.writeTileToScanlineBPP8 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip) {
  tileAddr += 8 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
  	//b7b6b5b4b3b2b1b0
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = paletteRamMem16[vramMem8[tileAddr + 7]];
  	scanlineArr[scanlineArrIndex + 1] = paletteRamMem16[vramMem8[tileAddr + 6]];
  	scanlineArr[scanlineArrIndex + 2] = paletteRamMem16[vramMem8[tileAddr + 5]];
  	scanlineArr[scanlineArrIndex + 3] = paletteRamMem16[vramMem8[tileAddr + 4]];
  	scanlineArr[scanlineArrIndex + 4] = paletteRamMem16[vramMem8[tileAddr + 3]];
  	scanlineArr[scanlineArrIndex + 5] = paletteRamMem16[vramMem8[tileAddr + 2]];
  	scanlineArr[scanlineArrIndex + 6] = paletteRamMem16[vramMem8[tileAddr + 1]];
  	scanlineArr[scanlineArrIndex + 7] = paletteRamMem16[vramMem8[tileAddr]];
  }
  else
  {
  	//b0b1b2b3b4b5b6b7
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = paletteRamMem16[vramMem8[tileAddr]];
  	scanlineArr[scanlineArrIndex + 1] = paletteRamMem16[vramMem8[tileAddr + 1]];
  	scanlineArr[scanlineArrIndex + 2] = paletteRamMem16[vramMem8[tileAddr + 2]];
  	scanlineArr[scanlineArrIndex + 3] = paletteRamMem16[vramMem8[tileAddr + 3]];
  	scanlineArr[scanlineArrIndex + 4] = paletteRamMem16[vramMem8[tileAddr + 4]];
  	scanlineArr[scanlineArrIndex + 5] = paletteRamMem16[vramMem8[tileAddr + 5]];
  	scanlineArr[scanlineArrIndex + 6] = paletteRamMem16[vramMem8[tileAddr + 6]];
  	scanlineArr[scanlineArrIndex + 7] = paletteRamMem16[vramMem8[tileAddr + 7]];
  }
}