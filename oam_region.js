const oamRegion = function() {
	this.memory = new Uint8Array(1024);
	this.ioregs = [];

	//sprite data is stored in OAM (object attribute memory)
	//there are 128 sprites, each has their own attributes
	//there are three attributes for each sprite, each taking up two bytes (6 bytes for all attributes)
	//these six bytes are contiguous, and followed by another two bytes used for object rotation/scaling
	//the two bytes in between each six bytes of attributes together are 128 x 2 bytes === 256 bytes in total
	//these 256 bytes define 32 groups of rotation / scaling parameters (of which there are 4, each taking 2 bytes each)

	//initialize ioregs array
	let objNum = 0;
	for (let i = 0; i < 1024; i += 8)
	{ 
		let newOBJAttr0IOReg = new ioReg("OBJ" + objNum + "ATTR0", this.memory, this.ioregs, i);
		let newOBJAttr1IOReg = new ioReg("OBJ" + objNum + "ATTR1", this.memory, this.ioregs, i + 2);
		let newOBJAttr2IOReg = new ioReg("OBJ" + objNum + "ATTR2", this.memory, this.ioregs, i + 4);
		let newOBJAffineIOReg = new ioReg("OBJ" + objNum + "AFFINE", this.memory, this.ioregs, i + 6);

		this.ioregs.push(newOBJAttr0IOReg);
		this.ioregs.push(newOBJAttr0IOReg);

		this.ioregs.push(newOBJAttr1IOReg);
		this.ioregs.push(newOBJAttr1IOReg);

		this.ioregs.push(newOBJAttr2IOReg);
		this.ioregs.push(newOBJAttr2IOReg);	

		this.ioregs.push(newOBJAffineIOReg);
		this.ioregs.push(newOBJAffineIOReg);	
		
		objNum ++;
	}
};

oamRegion.prototype.read8 = function (memAddr) {
	return this.ioregs[memAddr].read8(memAddr);
};

oamRegion.prototype.read16 = function (memAddr) {
	return this.ioregs[memAddr].read16(memAddr);
};

oamRegion.prototype.read32 = function (memAddr) {
	return this.ioregs[memAddr].read32(memAddr);
};

oamRegion.prototype.write8 = function (memAddr, val) {
	console.log("not implemented: writing byte to OAM at mem addr: " + (memAddr >>> 0).toString(16));
};

oamRegion.prototype.write16 = function (memAddr, val) {
	// console.log(memAddr);
	// console.log(this.ioregs);
	this.ioregs[memAddr].write16(memAddr, val);
	this.ioregs[memAddr].triggerCallbacks();
};

oamRegion.prototype.write32 = function (memAddr, val) {
	//console.log(memAddr + ": " + val.toString(16));
	//console.log(this.ioregs.length);
	this.ioregs[memAddr].write32(memAddr, val);
	this.ioregs[memAddr].triggerCallbacks();

};

oamRegion.prototype.getOBJAffineIORegs = function () {
	let arr = [];
	for (let i = 0; i < 1024; i += 8)
	{
		arr.push(this.ioregs[i + 6]);
	}
	return arr;
};

oamRegion.prototype.getIOReg = function (name) {
	for (let i = 0; i < this.ioregs.length; i++)
	{
		if (this.ioregs[i].name === name)
		{
			return this.ioregs[i];
		}
	}
	throw Error("failed to retrieve ioreg: " + name);
};
