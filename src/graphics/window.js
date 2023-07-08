const windowController = function(WIN0H, WIN1H, WIN0V, WIN1V, WININ0, WININ1, WINOUT, WINOBJ, sprites) {

	//The DISPCNT Register
	//DISPCNT Bits 13-15 are used to enable Window 0, Window 1, and/or OBJ Window regions, if any of these regions is enabled then the "Outside of Windows" region is automatically enabled, too.
	//DISPCNT Bits 8-12 are kept used as master enable bits for the BG0-3,OBJ layers, a layer is displayed only if both DISPCNT and WININ/OUT enable bits are set.

	//In case that more than one window is enabled, and that these windows do overlap, Window 0 is having highest priority, Window 1 medium, and Obj Window lowest priority. Outside of Window is having zero priority, it is used for all dots which are not inside of any window region.

	//bottom and right exclusive
	//win0 dimensions
	this.win0Right = 0;
	this.win0Left = 0
	this.win0Bottom = 0;
	this.win0Top = 0;

	//win1 dimensions
	this.win1Right = 0;
	this.win1Left = 0
	this.win1Bottom = 0;
	this.win1Top = 0;

	//BG0, BG1, BG2, BG3, OBJ, BLD display bits
	this.win0CNT = [0, 0, 0, 0, 0, 0];
	this.win1CNT = [0, 0, 0, 0, 0, 0];
	this.winOutCNT = [0, 0, 0, 0, 0, 0];
	this.winOBJCNT = [0, 0, 0, 0, 0, 0];
	this.windowCNT = [this.win0CNT, this.win1CNT, this.winOutCNT, this.winOBJCNT];

	//enable bits (dispcnt)
	this.winInDisplay = 0;
	this.winOBJDisplay = 0;

	//the actual window, marked by value in array (0 for win0, 1 for win1, 2 for winout, 3 for winobj)
	//one buffer for win0, win1, win0 and win1, if obj is enabled, will be merged
	//all possible configs
	//winin disabled + winobj enabled/disabled
	//win1 enabled + winobj enabled/disabled
	//win0 enabled + winobj enabled/disabled
	//winin enabled + winobj enabled/disabled
	this.win0ScanlineBuffer = [];
	this.win1ScanlineBuffer = [];
	this.winInScanlineBuffer = [];
	for (let i = 0; i < 160; i ++)
	{
		this.win0ScanlineBuffer.push(new Uint8Array(240).fill(2));
		this.win1ScanlineBuffer.push(new Uint8Array(240).fill(2));
		this.winInScanlineBuffer.push(new Uint8Array(240).fill(2));
	}
	this.objScanlineBuffer = new Uint8Array(240).fill(2); 

	this.sprites = sprites;

	WIN0H.addCallback((newWIN0HVal) => {this.updateWIN0H(newWIN0HVal);});
	WIN1H.addCallback((newWIN1HVal) => {this.updateWIN1H(newWIN1HVal);});
	WIN0V.addCallback((newWIN0VVal) => {this.updateWIN0V(newWIN0VVal);});
	WIN1V.addCallback((newWIN1VVal) => {this.updateWIN1V(newWIN1VVal);});
	WININ0.addCallback((newWININ0Val) => {this.updateWININ0(newWININ0Val);});
	WININ1.addCallback((newWININ1Val) => {this.updateWININ1(newWININ1Val);});
	WINOUT.addCallback((newWINOUTVal) => {this.updateWINOUT(newWINOUTVal);});
	WINOBJ.addCallback((newWINOBJVal) => {this.updateWINOBJ(newWINOBJVal);});
};

//dimensions
windowController.prototype.updateWIN0H = function (newWIN0HVal) {
	let oldRight = this.win0Right;
	let oldLeft = this.win0Left;

	this.win0Right = newWIN0HVal & 255;
	this.win0Left = (newWIN0HVal >>> 8) & 255;

	this.win0Right = this.win0Right > 240 ? 240 : this.win0Right;
	this.win0Left = this.win0Left > this.win0Right ? this.win0Right : this.win0Left;

	this.updateWin0((oldRight !== this.win0Right) || (oldLeft !== this.win0Left));
};

windowController.prototype.updateWIN1H = function (newWIN1HVal) {
	let oldRight = this.win1Right;
	let oldLeft = this.win1Left;

	this.win1Right = newWIN1HVal & 255;
	this.win1Left = (newWIN1HVal >>> 8) & 255;

	this.win1Right = this.win1Right > 240 ? 240 : this.win1Right;
	this.win1Left = this.win1Left > this.win1Right ? this.win1Right : this.win1Left;

	this.updateWin1((oldRight !== this.win1Right) || (oldLeft !== this.win1Left));
};

windowController.prototype.updateWIN0V = function (newWIN0VVal) {
	let oldBottom = this.win0Bottom;
	let oldTop = this.win0Top;

	this.win0Bottom = newWIN0VVal & 255;
	this.win0Top = (newWIN0VVal >>> 8) & 255;

	this.win0Bottom = this.win0Bottom > 160 ? 160 : this.win0Bottom;
	this.win0Top = this.win0Top > this.win0Bottom ? this.win0Bottom : this.win0Top;

	this.updateWin0((oldBottom !== this.win0Bottom) || (oldTop !== this.win0Top));
};

windowController.prototype.updateWIN1V = function (newWIN1VVal) {
	let oldBottom = this.win1Bottom;
	let oldTop = this.win1Top;

	this.win1Bottom = newWIN1VVal & 255;
	this.win1Top = (newWIN1VVal >>> 8) & 255;

	this.win1Bottom = this.win1Bottom > 160 ? 160 : this.win1Bottom;
	this.win1Top = this.win1Top > this.win1Bottom ? this.win1Bottom : this.win1Top;

	this.updateWin1((oldBottom !== this.win1Bottom) || (oldTop !== this.win1Top));
};

//control
windowController.prototype.updateWININ0 = function (newWININ0Val) {
	this.win0CNT[0] = newWININ0Val & 1;
	this.win0CNT[1] = newWININ0Val & 2;
	this.win0CNT[2] = newWININ0Val & 4;
	this.win0CNT[3] = newWININ0Val & 8;
	this.win0CNT[4] = newWININ0Val & 16;
	this.win0CNT[5] = newWININ0Val & 32;
};

windowController.prototype.updateWININ1 = function (newWININ1Val) {
	this.win1CNT[0] = newWININ1Val & 1;
	this.win1CNT[1] = newWININ1Val & 2;
	this.win1CNT[2] = newWININ1Val & 4;
	this.win1CNT[3] = newWININ1Val & 8;
	this.win1CNT[4] = newWININ1Val & 16;
	this.win1CNT[5] = newWININ1Val & 32;
};

windowController.prototype.updateWINOUT = function (newWINOUTVal) {
	this.winOutCNT[0] = newWINOUTVal & 1;
	this.winOutCNT[1] = newWINOUTVal & 2;
	this.winOutCNT[2] = newWINOUTVal & 4;
	this.winOutCNT[3] = newWINOUTVal & 8;
	this.winOutCNT[4] = newWINOUTVal & 16;
	this.winOutCNT[5] = newWINOUTVal & 32;
};

windowController.prototype.updateWINOBJ = function (newWINOBJVal) {
	this.winOBJCNT[0] = newWINOBJVal & 1;
	this.winOBJCNT[1] = newWINOBJVal & 2;
	this.winOBJCNT[2] = newWINOBJVal & 4;
	this.winOBJCNT[3] = newWINOBJVal & 8;
	this.winOBJCNT[4] = newWINOBJVal & 16;
	this.winOBJCNT[5] = newWINOBJVal & 32;
};

windowController.prototype.getEnableScanline = function (scanline) {
	switch (this.winInDisplay)
	{
		//winin disabled
		case 0:
		if (this.winOBJDisplay)
		{
			//this will just copy over object window to object window
			return this.getObjectWindow(scanline, this.objScanlineBuffer);
		}
		else
		{
			throw Error("should not be being called if window not enabled...");
		}
		break;

		//win0 enabled
		case 1:
		if (this.winOBJDisplay)
		{
			//return obj window merged with win0
			return this.getObjectWindow(scanline, this.win0ScanlineBuffer[scanline]);
		}
		//return win0
		return this.win0ScanlineBuffer[scanline];
		break;

		//win1 enabled
		case 2:
		if (this.winOBJDisplay)
		{
			//return obj window merged with win1
			return this.getObjectWindow(scanline, this.win1ScanlineBuffer[scanline]);
		}
		return this.win1ScanlineBuffer[scanline];
		//return win1
		break;

		//winin enabled
		case 3:
		if (this.winOBJDisplay)
		{
			//return obj window merged with winin
			return this.getObjectWindow(scanline, this.winInScanlineBuffer[scanline]);
		}
		//return winin
		return this.winInScanlineBuffer[scanline];
		break;
	}
	throw Error("window display bits being parsed incorrectly?");
};


//window display bits (msb first) -> winobj, win1, win0
windowController.prototype.setDisplay = function (windowDisplayBits) {
	this.winInDisplay = windowDisplayBits & 3;
	this.winOBJDisplay = windowDisplayBits & 4;

	return windowDisplayBits;
};

windowController.prototype.getObjectWindow = function (scanline, upperLayer) {
	let sprites = this.sprites;
	let objScanlineBuffer = this.objScanlineBuffer.fill(2);

	for (let i = 127; i >= 0; i --)
	{
		if (sprites[i].shouldRenderWindow(scanline))
		{
			sprites[i].renderScanlineWindow[sprites[i].mode](objScanlineBuffer, scanline);
		}
	}

	for (let i = 0; i < 240; i ++)
	{
		objScanlineBuffer[i] = (upperLayer[i] === 2) ? objScanlineBuffer[i] : upperLayer[i];
	}

	return objScanlineBuffer;
};

windowController.prototype.updateWin0 = function(dimensionsChanged) {
	if (dimensionsChanged)
	{
		//fill in win0 and winin with winout layer
		this.win0ScanlineBuffer.forEach((scanlineArr) => {scanlineArr.fill(2)});
		this.winInScanlineBuffer.forEach((scanlineArr) => {scanlineArr.fill(2)});

		//fill in win0 buffer
		//fill in the win0 layer 
		for (let i = this.win0Top; i < this.win0Bottom; i ++)
		{
			let scanlineArr = this.win0ScanlineBuffer[i];
			for (let p = this.win0Left; p < this.win0Right; p ++)
			{
				scanlineArr[p] = 0;
			}
		}

		//fill in winin buffer
		//fill in win1 layer
		for (let i = this.win1Top; i < this.win1Bottom; i ++)
		{
			let scanlineArr = this.winInScanlineBuffer[i];
			for (let p = this.win1Left; p < this.win1Right; p ++)
			{
				scanlineArr[p] = 1;
			}
		}

		//fill in win0 layer
		for (let i = this.win0Top; i < this.win0Bottom; i ++)
		{
			let scanlineArr = this.winInScanlineBuffer[i];
			for (let p = this.win0Left; p < this.win0Right; p ++)
			{
				scanlineArr[p] = 0;
			}
		}
	}
};

windowController.prototype.updateWin1 = function(dimensionsChanged) {
	if (dimensionsChanged)
	{
		//console.log("UPDATING...");
		//fill in win1 and winin with winout layer
		this.win1ScanlineBuffer.forEach((scanlineArr) => {scanlineArr.fill(2)});
		this.winInScanlineBuffer.forEach((scanlineArr) => {scanlineArr.fill(2)});

		// console.log("top: " + this.win1Top);
		// console.log("bottom: " + this.win1Bottom);
		// console.log("left: " + this.win1Left);
		// console.log("right: " + this.win1Right);
		//fill in win1 buffer
		//fill in the win1 layer 
		for (let i = this.win1Top; i < this.win1Bottom; i ++)
		{
			let scanlineArr = this.win1ScanlineBuffer[i];
			for (let p = this.win1Left; p < this.win1Right; p ++)
			{
				scanlineArr[p] = 1;
			}
		}

		// //fill in winin buffer
		// //fill in win1 layer
		for (let i = this.win1Top; i < this.win1Bottom; i ++)
		{
			let scanlineArr = this.winInScanlineBuffer[i];
			for (let p = this.win1Left; p < this.win1Right; p ++)
			{
				scanlineArr[p] = 1;
			}
		}

		//fill in win0 layer
		for (let i = this.win0Top; i < this.win0Bottom; i ++)
		{
			let scanlineArr = this.winInScanlineBuffer[i];
			for (let p = this.win0Left; p < this.win0Right; p ++)
			{
				scanlineArr[p] = 0;
			}
		}
	}

};

//returns JSON of inner state
windowController.prototype.serialize = function() {
	let copy = {};

	//win0 dimensions
	copy.win0Right = this.win0Right;
	copy.win0Left = this.win0Left;
	copy.win0Bottom = this.win0Bottom;
	copy.win0Top = this.win0Top;

	//win1 dimensions
	copy.win1Right = this.win1Right;
	copy.win1Left = this.win1Left;
	copy.win1Bottom = this.win1Bottom;
	copy.win1Top = this.win1Top;

	//BG0, BG1, BG2, BG3, OBJ, BLD display bits
	copy.win0CNT = this.win0CNT;
	copy.win1CNT = this.win1CNT;
	copy.winOutCNT = this.winOutCNT;
	copy.winOBJCNT = this.winOBJCNT;

	//enable bits (dispcnt)
	copy.winInDisplay = this.winInDisplay;
	copy.winOBJDisplay = this.winOBJDisplay;

	copy.win0ScanlineBuffer = this.win0ScanlineBuffer.map(x => [...x]);
	copy.win1ScanlineBuffer = this.win1ScanlineBuffer.map(x => [...x]);
	copy.winInScanlineBuffer = this.winInScanlineBuffer.map(x => [...x]);
	copy.objScanlineBuffer = [...this.objScanlineBuffer];

	return copy;
}
  
windowController.prototype.setState = function(saveState) {
	//win0 dimensions
	this.win0Right = saveState.win0Right;
	this.win0Left = saveState.win0Left;
	this.win0Bottom = saveState.win0Bottom;
	this.win0Top = saveState.win0Top;

	//win1 dimensions
	this.win1Right = saveState.win1Right;
	this.win1Left = saveState.win1Left;
	this.win1Bottom = saveState.win1Bottom;
	this.win1Top = saveState.win1Top;

	//BG0, BG1, BG2, BG3, OBJ, BLD display bits
	copyArrIntoArr(saveState.win0CNT, this.win0CNT);
	copyArrIntoArr(saveState.win1CNT, this.win1CNT);
	copyArrIntoArr(saveState.winOutCNT, this.winOutCNT);
	copyArrIntoArr(saveState.winOBJCNT, this.winOBJCNT);

	//enable bits (dispcnt)
	this.winInDisplay = saveState.winInDisplay;
	this.winOBJDisplay = saveState.winOBJDisplay;

	//preserve type as typed arr, as typed arr serialized as normal array
	saveState.win0ScanlineBuffer.forEach((arrToCopy, index) => {
		copyArrIntoArr(arrToCopy, this.win0ScanlineBuffer[index]);
	});
	saveState.win1ScanlineBuffer.forEach((arrToCopy, index) => {
		copyArrIntoArr(arrToCopy, this.win1ScanlineBuffer[index]);
	});
	saveState.winInScanlineBuffer.forEach((arrToCopy, index) => {
		copyArrIntoArr(arrToCopy, this.winInScanlineBuffer[index]);
	});
	copyArrIntoArr(saveState.objScanlineBuffer, this.objScanlineBuffer);
}