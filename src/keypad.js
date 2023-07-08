const keypad = function(mmu) {
	this.ioregMem16 = new Uint16Array(mmu.getMemoryRegion("IOREGISTERS").memory.buffer); //0x4000000
	this.vramMem = mmu.getMemoryRegion("VRAM").memory;
	
	//bits being cleared represents the corresponding button being pressed
	//bits 0 to 9 correspond to buttons
	//default bindings...
	//A, B, select, start, right, left, up , down, r, and l
	//bit 9 - l      -mapped to Q key
	//bit 8 - r      -mapped to E key
	//bit 7 - down   -mapped to S arrow key
	//bit 6 - up     -mapped to W arrow key
	//bit 5 - left   -mapped to A arrow key
	//bit 4 - right  -mapped to D arrow key 
	//bit 3 - start  -mapped to enter key
	//bit 2 - select -mapped to / key
	//bit 1 - B      -mapped to K key
	//bit 0 - A      -mapped to L key
	this.aKeyBinding ="L";
	this.bKeyBinding ="K";
	this.selectKeyBinding ="/";
	this.startKeyBinding ="Enter".toUpperCase();
	this.arrowRightKeyBinding ="D".toUpperCase();
	this.arrowLeftKeyBinding ="A".toUpperCase();
	this.arrowUpKeyBinding ="W".toUpperCase();
	this.arrowDownKeyBinding ="S".toUpperCase();
	this.rKeyBinding ="Q";
	this.lKeyBinding ="E";

	this.initKeyCodeMappings();
};


//mappings will be used to map keycodes of user key events to the bits
//that will be used with bitwise and / or to clear the KEYINPUT ioreg to "trigger" keypad events in emu
keypad.prototype.initKeyCodeMappings = function () {
	this.keyCodeToKeyDown = {};
	this.keyCodeToKeyUp = {};

	//0000001111111111 - 0x3FF, default state

	this.keyCodeToKeyDown[this.aKeyBinding]  = 1022; //1111111110 A
	this.keyCodeToKeyDown[this.bKeyBinding]  = 1021; //1111111101 B
	this.keyCodeToKeyDown[this.selectKeyBinding] = 1019; //1111111011 select
	this.keyCodeToKeyDown[this.startKeyBinding]  = 1015; //1111110111 start
	this.keyCodeToKeyDown[this.arrowRightKeyBinding]  = 1007; //1111101111 right
	this.keyCodeToKeyDown[this.arrowLeftKeyBinding]  = 991;  //1111011111 left
	this.keyCodeToKeyDown[this.arrowUpKeyBinding]  = 959;  //1110111111 up 
	this.keyCodeToKeyDown[this.arrowDownKeyBinding]  = 895;  //1101111111 down
	this.keyCodeToKeyDown[this.rKeyBinding]  = 767;  //1011111111 r
	this.keyCodeToKeyDown[this.lKeyBinding]  = 511;  //0111111111 l

	this.keyCodeToKeyUp[this.aKeyBinding]  = ~1022;
	this.keyCodeToKeyUp[this.bKeyBinding]  = ~1021;
	this.keyCodeToKeyUp[this.selectKeyBinding] = ~1019;
	this.keyCodeToKeyUp[this.startKeyBinding]  = ~1015; 
	this.keyCodeToKeyUp[this.arrowRightKeyBinding]  = ~1007;
	this.keyCodeToKeyUp[this.arrowLeftKeyBinding]  = ~991;
	this.keyCodeToKeyUp[this.arrowUpKeyBinding]  = ~959;
	this.keyCodeToKeyUp[this.arrowDownKeyBinding]  = ~895;
	this.keyCodeToKeyUp[this.rKeyBinding]  = ~767;
	this.keyCodeToKeyUp[this.lKeyBinding]  = ~511;

	this.ioregMem16[0x98] = 0x3FF; //fill KEYINPUT with all 1s i.e. no buttons pressed
}

keypad.prototype.triggerEmuKeyPress = function(keyCode) {
	//set the key down in ioreg mem
	let bits = this.keyCodeToKeyDown[keyCode];
	if (bits !== undefined)
		this.ioregMem16[0x98] &= bits;
}

keypad.prototype.triggerEmuKeyUp = function(keyCode) {
	let bits = this.keyCodeToKeyUp[keyCode];
	if (bits !== undefined)
		this.ioregMem16[0x98] |= (bits & 0x3FF);
}

keypad.prototype.setKeyHighlighted = function(keyCode, highlight) {
	let elementID;

	switch(keyCode)
	{
		case this.aKeyBinding:
			elementID = "aKeyRebindButton";
			break;
		case this.bKeyBinding:
			elementID = "bKeyRebindButton";
			break;
		case this.selectKeyBinding:
			elementID = "selectKeyRebindButton";
			break;
		case this.startKeyBinding:
			elementID = "startKeyRebindButton";
			break;
		case this.arrowRightKeyBinding:
			elementID = "rightKeyRebindButton";
			break;
		case this.arrowLeftKeyBinding:
			elementID = "leftKeyRebindButton";
			break;
		case this.arrowUpKeyBinding:
			elementID = "upKeyRebindButton";
			break;
		case this.arrowDownKeyBinding:
			elementID = "downKeyRebindButton";
			break;
		case this.rKeyBinding:
			elementID = "rKeyRebindButton";
			break;
		case this.lKeyBinding:
			elementID = "lKeyRebindButton";
			break;
	}

	if (elementID) {
		if (highlight)
			$("#" + elementID).addClass("bg-secondary");
		else
			$("#" + elementID).removeClass("bg-secondary");
	}
}

keypad.prototype.registerEventHandlers = function() {
	//for triggering key presses in the emulator
	$(document).keydown((e) => {
		let code = e.key.toUpperCase();
		//set the key down in ioreg mem
		this.triggerEmuKeyPress(code);
		//toggle highlight in the ui
		this.setKeyHighlighted(code, true);
	});

	//for triggering key up in the emulator
	$(document).keyup((e) => {
		let code = e.key.toUpperCase();
		//set the key up in ioreg mem
		this.triggerEmuKeyUp(code);
	  	//switch and toggle hightlight
	  	this.setKeyHighlighted(code, false);
	});


	//event handlers for rebinding keys
	//on rebind button click, undisable, and clear out value
	//on input value change, disable, and set state here

	let keyElementArr = [];
	let rebindElementArr = [];
	let keyBindingPropArr = [];

	keyElementArr.push($("#lKeyBindingCode"));
	keyElementArr.push($("#rKeyBindingCode"));
	keyElementArr.push($("#aKeyBindingCode"));
	keyElementArr.push($("#bKeyBindingCode"));
	keyElementArr.push($("#upKeyBindingCode"));
	keyElementArr.push($("#downKeyBindingCode"));
	keyElementArr.push($("#leftKeyBindingCode"));
	keyElementArr.push($("#rightKeyBindingCode"));
	keyElementArr.push($("#selectKeyBindingCode"));
	keyElementArr.push($("#startKeyBindingCode"));

	rebindElementArr.push($("#lKeyRebindButton"));
	rebindElementArr.push($("#rKeyRebindButton"));
	rebindElementArr.push($("#aKeyRebindButton"));
	rebindElementArr.push($("#bKeyRebindButton"));
	rebindElementArr.push($("#upKeyRebindButton"));
	rebindElementArr.push($("#downKeyRebindButton"));
	rebindElementArr.push($("#leftKeyRebindButton"));
	rebindElementArr.push($("#rightKeyRebindButton"));
	rebindElementArr.push($("#selectKeyRebindButton"));
	rebindElementArr.push($("#startKeyRebindButton"));

	keyBindingPropArr.push("lKeyBinding");
	keyBindingPropArr.push("rKeyBinding");
	keyBindingPropArr.push("aKeyBinding");
	keyBindingPropArr.push("bKeyBinding");
	keyBindingPropArr.push("arrowUpKeyBinding");
	keyBindingPropArr.push("arrowDownKeyBinding");
	keyBindingPropArr.push("arrowLeftKeyBinding");
	keyBindingPropArr.push("arrowRightKeyBinding");
	keyBindingPropArr.push("selectKeyBinding");
	keyBindingPropArr.push("startKeyBinding");


	for (let i = 0; i < keyElementArr.length; i ++)
	{
		let keyBindingDisplay = keyElementArr[i];
		let rebindButton = rebindElementArr[i];
		let prop = keyBindingPropArr[i];

		keyBindingDisplay.val(this[prop]);
		rebindButton.val(this[prop]);

		rebindButton.click((e) => {
			keyBindingDisplay.prop('disabled', false);
			keyBindingDisplay.attr('hidden', false);
			keyBindingDisplay.focus();
		});
		keyBindingDisplay.keydown((e) => {
			keyBindingDisplay.prop('disabled', true);
			keyBindingDisplay.attr('hidden', true);
			let code = e.key.toUpperCase();

			//prevent duplicate mappings
			if (!keyBindingPropArr.map(x => this[x]).includes(code)) {
				keyBindingDisplay.val(code);
				rebindButton.val(code);
				this[prop] = code;
				this.initKeyCodeMappings();
			}
		});
		keyBindingDisplay.focusout((e) => {
			keyBindingDisplay.prop('disabled', true);
			keyBindingDisplay.attr('hidden', true);
		});
	}
};	

keypad.prototype.deregisterEventHandlers = function() {
	$(document).off('keyup');
	$(document).off('keydown');

	let keyElementArr = [];
	let rebindElementArr = [];
	let keyBindingPropArr = [];

	keyElementArr.push($("#lKeyBindingCode"));
	keyElementArr.push($("#rKeyBindingCode"));
	keyElementArr.push($("#aKeyBindingCode"));
	keyElementArr.push($("#bKeyBindingCode"));
	keyElementArr.push($("#upKeyBindingCode"));
	keyElementArr.push($("#downKeyBindingCode"));
	keyElementArr.push($("#leftKeyBindingCode"));
	keyElementArr.push($("#rightKeyBindingCode"));
	keyElementArr.push($("#selectKeyBindingCode"));
	keyElementArr.push($("#startKeyBindingCode"));

	rebindElementArr.push($("#lKeyRebindButton"));
	rebindElementArr.push($("#rKeyRebindButton"));
	rebindElementArr.push($("#aKeyRebindButton"));
	rebindElementArr.push($("#bKeyRebindButton"));
	rebindElementArr.push($("#upKeyRebindButton"));
	rebindElementArr.push($("#downKeyRebindButton"));
	rebindElementArr.push($("#leftKeyRebindButton"));
	rebindElementArr.push($("#rightKeyRebindButton"));
	rebindElementArr.push($("#selectKeyRebindButton"));
	rebindElementArr.push($("#startKeyRebindButton"));

	keyBindingPropArr.push("lKeyBinding");
	keyBindingPropArr.push("rKeyBinding");
	keyBindingPropArr.push("aKeyBinding");
	keyBindingPropArr.push("bKeyBinding");
	keyBindingPropArr.push("arrowUpKeyBinding");
	keyBindingPropArr.push("arrowDownKeyBinding");
	keyBindingPropArr.push("arrowLeftKeyBinding");
	keyBindingPropArr.push("arrowRightKeyBinding");
	keyBindingPropArr.push("selectKeyBinding");
	keyBindingPropArr.push("startKeyBinding");


	for (let i = 0; i < keyElementArr.length; i ++)
	{
		let keyBindingDisplay = keyElementArr[i];
		let rebindButton = rebindElementArr[i];

		rebindButton.off('click');
		keyBindingDisplay.off('keydown');
	}
};	

//returns JSON of inner state
keypad.prototype.serialize = function() {
	let copy = {};

	copy.aKeyBinding = this.aKeyBinding;
	copy.bKeyBinding = this.bKeyBinding;
	copy.selectKeyBinding = this.selectKeyBinding;
	copy.startKeyBinding = this.startKeyBinding;
	copy.arrowRightKeyBinding = this.arrowRightKeyBinding;
	copy.arrowLeftKeyBinding = this.arrowLeftKeyBinding;
	copy.arrowUpKeyBinding = this.arrowUpKeyBinding;
	copy.arrowDownKeyBinding = this.arrowDownKeyBinding;
	copy.rKeyBinding = this.rKeyBinding;
	copy.lKeyBinding = this.lKeyBinding;

	copy.keyCodeToKeyDown = this.keyCodeToKeyDown;
	copy.keyCodeToKeyUp = this.keyCodeToKeyUp;

	return copy;
}
  
keypad.prototype.setState = function(saveState) {
	this.aKeyBinding = saveState.aKeyBinding;
	this.bKeyBinding = saveState.bKeyBinding;
	this.selectKeyBinding = saveState.selectKeyBinding;
	this.startKeyBinding = saveState.startKeyBinding;
	this.arrowRightKeyBinding = saveState.arrowRightKeyBinding;
	this.arrowLeftKeyBinding = saveState.arrowLeftKeyBinding;
	this.arrowUpKeyBinding = saveState.arrowUpKeyBinding;
	this.arrowDownKeyBinding = saveState.arrowDownKeyBinding;
	this.rKeyBinding = saveState.rKeyBinding;
	this.lKeyBinding = saveState.lKeyBinding;

	this.keyCodeToKeyDown = saveState.keyCodeToKeyDown;
	this.keyCodeToKeyUp = saveState.keyCodeToKeyUp;
}