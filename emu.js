
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
		let BIOS = MMU.getMemoryRegion("BIOS");
		for (let i = 0; i < biosBuffer.length; i ++)
		{
			BIOS[i] = biosBuffer[i]; //LSB
			BIOS[i + 1] = biosBuffer[i + 1];
			BIOS[i + 2] = biosBuffer[i + 2];
			BIOS[i + 3] = biosBuffer[i + 3]; //MSB
		}
		console.log("copied BIOS into memory");
	}

	//copy ROM into memory
	let ROM = MMU.getMemoryRegion("ROM");
	let ROM2 = MMU.getMemoryRegion("ROM2");
	for (let i = 0; i < Math.min(ROM.length, buffer.length); i+=4)
	{
		ROM[i] = buffer[i]; //LSB
		ROM[i + 1] = buffer[i + 1];
		ROM[i + 2] = buffer[i + 2];
		ROM[i + 3] = buffer[i + 3]; //MSB
	}
	for (let i = ROM.length; i < buffer.length; i ++)
	{
		let p = i & 0xFFFFFF;
		ROM2[p] = buffer[p]; //LSB
		ROM2[p + 1] = buffer[p + 1];
		ROM2[p + 2] = buffer[p + 2];
		ROM2[p + 3] = buffer[p + 3]; //MSB
	}
	console.log("copied ROM into memory");

	buffer = null;
	biosBuffer = null;

	//set up hardware
	let frameNotComplete = true;

	const CPU = new cpu(0x08000000, MMU);
	const GRAPHICS = new graphics(MMU, CPU.registers, function(){frameNotComplete = false;});
	const KEYPAD = new keypad(MMU);

	CPU.initPipeline();
	KEYPAD.initInput();


	//for debugging
	let i = 1;
	let frames = 0;
	$("#runbutton").click(function()
	{
		CPU.run(true, i);
		GRAPHICS.updateRegisters(CPU.mode);
		GRAPHICS.updateScreen();
		i ++;
		//console.log(i);
	});

	//for debugging
	// while (i <= 208830)
	// {

	// 	try {
	// 		CPU.run(false, i);
	// 		// GRAPHICS.updateRegisters(CPU.getMode());
	// 		GRAPHICS.updateScreen();
	// 	}
	// 	catch (err)
	// 	{
	// 		console.log("error on instruction " + i );
	// 		//download(strData, strFileName);
	// 		throw (err);
	// 	}
	// 	// await new Promise(function (resolve, reject)
	// 	// {
	// 	// 	resolve();
	// 	// 	//setTimeout(function(){resolve()}, 10);
	// 	// });
	// 	i ++;
	// }
	console.log("finished");

	const printFPS = function () {
		setTimeout(function (){
			console.log("FPS: " + frames / 30);
			frames = 0;
			printFPS();
		}, 30000);
	}

	//for input
	const executeFrame = function() {
		while (frameNotComplete)
		{
			CPU.run(false, i);
			GRAPHICS.updateScreen();
			i ++;
		}
		frameNotComplete = true;
		frames ++;
		setTimeout(executeFrame, 10);
	};
	setTimeout(executeFrame, 10);
	printFPS();




	//download(strData, strFileName);
});