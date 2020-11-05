checkEndian();

const waitFile = function(fileName) //waits for file input (chip8 rom)
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

var biosBuffer;

waitFile("biosInput").then(function (buffer) {biosBuffer = buffer;})


waitFile("romInput").then(async function (buffer) {
	const MMU = new mmu();

	//copy BIOS into memory
	if (biosBuffer !== undefined)
	{
		let biosMem = MMU.getMemoryRegion("BIOS").memory;
		for (let i = 0; i < biosBuffer.length; i ++)
		{
			biosMem[i] = biosBuffer[i]; //LSB
			biosMem[i + 1] = biosBuffer[i + 1];
			biosMem[i + 2] = biosBuffer[i + 2];
			biosMem[i + 3] = biosBuffer[i + 3]; //MSB
		}
		console.log("copied BIOS into memory");
	}

	//copy ROM into memory
	let rom1Mem = MMU.getMemoryRegion("ROM1").memory;
	let rom2Mem = MMU.getMemoryRegion("ROM2").memory;
	for (let i = 0; i < Math.min(rom1Mem.length, buffer.length); i+=4)
	{
		rom1Mem[i] = buffer[i]; //LSB
		rom1Mem[i + 1] = buffer[i + 1];
		rom1Mem[i + 2] = buffer[i + 2];
		rom1Mem[i + 3] = buffer[i + 3]; //MSB
	}
	for (let i = rom1Mem.length; i < buffer.length; i ++)
	{
		let p = i & 0xFFFFFF;
		rom2Mem[p] = buffer[p]; //LSB
		rom2Mem[p + 1] = buffer[p + 1];
		rom2Mem[p + 2] = buffer[p + 2];
		rom2Mem[p + 3] = buffer[p + 3]; //MSB
	}
	console.log("copied ROM into memory");

	buffer = null;
	biosBuffer = null;

	let frameNotComplete = true;

	//set up hardware
	const CPU = new cpu(0x08000000, MMU);
	const GRAPHICS = new graphics(MMU, CPU, function(){frameNotComplete = false;});
	const KEYPAD = new keypad(MMU);

	//for debugging
	let instructionNum = 1;
	let cnt = 0;
	let frames = 0;

	$("#runbutton").click(function()
	{
		CPU.run(true, instructionNum);
		instructionNum ++;
		cnt ++;
		GRAPHICS.updateRegisters(CPU.mode);
		if (cnt === 4)
		{
		 GRAPHICS.pushPixel();
		 cnt = 0;
		}
	});

	//for debugging
	// while (instructionNum <= 281800) //281857
	// {

	// 	try {
	// 		CPU.run(false, instructionNum);
	// 		instructionNum ++;
	// 		CPU.run(false, instructionNum);
	// 		instructionNum ++;
	// 		CPU.run(false, instructionNum);
	// 		instructionNum ++;
	// 		CPU.run(false, instructionNum);
	// 		instructionNum ++;
	// 		GRAPHICS.pushPixel();
	// 	}
	// 	catch (err)
	// 	{
	// 		console.log("error on instruction " + instructionNum );
	// 		//download(strData, strFileName);
	// 		throw (err);
	// 	}
	// 	// await new Promise(function (resolve, reject)
	// 	// {
	// 	// 	resolve();
	// 	// 	//setTimeout(function(){resolve()}, 10);
	// 	// });
	// 	//instructionNum ++;
	// }
	console.log("finished");
	// download(strData, strFileName);

	const printFPS = function () {
		setTimeout(function (){
			console.log("FPS: " + frames / 30);
			frames = 0;
			printFPS();
		}, 30000);
	}

	const executeFrame = function() {
		while (frameNotComplete)
		{
			// if (instructionNum >= 575612) //576930
			// {
			// 	return;
			// }
			// for (let i = 0; i < 4; i ++)
			// {
				CPU.run(false, instructionNum);
				instructionNum ++;
				CPU.run(false, instructionNum);
				instructionNum ++;
				CPU.run(false, instructionNum);
				instructionNum ++;
				CPU.run(false, instructionNum);
				instructionNum ++;
			// }
			GRAPHICS.pushPixel();
		}
		//console.log("FRAME");
		frames ++;
		frameNotComplete = true;
		setTimeout(executeFrame, 10);
	};

	setTimeout(executeFrame, 10);
	printFPS();


});
