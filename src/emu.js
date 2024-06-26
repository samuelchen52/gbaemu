const emulator = function(biosBuffer, romBuffer) {
	this.cyclesToRun;
	this.frames;
	this.frameNotComplete;
	this.pause;
	this.speedCap; //this is effectively fps

	this.gbaMMU;
	this.gbaCPU;
	this.gbaGPU;
	this.gbaTimerController;
	this.gbaKeypad;
	this.gbaDMAController;
	this.gbaSound;
	
	this.init(biosBuffer, romBuffer);
}


emulator.prototype.pause = function() {
	this.pause = true;
}

emulator.prototype.unpause = function() {
	this.pause = false;
}

emulator.prototype.togglePause = function() {
	this.pause = !this.pause;
}

emulator.prototype.setSpeedCap = function(cap) {
	this.speedCap = cap;
}


// emulator.prototype.resetSaveStatesUI = function(saveState) {
// 	//clear savestates from session storage



// };

emulator.prototype.resetUI = function() {
	//turn off keypad event handlers
	this.keypad.deregisterEventHandlers();
	//reset save states ui
	//
};

emulator.prototype.reset = function(biosBuffer, romBuffer, saveState) {
	//clean up ui stuff
	this.resetUI();
	//kill execution of emulator loop
	this.pause = true;
	//reinit everything
	this.init();
	this.start();
};

// emulator.prototype.initSaveStatesUI = function(saveState) {
// 	//read savestates from session storage



// };

emulator.prototype.initUI = function() {
	//clean up ui stuff
	this.gbaKeypad.registerEventHandlers();
	//reinit everything
	//this.init();
};

emulator.prototype.initHardware = function(biosBuffer, romBuffer, saveState) {
	if (!biosBuffer?.length)
		throw Error("Cannot initialize emulator without bios");
	if (!romBuffer?.length && !saveState?.length)
		throw Error("Cannot initialize emulator without rom");

	if (saveState) {

	}
	else {
		this.gbaMMU = new mmu();
		this.gbaCPU = new cpu(0x8000000, this.gbaMMU);
		this.gbaGPU = new graphics(this.gbaMMU, this.gbaCPU, document.getElementById("backingScreen"), document.getElementById("visibleScreen"), () => { this.frameNotComplete = false; });
		this.gbaTimerController = new timerController(this.gbaMMU, this.gbaCPU);
		this.gbaSound = new sound(this.gbaMMU, this.gbaTimerController);
		this.gbaDMAController = new DMAController(this.gbaMMU, this.gbaCPU, this.gbaGPU, this.gbaSound);
		this.gbaKeypad = new keypad(this.gbaMMU);
	}

	//copy BIOS into memory
	let biosMem = this.gbaMMU.getMemoryRegion("BIOS").memory;

	if (biosBuffer.length > biosMem.length)
		throw Error("BIOS file too big?")
	for (let i = 0; i < biosBuffer.length; i ++)
		biosMem[i] = biosBuffer[i];
	console.log("loaded BIOS into memory");

	//copy ROM into memory
	if (romBuffer)
	{
		let rom1Mem = this.gbaMMU.getMemoryRegion("ROM1").memory;
		let rom2Mem = this.gbaMMU.getMemoryRegion("ROM2").memory;

		if (romBuffer.length > (rom1Mem.length + rom2Mem.length))
			throw Error("ROM too big?")

		for (let i = 0; i < Math.min(rom1Mem.length, romBuffer.length); i++)
			rom1Mem[i] = romBuffer[i];
		for (let i = rom1Mem.length; i < romBuffer.length; i ++)
		{
			let p = i & 0xFFFFFF;
			rom2Mem[p] = romBuffer[p];
		}
		console.log("loaded ROM into memory");
	}
	this.gbaCPU.initPipeline();
}

emulator.prototype.init = function(biosBuffer, romBuffer) {
	this.cyclesToRun = 0;
	this.frames = 0;
	this.frameNotComplete = true;
	this.pause = false;
	this.speedCap = 60;
	this.initHardware(biosBuffer, romBuffer);
	this.initUI();
};

emulator.prototype.start = function() {
	let FPSCounter = document.getElementById("FPS");

	let timeTakenMS = 0; //time it took for hardware components to update, in ms
	const executeFrame = () => {
		if (!this.pause) {
			let timenow = Date.now();
			while (this.frameNotComplete)
			{
				//run the cpu up to the next "event" that will be triggered, event being defined as some action e.g. timer going off, graphics render
				//this is because there is no need to update every component after every cpu instruction (each component only does some action after a certain number of 
				//cycles), which would be still be correct, but way slower / expensive. 
				this.gbaCPU.run(this.cyclesToRun);
				this.cyclesToRun = Math.min(this.gbaGPU.update(this.cyclesToRun), this.gbaTimerController.update(this.cyclesToRun), this.gbaSound.update(this.cyclesToRun));
			}
			timeTakenMS += (Date.now() - timenow);

			this.frames ++;
			this.frameNotComplete = true;
		}
		//rudimentary logic to keep framerate consistent. we take into account how long the actual execution of all the hardware components took 
		//and use that to calculate the delay before executing the next frame. in an ideal world where this execution was instant, the delay would always be
		//1000 / 60 ms, i.e. 60 fps. since its not, we have to shorten the delay by the execution time (and sometimes get rid of the delay altogether by setting to 0)
		//also some additional logic to "carry over" lost time if execution is greater than the ideal delay
		let offset;
		let ideal = 1000 / this.speedCap;
		if (timeTakenMS > ideal)
			offset = ideal;
		else
			offset = timeTakenMS;
		timeTakenMS -= offset;

		setTimeout(executeFrame, ideal - offset);
	};
	executeFrame();


	//prints AND resets frames counter to zero every second
	const printFPS = () => {
		if (!this.pause) {	
			//console.log("FPS: " + this.frames);
			FPSCounter.value = this.frames;
			this.frames = 0;
		}
		setTimeout(printFPS, 1000);
	}
	printFPS();
};


//for debugging
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "dupe";
      }
      seen.add(value);
    }
    return value;
  };
};

//const stringified = JSON.stringify(circularReference, getCircularReplacer());

emulator.prototype.serialize = function () {

	//this.pause();


	let ret = {
		cyclesToRun: this.cyclesToRun,
		frames: this.frames,
		frameNotComplete: this.frameNotComplete,

		gbaMMU: this.gbaMMU.serialize(), //good
		gbaCPU: this.gbaCPU.serialize(), //good
		gbaGPU: this.gbaGPU.serialize(), //good
		gbaTimerController: this.gbaTimerController.serialize(), //good
		gbaKeypad: this.gbaKeypad.serialize(), //good
		gbaDMAController: this.gbaDMAController.serialize(), //good
		gbaSound: this.gbaSound.serialize()
	};

	//debug save states for non mmu stuff
	//cmd json-diff json1.json json2.json
	// for (let i = 0; i < this.gbaMMU.memRegions.length; i ++)
	// {
	// 	let memRegion = this.gbaMMU.memRegions[i];
	// 	if (memRegion) {
	// 		memRegion.memory = [];
	// 		memRegion.memory16 = [];
	// 		memRegion.memory32 = [];
	// 	}
	// }
	// console.log(JSON.stringify(this, getCircularReplacer()));

	return ret;
}
emulator.prototype.setState = function (saveState) {
	this.cyclesToRun = saveState.cyclesToRun;
	this.frames = saveState.frames;
	this.frameNotComplete = saveState.frameNotComplete;

	//debugging save states for mmu stuff
	// for (let i = 0; i < this.gbaMMU.memRegions.length; i ++)
	// {
	// 	let memRegion = this.gbaMMU.memRegions[i];
	// 	if (memRegion)
	// 		memRegion.memory2 = _.cloneDeep(memRegion.memory);
	// }

	this.gbaMMU.setState(saveState.gbaMMU);
	this.gbaCPU.setState(saveState.gbaCPU);
	this.gbaGPU.setState(saveState.gbaGPU);
	this.gbaTimerController.setState(saveState.gbaTimerController);
	this.gbaKeypad.setState(saveState.gbaKeypad);
	this.gbaDMAController.setState(saveState.gbaDMAController);
	this.gbaSound.setState(saveState.gbaSound);

	//debug save states for non mmu stuff
	// for (let i = 0; i < this.gbaMMU.memRegions.length; i ++)
	// {
	// 	let memRegion = this.gbaMMU.memRegions[i];
	// 	if (memRegion)
	// 		memRegion.memory = [];
	// }
	// console.log(JSON.stringify(this, getCircularReplacer()));

	//debugging save states for mmu stuff, run this in console to compare mem
	// for (let i = 0; i < gbaEmu.gbaMMU.memRegions.length; i ++)
	// {
	// 	let memRegion = gbaEmu.gbaMMU.memRegions[i];
	// 	if (memRegion) {
	// 		for (let ii = 0; ii < memRegion.memory.length; ii ++)
	// 			if (memRegion.memory[ii] !== memRegion.memory2[ii])
	// 				throw Error(memRegion.name + " doesnt match");
	// 		console.log(memRegion.name + " matches")
	// 	}
	// }
}