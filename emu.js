var biosBuffer;

const waitFile = function(fileName)
{
	return new Promise(function (resolve, reject)
	{
		let fileInput = document.getElementById(fileName);

    fileInput.addEventListener('change', function(e) {
        let file = fileInput.files[0];
        let reader = new FileReader();

        reader.onload = function () {
        	resolve(new Uint8Array(reader.result));
				}
        reader.readAsArrayBuffer(file);
    });
	});
};

const disableInput = function ()
{
	$("#biosInput").prop("disabled", true);
	$("#romInput").prop("disabled", true);
	$("#demo").prop("disabled", true);
}

const start = function (biosBuffer, romBuffer) {
	let	cyclesToRun = 0;
	let frames = 0;
	let frameNotComplete = true;

	//hardware
	const MMU = new mmu();
	const CPU = new cpu(0, MMU);
	const GRAPHICS = new graphics(MMU, CPU, function(){frameNotComplete = false;});
	const TIMERCONTROLLER = new timerController(MMU, CPU);
	const KEYPAD = new keypad(MMU);
	const DMACONTROLLER = new DMAController(MMU, CPU, GRAPHICS);

	//copy BIOS into memory
	if (biosBuffer !== undefined)
	{
		let biosMem = MMU.getMemoryRegion("BIOS").memory;
		for (let i = 0; i < biosBuffer.length; i ++)
		{
			biosMem[i] = biosBuffer[i];
		}
		console.log("loaded BIOS into memory");
	}
	else //load normatt bios
	{
		let nbios = getNormattBIOS();
		let biosMem = MMU.getMemoryRegion("BIOS").memory;

		for (let i = 0; i < nbios.length; i ++)
		{
			biosMem[i] = nbios[i];
		}
		console.log("loaded normatt BIOS");
	}

	//copy ROM into memory
	if (romBuffer !== undefined)
	{
		let rom1Mem = MMU.getMemoryRegion("ROM1").memory;
		let rom2Mem = MMU.getMemoryRegion("ROM2").memory;
		for (let i = 0; i < Math.min(rom1Mem.length, romBuffer.length); i++)
		{
			rom1Mem[i] = romBuffer[i];
		}
		for (let i = rom1Mem.length; i < romBuffer.length; i ++)
		{
			let p = i & 0xFFFFFF;
			rom2Mem[p] = romBuffer[p];
		}
		console.log("loaded ROM into memory");
	}
	else //load TONC demo
	{
		let m7demo = getTONCDemo();
		let rom1Mem = MMU.getMemoryRegion("ROM1").memory;

		for (let i = 0; i < m7demo.length; i ++)
		{
			rom1Mem[i] = m7demo[i];
		}
		console.log("loaded DEMO");
	}

	romBuffer = null;
	biosBuffer = null;

	CPU.initPipeline();

	//for debugging------------------------------------------------------------------
	window.instructionNum = 1;
	$("#runbutton").click(function()
	{
		if (CPU.halt)
		{
			while (CPU.halt)
			{
				GRAPHICS.update(1);
				TIMERCONTROLLER.update(1)
			}
		}
		else
		{
			if (window.debug)
			{
				while (!CPU.checkInterrupt)
				{
					if (!CPU.halt)
					{
						CPU.run(false, window.instructionNum);
						window.instructionNum ++;
					}
					GRAPHICS.update(1);
					TIMERCONTROLLER.update(1)
				}
			}
			else
			{
				CPU.run(true, window.instructionNum);
				window.instructionNum ++;
				GRAPHICS.update(1);
				TIMERCONTROLLER.update(1);
			}
			GRAPHICS.updateRegisters(CPU.mode);
		}
		//GRAPHICS.updateRegisters(CPU.mode);
	});

	// while (window.instructionNum <= 3000000)
	// {

	// 	try {
	// 		if (!CPU.halt)
	// 		{
	// 			CPU.run(false, window.instructionNum);
	// 			window.instructionNum ++;
	// 		}
	// 		GRAPHICS.update(1);
	// 		TIMERCONTROLLER.update(1)			
	// 	}
	// 	catch (err)
	// 	{
	// 		console.log("error on instruction " + window.instructionNum );
	// 		//download(strData, strFileName);
	// 		throw (err);
	// 	}
	// }
	console.log("finished");
	//download(strData, strFileName);
	//for debugging------------------------------------------------------------------

	const executeFrame = function() {
		while (frameNotComplete)
		{
			// if (!CPU.halt)
			// {
			// 	CPU.run();
			// 	window.instructionNum ++;
			// }
			// GRAPHICS.update(1);
			// TIMERCONTROLLER.update(1)			

			if (!CPU.halt)
			{
				for (var i = 0; i < cyclesToRun; i ++)
				{	
					CPU.run();
				}
			}
			cyclesToRun = Math.min(GRAPHICS.update(cyclesToRun), TIMERCONTROLLER.update(cyclesToRun));
		}
		frames ++;
		frameNotComplete = true;
		setTimeout(executeFrame, 10);
	};
	executeFrame();

	const printFPS = function () {
		setTimeout(function (){
			console.log("FPS: " + frames / 30);
			frames = 0;
			printFPS();
		}, 30000);
	}
	printFPS();
};


waitFile("biosInput").then(function(buffer) {biosBuffer = buffer;});
waitFile("romInput").then(function(buffer) {disableInput(); start(biosBuffer, buffer); biosBuffer = null;});
$("#demo").click(function(){disableInput(); start(biosBuffer); biosBuffer = null;})





