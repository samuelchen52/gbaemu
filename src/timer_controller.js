const timerController = function(mmu, cpu) {
	let ioregion = mmu.getMemoryRegion("IOREGISTERS");
	let ifByte1 = ioregion.getIOReg("IF").regIndex;

	this.dummyTimer = {
		cascade : false,
		enabled : false
	};
	this.timer3 = new timer(ioregion.getIOReg("TM3CNTL"), ioregion.getIOReg("TM3CNTH"), this.dummyTimer, cpu, ioregion.memory, ifByte1, 64, 3);
	this.timer2 = new timer(ioregion.getIOReg("TM2CNTL"), ioregion.getIOReg("TM2CNTH"), this.timer3, cpu, ioregion.memory, ifByte1, 32, 2);
	this.timer1 = new timer(ioregion.getIOReg("TM1CNTL"), ioregion.getIOReg("TM1CNTH"), this.timer2, cpu, ioregion.memory, ifByte1, 16, 1);
	this.timer0 = new timer(ioregion.getIOReg("TM0CNTL"), ioregion.getIOReg("TM0CNTH"), this.timer1, cpu, ioregion.memory, ifByte1, 8, 0);
};

timerController.prototype.update = function (numCycles) {
	return Math.min(this.timer0.update(numCycles), this.timer1.update(numCycles), this.timer2.update(numCycles), this.timer3.update(numCycles));
};

//returns JSON of inner state
timerController.prototype.serialize = function() {
	let copy = {};

	copy.timer3 = this.timer3.serialize();
	copy.timer2 = this.timer2.serialize();
	copy.timer1 = this.timer1.serialize();
	copy.timer0 = this.timer0.serialize();

	return copy;
}
  
timerController.prototype.setState = function(saveState) {
	this.timer3.setState(saveState.timer3);
	this.timer2.setState(saveState.timer2);
	this.timer1.setState(saveState.timer1);
	this.timer0.setState(saveState.timer0);
}

//if timer is enabled while scheduler is running to next event, it will NOT inform the scheduler
//timings are totally inaccurate right now so there wouldnt be a difference fixing this right now anyway
const timer = function(TMCNTL, TMCNTH, nextTimer, cpu, ioregionMem, ifByte1, interruptFlag, timerNum) {
	this.nextTimer = nextTimer;
	this.cpu =  cpu;
	this.ioregionMem = ioregionMem;
	this.ifByte1 = ifByte1;
	this.interruptFlag = interruptFlag;
	this.timerNum = timerNum;

	this.counter = 0;
	this.reload = 0;
	this.freq = 1;
	this.freqPow = 0;
	this.cascade = false;
	this.irqEnable = false;
	this.enabled = false;

	this.leftoverCycles = 0;

	this.timerOverflowCallbacks = [];

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
	// if ((this.reload === this.counter) && (this.enabled))
	// {
	// 	this.counter = newTMCNTLVal;
	// }
	this.reload = newTMCNTLVal;
};

timer.prototype.updateTMCNTHVal = function (newTMCNTHVal) {
	this.freq = newTMCNTHVal & this.timerENUMS["TMFREQ"];
	this.freqPow = this.freq === 0 ? 0 : 4 + (this.freq * 2);
	this.freq = Math.pow(2, this.freqPow);

	this.cascade = newTMCNTHVal & this.timerENUMS["TMCASCADE"];
	this.irqEnable = newTMCNTHVal & this.timerENUMS["TMIRQ"];

	if (!this.enabled && (newTMCNTHVal & this.timerENUMS["TMENABLE"])) //if timer is starting, set counter to initial reload value
	{
		this.counter = this.reload;
	}
	this.enabled = newTMCNTHVal & this.timerENUMS["TMENABLE"];
};

//executes numCycles, returns the number of cycles before the next "event" 
timer.prototype.update = function (numCycles) {
	if (this.enabled && !this.cascade)
	{
		this.counter += (numCycles + this.leftoverCycles) >>> this.freqPow;
		this.leftoverCycles = (numCycles + this.leftoverCycles) & (this.freq - 1);
	
		//counter normally shouldnt go above 0x10000
		//only happens when timer is set to increment at a high cycle count (so it returns a high amount of cycles before the next timer interrupt)
		//then is set to increment at a low cycle count when CPU is running (in which case the timer is updated with too many cycles i.e. timer should have already gone off)
		//if this happens, we'll just have the timer go off (late)
		//to fix, have to have an actual scheduler
		if (this.counter >= 0x10000)
		{
			this.counter = this.reload;
			if (this.nextTimer.cascade && this.nextTimer.enabled)
			{
				this.nextTimer.increment();
			}
			if (this.irqEnable)
			{
				this.ioregionMem[this.ifByte1] |= this.interruptFlag;
		    this.cpu.awake();
			}
			this.timerOverflowCallbacks.forEach(callback => callback(this.timerNum));
		}
		return (0x10000 - this.counter) << this.freqPow;
	}
	return Number.MAX_SAFE_INTEGER; //return some arbitrarily large number for the scheduler
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
		if (this.irqEnable)
		{
			this.ioregionMem[this.ifByte1] |= this.interruptFlag;
	    this.cpu.awake();
		}
		this.timerOverflowCallbacks.forEach(callback => callback(this.timerNum));
	}
};

timer.prototype.addTimerOverflowCallback = function (callback) {
	this.timerOverflowCallbacks.push(callback);
};

//returns JSON of inner state
timer.prototype.serialize = function() {
	let copy = {};

	copy.counter = this.counter; 
	copy.reload = this.reload; 
	copy.freq = this.freq; 
	copy.freqPow = this.freqPow; 
	copy.cascade = this.cascade; 
	copy.irqEnable = this.irqEnable; 
	copy.enabled = this.enabled; 

	copy.leftoverCycles = this.leftoverCycles; 

	return copy;
}
  
timer.prototype.setState = function(saveState) {
	this.counter = saveState.counter; 
	this.reload = saveState.reload; 
	this.freq = saveState.freq; 
	this.freqPow = saveState.freqPow; 
	this.cascade = saveState.cascade; 
	this.irqEnable = saveState.irqEnable; 
	this.enabled = saveState.enabled; 

	this.leftoverCycles = saveState.leftoverCycles; 
}