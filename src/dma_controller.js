const DMAController = function(mmu, cpu, graphics, sound) {
	let ioregion = mmu.getMemoryRegion("IOREGISTERS");
	
	this.FIFOAAddress = ioregion.getIOReg("REG_FIFO_A").regIndex;
	this.FIFOBAddress = ioregion.getIOReg("REG_FIFO_B").regIndex;

	this.DMAChannel0 = new DMAChannel0(mmu, cpu, ioregion.getIOReg("DMA0SAD"), ioregion.getIOReg("DMA0DAD"), ioregion.getIOReg("DMA0CNTL"), ioregion.getIOReg("DMA0CNTH"), 0x7FFFFFF, 0x7FFFFFF, 0x3FFF, 1);
	this.DMAChannel1 = new DMAChannel12(mmu, cpu, ioregion.getIOReg("DMA1SAD"), ioregion.getIOReg("DMA1DAD"), ioregion.getIOReg("DMA1CNTL"), ioregion.getIOReg("DMA1CNTH"), 0xFFFFFFF, 0x7FFFFFF, 0x3FFF, 2);
	this.DMAChannel2 = new DMAChannel12(mmu, cpu, ioregion.getIOReg("DMA2SAD"), ioregion.getIOReg("DMA2DAD"), ioregion.getIOReg("DMA2CNTL"), ioregion.getIOReg("DMA2CNTH"), 0xFFFFFFF, 0x7FFFFFF, 0x3FFF, 4);
	this.DMAChannel3 = new DMAChannel3(mmu, cpu, ioregion.getIOReg("DMA3SAD"), ioregion.getIOReg("DMA3DAD"), ioregion.getIOReg("DMA3CNTL"), ioregion.getIOReg("DMA3CNTH"), 0xFFFFFFF, 0xFFFFFFF, 0xFFFF, 8);

	graphics.addCallbacks(this.triggerHblankDMA.bind(this), this.triggerVblankDMA.bind(this));
	sound.directSoundChannel5.addBufferDrainedCallback(this.triggerFIFOADMA.bind(this));
	sound.directSoundChannel6.addBufferDrainedCallback(this.triggerFIFOBDMA.bind(this));
};

DMAController.prototype.triggerVblankDMA = function () {
	this.DMAChannel0.startTransfer(this.DMAChannel0.enable && (this.DMAChannel0.timingMode === 1));
	this.DMAChannel1.startTransfer(this.DMAChannel1.enable && (this.DMAChannel1.timingMode === 1));
	this.DMAChannel2.startTransfer(this.DMAChannel2.enable && (this.DMAChannel2.timingMode === 1));
	this.DMAChannel3.startTransfer(this.DMAChannel3.enable && (this.DMAChannel3.timingMode === 1));
};

DMAController.prototype.triggerHblankDMA = function () {
	this.DMAChannel0.startTransfer(this.DMAChannel0.enable && (this.DMAChannel0.timingMode === 2));
	this.DMAChannel1.startTransfer(this.DMAChannel1.enable && (this.DMAChannel1.timingMode === 2));
	this.DMAChannel2.startTransfer(this.DMAChannel2.enable && (this.DMAChannel2.timingMode === 2));
	this.DMAChannel3.startTransfer(this.DMAChannel3.enable && (this.DMAChannel3.timingMode === 2));
};

DMAController.prototype.triggerFIFOADMA = function () {
	this.DMAChannel1.startTransferSpecial(this.DMAChannel1.enable && (this.DMAChannel1.timingMode === 3) && this.DMAChannel1.destAddr === this.FIFOAAddress);
	this.DMAChannel2.startTransferSpecial(this.DMAChannel2.enable && (this.DMAChannel2.timingMode === 3) && this.DMAChannel2.destAddr === this.FIFOAAddress);
};

DMAController.prototype.triggerFIFOBDMA = function () {
	this.DMAChannel1.startTransferSpecial(this.DMAChannel1.enable && (this.DMAChannel1.timingMode === 3) && this.DMAChannel1.destAddr === this.FIFOBAddress);
	this.DMAChannel2.startTransferSpecial(this.DMAChannel2.enable && (this.DMAChannel2.timingMode === 3) && this.DMAChannel2.destAddr === this.FIFOBAddress);
};


//returns JSON of inner state
DMAController.prototype.serialize = function() {
	let copy = {};

	copy.DMAChannel0 = this.DMAChannel0.serialize();
	copy.DMAChannel1 = this.DMAChannel1.serialize();
	copy.DMAChannel2 = this.DMAChannel2.serialize();
	copy.DMAChannel3 = this.DMAChannel3.serialize();
  
	return copy;
}
  
DMAController.prototype.setState = function(saveState) {
	this.DMAChannel0.setState(saveState.DMAChannel0);
	this.DMAChannel1.setState(saveState.DMAChannel1);
	this.DMAChannel2.setState(saveState.DMAChannel2);
	this.DMAChannel3.setState(saveState.DMAChannel3);
}

const DMAChannel = function (mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, sadMask, dadMask, dmacntlMask, interruptFlag) {
	let ioRegion = mmu.getMemoryRegion("IOREGISTERS");

	this.memRegions = mmu.memRegions;
	this.memRegionsNames = mmu.memRegionNames;
	this.ioRegionMem = ioRegion.memory;
	this.ifByte2 = ioRegion.getIOReg("IF").regIndex + 1;
	this.interruptFlag = interruptFlag;
	this.sadMask = sadMask;
	this.dadMask = dadMask;
	this.dmacntlMask = dmacntlMask;
	this.cpu = cpu;

	//keep copies of the original register value, dma channels have their own internal pointer for src / dest addr
	this.srcAddrReg = 0;
	this.srcAddr = 0;
	this.destAddrReg = 0;
	this.destAddr = 0;
	this.numTransfers = 0;
	this.destAdjust = 0;
	this.srcAdjust = 0;
	this.repeat = 0;
	this.chunkSize = 0;
	this.timingMode = 0;
	this.irqEnable = 0;
	this.enable = 0;

	this.srcMemRegion = null;
	this.srcMemRegionMask = 0;
	this.srcIncrAmount = 0;
	this.srcAddrInvalid = true;
	this.destMemRegion = null;
	this.destMemRegionMask = 0;
	this.destIncrAmount = 0;
	this.destAddrInvalid = true;
	this.DMACNTHByte2 = DMACNTH.regIndex + 1;

	this.srcMemRegionName = "";
	this.destMemRegionName = "";

	DMASAD.addCallback((newDMASADVal) => {this.updateDMASAD(newDMASADVal)});
	DMADAD.addCallback((newDMADADVal) => {this.updateDMADAD(newDMADADVal)});
	DMACNTL.addCallback((newDMACNTLVal) => {this.updateDMACNTL(newDMACNTLVal)});
	DMACNTH.addCallback((newDMACNTHVal) => {this.updateDMACNTH(newDMACNTHVal)});
};

DMAChannel.prototype.DMAChannelENUMS = {
	DESTADJUST : 96,
	SRCADJUST : 384,
	REPEAT : 512,
	CHUNKSIZE : 1024,
	TIMINGMODE : 12288,
	IRQENABLE : 16384,
	ENABLE : 32768,
};

DMAChannel.prototype.memRegionMasks = [
	0xFFFFFF, //BIOS forbidden
	0,				//filler
	0x3FFFF,  //EWRAM
	0x7FFF,   //IWRAM
	0xFFFFFF, //IOREGS
	0x3FF,    //PALETTERAM
	0,			  //VRAM
	0x3FF,		//OAM
	0xFFFFFF,	//ROM1 read only
	0xFFFFFF, //ROM2 read only
	0xFFFFFF  //SRAM forbidden
];

DMAChannel.prototype.updateDMASAD = function (newDMASADVal) {
	newDMASADVal &= this.sadMask;

	let memRegionIndex = (newDMASADVal & 0xFF000000) >>> 24;
	if ((memRegionIndex < 0x2) || (memRegionIndex >= 0xA))
	{
		//console.log("DMA source addr out of bounds : " + memRegionIndex);
		this.srcAddrInvalid = true;
		return;
	}

	this.srcMemRegion = this.memRegions[memRegionIndex];
	this.srcMemRegionMask = this.memRegionMasks[memRegionIndex];
	this.srcAddrReg = newDMASADVal & 0x00FFFFFF;
	this.srcMemRegionName = this.memRegionsNames[memRegionIndex];
	this.srcAddrInvalid = false;
};

DMAChannel.prototype.updateDMADAD = function (newDMADADVal) {
	newDMADADVal &= this.dadMask;

	let memRegionIndex = (newDMADADVal & 0xFF000000) >>> 24;
	if ((memRegionIndex < 0x2) || (memRegionIndex >= 0x8))
	{
		//console.log("DMA dest addr out of bounds : " + memRegionIndex);
		this.destAddrInvalid = true;
		return;
	}

	this.destMemRegion = this.memRegions[memRegionIndex];
	this.destMemRegionMask = this.memRegionMasks[memRegionIndex];
	this.destAddrReg = newDMADADVal & 0x00FFFFFF;
	this.destMemRegionName = this.memRegionsNames[memRegionIndex];
	this.destAddrInvalid = false;
};

//number of units to transfer
DMAChannel.prototype.updateDMACNTL = function (newDMACNTLVal) {
	if ((newDMACNTLVal & this.dmacntlMask) === 0)
	{
		this.numTransfers = this.dmacntlMask + 1;
	} 
	else
	{
		this.numTransfers = newDMACNTLVal & this.dmacntlMask;
	}
};

//control bits
DMAChannel.prototype.updateDMACNTH = function (newDMACNTHVal) {
	this.destAdjust = (newDMACNTHVal & this.DMAChannelENUMS["DESTADJUST"]) >>> 5;
	this.srcAdjust = (newDMACNTHVal & this.DMAChannelENUMS["SRCADJUST"]) >>> 7;
	this.repeat = newDMACNTHVal & this.DMAChannelENUMS["REPEAT"];
	this.chunkSize = (newDMACNTHVal & this.DMAChannelENUMS["CHUNKSIZE"]) ? 4 : 2;
	this.timingMode = (newDMACNTHVal & this.DMAChannelENUMS["TIMINGMODE"]) >>> 12;
	this.irqEnable = newDMACNTHVal & this.DMAChannelENUMS["IRQENABLE"];
	let enable = newDMACNTHVal & this.DMAChannelENUMS["ENABLE"];

	//if dma being enabled, copy over src / dest addres
	if (enable && !this.enable) {
		this.srcAddr = this.srcAddrReg;
		this.destAddr = this.destAddrReg;		
	}
	this.enable = enable;


	this.destIncrAmount = ((this.destAdjust === 0) || (this.destAdjust === 3)) ? this.chunkSize : ((this.destAdjust === 1) ? (-1 * this.chunkSize) : 0);
	this.srcIncrAmount = ((this.srcAdjust === 0) || (this.srcAdjust === 3)) ? this.chunkSize : ((this.srcAdjust === 1) ? (-1 * this.chunkSize) : 0);
	this.startTransfer(this.enable && (this.timingMode === 0));
};


//taking into account mirrored addresses, will NOT check addresses of non mirrored regions (io region is the only valid SRC/DEST that isnt mirrored)
DMAChannel.prototype.startTransfer = function (shouldStart) {
	if (shouldStart && !this.destAddrInvalid && !this.srcAddrInvalid)
	{
		let srcMemRegion = this.srcMemRegion;
		let srcMemRegionMask = this.srcMemRegionMask;
		let srcAddr = this.srcAddr & (this.chunkSize === 4 ? 0xFFFFFC : 0xFFFFFE);
		let srcIncrAmount = this.srcIncrAmount;

		let destMemRegion = this.destMemRegion;
		let destMemRegionMask = this.destMemRegionMask;
		let destAddr = this.destAddr & (this.chunkSize === 4 ? 0xFFFFFC : 0xFFFFFE);
		let destIncrAmount = this.destIncrAmount;

		// console.log("starting DMA, src addr: 0x" + srcAddr.toString(16) + " dest addr: 0x" + destAddr.toString(16));
		// console.log("src mem region: " + this.srcMemRegionName + " dest mem region: " + this.destMemRegionName);
		// console.log("chunkSize: " + this.chunkSize + " numBytes: " + (this.numTransfers * this.chunkSize).toString(16));
		// console.log("srcIncrAmount: " + srcIncrAmount + " destIncrAmount: " + destIncrAmount);
		//transfer halfwords
		if (this.chunkSize === 2)
		{
			for (let i = 0; i < this.numTransfers; i ++)
			{
				destMemRegion.write16(destAddr, srcMemRegion.read16(srcAddr));
				srcAddr += srcIncrAmount;
				srcAddr = (!srcMemRegionMask) ? ((srcAddr & 0x10000) ? (srcAddr & 0x17FFF) : srcAddr) : (srcAddr & srcMemRegionMask);
				destAddr += destIncrAmount;
				destAddr = (!destMemRegionMask) ? ((destAddr & 0x10000) ? (destAddr & 0x17FFF) : destAddr) : (destAddr & destMemRegionMask);
			}
		}
		else //transfer words
		{
			for (let i = 0; i < this.numTransfers; i ++)
			{
				destMemRegion.write32(destAddr, srcMemRegion.read32(srcAddr));
				srcAddr += srcIncrAmount;
				srcAddr = (!srcMemRegionMask) ? ((srcAddr & 0x10000) ? (srcAddr & 0x17FFF) : srcAddr) : (srcAddr & srcMemRegionMask);
				destAddr += destIncrAmount;
				destAddr = (!destMemRegionMask) ? ((destAddr & 0x10000) ? (destAddr & 0x17FFF) : destAddr) : (destAddr & destMemRegionMask);
			}
		}

		//will writeback aligned addresses, shouldnt matter since register
		if (this.destAdjust !== 3)
		{
			this.destAddr = destAddr;
		}
		this.srcAddr = srcAddr;

		if (!(((this.timingMode === 1) || (this.timingMode === 2)) && (this.repeat)))
		{
			this.ioRegionMem[this.DMACNTHByte2] &= 127;
			this.enable = 0;
		}
		// else
		// 	this.destAddr = this.destAddrReg;

		if (this.irqEnable)
		{	
			this.ioRegionMem[this.ifByte2] |= this.interruptFlag;
	    this.cpu.awake();
		}
	}
};

//returns JSON of inner state
DMAChannel.prototype.serialize = function() {
	let copy = {};

	copy.srcAddr = this.srcAddr;
	copy.srcAddrReg = this.srcAddrReg;
	copy.destAddr = this.destAddr;
	copy.destAddrReg = this.destAddrReg;
	copy.numTransfers = this.numTransfers;
	copy.destAdjust = this.destAdjust;
	copy.srcAdjust = this.srcAdjust;
	copy.repeat = this.repeat;
	copy.chunkSize = this.chunkSize;
	copy.timingMode = this.timingMode;
	copy.irqEnable = this.irqEnable;
	copy.enable = this.enable;

	//copy.srcMemRegion = this.srcMemRegion; //ref that is set after initialization, need to re-set this
	copy.srcMemRegionMask = this.srcMemRegionMask;
	copy.srcIncrAmount = this.srcIncrAmount;
	copy.srcAddrInvalid = this.srcAddrInvalid;
	//copy.destMemRegion = this.destMemRegion; //ref that is set after initialization, need to re-set this
	copy.destMemRegionMask = this.destMemRegionMask;
	copy.destIncrAmount = this.destIncrAmount;
	copy.destAddrInvalid = this.destAddrInvalid;

	copy.srcMemRegionName = this.srcMemRegionName;
	copy.destMemRegionName = this.destMemRegionName;
  
	return copy;
}
  
DMAChannel.prototype.setState = function(saveState) {
	this.srcAddr = saveState.srcAddr;
	this.srcAddrReg = saveState.srcAddrReg;
	this.destAddr = saveState.destAddr;
	this.destAddrReg = saveState.destAddrReg;
	this.numTransfers = saveState.numTransfers;
	this.destAdjust = saveState.destAdjust;
	this.srcAdjust = saveState.srcAdjust;
	this.repeat = saveState.repeat;
	this.chunkSize = saveState.chunkSize;
	this.timingMode = saveState.timingMode;
	this.irqEnable = saveState.irqEnable;
	this.enable = saveState.enable;

	//this.srcMemRegion = saveState.srcMemRegion; //ref that is set after initialization, need to re-set this
	this.srcMemRegionMask = saveState.srcMemRegionMask;
	this.srcIncrAmount = saveState.srcIncrAmount;
	this.srcAddrInvalid = saveState.srcAddrInvalid;
	//this.destMemRegion = saveState.destMemRegion; //ref that is set after initialization, need to re-set this
	this.destMemRegionMask = saveState.destMemRegionMask;
	this.destIncrAmount = saveState.destIncrAmount;
	this.destAddrInvalid = saveState.destAddrInvalid;

	this.srcMemRegionName = saveState.srcMemRegionName;
	this.destMemRegionName = saveState.destMemRegionName;

	let srcMemRegionIndex = this.memRegionsNames.indexOf(this.srcMemRegionName);
	if (srcMemRegionIndex !== -1)
		this.srcMemRegion = this.memRegions[srcMemRegionIndex];
	let destMemRegionIndex = this.memRegionsNames.indexOf(this.destMemRegionName);
	if (destMemRegionIndex !== -1)
		this.destMemRegion = this.memRegions[destMemRegionIndex];
}




const DMAChannel0 = function (mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag) {
	DMAChannel.call(this, mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag);
}

DMAChannel0.prototype = Object.create(DMAChannel.prototype);
DMAChannel0.constructor = DMAChannel0;

DMAChannel0.prototype.startTransferSpecial = function (memAddr) {
	//this method should never be called
	throw Error("forbidden start timing for DMA 0!");
}

const DMAChannel12 = function (mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag) {
	DMAChannel.call(this, mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag);
}

DMAChannel12.prototype = Object.create(DMAChannel.prototype);
DMAChannel12.constructor = DMAChannel12;

DMAChannel12.prototype.startTransferSpecial = function (shouldStart) {
	if (shouldStart && !this.srcAddrInvalid)
	{
		let srcMemRegion = this.srcMemRegion;
		let srcMemRegionMask = this.srcMemRegionMask;
		let srcAddr = this.srcAddr & 0xFFFFFC; //(this.chunkSize === 4 ? 0xFFFFFC : 0xFFFFFE);
		let srcIncrAmount = ((this.srcAdjust === 0) || (this.srcAdjust === 3)) ? 4 : ((this.srcAdjust === 1) ? -4 : 0);


		let destMemRegion = this.destMemRegion;
		let destMemRegionMask = this.destMemRegionMask;
		let destAddr = this.destAddr & 0xFFFFFC; //(this.chunkSize === 4 ? 0xFFFFFC : 0xFFFFFE);
		let destIncrAmount = this.destIncrAmount;

		// console.log("starting DMA, src addr: 0x" + srcAddr.toString(16) + " dest addr: 0x" + destAddr.toString(16));
		// console.log("src mem region: " + this.srcMemRegionName + " dest mem region: " + this.destMemRegionName);
		// console.log("chunkSize: " + this.chunkSize + " numBytes: " + (this.numTransfers * this.chunkSize).toString(16));
		// console.log("srcIncrAmount: " + srcIncrAmount + " destIncrAmount: " + destIncrAmount);
		for (let i = 0; i < 4; i ++)
		{
			destMemRegion.write32(destAddr, srcMemRegion.read32(srcAddr));
			srcAddr += srcIncrAmount;
			srcAddr = (!srcMemRegionMask) ? ((srcAddr & 0x10000) ? (srcAddr & 0x17FFF) : srcAddr) : (srcAddr & srcMemRegionMask);
			//destAddr += destIncrAmount;
			//destAddr = (!destMemRegionMask) ? ((destAddr & 0x10000) ? (destAddr & 0x17FFF) : destAddr) : (destAddr & destMemRegionMask);
		}

		//will writeback aligned addresses, shouldnt matter since register
		// if (this.destAdjust !== 3)
		// {
		// 	this.destAddr = destAddr;
		// }
		this.srcAddr = srcAddr;

		if (!this.repeat)
		{
			this.ioRegionMem[this.DMACNTHByte2] &= 127;
			this.enable = 0;
		}
		// else
		// 	this.destAddr = this.destAddrReg;

		if (this.irqEnable)
		{	
			this.ioRegionMem[this.ifByte2] |= this.interruptFlag;
			this.cpu.awake();
		}
	}
}

const DMAChannel3 = function (mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag) {
	DMAChannel.call(this, mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag);
}

DMAChannel3.prototype = Object.create(DMAChannel.prototype);
DMAChannel3.constructor = DMAChannel3;

DMAChannel3.prototype.startTransferSpecial = function (memAddr) {
	throw Error("unimplemented special timing for DMA 3");
}