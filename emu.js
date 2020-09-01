
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

//prints the bytes of a 32 or 16 bit number
const printBytes = function (instr, state)
{
	let arr = new Uint8Array(4);
	if (!state) //ARM
	{
		arr[0] = (instr & 0xFF000000) >> 24;
		arr[1] = (instr & 0xFF0000) >> 16;
		arr[2] = (instr & 0xFF00) >> 8;
		arr[3] = (instr & 0xFF);
		console.log(arr[0].toString(16) + " " + arr[1].toString(16) + " " + arr[2].toString(16) + " " + arr[3].toString(16));
	}
	else
	{
		arr[2] = (instr & 0xFF00) >> 8;
		arr[3] = (instr & 0xFF);
		console.log(arr[2].toString(16) + " " + arr[3].toString(16));
	}
}

const memory = {
	BIOS: 	new Uint8Array(16 * 1024), //16 kb of bios
	BOARDWORKRAM: new Uint8Array(256 * 1024), //256 kb of on board work ram
	CHIPWORKRAM: new Uint8Array(32 * 1024), //32 kb of on chip work ram
	IOREGISTERS: new Uint8Array(1023), //1023 bytes for io registers
	PALETTERAM: new Uint8Array(1 * 1024), //1 kb for palette ram
	VRAM: new Uint8Array(96 * 1024), //96 kb for vram
	OAM: new Uint8Array(1 * 1024), //1kb for oam
	ROM: new Uint8Array(32 * 1024 * 1024), //32mb for game rom
	SRAM: new Uint8Array(64 * 1024) //64 kb for sram
}


waitFile().then(async function (buffer) {
	let ROM = memory["ROM"];
	for (let i = 0; i < buffer.length; i+=4) //copy game into memory
	{
		//little endian - LSB stored in the first byte
		ROM[i] = buffer[i]; //LSB
		ROM[i + 1] = buffer[i + 1];
		ROM[i + 2] = buffer[i + 2];
		ROM[i + 3] = buffer[i + 3]; //MSB
	}
	//console.log(ROM);
	const MMU = mmu(memory);
	const CPU = cpu(0x08B4E29A, MMU);
	let opcode;
	let instr;
	let i = 0;
	while (i < 50)
	{
		instr = CPU.fetch();
		opcode = CPU.decode(instr);
		console.log("instr bytes (MSB to LSB): ");
		printBytes(instr, CPU.getState());
		console.log("opcode: " + (CPU.getState() === 0 ? ARMopcodes[opcode] : THUMBopcodes[opcode]) );
		console.log("////////////////////////////////////");
		CPU.execute(opcode);
		await new Promise(function (resolve, reject)
		{
			setTimeout(function(){resolve()}, 2000);
		});
		i ++;
	}


});