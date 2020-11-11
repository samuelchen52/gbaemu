const timerController = function(mmu, cpu) {

	let ioregion = mmu.getMemoryRegion("IOREGISTERS");
	let ifByte1 = ioregion.getIOReg("IF").regIndex;

  this.dummyTimer = {
  	cascade : false,
  	enabled : false
  };
	this.timer3 = new timer(ioregion.getIOReg("TM3CNTL"), ioregion.getIOReg("TM3CNTH"), this.dummyTimer, cpu, ioregion.memory, ifByte1, 64);
	this.timer2 = new timer(ioregion.getIOReg("TM2CNTL"), ioregion.getIOReg("TM2CNTH"), this.timer3, cpu, ioregion.memory, ifByte1, 32);
	this.timer1 = new timer(ioregion.getIOReg("TM1CNTL"), ioregion.getIOReg("TM1CNTH"), this.timer2, cpu, ioregion.memory, ifByte1, 16);
	this.timer0 = new timer(ioregion.getIOReg("TM0CNTL"), ioregion.getIOReg("TM0CNTH"), this.timer1, cpu, ioregion.memory, ifByte1, 8);
	window.timer = this;
}

timerController.prototype.update = function (numCycles) {
	return Math.min(this.timer0.update(numCycles), this.timer1.update(numCycles), this.timer2.update(numCycles), this.timer3.update(numCycles));
};


//if timer is enabled while scheduler is running to next event, it will NOT inform the scheduler
//timings are totally inaccurate right now so there wouldnt be a difference fixing this right now anyway
const timer = function(TMCNTL, TMCNTH, nextTimer, cpu, ioregionMem, ifByte1, interruptFlag) {
	this.nextTimer = nextTimer;
	this.cpu =  cpu;
	this.ioregionMem = ioregionMem;
	this.ifByte1 = ifByte1;
	this.interruptFlag = interruptFlag;

	this.counter = 0;
	this.reload = 0;
	this.freq = 1;
	this.freqPow = 0;
	this.cascade = false;
	this.raiseIRQ = false;
	this.enabled = false;

	this.leftoverCycles = 0;

	TMCNTL.addCallback((newTMCNTLVal) => {this.updateTMCNTLVal(newTMCNTLVal)});
	TMCNTH.addCallback((newTMCNTHVal) => {this.updateTMCNTHVal(newTMCNTHVal)});

	TMCNTL.addTimer(this);
};

timer.prototype.timerENUMS = {
    TMFREQ : 3,
    TMCASCADE : 4, 
    TMIRQ : 64,
    TMENABLE : 128
};

timer.prototype.updateTMCNTLVal = function (newTMCNTLVal) {
	//Note: When simultaneously changing the start bit from 0 to 1, and setting the reload value at the same time (by a single 32bit I/O operation), then the newly written reload value is recognized as new counter value.
	//to handle this, check if counter === reload i.e. both timer ioregs are being written to at the same time (TMCNTH callbacks are triggered first)
	//it IS possible for this condition to be met without a word write e.g. when timer is updated and has overflowed back to its reload value but this should be rare enough, and our timings are inaccurate anyway
	if ((this.reload === this.counter) && (this.enabled))
	{
		this.counter = newTMCNTLVal;
	}
	this.reload = newTMCNTLVal;
};

timer.prototype.updateTMCNTHVal = function (newTMCNTHVal) {
	this.freq = newTMCNTHVal & this.timerENUMS["TMFREQ"];
	this.freqPow = this.freq === 0 ? 0 : 4 + (this.freq * 2);
	this.freq = Math.pow(2, this.freqPow);

	this.cascade = newTMCNTHVal & this.timerENUMS["TMCASCADE"];
	this.raiseIRQ = newTMCNTHVal & this.timerENUMS["TMIRQ"];

	if (!this.enabled && (newTMCNTHVal & this.timerENUMS["TMENABLE"])) //if timer is starting, set counter to initial reload value
	{
		this.counter = this.reload;
	}
	this.enabled = newTMCNTHVal & this.timerENUMS["TMENABLE"];
};

timer.prototype.update = function (numCycles) {
	if (this.enabled && !this.cascade)
	{
		this.counter += (numCycles + this.leftoverCycles) >>> this.freqPow;
		this.leftoverCycles = (numCycles + this.leftoverCycles) & (this.freq - 1);
	
		if (this.counter === 0x10000)
		{
			this.counter = this.reload;
			if (this.nextTimer.cascade && this.nextTimer.enabled)
			{
				this.nextTimer.increment();
			}
			if (this.raiseIRQ)
			{
				this.ioregionMem[this.ifByte1] |= this.interruptFlag;
		    this.cpu.halt = false;
		    this.cpu.checkInterrupt = true;
			}
		}
		if (this.counter > 0x10000)
		{
			throw Error("error with scheduling?");
		}
		return (0x10000 - this.counter) << this.freqPow;
	}
	return 0xFFFFFFFF; //return some arbitrarily large number for the scheduler
};

timer.prototype.increment = function () {
	this.counter ++;
	if (this.counter === 0x10000)
	{
		this.counter = this.reload;
		if (this.nextTimer.cascade && this.nextTimer.enabled)
		{
			this.nextTimer.increment();
		}
		if (this.raiseIRQ)
		{
			this.ioregionMem[this.ifByte1] |= this.interruptFlag;
	    this.cpu.halt = false;
	    this.cpu.checkInterrupt = true;
		}
	}
};