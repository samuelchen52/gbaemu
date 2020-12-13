	const keypad = function(mmu) {
	this.ioregMem16 = new Uint16Array(mmu.getMemoryRegion("IOREGISTERS").memory.buffer); //0x4000000
	this.vramMem = mmu.getMemoryRegion("VRAM").memory;
	//bits being cleared represents the corresponding button being pressed
	//bits 0 to 9 correspond to buttons
	//A, B, select, start, right, left, up , down, r, and l
	//bit 9 - l      -mapped to k key
	//bit 8 - r      -mapped to l key
	//bit 7 - down   -mapped to down arrow key
	//bit 6 - up     -mapped to up arrow key
	//bit 5 - left   -mapped to left arrow key
	//bit 4 - right  -mapped to right arrow key 
	//bit 3 - start  -mapped to enter key
	//bit 2 - select -mapped to / key
	//bit 1 - B      -mapped to s key
	//bit 0 - A      -mapped to a key
	this.keyCodeToKeyDown = new Uint16Array(255);
	this.keyCodeToKeyUp = new Uint16Array(255);

	//0000001111111111 - 0x3FF, default state

	this.keyCodeToKeyDown.fill(0x3FF);
	this.keyCodeToKeyDown[65]  = 1022; //1111111110 A
	this.keyCodeToKeyDown[83]  = 1021; //1111111101 B
	this.keyCodeToKeyDown[191] = 1019; //1111111011 select
	this.keyCodeToKeyDown[13]  = 1015; //1111110111 start
	this.keyCodeToKeyDown[39]  = 1007; //1111101111 right
	this.keyCodeToKeyDown[37]  = 991;  //1111011111 left
	this.keyCodeToKeyDown[38]  = 959;  //1110111111 up 
	this.keyCodeToKeyDown[40]  = 895;  //1101111111 down
	this.keyCodeToKeyDown[76]  = 767;  //1011111111 r
	this.keyCodeToKeyDown[75]  = 511;  //0111111111 l

	this.keyCodeToKeyUp.fill(0);
	this.keyCodeToKeyUp[65]  = ~1022;
	this.keyCodeToKeyUp[83]  = ~1021;
	this.keyCodeToKeyUp[191] = ~1019;
	this.keyCodeToKeyUp[13]  = ~1015; 
	this.keyCodeToKeyUp[39]  = ~1007;
	this.keyCodeToKeyUp[37]  = ~991;
	this.keyCodeToKeyUp[38]  = ~959;
	this.keyCodeToKeyUp[40]  = ~895;
	this.keyCodeToKeyUp[76]  = ~767;
	this.keyCodeToKeyUp[75]  = ~511;

	this.ioregMem16[0x98] = 0x3FF; //fill KEYINPUT with all 1s i.e. no buttons pressed

	$(document).keydown((e) => {
		//console.log(e.keyCode);
		if (e.keyCode === 68)
		{
			window.debug = true;
		} 
	 	this.ioregMem16[0x98] &= this.keyCodeToKeyDown[e.keyCode];
	});

	$(document).keyup((e) => {
		//console.log("keyup");
	  this.ioregMem16[0x98] |= (this.keyCodeToKeyUp[e.keyCode] & 0x3FF);
	});
};
	

