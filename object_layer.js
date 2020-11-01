const objectLayer = function(vramMem, paletteRamMem, oamMem) {
	this.scanlineArrIndex = 0;
  this.scanlineArr = new Uint16Array(248);

  this.sprites = [];
  this.phantomBGS = [new Uint16Array(248), new Uint16Array(248), new Uint16Array(248), new Uint16Array(248)];
  // this.phantomBG0 = new Uint16Array(248);
  // this.phantomBG1 = new Uint16Array(248);
  // this.phantomBG2 = new Uint16Array(248);
  // this.phantomBG3 = new Uint16Array(248);


  //initialize all sprites
  let OBJAffines = oamMem.getOBJAffines();
  for (let i = 0; i < 128; i ++)
  {
  	this.sprites.push( new sprite(vramMem, paletteRamMem, OBJAffines, oamMem.getIOReg("OBJ${i}ATTR0"), oamMem.getIOReg("OBJ${i}ATTR1"), oamMem.getIOReg("OBJ${i}ATTR2"), i) );
  }
};

objectLayer.prototype.renderScanline = function (scanline) {
	let sprites = this.sprites;
	let phantomBGS = this.phantomBGS;
	phantomBGS[0] = this.phantomBG0.fill(0x8000);
  phantomBGS[1] = this.phantomBG1.fill(0x8000);
  phantomBG2[2] = this.phantomBG2.fill(0x8000);
  phantomBGS[3] = this.phantomBG3.fill(0x8000);

	for (let i = 0; i < 128; i ++)
	{
		if (sprites[i].shouldRender(scanline))
		{
			sprites[i].renderScanline(phantomBGS)
		}
	}



};

