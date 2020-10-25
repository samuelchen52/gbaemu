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
    SCREENSIZE : 49152

    HOFFSET : 511,
    VOFFSET : 511,
  };

  bgcnt.addCallback((newBGCNTVal) => {this.updateBGCNT(newBGCNTVal)});
  bghofs.addCallback((newBGHOFSVal) => {this.updateBGHOFS(newBGHOFSVal)});
  bgvofs.addCallback((newBGVOFSVal) => {this.updateBGVOFS(newBGVOFSVal)});

  this.vramMem8 = new Uint16Array(vramMem.buffer);
	this.vramMem16 = new Uint16Array(vramMem.buffer);
	this.paletteRamMem16 = new Uint16Array(paletteRamMem.buffer);
  this.scanlineArr = new Uint16Array(248); //extra 8 for misaligned tiles
  this.tileArr = new Uint16Array(31);

  this.getTiles = [
  getTilesSize0.bind(this),
  getTilesSize1.bind(this),
  getTilesSize0.bind(this),
  getTilesSize3.bind(this)
  ];

  this.writeTileToScanline = [
  writeTileToScanlineBPP4.bind(this),
  writeTileToScanlineBPP8.bind(this),
  ];
}

background.prototype.updateBGCNT = function (newBGCNTVal) {
  this.prio = newBGCNTVal & this.backgroundENUMS["BGPRIO"];
  this.CBB = newBGCNTVal & this.backgroundENUMS["CBB"];
  this.mosaic = newBGCNTVal & this.backgroundENUMS["MOSAIC"];
  this.bpp8 = newBGCNTVal & this.backgroundENUMS["BPP8"];
  this.SBB = newBGCNTVal & this.backgroundENUMS["SBB"];
  this.wrapAround = newBGCNTVal & this.backgroundENUMS["WRAPAROUND"];
  this.screenSize = newBGCNTVal & this.backgroundENUMS["SCREENSIZE"];
}

background.prototype.updateBGHOFS = function (newBGHOFSVal) {
  this.hOffset = newBGHOFSVal & this.backgroundENUMS["HOFFSET"];
}

background.prototype.updateBGVOFS = function (newBGVOFSVal) {
  this.vOffset = newBGVOFSVal & this.backgroundENUMS["VOFFSET"];
}

//tiles (screen entries) are 16 bits
//0-9 tile index
//A-B horizontal / vertical flip
//C-F palette bank index (for 4bpp)
background.prototype.getScanline = function (scanline) {
	let tileArr = this.tileArr;
	let numTiles = this.getTiles[this.screenSize](scanline, this.hOffset, this.vOffset, this.SBB, this.vramMem16, tileArr); //retrieve screen entries (tiles) from screenblock (tilemap)

	scanline %= 8;
	let bpp8 = this.bpp8;
	let tileSize = this.bpp8 ? 0x40 : 0x20;
	let tileBase = this.CBB * 4000;
	let vramMem8 = this.vramMem8;
	let paletteRamMem16 = this.paletteRamMem16;
	let scanlineArr = this.scanlineArr;

	for (let i = 0; i < numTiles; i ++)
	{
		this.writeTileToScanline[bpp8](tileBase + ((tileArr[i] & 1023) * tileSize), scanline, vFlip, hFlip, vramMem8, scanlineArr);
		//vramMem8[tileBase + ((tileArr[i] & 1023) * tileSize)]; //first palette index of 8x8 palette indices (either 4bpp or 8bpp)
	}


  

  return this.hOffset % 8; //index at which to copy scanlineArr into corresponding scanline in imageData buffer
}



//regular backgrounds
//hOffset and vOffset in units of pixels
//size0, hoff % 32, voff % 32
//size1, hoff % 64, voff % 32 (if hoff >= 32, add 32 * 32)
//size2, hoff % 32, voff % 64
//size3, hoff % 64, voff % 64 (if voff >= 32, add 32 * 32 * 2) (if hoff >= 32, add 32 * 32)
background.prototype.getTilesSize0 = function (scanline, hOffset, vOffset, sbb, vramMem16, tileArr) {
	let midTile = hOffset & 7;

	hOffset = (hOffset >>> 3) % 32;
	vOffset = ((vOffset + scanline) >>> 3) % (this.screenSize ? 64 : 32); //screensize is either 0 or 2 here
	let seIndex = (sbb * 1024) + (vOffset * 32);
	for (let i = 0; i < 30; i ++)
	{
		tileArr[i] = vramMem16[seIndex + hOffset];
		hOffset = (hOffset + 1) % 32;
	}
	tileArr[30] = vramMem16[seIndex + hOffset];

	return midTile ? 31 : 30;
}

background.prototype.getTilesSize1 = function (scanline, hOffset, vOffset, sbb, vramMem16, tileArr) {
  let midTile = hOffset & 7;

	hOffset = (hOffset >>> 3) % 64;
	vOffset = ((vOffset + scanline) >>> 3) % 32;
	let seIndex = (sbb * 1024) + (vOffset * 32);
	for (let i = 0; i < 30; i ++)
	{
		tileArr[i] = vramMem16[seIndex + hOffset + ((hOffset & 32) * 32)];
		hOffset = (hOffset + 1) % 64;
	}
	tileArr[30] = vramMem16[seIndex + hOffset];

	return midTile ? 31 : 30;
}

background.prototype.getTilesSize3 = function (scanline, hOffset, vOffset, sbb, vramMem16, tileArr) {
  let midTile = hOffset & 7;

	hOffset = (hOffset >>> 3) % 64;
	vOffset = ((vOffset + scanline) >>> 3) % 64;
	let seIndex = (sbb * 1024) + (vOffset * 32);
	for (let i = 0; i < 30; i ++)
	{
		tileArr[i] = vramMem16[seIndex + hOffset + ((hOffset & 32) * 32) + ((vOffset & 32) * 64)];
		hOffset = (hOffset + 1) % 64;
	}
	tileArr[30] = vramMem16[seIndex + hOffset];

	return midTile ? 31 : 30;
}

background.prototype.writeTileToScanlineBPP4 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, vflip, hflip, palBankIndex) {
  tileAddr += vflip ? tileLine * 0x20 : (7 - tileLine) * 0x20;
  if (hflip)
  {
  	scanlineArr[scanlineArrIndex] = vramMem8
  }
  else
  {

  }

}

background.prototype.writeTileToScanlineBPP8 = function (tileAddr, tileLine, vFlip, hFlip, vramMem8) {
  let midTile = hOffset & 7;

	hOffset = (hOffset >>> 3) % 64;
	vOffset = ((vOffset + scanline) >>> 3) % 64;
	let seIndex = (sbb * 1024) + (vOffset * 32);
	for (let i = 0; i < 30; i ++)
	{
		tileArr[i] = vramMem16[seIndex + hOffset + ((hOffset & 32) * 32) + ((vOffset & 32) * 64)];
		hOffset = (hOffset + 1) % 64;
	}
	tileArr[30] = vramMem16[seIndex + hOffset];

	return midTile ? 31 : 30;
}