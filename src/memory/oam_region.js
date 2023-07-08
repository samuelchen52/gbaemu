const oamRegion = function() {
	this.memory = new Uint8Array(1024);
	this.memory16 = new Uint16Array(this.memory.buffer);
	this.memory32 = new Uint32Array(this.memory.buffer);
	this.ioRegs = [];

	//sprite data is stored in OAM (object attribute memory)
	//there are 128 sprites, each has their own attributes
	//there are three attributes for each sprite, each taking up two bytes (6 bytes for all attributes)
	//these six bytes are contiguous, and followed by another two bytes used for object rotation/scaling
	//the two bytes in between each six bytes of attributes together are 128 x 2 bytes === 256 bytes in total
	//these 256 bytes define 32 groups of rotation / scaling parameters (of which there are 4, each taking 2 bytes each)

	//initialize ioRegs array
	let objNum = 0;
	for (let i = 0; i < 1024; i += 8)
	{ 
		let newOBJAttr0IOReg = new ioReg("OBJ" + objNum + "ATTR0", this, i);
		let newOBJAttr1IOReg = new ioReg("OBJ" + objNum + "ATTR1", this, i + 2);
		let newOBJAttr2IOReg = new ioReg("OBJ" + objNum + "ATTR2", this, i + 4);
		let newOBJAffineIOReg = new ioReg("OBJ" + objNum + "AFFINE", this, i + 6);

		this.ioRegs.push(newOBJAttr0IOReg);
		this.ioRegs.push(newOBJAttr0IOReg);

		this.ioRegs.push(newOBJAttr1IOReg);
		this.ioRegs.push(newOBJAttr1IOReg);

		this.ioRegs.push(newOBJAttr2IOReg);
		this.ioRegs.push(newOBJAttr2IOReg);	

		this.ioRegs.push(newOBJAffineIOReg);
		this.ioRegs.push(newOBJAffineIOReg);	
		
		objNum ++;
	}
};

oamRegion.prototype.read8 = function (memAddr) {
	return this.ioRegs[memAddr].read8(memAddr);
};

oamRegion.prototype.read16 = function (memAddr) {
	return this.ioRegs[memAddr].read16(memAddr);
};

oamRegion.prototype.read32 = function (memAddr) {
	return this.ioRegs[memAddr].read32(memAddr);
};

oamRegion.prototype.write8 = function (memAddr, val) {
	console.log("not implemented: writing byte to OAM at mem addr: " + (memAddr >>> 0).toString(16));
};

oamRegion.prototype.write16 = function (memAddr, val) {
	this.ioRegs[memAddr].write16(memAddr, val);
};

oamRegion.prototype.write32 = function (memAddr, val) {
	this.ioRegs[memAddr].write32(memAddr, val);
};

oamRegion.prototype.getOBJAffineIORegs = function () {
	let arr = [];
	for (let i = 0; i < 1024; i += 8)
	{
		arr.push(this.ioRegs[i + 6]);
	}
	return arr;
};

oamRegion.prototype.getIOReg = function (name) {
	for (let i = 0; i < this.ioRegs.length; i++)
	{
		if (this.ioRegs[i].name === name)
		{
			return this.ioRegs[i];
		}
	}
	throw Error("failed to retrieve ioreg: " + name);
};

//returns JSON of inner state
oamRegion.prototype.serialize = function() {
	let copy = {};

	copy.memory = [...compressBinaryData(this.memory, 1)];

	return copy;
}
  
oamRegion.prototype.setState = function(saveState) {
	copyArrIntoArr(decompressBinaryData(new Uint8Array(saveState.memory), 1), this.memory);
}