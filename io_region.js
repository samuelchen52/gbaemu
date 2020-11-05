const ioRegion = function() {

	let ioregENUMS = {IOREG : 0, IOREGREADONLY : 1, IOREGWRITEONLY : 2, IOREGBYTE : 3, IOREGBYTEWRITEONLY : 4, IOREGWORD : 5, IOREGWORDWRITEONLY : 6, IOREGIF : 7, IOREGDISPSTAT : 8, UNUSED : 9};

	this.memory = new Uint8Array(1024);
	this.ioregs = [];
	let ioregInitArr = [
	//LCD IO REGISTERS
	{name: "DISPCNT", type: ioregENUMS["IOREG"]},
	{name: "GREENSWAP", type: ioregENUMS["IOREG"]},
	{name: "DISPSTAT", type: ioregENUMS["IOREGDISPSTAT"]},
	{name: "VCOUNT", type: ioregENUMS["IOREGREADONLY"]},
	{name: "BG0CNT", type: ioregENUMS["IOREG"]},
	{name: "BG1CNT", type: ioregENUMS["IOREG"]},
	{name: "BG2CNT", type: ioregENUMS["IOREG"]},
	{name: "BG3CNT", type: ioregENUMS["IOREG"]},
	{name: "BG0HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG0VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG1HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG1VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PA", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PB", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PC", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PD", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2X", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "BG2Y", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "BG3PA", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3PB", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3PC", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3PD", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3X", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "BG3Y", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "WIN0H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WIN1H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WIN0V", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WIN1V", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WININ", type: ioregENUMS["IOREG"]},
	{name: "WINOUT", type: ioregENUMS["IOREG"]},
	{name: "MOSAIC", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "BLDCNT", type: ioregENUMS["IOREG"]},
	{name: "BLDALPHA", type: ioregENUMS["IOREG"]},
	{name: "BLDY", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(4)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//SOUND IO REGISTERS
	{name: "SOUND1CNT_L", type: ioregENUMS["IOREG"]},
	{name: "SOUND1CNT_H", type: ioregENUMS["IOREG"]},
	{name: "SOUND1CNT_X", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND2CNT_L", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND2CNT_H", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND3CNT_L", type: ioregENUMS["IOREG"]},
	{name: "SOUND3CNT_H", type: ioregENUMS["IOREG"]},
	{name: "SOUND3CNT_X", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND4CNT_L", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND4CNT_H", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUNDCNT_L", type: ioregENUMS["IOREG"]},
	{name: "SOUNDCNT_H", type: ioregENUMS["IOREG"]},
	{name: "SOUNDCNT_X", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUNDBIAS", type: ioregENUMS["IOREGREADONLY"]}, // type is actually BIOS, implement later
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "REG_WAVE_RAM0_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM0_H", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM1_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM1_H", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM2_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM2_H", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM3_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM3_H", type: ioregENUMS["IOREG"]},
	{name: "REG_FIFO_A_L", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "REG_FIFO_A_H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "REG_FIFO_B_L", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "REG_FIFO_B_H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(3)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//DMA IO REGISTERS
	{name: "DMA0SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA0DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA0CNT_L", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA0CNT_H", type: ioregENUMS["IOREG"]},
	{name: "DMA1SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA1DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA1CNT_L", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA1CNT_H", type: ioregENUMS["IOREG"]},
	{name: "DMA2SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA2DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA2CNT_L", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA2CNT_H", type: ioregENUMS["IOREG"]},
	{name: "DMA3SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA3DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA3CNT_L", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA3CNT_H", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(15)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//TIMER IO REGISTERS
	{name: "TM0CNT_L", type: ioregENUMS["IOREG"]},
	{name: "TM0CNT_H", type: ioregENUMS["IOREG"]},
	{name: "TM1CNT_L", type: ioregENUMS["IOREG"]},
	{name: "TM1CNT_H", type: ioregENUMS["IOREG"]},
	{name: "TM2CNT_L", type: ioregENUMS["IOREG"]},
	{name: "TM2CNT_H", type: ioregENUMS["IOREG"]},
	{name: "TM3CNT_L", type: ioregENUMS["IOREG"]},
	{name: "TM3CNT_H", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(7)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//SERIAL COMMUNICATION (1) IO REGISTERS
	{name: "SIOMULTI0", type: ioregENUMS["IOREG"]},
	{name: "SIOMULTI1", type: ioregENUMS["IOREG"]},
	{name: "SIOMULTI2", type: ioregENUMS["IOREG"]},
	{name: "SIOMULTI3", type: ioregENUMS["IOREG"]},
	{name: "SIOCNT", type: ioregENUMS["IOREG"]},
	{name: "SIODATA8", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(1)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//KEYPAD INPUT IO REGISTERS
	{name: "KEYINPUT", type: ioregENUMS["IOREGREADONLY"]},
	{name: "KEYCNT", type: ioregENUMS["IOREG"]},
	//SERIAL COMMUNICATION (2) IO REGISTERS
	{name: "RCNT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "JOYCNT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "JOY_RECV", type: ioregENUMS["IOREGWORD"]},
	{name: "JOY_TRANS", type: ioregENUMS["IOREGWORD"]},
	{name: "JOYSTAT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(82)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//INTERRUPT, WAITSTATE, AND POWERDOWN CONTROL IO REGISTERS
	{name: "IE", type: ioregENUMS["IOREG"]},
	{name: "IF", type: ioregENUMS["IOREGIF"]},
	{name: "WAITCNT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "IME", type: ioregENUMS["IOREG"]},
	...(new Array(123)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	{name: "POSTFLG", type: ioregENUMS["IOREGBYTE"]},
	{name: "HALTCNT", type: ioregENUMS["IOREGBYTEWRITEONLY"]},
	...(new Array(136)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	];

	//initialize ioregs array
	let unusedreg = new ioRegUnused("UNUSED", this.memory, this.ioregs, -1);
	let ioregAddr = 0;
	let newioreg;
	let size;
	for (let i = 0; i < ioregInitArr.length; i ++)
	{
		switch(ioregInitArr[i]["type"])
		{
			case ioregENUMS["IOREG"]: newioreg = new ioReg(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGREADONLY"]: newioreg = new ioRegReadOnly(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGWRITEONLY"]: newioreg = new ioRegWriteOnly(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGBYTE"]: newioreg = new ioRegByte(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 1; break;
			case ioregENUMS["IOREGBYTEWRITEONLY"]: newioreg = new ioRegByteWriteOnly(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 1; break;
			case ioregENUMS["IOREGWORD"]: newioreg = new ioRegWord(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 4; break;
			case ioregENUMS["IOREGWORDWRITEONLY"]: newioreg = new ioRegWordWriteOnly(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 4; break;
			case ioregENUMS["IOREGIF"]: newioreg = new ioRegIF(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGDISPSTAT"]: newioreg = new ioRegDISPSTAT(ioregInitArr[i]["name"], this.memory, this.ioregs, ioregAddr); size = 2; break;
			case ioregENUMS["UNUSED"]: newioreg = unusedreg; size = 2; break;
			default: throw Error("undefined IO register type!");
		}
		for (let p = 0; p < size; p ++)
		{
			this.ioregs.push(newioreg);
		}
		ioregAddr += size;
	}

	//this.getIOReg("IE").addCallback(()=> {console.log("THIS ROM IS USING INTERRUPTS!!")});
	this.getIOReg("DMA0SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	this.getIOReg("DMA1SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	this.getIOReg("DMA2SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	this.getIOReg("DMA3SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	this.getIOReg("TM0CNT_L").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	this.getIOReg("TM1CNT_L").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	this.getIOReg("TM2CNT_L").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	this.getIOReg("TM3CNT_L").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	//this.getIOReg("HALTCNT").addCallback(()=> {console.log("THIS ROM IS USING HALT!!")});
}

ioRegion.prototype.read8 = function (memAddr) {
	return this.ioregs[memAddr].read8(memAddr);
}

ioRegion.prototype.read16 = function (memAddr) {
	return this.ioregs[memAddr].read16(memAddr);
}

ioRegion.prototype.read32 = function (memAddr) {
	return this.ioregs[memAddr].read32(memAddr);
}

ioRegion.prototype.write8 = function (memAddr, val) {
	this.ioregs[memAddr].write8(memAddr, val);
	this.ioregs[memAddr].triggerCallbacks();
}

ioRegion.prototype.write16 = function (memAddr, val) {
	this.ioregs[memAddr].write16(memAddr, val);
	this.ioregs[memAddr].triggerCallbacks();
}

ioRegion.prototype.write32 = function (memAddr, val) {
	this.ioregs[memAddr].write32(memAddr, val);
	this.ioregs[memAddr].triggerCallbacks();

}

ioRegion.prototype.getIOReg = function (name) {
	for (let i = 0; i < this.ioregs.length; i++)
	{
		if (this.ioregs[i].name === name)
		{
			return this.ioregs[i];
		}
	}
	throw Error("failed to retrieve ioreg: " + name);
}
