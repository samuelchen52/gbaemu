
const waitFile = function() //waits for file input (chip8 rom)
{
	return new Promise(function (resolve, reject)
	{
		let fileInput = document.getElementById('fileInput');

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


waitFile().then(async function (buffer) {
	const MMU = mmu();

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

	let frameNotComplete = true;

	const CPU = cpu(0x08000000, MMU);
	const GRAPHICS = graphics(MMU, CPU.getRegisters(), function(){frameNotComplete = false;});
	const KEYPAD = keypad(MMU);



	let i = 1;
	let frames = 0;
	$("#runbutton").click(function()
	{
		CPU.run(true, i);
		GRAPHICS.updateRegisters(CPU.getMode());
		GRAPHICS.updateScreen();
		i ++;
		//console.log(i);
	});
	KEYPAD.setup();

	// for debugging
	// while (i <= 1200)
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
	console.log("finished");

	//let timeElapsed = new Date().getTime() - time;
	//console.log("took " + timeElapsed / 1000 + " seconds to execute " + (i - 1)  + " instructions");

});