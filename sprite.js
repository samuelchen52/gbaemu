const sprite = function(vramMem, paletteRamMem16, OBJAffines, OBJAttr0, OBJAttr1, OBJAttr2, spriteNum) {

	this.vramMem = vramMem;
	this.paletteRamMem16 = paletteRamMem16;
	this.OBJAffines = OBJAffines;
	this.OBJAttr0 = OBJAttr0;
	this.OBJAttr1 = OBJAttr1;
	this.OBJAttr2 = OBJAttr2;
	this.spriteNum = spriteNum;

	//attribute 0
	this.yCoord = 255;
	this.mode = 0;
	this.gfxMode = 0;
	this.mosaic = 0;
	this.bpp8 = 0; //1. When using the 256 Colors/1 Palette mode, only each second tile may be used, the lower bit of the tile number should be zero (in 2-dimensional mapping mode, the bit is completely ignored).
	this.shape = 0;

	//attribute 1
	this.xCoord = 0;
	this.affineIndex = 0;
	this.hflip = 0;
	this.vflip = 0;
	this.size = 0;

	//attribute 2
	this.tileIndex = 0; //should 512 or higher in bitmap modes
	this.priority = 0;
	this.palBankIndex = 0;

	//other
	this.bottomY = 8;
	this.rightX = 8;
	this.render = false;
	this.mappingMode = 0;
	this.spriteRowSize = 256; //in 1d mode


	this.tileArr = new Uint32Array(8); //sprite width up to 8 tiles
 
	OBJAttr0.addCallback((newOBJAttr0Val) => {this.updateOBJAttr0(newOBJAttr0Val)});
	OBJAttr1.addCallback((newOBJAttr1Val) => {this.updateOBJAttr1(newOBJAttr1Val)});
	OBJAttr2.addCallback((newOBJAttr2Val) => {this.updateOBJAttr2(newOBJAttr2Val)});

	//render scanline functions indexed by mode
	this.renderScanline = [
		this.renderScanlineNormal.bind(this),
		this.renderScanlineAffine.bind(this),
		null,
		this.renderScanlineAffineDouble.bind(this)
	];

	this.writeTileToScanline = [
	  this.writeTileToScanlineBPP4.bind(this),
	  this.writeTileToScanlineBPP8.bind(this)
  ];


};

sprite.prototype.spriteENUMS = {
	YCOORD : 255,
	MODE : 768,
	GFXMODE : 3072,
	MOSAIC : 4096,
	BPP8 : 8192,
	SHAPE : 49152,

	XCOORD : 511,
	AFFINEINDEX : 15872,
	HFLIP : 4096,
	VFLIP : 8192,
	SIZE : 49152,

	TILEINDEX : 1023,
	PRIORITY : 3072,
	PALBANKINDEX : 61440
};

//[[8, 8], [16, 8], [8, 16]],
//[[16, 16], [32, 8], [8, 32]],
//[[32, 32], [32, 16], [16, 32]],
//[[64, 64], [64, 32], [32, 64]]

//width indexed by size, then by shape
sprite.prototype.objWidthTable = [
	[8, 16, 8],
	[16, 32, 8],
	[32, 32, 16],
	[64, 64, 32]
];

//height indexed by size, then by shape
sprite.prototype.objHeightTable = [
	[8, 8, 16],
	[16, 8, 32],
	[32, 16, 32],
	[64, 32, 64]
];

sprite.prototype.updateOBJAttr0 = function (newOBJAttr0Val) {
  this.yCoord = newOBJAttr0Val & this.spriteENUMS["YCOORD"];
  this.yCoord = this.yCoord >= 160 ? -1 * ((~(this.yCoord - 1)) & 0xFF) : this.yCoord;

  this.mode = (newOBJAttr0Val & this.spriteENUMS["MODE"]) >>> 8;
  this.gfxMode = (newOBJAttr0Val & this.spriteENUMS["GFXMODE"]) >>> 10;
  this.mosaic = newOBJAttr0Val & this.spriteENUMS["MOSAIC"];
  this.bpp8 = (newOBJAttr0Val & this.spriteENUMS["BPP8"]) >>> 13;
  this.shape = (newOBJAttr0Val & this.spriteENUMS["SHAPE"]) >>> 14;

  this.bottomY = this.yCoord + this.objHeightTable[this.size][this.shape];
  this.rightX = this.xCoord + this.objWidthTable[this.size][this.shape];
  this.render = !((this.mode === 2) || (this.gfxMode === 2));
  this.spriteRowSize = this.objWidthTable[this.size][this.shape] << 2; //(this.objWidthTable[this.size][this.shape] >>> 3) * 0x20
};

sprite.prototype.updateOBJAttr1 = function (newOBJAttr1Val) {
  this.xCoord = newOBJAttr1Val & this.spriteENUMS["XCOORD"];
  this.xCoord = this.xCoord >= 256 ? -1 * ((~(this.xCoord - 1)) & 0x1FF) : this.xCoord;

  this.affineIndex = (newOBJAttr1Val & this.spriteENUMS["AFFINEINDEX"]) >>> 9;
  this.hflip = (newOBJAttr1Val & this.spriteENUMS["HFLIP"]) >>> 12;
  this.vflip = (newOBJAttr1Val & this.spriteENUMS["VFLIP"]) >>> 13;
  this.size = (newOBJAttr1Val & this.spriteENUMS["SIZE"]) >>> 14;

  this.bottomY = this.yCoord + this.objHeightTable[this.size][this.shape];
  this.rightX = this.xCoord + this.objWidthTable[this.size][this.shape];
  this.render = !((this.mode === 2) || (this.gfxMode === 2));
  this.spriteRowSize = this.objWidthTable[this.size][this.shape] << 2; //(this.objWidthTable[this.size][this.shape] >>> 3) * 0x20
};

sprite.prototype.updateOBJAttr2 = function (newOBJAttr2Val) {
  this.tileIndex = newOBJAttr2Val & this.spriteENUMS["TILEINDEX"];
  this.priority = (newOBJAttr2Val & this.spriteENUMS["PRIORITY"]) >>> 10;
  this.palBankIndex = (newOBJAttr2Val & this.spriteENUMS["PALBANKINDEX"]) >>> 12;
};

sprite.prototype.renderScanlineNormal = function (phantomBGS, scanline) {
	let hflip = this.hflip;
	let vflip = this.vflip;
	let numTilesRender = Math.ceil((Math.min(this.rightX, 240) - this.xCoord) / 8);
	let tileOffset = (0x20 << this.bpp8) * (hflip ? -1 : 1);
	let tileLine = (scanline - this.yCoord) % 8;
	let tileAddr = 0x10000 //add 4 char block offset
	+ (this.tileIndex * 0x20)  //add start tile offset
	+ (((vflip ? (this.bottomY - (scanline + 1)) : (scanline - this.yCoord)) >>> 3) * (this.mappingMode ? this.spriteRowSize : 1024)) //add tile row offset
	+ (hflip ? ((numTilesRender - 1) * (0x20 << this.bpp8)) : 0); //add tile number offset
	let scanlineArrIndex = this.xCoord; //keep in mind this sometimes access negative index (ignored in javascript), to get around this, allocate buffer of size 512 and set index to xCoord + 256
	let scanlineArr = phantomBGS[this.priority];
	let vramMem = this.vramMem;
	let paletteRamMem16 = this.paletteRamMem16;
	let palBankIndex = this.palBankIndex;

	for (let i = 0; i < numTilesRender; i ++)
	{
		this.writeTileToScanline[this.bpp8](tileAddr, tileLine, scanlineArrIndex, vramMem, paletteRamMem16, scanlineArr, hflip, vflip, palBankIndex);
		scanlineArrIndex += 8;
		tileAddr += tileOffset;
	}
};

sprite.prototype.renderScanlineAffine = function (phantomBGS, scanline) {
	console.log("NOT IMPLEMENTED");
};

sprite.prototype.renderScanlineAffineDouble = function (phantomBGS, scanline) {
	console.log("NOT IMPLEMENTED");
};

//at bpp4, one line of pixels in a tile encoded in 4 bytes
sprite.prototype.writeTileToScanlineBPP4 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip, palBankIndex) {
  tileAddr += 4 * (vflip ? (7 - tileLine) : tileLine);
  palBankIndex = (palBankIndex << 4) + 0x100;
  let paletteIndex0 = (vramMem8[tileAddr] & 15);
  let paletteIndex1 = ((vramMem8[tileAddr] >>> 4) & 15);
  let paletteIndex2 = (vramMem8[tileAddr + 1] & 15);
  let paletteIndex3 = ((vramMem8[tileAddr + 1] >>> 4) & 15);
  let paletteIndex4 = (vramMem8[tileAddr + 2] & 15);
  let paletteIndex5 = ((vramMem8[tileAddr + 2] >>> 4) & 15);
  let paletteIndex6 = (vramMem8[tileAddr + 3] & 15);
  let paletteIndex7 = ((vramMem8[tileAddr + 3] >>> 4) & 15);

  if (hflip)
  {
  	//b3  b2  b1  b0
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex + 7] = paletteIndex0 ? paletteRamMem16[paletteIndex0 + palBankIndex] : 0x8000;
  	scanlineArr[scanlineArrIndex + 6] = paletteIndex1 ? paletteRamMem16[paletteIndex1 + palBankIndex] : 0x8000;
  	scanlineArr[scanlineArrIndex + 5] = paletteIndex2 ? paletteRamMem16[paletteIndex2 + palBankIndex] : 0x8000;
  	scanlineArr[scanlineArrIndex + 4] = paletteIndex3 ? paletteRamMem16[paletteIndex3 + palBankIndex] : 0x8000;
  	scanlineArr[scanlineArrIndex + 3] = paletteIndex4 ? paletteRamMem16[paletteIndex4 + palBankIndex] : 0x8000;
  	scanlineArr[scanlineArrIndex + 2] = paletteIndex5 ? paletteRamMem16[paletteIndex5 + palBankIndex] : 0x8000;
  	scanlineArr[scanlineArrIndex + 1] = paletteIndex6 ? paletteRamMem16[paletteIndex6 + palBankIndex] : 0x8000; 
  	scanlineArr[scanlineArrIndex] = paletteIndex7 ? paletteRamMem16[paletteIndex7 + palBankIndex] : 0x8000;
  }
  else
  {
  	//b0  b1  b2  b3
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = paletteIndex0 ? paletteRamMem16[paletteIndex0 + palBankIndex] : 0x8000;
    scanlineArr[scanlineArrIndex + 1] = paletteIndex1 ? paletteRamMem16[paletteIndex1 + palBankIndex] : 0x8000;
    scanlineArr[scanlineArrIndex + 2] = paletteIndex2 ? paletteRamMem16[paletteIndex2 + palBankIndex] : 0x8000;
    scanlineArr[scanlineArrIndex + 3] = paletteIndex3 ? paletteRamMem16[paletteIndex3 + palBankIndex] : 0x8000;
    scanlineArr[scanlineArrIndex + 4] = paletteIndex4 ? paletteRamMem16[paletteIndex4 + palBankIndex] : 0x8000;
    scanlineArr[scanlineArrIndex + 5] = paletteIndex5 ? paletteRamMem16[paletteIndex5 + palBankIndex] : 0x8000;
    scanlineArr[scanlineArrIndex + 6] = paletteIndex6 ? paletteRamMem16[paletteIndex6 + palBankIndex] : 0x8000; 
    scanlineArr[scanlineArrIndex + 7] = paletteIndex7 ? paletteRamMem16[paletteIndex7 + palBankIndex] : 0x8000;
  }
}

//at bpp8, one line of pixels in a tile encoded in 8 bytes
sprite.prototype.writeTileToScanlineBPP8 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip) {
  tileAddr += 8 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
  	//b7b6b5b4b3b2b1b0
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = vramMem8[tileAddr + 7] ? paletteRamMem16[vramMem8[tileAddr + 7] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 1] = vramMem8[tileAddr + 6] ? paletteRamMem16[vramMem8[tileAddr + 6] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 2] = vramMem8[tileAddr + 5] ? paletteRamMem16[vramMem8[tileAddr + 5] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 3] = vramMem8[tileAddr + 4] ? paletteRamMem16[vramMem8[tileAddr + 4] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 4] = vramMem8[tileAddr + 3] ? paletteRamMem16[vramMem8[tileAddr + 3] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 5] = vramMem8[tileAddr + 2] ? paletteRamMem16[vramMem8[tileAddr + 2] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 6] = vramMem8[tileAddr + 1] ? paletteRamMem16[vramMem8[tileAddr + 1] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 7] = vramMem8[tileAddr] ? paletteRamMem16[vramMem8[tileAddr] + 0x100] : 0x8000;
  }
  else
  {
  	//b0b1b2b3b4b5b6b7
  	//0 1 2 3 4 5 6 7
  	scanlineArr[scanlineArrIndex] = vramMem8[tileAddr] ? paletteRamMem16[vramMem8[tileAddr] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 1] = vramMem8[tileAddr + 1] ? paletteRamMem16[vramMem8[tileAddr + 1] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 2] = vramMem8[tileAddr + 2] ? paletteRamMem16[vramMem8[tileAddr + 2] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 3] = vramMem8[tileAddr + 3] ? paletteRamMem16[vramMem8[tileAddr + 3] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 4] = vramMem8[tileAddr + 4] ? paletteRamMem16[vramMem8[tileAddr + 4] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 5] = vramMem8[tileAddr + 5] ? paletteRamMem16[vramMem8[tileAddr + 5] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 6] = vramMem8[tileAddr + 6] ? paletteRamMem16[vramMem8[tileAddr + 6] + 0x100] : 0x8000;
  	scanlineArr[scanlineArrIndex + 7] = vramMem8[tileAddr + 7] ? paletteRamMem16[vramMem8[tileAddr + 7] + 0x100] : 0x8000;
  }
}

sprite.prototype.shouldRender = function (scanline) {
	return this.render 
	&& ((scanline >= this.yCoord) && (scanline < this.bottomY)) 
	&& (((this.xCoord >= 0) && (this.xCoord < 240)) || ((this.rightX >= 0) && (this.rightX < 240)));
};
