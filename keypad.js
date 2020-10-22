const keypad = function(mmu) {
	this.mmu = mmu;

	this.ioregMem = mmu.getMemoryRegion("IOREGISTERS").memory; //0x4000000
	this.vramMem = mmu.getMemoryRegion("VRAM").memory;
	//KEYINPUT - Key Status (read-only) 0x4000130 -> ioregs[0x130] + ioregs[0x131] << 8
	//bits being cleared represents the corresponding button being pressed
	//bits 0 to 9 correspond to buttons
	//A, B, select, start, right, left, up , down, r, and l
	//bits 10 to 15 unused

	//KEYCNT - Key Interrupt Control (read/write only) 0x4000132 -> ioregs[0x132] + ioregs[0x133] << 8
	//KEYCNT not really used, vblank is used instead

	//just going to implement, button A, button B, directional buttons, and start for now
	//button A -> a (keycode 65)
	//button B -> s (keycode 83)
	//directional buttons -> arrow keys (keycode: down, right, up, left -> 40, 39, 38, 37)
	//start -> enter (keycode 13)

	this.keyCodeToKeyDown = new Uint8Array(255);
	this.keyCodeToKeyUp = new Uint8Array(255);

	this.keyCodeToKeyDown.fill(65565);
															//0A 1B 2select 3start 4right 5left 6up 7down 8r 9l
	this.keyCodeToKeyDown[65] = 254; //11111110
	this.keyCodeToKeyDown[83] = 253; //11111101
	this.keyCodeToKeyDown[13] = 247; //11110111
	this.keyCodeToKeyDown[39] = 239; //11101111
	this.keyCodeToKeyDown[37] = 223; //11011111
	this.keyCodeToKeyDown[38] = 191; //10111111
	this.keyCodeToKeyDown[40] = 127; //01111111

	this.keyCodeToKeyUp.fill(0);
	this.keyCodeToKeyUp[65] = ~254;
	this.keyCodeToKeyUp[83] = ~253;
	this.keyCodeToKeyUp[13] = ~247; 
	this.keyCodeToKeyUp[39] = ~239;
	this.keyCodeToKeyUp[37] = ~223;
	this.keyCodeToKeyUp[38] = ~191;
	this.keyCodeToKeyUp[40] = ~127;

	//only dealing with the first 8 bits (for now), L and R buttons in next two bits in next byte
	this.ioregMem[0x130] = 255; 

	$(document).keydown(function(e) {
		//console.log("keydown");
	 	this.ioregMem[0x130] &= this.keyCodeToKeyDown[e.keyCode];
	}.bind(this));

	$(document).keyup(function(e) {
		//console.log("keyup");
	  this.ioregMem[0x130] |= this.keyCodeToKeyUp[e.keyCode];
	}.bind(this));
};
	

