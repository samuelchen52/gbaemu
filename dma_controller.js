const DMAController = function(mmu, cpu, graphics) {
	let ioregion = mmu.getMemoryRegion("IOREGISTERS");

	this.DMAChannel0 = new DMAChannel0(mmu, cpu, ioregion.getIOReg("DMA0SAD"), ioregion.getIOReg("DMA0DAD"), ioregion.getIOReg("DMA0CNTL"), ioregion.getIOReg("DMA0CNTH"), 0x7FFFFFF, 0x7FFFFFF, 0x3FFF, 1);
	this.DMAChannel1 = new DMAChannel12(mmu, cpu, ioregion.getIOReg("DMA1SAD"), ioregion.getIOReg("DMA1DAD"), ioregion.getIOReg("DMA1CNTL"), ioregion.getIOReg("DMA1CNTH"), 0xFFFFFFF, 0x7FFFFFF, 0x3FFF, 2);
	this.DMAChannel2 = new DMAChannel12(mmu, cpu, ioregion.getIOReg("DMA2SAD"), ioregion.getIOReg("DMA2DAD"), ioregion.getIOReg("DMA2CNTL"), ioregion.getIOReg("DMA2CNTH"), 0xFFFFFFF, 0x7FFFFFF, 0x3FFF, 4);
	this.DMAChannel3 = new DMAChannel3(mmu, cpu, ioregion.getIOReg("DMA3SAD"), ioregion.getIOReg("DMA3DAD"), ioregion.getIOReg("DMA3CNTL"), ioregion.getIOReg("DMA3CNTH"), 0xFFFFFFF, 0xFFFFFFF, 0xFFFF, 8);

	graphics.vblankCallback = this.triggerVblankDMA.bind(this);
	graphics.hblankCallback = this.triggerHblankDMA.bind(this);
	window.dma = this;
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

const DMAChannel = function (mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, sadMask, dadMask, dmacntlMask, interruptFlag) {
	let ioRegion = mmu.getMemoryRegion("IOREGISTERS");
	window.ioRegion = ioRegion;

	this.memRegions = mmu.memRegions;
	this.memRegionsENUMS = mmu.memENUMS;
	this.ioRegionMem = ioRegion.memory;
  this.ifByte2 = ioRegion.getIOReg("IF").regIndex + 1;
	this.interruptFlag = interruptFlag;
	this.sadMask = sadMask;
	this.dadMask = dadMask;
	this.dmacntlMask = dmacntlMask;
	this.cpu = cpu;

	this.srcAddr = 0;
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
		this.destAddrInvalid = true;
		return;
	}

	this.srcMemRegion = this.memRegions[memRegionIndex];
	this.srcMemRegionMask = this.memRegionMasks[memRegionIndex];
	this.srcAddr = newDMASADVal & 0x00FFFFFF;
	this.srcMemRegionName = this.memRegionsENUMS[memRegionIndex];
	this.srcAddrInvalid = false;
};

DMAChannel.prototype.updateDMADAD = function (newDMADADVal) {
	newDMADADVal &= this.dadMask;

	let memRegionIndex = (newDMADADVal & 0xFF000000) >>> 24;
	if ((memRegionIndex < 0x2) || (memRegionIndex >= 0x8))
	{
		//console.log("DMA dest addr out of bounds : " + memRegionIndex);
		this.srcAddrInvalid = true;
		return;
	}

	this.destMemRegion = this.memRegions[memRegionIndex];
	this.destMemRegionMask = this.memRegionMasks[memRegionIndex];
	this.destAddr = newDMADADVal & 0x00FFFFFF;
	this.destMemRegionName = this.memRegionsENUMS[memRegionIndex];
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
	this.enable = newDMACNTHVal & this.DMAChannelENUMS["ENABLE"];

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

		if (this.irqEnable)
		{	
			this.ioRegionMem[this.ifByte2] |= this.interruptFlag;
	    this.cpu.halt = false;
	    this.cpu.checkInterrupt = true;
		}
	}
};




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

DMAChannel12.prototype.startTransferSpecial = function (memAddr) {
	throw Error("unimplemented special timing for DMA 1/2");
}

const DMAChannel3 = function (mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag) {
	DMAChannel.call(this, mmu, cpu, DMASAD, DMADAD, DMACNTL, DMACNTH, SADMask, DADMask, DMACNTLMask, interruptFlag);
}

DMAChannel3.prototype = Object.create(DMAChannel.prototype);
DMAChannel3.constructor = DMAChannel3;

DMAChannel3.prototype.startTransferSpecial = function (memAddr) {
	throw Error("unimplemented special timing for DMA 3");
}