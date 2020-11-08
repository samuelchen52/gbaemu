const objectLayer = function(vramMem, paletteRamMem16, oamMem) {
	this.scanlineArrIndex = 0;
  this.scanlineArr = new Uint16Array(248);

  this.sprites = [];
  this.OBJAffines = [];
  this.phantomBGS = [new Uint16Array(248), new Uint16Array(248), new Uint16Array(248), new Uint16Array(248)];
  
  this.mappingMode = 0; //0 - 2d, 1 - 1d


  //initialize all OBJ Affine Parameter objects
  let OBJAffineIORegs = oamMem.getOBJAffineIORegs();
  for (let i = 0; i < 128; i += 4)
  {
  	this.OBJAffines.push(new OBJAffine(OBJAffineIORegs[i], OBJAffineIORegs[i + 1], OBJAffineIORegs[i + 2], OBJAffineIORegs[i + 3], i >>> 2));
  }

  //initialize all sprites
  for (let i = 0; i < 128; i ++)
  {
  	this.sprites.push(new sprite(vramMem, paletteRamMem16, this.OBJAffines, oamMem.getIOReg("OBJ" + i + "ATTR0"), oamMem.getIOReg("OBJ" + i + "ATTR1"), oamMem.getIOReg("OBJ" + i + "ATTR2"), i) );
  }
};

objectLayer.prototype.renderScanline = function (scanline) {
	let sprites = this.sprites;
	let phantomBGS = this.phantomBGS;
	phantomBGS[0].fill(0x8000);
  phantomBGS[1].fill(0x8000);
  phantomBGS[2].fill(0x8000);
  phantomBGS[3].fill(0x8000);
  window.phantombg = phantomBGS[0];
  window.sprites = sprites;
  window.OBJAffines = this.OBJAffines;

	for (let i = 127; i >= 0; i--)
	{
		if (sprites[i].shouldRender(scanline))
		{
			sprites[i].renderScanline[sprites[i].mode](phantomBGS, scanline);
		}
	}
	return phantomBGS;
};

objectLayer.prototype.setMappingMode = function (mappingMode) {
	if (this.mappingMode !== mappingMode)
	{
		for (let i = 0; i < 128; i++)
		{
			this.sprites[i].mappingMode = mappingMode;
		}
		this.mappingMode = mappingMode;
	}
};

