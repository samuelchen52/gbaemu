const objectLayer = function(graphics, mmu) {
  this.sprites = [];
  this.OBJAffines = [];
  this.PBGs = [new Uint16Array(248), new Uint16Array(248), new Uint16Array(248), new Uint16Array(248)]; //'phantom' backgrounds, one for each object priority (0 - 3)
  this.spritesPerPBG = [128, 0, 0, 0];

  this.mappingMode = 0; //0 - 2d, 1 - 1d

  //initialize all OBJ Affine Parameter objects
  let oamMem = mmu.getMemoryRegion("OAM");
  let OBJAffineIORegs = oamMem.getOBJAffineIORegs();
  for (let i = 0; i < 128; i += 4)
  {
  	this.OBJAffines.push(new OBJAffine(OBJAffineIORegs[i], OBJAffineIORegs[i + 1], OBJAffineIORegs[i + 2], OBJAffineIORegs[i + 3], i >>> 2));
  }

  //initialize all sprites
  for (let i = 0; i < 128; i ++)
  {
  	this.sprites.push(new sprite(i, mmu, this, this.OBJAffines, oamMem.getIOReg("OBJ" + i + "ATTR0"), oamMem.getIOReg("OBJ" + i + "ATTR1"), oamMem.getIOReg("OBJ" + i + "ATTR2")) );
  }

  this.graphics = graphics;
};

objectLayer.prototype.renderScanline = function (scanline) {
	let sprites = this.sprites;
	let PBGs = this.PBGs;
  let spritesPerPBG = this.spritesPerPBG;

  if (spritesPerPBG[0])
    PBGs[0].fill(0x8888);
  if (spritesPerPBG[1])
    PBGs[1].fill(0x8888);
  if (spritesPerPBG[2])
    PBGs[2].fill(0x8888);
  if (spritesPerPBG[3])
    PBGs[3].fill(0x8888);

	for (let i = 127; i >= 0; i--)
	{
		if (sprites[i].shouldRender(scanline))
		{
			sprites[i].renderScanline[sprites[i].mode](PBGs, scanline);
		}
	}
};

//updates the number of sprites in a 'phantom' bg
objectLayer.prototype.updateSpritesPerPBG = function (oldPrio, newPrio) {
  if (oldPrio !== newPrio)
  {
    this.spritesPerPBG[oldPrio] --;
    this.spritesPerPBG[newPrio] ++;

    //'turn off' an object layer, since there are no more sprites with oldPrio
    if (this.spritesPerPBG[oldPrio] === 0)
    {
      this.graphics.updateObjLayerDisplay(oldPrio, 0);
    }
    //'turn on' an object layer, since a sprite just got changed to a prio that no other sprite has
    if (this.spritesPerPBG[newPrio] === 1)
    {
      this.graphics.updateObjLayerDisplay(newPrio, 1);
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

//returns JSON of inner state
objectLayer.prototype.serialize = function() {
  let copy = {};

  copy.PBGs = this.PBGs.map(x => [...x]);
  copy.spritesPerPBG = [...this.spritesPerPBG];
  
  copy.mappingMode = this.mappingMode;
  
  copy.OBJAffines = this.OBJAffines.map(x => x.serialize());
  copy.sprites = this.sprites.map(x => x.serialize());

  return copy;
}

objectLayer.prototype.setState = function(saveState) {
  //preserve type as typed arr, as typed arr serialized as normal array
  saveState.PBGs.forEach((arrToCopy, index) => {
    copyArrIntoArr(arrToCopy, this.PBGs[index]);
	});
  this.spritesPerPBG = [...saveState.spritesPerPBG];
  
  this.mappingMode = saveState.mappingMode;
  
  saveState.OBJAffines.forEach((x, index) => this.OBJAffines[index].setState(x));
  saveState.sprites.forEach((x, index) => this.sprites[index].setState(x));
}