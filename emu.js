
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

const memory = [
	new Uint8Array(16 * 1024), //16 kb of BIOS
	new Uint8Array(256 * 1024), //256 kb of on board work ram (EWRAM)
	new Uint8Array(32 * 1024), //32 kb of on chip work ram (IEWRAM)
	new Uint8Array(1023), //1023 bytes for io registers
	new Uint8Array(1 * 1024), //1 kb for palette ram
	new Uint8Array(96 * 1024), //96 kb for vram
	new Uint8Array(1 * 1024), //1kb for oam
	new Uint8Array(32 * 1024 * 1024), //32mb for game rom
	new Uint8Array(64 * 1024) //64 kb for sram
];


waitFile().then(async function (buffer) {
	let ROM = memory[7];
	for (let i = 0; i < buffer.length; i+=4) //copy game into memory
	{
		ROM[i] = buffer[i]; //LSB
		ROM[i + 1] = buffer[i + 1];
		ROM[i + 2] = buffer[i + 2];
		ROM[i + 3] = buffer[i + 3]; //MSB
	}
	//console.log(ROM);
	let frameNotComplete = true;

	const MMU = mmu(memory);
	const CPU = cpu(0x08000000, MMU);
	const GRAPHICS = graphics(MMU, CPU.getRegisters(), function(){frameNotComplete = false;});
	const KEYPAD = keypad(MMU);



	let i = 1;
	$("#runbutton").click(function()
	{
		CPU.run(true, i);
		GRAPHICS.updateRegisters(CPU.getMode());
		GRAPHICS.updateScreen();
		i ++;
		//console.log(i);
	});
	KEYPAD.setup();

	//let time = new Date().getTime();

	//to execute frame by frame, while allowing for events in the event loop to execute
	//cant do in linear fashion
	//use a recursive function
	//the function should execute instruction, and cycle through hardware (graphics, sound) for one frame
	//when everything is done, it should call itself again, using set time out
	//setimeout with a delay allows for keyboard events to propagate through e.g. -> event loop [executeFrame, keypress, keypress]
	//at 60 fps (the frame rate of gba), there would be 60 settimeout delays to allow for keyboard events to come through, solving the issue of the 
	//blocking code
	//of course, this means you need to optimize shit

	// for debugging
	while (i <= 349040)
	{

		try {
			CPU.run(false, i);
			// GRAPHICS.updateRegisters(CPU.getMode());
			//GRAPHICS.updateScreen();
		}
		catch (err)
		{
			console.log("error on instruction " + i );
			//download(strData, strFileName);
			throw (err);
		}
		// await new Promise(function (resolve, reject)
		// {
		// 	resolve();
		// 	//setTimeout(function(){resolve()}, 10);
		// });
		i ++;
	}


	// for graphics
	// const executeFrame = function() {
	// 	while (frameNotComplete)
	// 	{
	// 		CPU.run(false, i);
	// 		GRAPHICS.updateScreen();
	// 	}
	// 	frameNotComplete = true;
	// 	setTimeout(executeFrame, 10);
	// }
	// setTimeout(executeFrame, 10);





	//download(strData, strFileName);
	alert("finished");

	//let timeElapsed = new Date().getTime() - time;
	//console.log("took " + timeElapsed / 1000 + " seconds to execute " + (i - 1)  + " instructions");

});