const keypad = function(mmu) {

	const ioregs = mmu.getMemoryRegion("IOREGISTERS"); //0x4000000
	const vram = mmu.getMemoryRegion("VRAM");
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

	const keyCodeToKeyDown = new Uint8Array(255);
	const keyCodeToKeyUp = new Uint8Array(255);

	keyCodeToKeyDown.fill(65565, 0, 255);
	keyCodeToKeyDown[65] = 254; //11111110
	keyCodeToKeyDown[83] = 253; //11111101
	keyCodeToKeyDown[40] = 247; //11110111
	keyCodeToKeyDown[39] = 239; //11101111
	keyCodeToKeyDown[38] = 223; //11011111
	keyCodeToKeyDown[37] = 191; //10111111
	keyCodeToKeyDown[13] = 127; //01111111

	keyCodeToKeyUp.fill(0, 0, 255);
	keyCodeToKeyUp[65] = ~254;
	keyCodeToKeyUp[83] = ~253;
	keyCodeToKeyUp[40] = ~247;
	keyCodeToKeyUp[39] = ~239;
	keyCodeToKeyUp[38] = ~223;
	keyCodeToKeyUp[37] = ~191;
	keyCodeToKeyUp[13] = ~127;

	//only dealing with the first 8 bits (for now), L and R buttons in next two bits in next byte
	ioregs[0x130] = 255; 

	return {

		setup : function ()
		{
			$(document).keydown(function(e) {
			 	ioregs[0x130] &= keyCodeToKeyDown[e.keyCode];
			});

			$(document).keyup(function(e) {
			  ioregs[0x130] |= keyCodeToKeyUp[e.keyCode];
			});
		}


	}


}