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

const disableInput = function () {
	$("#biosInput").prop("disabled", true);
	$("#romInput").prop("disabled", true);
	$("#demo").prop("disabled", true);
	$("#importsave").prop("disabled", true);
}

const start = function (biosBuffer, romBuffer) {
	let	cyclesToRun = 0;
	let frames = 0;
	let frameNotComplete = true;

	//hardware
	const MMU = new mmu();
	const CPU = new cpu(0x8000000, MMU);
	const GRAPHICS = new graphics(MMU, CPU, document.getElementById("backingScreen"), document.getElementById("visibleScreen"), function(){frameNotComplete = false;});
	const TIMERCONTROLLER = new timerController(MMU, CPU);
	const KEYPAD = new keypad(MMU);

	KEYPAD.registerEventHandlers();

	const DMACONTROLLER = new DMAController(MMU, CPU, GRAPHICS);
	//sound

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
	// window.instructionNum = 1;
	// $("#runbutton").click(function()
	// {
	// 	if (CPU.halt)
	// 	{
	// 		while (CPU.halt)
	// 		{
	// 			GRAPHICS.update(1);
	// 			TIMERCONTROLLER.update(1)
	// 		}
	// 	}
	// 	else
	// 	{
	// 		if (window.debug)
	// 		{
	// 			while (!CPU.checkInterrupt)
	// 			{
	// 				if (!CPU.halt)
	// 				{
	// 					CPU.run(false, window.instructionNum);
	// 					window.instructionNum ++;
	// 				}
	// 				GRAPHICS.update(1);
	// 				TIMERCONTROLLER.update(1)
	// 			}
	// 		}
	// 		else
	// 		{
	// 			CPU.run(true, window.instructionNum);
	// 			window.instructionNum ++;
	// 			GRAPHICS.update(1);
	// 			TIMERCONTROLLER.update(1);
	// 		}
	// 		GRAPHICS.updateRegisters(CPU.mode);
	// 	}
	// 	//GRAPHICS.updateRegisters(CPU.mode);
	// });

	// while (window.instructionNum <= 0)
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
	//console.log("finished");
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

			CPU.run(cyclesToRun);
			// for (let i = 0; (i + MMU.numCycles) < cyclesToRun && !CPU.halt; i ++)	
			// {	
			// 	i += CPU.run();
			// }
			// MMU.numCycles = 0;
			cyclesToRun = Math.min(GRAPHICS.update(cyclesToRun), TIMERCONTROLLER.update(cyclesToRun));
		}
		frames ++;
		frameNotComplete = true;
		if (!window.debug)
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

	setTimeout(() => {

		window.temp = JSON.stringify({
			mmu: MMU.serialize(), //good
			cpu: CPU.serialize(), //good
			graphics: GRAPHICS.serialize(), //good
			timer: TIMERCONTROLLER.serialize(), //good
			keypad: KEYPAD.serialize(), //good
			dma: DMACONTROLLER.serialize() //good
			// const MMU = new mmu();
			// const CPU = new cpu(0x8000000, MMU);
			// const GRAPHICS = new graphics(MMU, CPU, document.getElementById("backingScreen"), document.getElementById("visibleScreen"), function(){frameNotComplete = false;});
			// const TIMERCONTROLLER = new timerController(MMU, CPU);
			// const KEYPAD = new keypad(MMU);
			// const DMACONTROLLER = new DMAController(MMU, CPU, GRAPHICS);
		});
		console.log("uncompressed");
		console.log(window.temp);

		
		console.log("compressed");
		console.log(LZString.compressToUTF16(window.temp))

	}, 5000);

	//LZString.compressToUTF16(window.temp);
	//let test2 = JSON.parse(LZString.decompressFromUTF16(x))

};


var biosBuffer;
let gbaEmu;

waitFile("biosInput").then(function(buffer) {
	biosBuffer = buffer;
});

waitFile("romInput").then(function(buffer) {
    disableInput(); 

    if (!biosBuffer) {
        biosBuffer = getNormattBIOS();
        console.log("used normatt bios");
    }
    else
        console.log("used inputted bios");


    gbaEmu = new emulator(biosBuffer, buffer);
    gbaEmu.start(); 
});

$("#demo").click(function(){
    disableInput(); 
    
    if (!biosBuffer) {
        biosBuffer = getNormattBIOS();
        console.log("used normatt bios");
    }
    else
        console.log("used inputted bios");

    let m7demo = getTONCDemo();
    gbaEmu = new emulator(biosBuffer, m7demo); 
    gbaEmu.start(); 
})

waitFile("importsave").then(function(buffer) {
    disableInput(); 

    if (!biosBuffer) {
        biosBuffer = getNormattBIOS();
        console.log("used normatt bios");
    }
    else
        console.log("used inputted bios");

	let json = new TextDecoder().decode(buffer);
    gbaEmu = new emulator(biosBuffer, [0]);
	gbaEmu.setState(JSON.parse(json));
    gbaEmu.start(); 
});

//pause button
let pauseButton = document.getElementById("pause");

pauseButton.addEventListener('click', function(e) {
    if (gbaEmu) {
        gbaEmu.togglePause();
        pauseButton.value = gbaEmu.pause ? "unpause" : "pause";

		pauseButton.blur();
    }
});

//dark mode
let darkModeCheckBox = document.getElementById("darkmode");

darkModeCheckBox.addEventListener('change', function(e) {
    if (e.target.checked)
		document.body.style = "background-color: black; color: white";
	else
		document.body.style = "background-color: Gainsboro;";

	darkModeCheckBox.blur();
});

//cap fps
// let capFPS = document.getElementById("capfps");

// capFPS.addEventListener('change', function(e) {
// 	if (gbaEmu) {
// 		if (e.target.checked)
// 			gbaEmu.setFPSCap(60);
// 		else
// 			gbaEmu.setFPSCap(1000);
//     }
// });

// Undefined	"undefined"
// Null	"object"
// Boolean	"boolean"
// Number	"number"
// BigInt	"bigint"
// String	"string"
// Symbol	"symbol" ???
// Function "function"
// Any other object	"object"

isIterable = function (obj) {
	return obj && typeof obj[Symbol.iterator] === 'function';
}

//iterate through all key value pairs of both objects
//if an object has already been visited, ignore (circ references)
deepCompare = function (obj1, obj2) {
	let visited = {};
	let result = "";

	//typeof obj1, obj2 === "object"
	let _deepCompare = function (obj1, obj2) {
		if (obj1 === null && obj2 === null)
			return;
		//null checks
		else if ((obj1 === null || obj2 === null) && (obj1 !== null || obj2 !== null)) {
			result += "\n" + ("obj1 or obj2 is null but not the other??");
			return;
		}
		//array, compare each element
		else if ((isIterable(obj1) || isIterable(obj2))) {
			if (!isIterable(obj1) || !isIterable(obj2))
				result += "\n" + ("obj1 or obj2 is an array in one but not the other??");
			else {
				for (let i = 0; i < Math.max(obj1.length, obj2.length); i ++)
				{
					let val1 = obj1[i];
					let val2 = obj2[i];

					if (typeof val1 === "object" || typeof val2 === "object")
						_deepCompare(val1, val2);
					else if (val1  !== val2) {
						//result += "\n" + ("array check failed");
						result += "\n" + ("skip for now2");
						return;
					}
				}
				result += "\n" + ("array checked out");
			}

			return;
		}
		
		//object, compare each key
		let keys = [];
		keys = keys.concat(Object.keys(obj1));
		keys = keys.concat(Object.keys(obj2));

		for (let i = 0; i < keys.length; i ++)
		{
			let key = keys[i];
			let val1 = obj1[key];
			let val2 = obj2[key];

			//avoid circular ref
			if (visited[val1?.["_id"]] || visited[val2?.["_id"]]) {
				result += "\n" + ("key: " + key + " skipped");
				continue;
			}
			if (typeof val1 === "object" && val1) {
				val1["_id"] = _.uniqueId();
				visited[val1["_id"]] = true;
			}
			if (typeof val2 === "object" && val2) {
				val2["_id"] = _.uniqueId();
				visited[val2["_id"]] = true;
			}

			if (typeof val1 !== typeof val2)
				result += "\n" + ("key: " + key + " does not match. val1: " + val1 + ". val2: " + val2 + ".");
			else {
				if (typeof val1 === "object") {
					result += "\n" + ("comparing sub-object: " + key);
					_deepCompare(val1, val2);
					result += "\n" + ("done comparing sub-object: " + key);
				}
				else {
					if (val1 !== val2)
						result += "\n" + ("key: " + key + " does not match. val1: " + val1 + ". val2: " + val2 + ".");
				}
			}

		}
	};

	_deepCompare(obj1, obj2);
	console.log(result);
}
// let saveStateButton = document.getElementById("savestate");

// saveStateButton.addEventListener('click', function(e) {
//     window.temp = gbaEmu.serialize();
//     //window.save = LZString.compressToUTF16(window.temp);
// 	window.save = window.temp;    
// });


// let restore = document.getElementById("restore");

// restore.addEventListener('click', function(e) {
//     //let decompressed = LZString.decompressFromUTF16(window.save);
//     // gbaEmu.setState(JSON.parse(decompressed));     
// 	let decompressed = window.save;
// 	gbaEmu.setState(decompressed);
// 	//gbaEmu.pause();
// });

datetime = function () {
	let now = new Date();
	let datetime = now.toLocaleDateString() + "_" + now.toLocaleTimeString(); 
	return datetime.replace(" ", "_");
}
//save state related stuff
const displaySaveStateScreen = function(canvasID, saveState) {
	let canvas = document.getElementById(canvasID);
	let context = canvas.getContext("2d");
	let imageData = context.createImageData(240, 160);
	let imageDataArr = new Uint32Array(imageData.data.buffer);
	//save state saves compressed binary data, have to decompress
	copyArrIntoArr(decompressBinaryData(new Uint8Array(saveState.gbaGPU.imageDataArr), 4), imageDataArr);

	context.putImageData(imageData, 0, 0);
}

//save state event handlers
let saveStateOverwritten;
let saveState1;
let saveState2;
let saveState3;

let restoresavestateoverwrittenButton = document.getElementById("restoresavestateoverwritten");
let exportsavestateoverwrittenButton = document.getElementById("exportsavestateoverwritten");

let createsavestate1Button = document.getElementById("createsavestate1");
let restoresavestate1Button = document.getElementById("restoresavestate1");
let exportsavestate1Button = document.getElementById("exportsavestate1");

let createsavestate2Button = document.getElementById("createsavestate2");
let restoresavestate2Button = document.getElementById("restoresavestate2");
let exportsavestate2Button = document.getElementById("exportsavestate2");

let createsavestate3Button = document.getElementById("createsavestate3");
let restoresavestate3Button = document.getElementById("restoresavestate3");
let exportsavestate3Button = document.getElementById("exportsavestate3");

const createButtonUIUpdate = function (saveStateBefore, saveState, restoreButton, exportButton, canvasID, restoreButtonOverwritten, exportButtonOverwritten, restoreCanvasID) {
	if (!gbaEmu)
		return;

	if (saveStateBefore) {
		saveStateOverwritten = saveStateBefore;
		displaySaveStateScreen(restoreCanvasID, saveStateOverwritten);
		restoreButtonOverwritten.removeAttribute("disabled")
		exportButtonOverwritten.removeAttribute("disabled");
	}

	displaySaveStateScreen(canvasID, saveState);
	restoreButton.removeAttribute("disabled");
	exportButton.removeAttribute("disabled");
};

//SS 1
createsavestate1Button.addEventListener('click', function(e) {
	if (!gbaEmu)
		return;

	//debugging for serialization
	//gbaEmu.pause();


	let savestate = gbaEmu.serialize();
	createButtonUIUpdate(saveState1, savestate, restoresavestate1Button, exportsavestate1Button, 'savestate1screen', restoresavestateoverwrittenButton, exportsavestateoverwrittenButton, 'savestateoverwrittenscreen');
	saveState1 = savestate;

	//debugging for serialization
	// console.log("comparing...");
	// window.clone = _.cloneDeep(gbaEmu);
	// gbaEmu.setState(savestate);
	// deepCompare(window.clone, gbaEmu);
	createsavestate1Button.blur();
});

restoresavestate1Button.addEventListener('click', function(e) {
	if (!saveState1)
		return;
	
	gbaEmu.setState(saveState1);

	restoresavestate1Button.blur();
});

exportsavestate1Button.addEventListener('click', function(e) {
	if (!saveState1)
		return;

	download(JSON.stringify(saveState1), "savestate1_" + datetime() + ".json");

	exportsavestate1Button.blur();
});

//SS 2
createsavestate2Button.addEventListener('click', function(e) {
	if (!gbaEmu)
		return;

	let savestate = gbaEmu.serialize();
	createButtonUIUpdate(saveState2, savestate, restoresavestate2Button, exportsavestate2Button, 'savestate2screen', restoresavestateoverwrittenButton, exportsavestateoverwrittenButton, 'savestateoverwrittenscreen');
	saveState2 = savestate;

	createsavestate2Button.blur();
});

restoresavestate2Button.addEventListener('click', function(e) {
	if (!saveState2)
		return;

	gbaEmu.setState(saveState2);

	restoresavestate2Button.blur();
});

exportsavestate2Button.addEventListener('click', function(e) {
	if (!saveState2)
		return;

	download(JSON.stringify(saveState2), "savestate2_" + datetime() + ".json");

	exportsavestate2Button.blur();
});

//SS3
createsavestate3Button.addEventListener('click', function(e) {
	if (!gbaEmu)
		return;

	let savestate = gbaEmu.serialize();
	createButtonUIUpdate(saveState3, savestate, restoresavestate3Button, exportsavestate3Button, 'savestate3screen', restoresavestateoverwrittenButton, exportsavestateoverwrittenButton, 'savestateoverwrittenscreen');
	saveState3 = savestate;

	createsavestate3Button.blur();
});

restoresavestate3Button.addEventListener('click', function(e) {
	if (!saveState3)
		return;

	gbaEmu.setState(saveState3);

	restoresavestate3Button.blur();
});

exportsavestate3Button.addEventListener('click', function(e) {
	if (!saveState3)
		return;

	download(JSON.stringify(saveState3), "savestate3_" + datetime() + ".json");

	exportsavestate3Button.blur();
});

//overwritten
restoresavestateoverwrittenButton.addEventListener('click', function(e) {
	if (!saveStateOverwritten)
		return;

	gbaEmu.setState(saveStateOverwritten);

	restoresavestateoverwrittenButton.blur();
});

exportsavestateoverwrittenButton.addEventListener('click', function(e) {
	if (!saveStateOverwritten)
		return;

	download(JSON.stringify(saveStateOverwritten), "overwrittensave_" + datetime() + ".json");

	exportsavestateoverwrittenButton.blur();
});


//allow pressing 1, 2, 3 as short cut to create saves
$(document).keydown((e) => {
	if (e.key === "1") {
		let savestate = gbaEmu.serialize();
		createButtonUIUpdate(saveState1, savestate, restoresavestate1Button, exportsavestate1Button, 'savestate1screen', restoresavestateoverwrittenButton, exportsavestateoverwrittenButton, 'savestateoverwrittenscreen');
		saveState1 = savestate;
	}
	else if (e.key === "2") {
		let savestate = gbaEmu.serialize();
		createButtonUIUpdate(saveState2, savestate, restoresavestate2Button, exportsavestate2Button, 'savestate2screen', restoresavestateoverwrittenButton, exportsavestateoverwrittenButton, 'savestateoverwrittenscreen');
		saveState2 = savestate;
	}
	else if (e.key === "3") {
		let savestate = gbaEmu.serialize();
		createButtonUIUpdate(saveState3, savestate, restoresavestate3Button, exportsavestate3Button, 'savestate3screen', restoresavestateoverwrittenButton, exportsavestateoverwrittenButton, 'savestateoverwrittenscreen');
		saveState3 = savestate;
	}
});