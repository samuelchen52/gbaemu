const ioRegion = function() {

	let ioregENUMS = {IOREG : 0, IOREGREADONLY : 1, IOREGWRITEONLY : 2, IOREGBYTE : 3, IOREGBYTEWRITEONLY : 4, IOREGWORD : 5, IOREGWORDWRITEONLY : 6, IOREGIF : 7, IOREGDISPSTAT : 8, IOREGTMCNTL : 9, UNUSED : 10};

	this.memory = new Uint8Array(1024);
	this.memory16 = new Uint16Array(this.memory.buffer);
	this.memory32 = new Uint32Array(this.memory.buffer);
	this.ioRegs = [];
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
	{name: "WININ0", type: ioregENUMS["IOREGBYTE"]},
	{name: "WININ1", type: ioregENUMS["IOREGBYTE"]},
	{name: "WINOUT", type: ioregENUMS["IOREGBYTE"]},
	{name: "WINOBJ", type: ioregENUMS["IOREGBYTE"]},
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
	{name: "DMA0CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA0CNTH", type: ioregENUMS["IOREG"]},
	{name: "DMA1SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA1DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA1CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA1CNTH", type: ioregENUMS["IOREG"]},
	{name: "DMA2SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA2DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA2CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA2CNTH", type: ioregENUMS["IOREG"]},
	{name: "DMA3SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA3DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA3CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA3CNTH", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(15)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//TIMER IO REGISTERS
	{name: "TM0CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM0CNTH", type: ioregENUMS["IOREG"]},
	{name: "TM1CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM1CNTH", type: ioregENUMS["IOREG"]},
	{name: "TM2CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM2CNTH", type: ioregENUMS["IOREG"]},
	{name: "TM3CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM3CNTH", type: ioregENUMS["IOREG"]},
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
	let unusedreg = new ioRegUnused("UNUSED", this, -1);
	let ioregAddr = 0;
	let newioreg;
	let size;
	for (let i = 0; i < ioregInitArr.length; i ++)
	{
		switch(ioregInitArr[i]["type"])
		{
			case ioregENUMS["IOREG"]: newioreg = new ioReg(ioregInitArr[i]["name"], this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGREADONLY"]: newioreg = new ioRegReadOnly(ioregInitArr[i]["name"], this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGWRITEONLY"]: newioreg = new ioRegWriteOnly(ioregInitArr[i]["name"], this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGBYTE"]: newioreg = new ioRegByte(ioregInitArr[i]["name"], this, ioregAddr); size = 1; break;
			case ioregENUMS["IOREGBYTEWRITEONLY"]: newioreg = new ioRegByteWriteOnly(ioregInitArr[i]["name"], this, ioregAddr); size = 1; break;
			case ioregENUMS["IOREGWORD"]: newioreg = new ioRegWord(ioregInitArr[i]["name"], this, ioregAddr); size = 4; break;
			case ioregENUMS["IOREGWORDWRITEONLY"]: newioreg = new ioRegWordWriteOnly(ioregInitArr[i]["name"], this, ioregAddr); size = 4; break;
			case ioregENUMS["IOREGIF"]: newioreg = new ioRegIF(ioregInitArr[i]["name"], this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGDISPSTAT"]: newioreg = new ioRegDISPSTAT(ioregInitArr[i]["name"], this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGTMCNTL"]: newioreg = new ioRegTMCNTL(ioregInitArr[i]["name"], this, ioregAddr); size = 2; break;
			case ioregENUMS["UNUSED"]: newioreg = unusedreg; size = 2; break;
			default: throw Error("undefined IO register type!");
		}
		for (let p = 0; p < size; p ++)
		{
			this.ioRegs.push(newioreg);
		}
		ioregAddr += size;
	}

	//this.getIOReg("IE").addCallback(()=> {console.log("THIS ROM IS USING INTERRUPTS!!")});
	// this.getIOReg("DMA0SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("DMA1SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("DMA2SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("DMA3SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("TM0CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	// this.getIOReg("TM1CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	// this.getIOReg("TM2CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	// this.getIOReg("TM3CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	//this.getIOReg("HALTCNT").addCallback(()=> {console.log("THIS ROM IS USING HALT!!")});
	//this.getIOReg("WAITCNT").addCallback(()=> {console.log("THIS ROM IS USING WAITCNT!!")});
	this.memory[this.getIOReg("SOUNDBIAS").regIndex + 1] = 0x2;
}

ioRegion.prototype.read8 = function (memAddr) {
	return this.ioRegs[memAddr].read8(memAddr);
}

ioRegion.prototype.read16 = function (memAddr) {
	return this.ioRegs[memAddr].read16(memAddr);
}

ioRegion.prototype.read32 = function (memAddr) {
	return this.ioRegs[memAddr].read32(memAddr);
}

ioRegion.prototype.write8 = function (memAddr, val) {
	this.ioRegs[memAddr].write8(memAddr, val);
}

ioRegion.prototype.write16 = function (memAddr, val) {
	this.ioRegs[memAddr].write16(memAddr, val);
}

ioRegion.prototype.write32 = function (memAddr, val) {
	this.ioRegs[memAddr].write32(memAddr, val);
}

ioRegion.prototype.getIOReg = function (name) {
	for (let i = 0; i < this.ioRegs.length; i++)
	{
		if (this.ioRegs[i].name === name)
		{
			return this.ioRegs[i];
		}
	}
	throw Error("failed to retrieve ioreg: " + name);
}

ioRegion.prototype.dumpMemory = function (memAddr) {
	let memory = this.memory;
	let numBytes = 12 * 16 + memAddr;
	for (let i = memAddr; i < numBytes; i += 16)
	{
		let str = "";
		for (let p = 0; p < 16; p ++)
		{
			str += memory[i + p].toString(16).padStart(2, "0") + " "; 
		}
		console.log((i & 0xFF).toString(16).padStart(2, "0") + ": " + str);
	}
};


//returns JSON of inner state
ioRegion.prototype.serialize = function() {
	let copy = {};

	copy.memory = [...compressBinaryData(this.memory, 1)];

	return copy;
}
  
ioRegion.prototype.setState = function(saveState) {
	copyArrIntoArr(decompressBinaryData(new Uint8Array(saveState.memory), 1), this.memory);
}