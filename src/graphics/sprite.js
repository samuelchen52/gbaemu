const sprite = function(spriteNum, mmu, objectLayer, OBJAffines, OBJAttr0, OBJAttr1, OBJAttr2) {

	this.vramMem = mmu.getMemoryRegion("VRAM").memory;
	this.paletteRamMem16 = new Uint16Array(mmu.getMemoryRegion("PALETTERAM").memory.buffer);
	this.OBJAffines = OBJAffines;
	this.OBJAttr0 = OBJAttr0;
	this.OBJAttr1 = OBJAttr1;
	this.OBJAttr2 = OBJAttr2;
	this.objectLayer = objectLayer;
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
	this.display = false;
	this.mappingMode = 0;
	this.spriteRowSize = 256; //in 1d mode
	this.transparentBit = 0;
 
	OBJAttr0.addCallback((newOBJAttr0Val) => {this.updateOBJAttr0(newOBJAttr0Val)});
	OBJAttr1.addCallback((newOBJAttr1Val) => {this.updateOBJAttr1(newOBJAttr1Val)});
	OBJAttr2.addCallback((newOBJAttr2Val) => {this.updateOBJAttr2(newOBJAttr2Val)});

	this.renderScanline = [
		this.renderScanlineNormal.bind(this),
		this.renderScanlineAffine.bind(this),
		null,
		this.renderScanlineAffine.bind(this)
	];

  //window versions
  this.renderScanlineWindow = [
		this.renderScanlineNormalWindow.bind(this),
		this.renderScanlineAffineWindow.bind(this),
		null,
		this.renderScanlineAffineWindow.bind(this)
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
  this.transparentBit = this.gfxMode === 1 ? 0x8000 : 0;
  this.mosaic = newOBJAttr0Val & this.spriteENUMS["MOSAIC"];
  this.bpp8 = (newOBJAttr0Val & this.spriteENUMS["BPP8"]) >>> 13;
  this.shape = (newOBJAttr0Val & this.spriteENUMS["SHAPE"]) >>> 14;

  this.bottomY = this.yCoord + (this.objHeightTable[this.size][this.shape] * (this.mode  === 3 ? 2 : 1));
  this.rightX = this.xCoord + (this.objWidthTable[this.size][this.shape] * (this.mode === 3 ? 2 : 1));
  this.spriteRowSize = this.objWidthTable[this.size][this.shape] << (2 + this.bpp8); //(this.objWidthTable[this.size][this.shape] >>> 3) * (0x20 << this.bpp8)

  this.display = !((this.mode === 2) || (this.gfxMode === 2));
};

sprite.prototype.updateOBJAttr1 = function (newOBJAttr1Val) {
  this.xCoord = newOBJAttr1Val & this.spriteENUMS["XCOORD"];
  this.xCoord = this.xCoord >= 256 ? -1 * ((~(this.xCoord - 1)) & 0x1FF) : this.xCoord;

  this.affineIndex = (newOBJAttr1Val & this.spriteENUMS["AFFINEINDEX"]) >>> 9;
  this.hflip = (newOBJAttr1Val & this.spriteENUMS["HFLIP"]) >>> 12;
  this.vflip = (newOBJAttr1Val & this.spriteENUMS["VFLIP"]) >>> 13;
  this.size = (newOBJAttr1Val & this.spriteENUMS["SIZE"]) >>> 14;

  this.bottomY = this.yCoord + (this.objHeightTable[this.size][this.shape] * (this.mode  === 3 ? 2 : 1));
  this.rightX = this.xCoord + (this.objWidthTable[this.size][this.shape] * (this.mode === 3 ? 2 : 1));
  this.spriteRowSize = this.objWidthTable[this.size][this.shape] << (2 + this.bpp8); //(this.objWidthTable[this.size][this.shape] >>> 3) * (0x20 << this.bpp8)
};

sprite.prototype.updateOBJAttr2 = function (newOBJAttr2Val) {
  this.tileIndex = newOBJAttr2Val & this.spriteENUMS["TILEINDEX"];
  this.palBankIndex = (newOBJAttr2Val & this.spriteENUMS["PALBANKINDEX"]) >>> 12;

  //'priority' === obj layer num
  this.priority = this.objectLayer.updateSpritesPerPBG(this.priority, (newOBJAttr2Val & this.spriteENUMS["PRIORITY"]) >>> 10);
};

sprite.prototype.renderScanlineNormal = function (PBGs, scanline) {
	let hflip = this.hflip;
	let vflip = this.vflip;
	let numTilesRender = Math.ceil((Math.min(this.rightX, 240) - this.xCoord) / 8);
	let tileOffset = (0x20 << this.bpp8) * (hflip ? -1 : 1);
	let tileLine = (scanline - this.yCoord) % 8;
	let tileAddr = 0x10000 //add 4 char block offset
	+ (this.tileIndex * 0x20)  //add start tile offset
	+ (((vflip ? (this.bottomY - (scanline + 1)) : (scanline - this.yCoord)) >>> 3) * (this.mappingMode ? this.spriteRowSize : 1024)) //add tile row offset
	+ (hflip ? ((numTilesRender - 1) * (0x20 << this.bpp8)) : 0); //add tile number offset
	let writeTileToScanline = this.bpp8 ? this.writeTileToScanlineBPP8 : this.writeTileToScanlineBPP4;
	let scanlineArrIndex = this.xCoord;
	let scanlineArr = PBGs[this.priority];
	let vramMem = this.vramMem;
	let paletteRamMem16 = this.paletteRamMem16;
	let palBankIndex = this.palBankIndex;
	let transparentBit = this.transparentBit;

	for (let i = 0; i < numTilesRender; i ++)
	{
		if (scanlineArrIndex >= -7) //only render if on screen
		{
			if (scanlineArrIndex < 0)
			{
				writeTileToScanline(tileAddr, tileLine, 0, vramMem, paletteRamMem16, scanlineArr, hflip, vflip,  0 - scanlineArrIndex, transparentBit, palBankIndex);
			}
			else
			{
				writeTileToScanline(tileAddr, tileLine, scanlineArrIndex, vramMem, paletteRamMem16, scanlineArr, hflip, vflip, 0, transparentBit, palBankIndex);
			}
		}
		scanlineArrIndex += 8;
		tileAddr += tileOffset;
	}
};

sprite.prototype.writeTileToScanlineBPP4 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip, startPixel, transparentBit, palBankIndex) {
  tileAddr += 4 * (vflip ? (7 - tileLine) : tileLine);
  palBankIndex <<= 4;
  if (hflip)
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = (vramMem8[tileAddr + ((7 - i) >>> 1)] >>> (4 * ((i + 1) & 1)) ) & 15;
      scanlineArr[scanlineArrIndex] = paletteIndex ? (paletteRamMem16[paletteIndex + palBankIndex + 0x100] & 0x7FFF) | transparentBit : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
  else
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = (vramMem8[tileAddr + (i >>> 1)] >>> (4 * (i & 1))) & 15;
      scanlineArr[scanlineArrIndex] = paletteIndex ? (paletteRamMem16[paletteIndex + palBankIndex + 0x100] & 0x7FFF) | transparentBit : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
};

sprite.prototype.writeTileToScanlineBPP8 = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, paletteRamMem16, scanlineArr, hflip, vflip, startPixel, transparentBit) {
  tileAddr += 8 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = vramMem8[tileAddr + 7 - i];
      scanlineArr[scanlineArrIndex] = paletteIndex ? (paletteRamMem16[paletteIndex + 0x100] & 0x7FFF) | transparentBit : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
  else
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = vramMem8[tileAddr + i];
      scanlineArr[scanlineArrIndex] = paletteIndex ? (paletteRamMem16[paletteIndex + 0x100] & 0x7FFF) | transparentBit : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
};

sprite.prototype.renderScanlineAffine = function (PBGs, scanline) {
	let spriteRowSize = this.mappingMode ? this.spriteRowSize : 1024;
	let OBJAffine = this.OBJAffines[this.affineIndex];
	let scanlineArr = PBGs[this.priority];
	let bpp8 = this.bpp8;
	let baseTileAddr = 0x10000 //add 4 char block offset
	+ (this.tileIndex * 0x20);  //add start tile offset
	let vramMem = this.vramMem;
	let paletteRamMem16 = this.paletteRamMem16;
	let palBankIndex = this.palBankIndex;
	let getColor = this.bpp8 ? this.getColorBPP8 : this.getColorBPP4;
	let transparentBit = this.transparentBit;

	let halfHeight = (this.objHeightTable[this.size][this.shape] >>> 1);
	let halfWidth = (this.objWidthTable[this.size][this.shape] >>> 1);

	let endPixel = Math.min(this.rightX, 240);

	//relative coords refer to position relative to sprite origin, regular coords refer to position on screen
	let relativeXCoord = this.mode === 3 ? -halfWidth : 0;
	let relativeYCoord = scanline - this.yCoord - (this.mode === 3 ? halfHeight : 0);
	let pb = (relativeYCoord - halfHeight) * OBJAffine.pb;
	let pd = (relativeYCoord - halfHeight) * OBJAffine.pd;

	let pa = (relativeXCoord - halfWidth + (-1 * Math.min(this.xCoord, 0))) * OBJAffine.pa;
	let pc = (relativeXCoord - halfWidth + (-1 * Math.min(this.xCoord, 0))) * OBJAffine.pc;

	for (let i = Math.max(this.xCoord, 0); i < endPixel; i ++)
	{
		let textureXCoord = (pa + pb) >> 8;
		let textureYCoord = (pc + pd) >> 8;

		if (((textureXCoord >= -halfWidth) && (textureXCoord < halfWidth)) && ((textureYCoord >= -halfHeight) && (textureYCoord < halfHeight)))
		{
			let xDiff = textureXCoord + halfWidth;
			let yDiff = textureYCoord + halfHeight;
			let tileAddr = baseTileAddr + ((yDiff >>> 3) * spriteRowSize) + ((xDiff >>> 3) * (0x20 << bpp8));

			scanlineArr[i] = getColor(tileAddr, xDiff, yDiff, vramMem, scanlineArr[i], paletteRamMem16, transparentBit, palBankIndex);
		}

 		pa += OBJAffine.pa;
 		pc += OBJAffine.pc;
	}
};

sprite.prototype.getColorBPP4 = function(tileAddr, xDiff, yDiff, vramMem8, underColor, paletteRamMem16, transparentBit, palBankIndex) {
	tileAddr += (4 * (yDiff % 8)) + ((xDiff % 8) >>> 1); //get color addr in tile

	let paletteIndex = (vramMem8[tileAddr] >>> ((xDiff & 1) << 2)) & 15;
	return paletteIndex ? (paletteRamMem16[paletteIndex + (palBankIndex << 4) + 0x100] & 0x7FFF) | transparentBit : underColor;
};

sprite.prototype.getColorBPP8 = function(tileAddr, xDiff, yDiff, vramMem8, underColor, paletteRamMem16, transparentBit) {
	tileAddr += (8 * (yDiff % 8)) + (xDiff % 8); //get color addr in tile

	return vramMem8[tileAddr] ? (paletteRamMem16[vramMem8[tileAddr] + 0x100] & 0x7FFF) | transparentBit : underColor;
};


//Window versions
sprite.prototype.renderScanlineNormalWindow = function (scanlineArr, scanline) {
	let hflip = this.hflip;
	let vflip = this.vflip;
	let numTilesRender = Math.ceil((Math.min(this.rightX, 240) - this.xCoord) / 8);
	let tileOffset = (0x20 << this.bpp8) * (hflip ? -1 : 1);
	let tileLine = (scanline - this.yCoord) % 8;
	let tileAddr = 0x10000 //add 4 char block offset
	+ (this.tileIndex * 0x20)  //add start tile offset
	+ (((vflip ? (this.bottomY - (scanline + 1)) : (scanline - this.yCoord)) >>> 3) * (this.mappingMode ? this.spriteRowSize : 1024)) //add tile row offset
	+ (hflip ? ((numTilesRender - 1) * (0x20 << this.bpp8)) : 0); //add tile number offset
	let writeTileToScanlineWindow = this.bpp8 ? this.writeTileToScanlineBPP8Window : this.writeTileToScanlineBPP4Window;
	let scanlineArrIndex = this.xCoord;
	let vramMem = this.vramMem;

	for (let i = 0; i < numTilesRender; i ++)
	{
		if (scanlineArrIndex >= -7) //only render if on screen
		{
			if (scanlineArrIndex < 0)
			{
				writeTileToScanlineWindow(tileAddr, tileLine, 0, vramMem, scanlineArr, hflip, vflip,  0 - scanlineArrIndex);
			}
			else
			{
				writeTileToScanlineWindow(tileAddr, tileLine, scanlineArrIndex, vramMem, scanlineArr, hflip, vflip, 0);
			}
		}
		scanlineArrIndex += 8;
		tileAddr += tileOffset;
	}
};

sprite.prototype.writeTileToScanlineBPP4Window = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, scanlineArr, hflip, vflip, startPixel) {
  tileAddr += 4 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = (vramMem8[tileAddr + ((7 - i) >>> 1)] >>> (4 * ((i + 1) & 1)) ) & 15;
      scanlineArr[scanlineArrIndex] = paletteIndex ? 3 : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
  else
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = (vramMem8[tileAddr + (i >>> 1)] >>> (4 * (i & 1))) & 15;
      scanlineArr[scanlineArrIndex] = paletteIndex ? 3 : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
};

sprite.prototype.writeTileToScanlineBPP8Window = function (tileAddr, tileLine, scanlineArrIndex, vramMem8, scanlineArr, hflip, vflip, startPixel) {
  tileAddr += 8 * (vflip ? (7 - tileLine) : tileLine);
  if (hflip)
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = vramMem8[tileAddr + 7 - i];
      scanlineArr[scanlineArrIndex] = paletteIndex ? 3 : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
  else
  {
    for (let i = startPixel; i < 8; i ++)
    {
      let paletteIndex = vramMem8[tileAddr + i];
      scanlineArr[scanlineArrIndex] = paletteIndex ? 3 : scanlineArr[scanlineArrIndex];
      scanlineArrIndex ++;
    }
  }
};

sprite.prototype.renderScanlineAffineWindow = function (scanlineArr, scanline) {
	let spriteRowSize = this.mappingMode ? this.spriteRowSize : 1024;
	let OBJAffine = this.OBJAffines[this.affineIndex];
	let bpp8 = this.bpp8;
	let baseTileAddr = 0x10000 //add 4 char block offset
	+ (this.tileIndex * 0x20);  //add start tile offset
	let vramMem = this.vramMem;
	let getColorWindow = this.bpp8 ? this.getColorBPP8Window : this.getColorBPP4Window;

	let halfHeight = (this.objHeightTable[this.size][this.shape] >>> 1);
	let halfWidth = (this.objWidthTable[this.size][this.shape] >>> 1);

	let endPixel = Math.min(this.rightX, 240);

	let relativeXCoord = this.mode === 3 ? -halfWidth : 0;
	let relativeYCoord = scanline - this.yCoord - (this.mode === 3 ? halfHeight : 0);
	let pb = (relativeYCoord - halfHeight) * OBJAffine.pb;
	let pd = (relativeYCoord - halfHeight) * OBJAffine.pd;

	let pa = (relativeXCoord - halfWidth + (-1 * Math.min(this.xCoord, 0))) * OBJAffine.pa;
	let pc = (relativeXCoord - halfWidth + (-1 * Math.min(this.xCoord, 0))) * OBJAffine.pc;

	for (let i = Math.max(this.xCoord, 0); i < endPixel; i ++)
	{
		let textureXCoord = (pa + pb) >> 8;
		let textureYCoord = (pc + pd) >> 8;

		if (((textureXCoord >= -halfWidth) && (textureXCoord < halfWidth)) && ((textureYCoord >= -halfHeight) && (textureYCoord < halfHeight)))
		{
			let xDiff = textureXCoord + halfWidth;
			let yDiff = textureYCoord + halfHeight;
			let tileAddr = baseTileAddr + ((yDiff >>> 3) * spriteRowSize) + ((xDiff >>> 3) * (0x20 << bpp8));

			scanlineArr[i] = getColorWindow(tileAddr, xDiff, yDiff, vramMem, scanlineArr[i]);
		}

 		pa += OBJAffine.pa;
 		pc += OBJAffine.pc;
	}
};

sprite.prototype.getColorBPP4Window = function(tileAddr, xDiff, yDiff, vramMem8, underColor) {
	tileAddr += (4 * (yDiff % 8)) + ((xDiff % 8) >>> 1); //get color addr in tile

	let paletteIndex = (vramMem8[tileAddr] >>> ((xDiff & 1) << 2)) & 15;
	return paletteIndex ? 3 : underColor;
};

sprite.prototype.getColorBPP8Window = function(tileAddr, xDiff, yDiff, vramMem8, underColor) {
	tileAddr += (8 * (yDiff % 8)) + (xDiff % 8); //get color addr in tile

	return vramMem8[tileAddr] ? 3 : underColor;
};


sprite.prototype.shouldRender = function (scanline) {
	return this.display 
	&& ((scanline >= this.yCoord) && (scanline < this.bottomY)) 
	&& (((this.xCoord >= 0) && (this.xCoord < 240)) || ((this.rightX >= 0) && (this.rightX < 240)));
};

sprite.prototype.shouldRenderWindow = function (scanline) {
	return !((this.mode === 2) || (this.gfxMode !== 2))
	&& ((scanline >= this.yCoord) && (scanline < this.bottomY)) 
	&& (((this.xCoord >= 0) && (this.xCoord < 240)) || ((this.rightX >= 0) && (this.rightX < 240)));
};




const OBJAffine = function (OBJAffineIORegPA, OBJAffineIORegPB, OBJAffineIORegPC, OBJAffineIORegPD, objAffineNum){
	this.pa = 0;
	this.pb = 0;
	this.pc = 0;
	this.pd = 0;
	this.objAffineNum = objAffineNum;

	OBJAffineIORegPA.addCallback((newPAVal) => {this.updatePA(newPAVal)});
	OBJAffineIORegPB.addCallback((newPBVal) => {this.updatePB(newPBVal)});
	OBJAffineIORegPC.addCallback((newPCVal) => {this.updatePC(newPCVal)});
	OBJAffineIORegPD.addCallback((newPDVal) => {this.updatePD(newPDVal)});
};

OBJAffine.prototype.updatePA = function(newPAVal) {
	//console.log(newPAVal + " from " + this.objAffineNum);
	this.pa = newPAVal & 32768 ? -1 * (~(newPAVal - 1) & 0xFFFF) : newPAVal;
};

OBJAffine.prototype.updatePB = function(newPBVal) {
	//console.log(newPBVal + " from " + this.objAffineNum);
	this.pb = newPBVal & 32768 ? -1 * (~(newPBVal - 1) & 0xFFFF) : newPBVal;
};

OBJAffine.prototype.updatePC = function(newPCVal) {
	//console.log(newPCVal + " from " + this.objAffineNum);
	this.pc = newPCVal & 32768 ? -1 * (~(newPCVal - 1) & 0xFFFF) : newPCVal;
};

OBJAffine.prototype.updatePD = function(newPDVal) {
	//console.log(newPDVal + " from " + this.objAffineNum);
	this.pd = newPDVal & 32768 ? -1 * (~(newPDVal - 1) & 0xFFFF) : newPDVal;
};
