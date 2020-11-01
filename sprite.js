const sprite = function(vramMem, paletteRamMem, OBJAffines, OBJAttr0, OBJAttr1, OBJATTR2, spriteNum) {

	this.vramMem = vramMem;
	this.paletteRamMem = paletteRamMem;
	this.OBJAffines = OBJAffines;
	this.OBJAttr0 = OBJAttr0;
	this.OBJAttr1 = OBJAttr1;
	this.OBJATTR2 = OBJATTR2;
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
	this.palbankIndex = 0;

	//other
	this.bottomY = 8;
	this.rightX = 8;
	this.render = false;
 
	OBJAttr0.addCallback((newOBJAttr0Val) => {this.updateOBJAttr0(newOBJAttr0Val)});
	OBJAttr1.addCallback((newOBJAttr1Val) => {this.updateOBJAttr1(newOBJAttr1Val)});
	OBJAttr2.addCallback((newOBJAttr2Val) => {this.updateOBJAttr2(newOBJAttr2Val)});

	//render scanline functions indexed by mode
	this.renderScanline = [

	]
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
  this.yCoord = this.yCoord >= 160 ? ~(this.yCoord - 1) : this.yCoord;

  this.mode = (newOBJAttr0Val & this.spriteENUMS["MODE"]) >>> 8;
  this.gfxMode = (newOBJAttr0Val & this.spriteENUMS["GFXMODE"]) >>> 10;
  this.mosaic = newOBJAttr0Val & this.spriteENUMS["MOSAIC"];
  this.bpp8 = (newOBJAttr0Val & this.spriteENUMS["BPP8"]) >>> 13;
  this.shape = newOBJAttr0Val & this.spriteENUMS["SHAPE"] >>> 14;

  this.bottomY = this.yCoord + this.objHeightTable[this.size][this.shape];
  this.rightX = this.xCoord + this.objWidthTable[this.size][this.shape];
  this.render = (this.mode === 2) || (this.gfxMode === 2);
};

sprite.prototype.updateOBJAttr1 = function (newOBJAttr1Val) {
  this.xCoord = newOBJAttr0Val & this.spriteENUMS["XCOORD"];
  this.xCoord = this.xCoord >= 256 ? ~(this.xCoord - 1) : this.xCoord;

  this.affineIndex = (newOBJAttr0Val & this.spriteENUMS["AFFINEINDEX"]) >>> 9;
  this.hflip = (newOBJAttr0Val & this.spriteENUMS["HFLIP"]) >>> 12;
  this.vflip = (newOBJAttr0Val & this.spriteENUMS["VFLIP"]) >>> 13;
  this.size = (newOBJAttr0Val & this.spriteENUMS["SIZE"]) >>> 14;

  this.bottomY = this.yCoord + this.objHeightTable[this.size][this.shape];
  this.rightX = this.xCoord + this.objWidthTable[this.size][this.shape];
};

sprite.prototype.updateOBJAttr2 = function (newOBJAttr2Val) {
  this.tileIndex = newOBJAttr0Val & this.spriteENUMS["TILEINDEX"];
  this.priority = (newOBJAttr0Val & this.spriteENUMS["PRIORITY"]) >>> 10;
  this.palbankIndex = (newOBJAttr0Val & this.spriteENUMS["PALBANKINDEX"]) >>> 12;
};

sprite.prototype.renderScanline = function (phantomBGS) {
	let scanlineArr = phantomBGS[this.priority];

	//get width / 8 tiles (take care of 1d and 2d mode)
	//for each tile, put tile into scanline arr


};

sprite.prototype.shouldRender = function (scanline) {
	return this.render && ((scanline >= this.yCoord) && (scanline <= (this.bottomY))) && (((this.xCoord >= 0) && (this.xCoord < 240)) || ((this.rightX >= 0) && (this.rightX < 240))) ;
};
