const objectLayer = function(vramMem, paletteRamMem16, oamMem, graphics) {
  this.sprites = [];
  this.OBJAffines = [];
  this.PBGs = [new Uint16Array(248), new Uint16Array(248), new Uint16Array(248), new Uint16Array(248)];
  this.spritesPerPBG = [128, 0, 0, 0];

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
  	this.sprites.push(new sprite(vramMem, paletteRamMem16, this.OBJAffines, oamMem.getIOReg("OBJ" + i + "ATTR0"), oamMem.getIOReg("OBJ" + i + "ATTR1"), oamMem.getIOReg("OBJ" + i + "ATTR2"), this, i) );
  }

  this.graphics = graphics;
};

objectLayer.prototype.renderScanline = function (scanline) {
	let sprites = this.sprites;
	let PBGs = this.PBGs;
  let spritesPerPBG = this.spritesPerPBG;

  if (spritesPerPBG[0])
    PBGs[0].fill(0x8000);
  if (spritesPerPBG[1])
    PBGs[1].fill(0x8000);
  if (spritesPerPBG[2])
    PBGs[2].fill(0x8000);
  if (spritesPerPBG[3])
    PBGs[3].fill(0x8000);

	for (let i = 127; i >= 0; i--)
	{
		if (sprites[i].shouldRender(scanline))
		{
			sprites[i].renderScanline[sprites[i].mode](PBGs, scanline);
		}
	}
};

objectLayer.prototype.updateSpritesPerPBG = function (oldPrio, newPrio) {
  if (oldPrio !== newPrio)
  {
    this.spritesPerPBG[oldPrio] --;
    this.spritesPerPBG[newPrio] ++;

    if (this.spritesPerPBG[oldPrio] === 0)
    {
      this.graphics.updateObjLayerDisplay(this.graphics.objLayerNumToLayerIndex[oldPrio], 0);
    }
    if (this.spritesPerPBG[newPrio] === 1)
    {
      this.graphics.updateObjLayerDisplay(this.graphics.objLayerNumToLayerIndex[newPrio], 1);
    }
  }

  return newPrio;
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

