//"layers" are just wrapper objects for the scanline buffers written to by the backgrounds / object layer 
const layer = function (scanlineArr, windowIndex, prio, display, isObj, sortVal, layerNum, code) {
  //sortval used for sorting layers, updated whenever priority is changed
  //the lower the sortval, the higher the priority
  //if two layers share the same sortval, layerNum is used as a tiebreaker
  //if a layers display is false, layer is has no priority, and will not be pushed to the screen
  //order of layers and each layers isobj, windowindex, and scanline arrs used for the final screen
  this.scanlineArr = scanlineArr;
  this.windowIndex = windowIndex;
  this.prio = prio;
  this.display = display;
  this.isObj = isObj;
  this.sortVal = sortVal;
  this.layerNum = layerNum;
  this.code = code; //descriptor for serialization

  let codes = ["BG0","BG1","BG2","BG3","OL0","OL1","OL2","OL3",];
  if (!codes.includes(code))
    throw new Error("Invalid layer code");
};

const graphics = function(mmu, cpu, backingCanvasElement, visibleCanvasElement, setFrameComplete) {

  //debugging stuff////////////////////////////////////////////
  // this.registers = cpu.registers;
	// this.registersDOM = $(".register");
	// this.cpsrDOM = $(".statusregister"); //N, Z, C, V, Q, I, F, T, Mode, all
	// this.valToMode = []; //modes indexed by their value in the CPSR
  // this.valToMode[31] = "SYSTEM";
  // this.valToMode[16] = "USER";
  // this.valToMode[17] = "FIQ"; //never used
  // this.valToMode[19] = "SVC";
  // this.valToMode[23] = "ABT";
  // this.valToMode[18] = "IRQ";
  // this.valToMode[27] = "UND";
	// this.registerIndices = [
  //   //                     1 1 1 1 1 1
  //   //r0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 C S 
  //     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"]
  //     [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0], //modeENUMS["FIQ"]
  //     [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1], //modeENUMS["SVC"]
  //     [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,2], //modeENUMS["ABT"]
  //     [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,3], //modeENUMS["IRQ"]
  //     [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,4], //modeENUMS["UND"]
  // ];
  //////////////////////////////////////////////////////////

  this.cpu = cpu;
  this.setFrameComplete = setFrameComplete;

  //canvas stuff
  this.backingCanvasElement = backingCanvasElement;
  this.visibleCanvasElement = visibleCanvasElement;

	this.backingContext = this.backingCanvasElement.getContext("2d");
  this.visibleContext = this.visibleCanvasElement.getContext("2d");
	this.imageData = this.backingContext.createImageData(240, 160);
  this.imageDataArr = new Uint32Array(this.imageData.data.buffer);

  //graphics related memory
  let ioregion = mmu.getMemoryRegion("IOREGISTERS");
  this.ioregionMem = ioregion.memory; //0x4000000
  this.paletteRamMem = mmu.getMemoryRegion("PALETTERAM").memory; //0x5000000
  this.paletteRamMem16 = new Uint16Array(this.paletteRamMem.buffer);
  this.vramMem = mmu.getMemoryRegion("VRAM").memory; //0x6000000
  this.oamRegion = mmu.getMemoryRegion("OAM"); //0x7000000

  //state variables
  this.pixel = 0; //current pixel we are "drawing" on current scanline
  this.scanline = 0; //current scanline we are drawing on
  this.hblank = false;
  this.vblank = false;

  //graphics hardware configuration
  this.mode = 0;
  this.page = 0;
  this.objMappingMode = 0;
  this.bg0Display = 0;
  this.bg1Display = 0;
  this.bg2Display = 0;
  this.bg3Display = 0;
  this.objDisplay = 0;
  this.win0Display = 0;
  this.win1Display = 0;
  this.winOBJDisplay = 0;
  this.windowEnabled = 0;

  //blending stuff
  this.blendMode = 0;
  this.firstTarget = [0, 0, 0, 0, 0, 0]; //bg0-3, obj, bd
  this.secondTarget = [0, 0, 0, 0, 0, 0];
  this.eva = 0;
  this.evb = 0;
  this.evy = 0;

  //interrupt enables
  this.hblankIRQEnable = false;
  this.vblankIRQEnable = false;
  this.vCountIRQEnable = false;
  this.vCountSetting = 0; //number for vcount match

  //set up mmio
  ioregion.getIOReg("DISPCNT").addCallback((newDISPCNTVal) => {this.updateDISPCNT(newDISPCNTVal)});
  ioregion.getIOReg("DISPSTAT").addCallback((newDISPSTATVal) => {this.updateDISPSTAT(newDISPSTATVal)});
  ioregion.getIOReg("BLDCNT").addCallback((newBLDCNTVal) => {this.updateBLDCNT(newBLDCNTVal)});
  ioregion.getIOReg("BLDALPHA").addCallback((newBLDALPHAVal) => {this.updateBLDALPHA(newBLDALPHAVal)});
  ioregion.getIOReg("BLDY").addCallback((newBLDYVal) => {this.updateBLDY(newBLDYVal)});

  //offsets into IO memory for dispstat, vcount, and if IO regs
  //byte 1 refers to LSB of ioreg
  this.dispstatByte1 = ioregion.getIOReg("DISPSTAT").regIndex;
  this.dispstatByte2 = ioregion.getIOReg("DISPSTAT").regIndex + 1;
  this.vcountByte1 = ioregion.getIOReg("VCOUNT").regIndex;
  this.ifByte1 = ioregion.getIOReg("IF").regIndex;

  //backgrounds
  this.bg0 = new background(0, this, mmu, ioregion.getIOReg("BG0CNT"), ioregion.getIOReg("BG0HOFS"), ioregion.getIOReg("BG0VOFS"));
  this.bg1 = new background(1, this, mmu, ioregion.getIOReg("BG1CNT"), ioregion.getIOReg("BG1HOFS"), ioregion.getIOReg("BG1VOFS"));
  this.bg2 = new background(2, this, mmu, ioregion.getIOReg("BG2CNT"), ioregion.getIOReg("BG2HOFS"), ioregion.getIOReg("BG2VOFS"), ioregion.getIOReg("BG2X"),
             ioregion.getIOReg("BG2Y"), ioregion.getIOReg("BG2PA"), ioregion.getIOReg("BG2PB"), ioregion.getIOReg("BG2PC"), ioregion.getIOReg("BG2PD"));
  this.bg3 = new background(3, this, mmu, ioregion.getIOReg("BG3CNT"), ioregion.getIOReg("BG3HOFS"), ioregion.getIOReg("BG3VOFS"), ioregion.getIOReg("BG3X"),
             ioregion.getIOReg("BG3Y"), ioregion.getIOReg("BG3PA"), ioregion.getIOReg("BG3PB"), ioregion.getIOReg("BG3PC"), ioregion.getIOReg("BG3PD"));

  //object (sprite) layer
  this.objectLayer = new objectLayer(this, mmu);

  //window
  this.windowController = new windowController(ioregion.getIOReg("WIN0H"), ioregion.getIOReg("WIN1H"), ioregion.getIOReg("WIN0V"), ioregion.getIOReg("WIN1V"), ioregion.getIOReg("WININ0"),
                                               ioregion.getIOReg("WININ1"), ioregion.getIOReg("WINOUT"), ioregion.getIOReg("WINOBJ"), this.objectLayer.sprites);

  //DMA callbacks (called after hblank / vblank is set)
  this.hblankCallback;
  this.vblankCallback;

  //renderScanline functions indexed by mode
  this.renderScanline = [
    this.renderScanlineMode0.bind(this),
    this.renderScanlineMode1.bind(this),
    this.renderScanlineMode2.bind(this),
    this.renderScanlineMode3.bind(this),
    this.renderScanlineMode4.bind(this),
    this.renderScanlineMode5.bind(this),
    () => {throw Error("invalid mode")},
    () => {throw Error("invalid mode")}
  ];

  //intitalize table for "converting" (just making the rgb values greater) 15 bit colors to 32 bit colors (alpha set to full opacity)
  //using the number 0x8888 as the transparent color, two situations where this will be interpreted wrongly
  //when an object is using the alpha blend flag and its pixels are the color 0x0888, this will write 0x8888
  //when the color 0x8888 is being used, as opposed to 0x0888 i.e. some game wants to use the color 0x888, but instead of writing just 0x888, its setting the 15th bit as well for some reason
  for (let i = 0; i < 32768; i ++)
  {
    //credit to https://byuu.net/video/color-emulation/ for the color correction code (modified) below
    let lb = Math.pow(((i & 31744) >>> 10) / 31.0, 4.0);
    let lg = Math.pow(((i & 992) >>> 5) / 31.0, 4.0);
    let lr = Math.pow((i & 31) / 31.0, 4.0);
    let r = Math.round(Math.pow((  0 * lb +  50 * lg + 220 * lr) / 255, 1 / 2.2) * (0xffff / 280));
    let g = Math.round(Math.pow(( 30 * lb + 230 * lg +  10 * lr) / 255, 1 / 2.2) * (0xffff / 280));
    let b = Math.round(Math.pow((220 * lb +  10 * lg +  10 * lr) / 255, 1 / 2.2) * (0xffff / 280));

    this.convertColor[i] = 0xFF000000 + (b << 16) + (g << 8) + r;
    this.convertColor[i + 32768] = this.convertColor[i]; //account for 15th bit being set sometimes in colors (e.g. BIOS backdrop)
  }  

  //layers array, to make sorting based on layer priority, blending, and windowing easier
  //graphics.prototype.bgNumToLayerIndex = [0, 1, 2, 3];
  //graphics.prototype.objLayerNumToLayerIndex = [4, 5, 6, 7];
  this.layers = [
    new layer(this.bg0.scanlineArr, 0, 0, 0, false, 20, 1, "BG0"), //background 0
    new layer(this.bg1.scanlineArr, 1, 0, 0, false, 20, 2, "BG1"), //background 1
    new layer(this.bg2.scanlineArr, 2, 0, 0, false, 20, 3, "BG2"), //background 2
    new layer(this.bg3.scanlineArr, 3, 0, 0, false, 20, 4, "BG3"), //background 3
    new layer(this.objectLayer.PBGs[0], 4, 0, 1, true, 20, 0, "OL0"), //object layer 0
    new layer(this.objectLayer.PBGs[1], 4, 1, 0, true, 20, 0, "OL1"), //object layer 1
    new layer(this.objectLayer.PBGs[2], 4, 2, 0, true, 20, 0, "OL2"), //object layer 2
    new layer(this.objectLayer.PBGs[3], 4, 3, 0, true, 20, 0, "OL3") //object layer 3
  ];

  //the actual array used for sorting
  this.sortedLayers = [...this.layers];
  //so i dont have to do property lookup three times for each pixel in each layer
  //after sorting above array, will copy over properties to these arrays
  this.sortedScanlineArrs = new Array(this.sortedLayers.length);
  this.sortedWindowIndices = new Array(this.sortedLayers.length);
  this.sortedIsObj = new Array(this.sortedLayers.length);
  this.numActiveLayers = 0; //number of layers used for the final screen (when doing the blending and collapsing and whatnot)
};

graphics.prototype.convertColor = new Uint32Array(65536);

graphics.prototype.bgNumToLayerIndex = [0, 1, 2, 3];

graphics.prototype.objLayerNumToLayerIndex = [4, 5, 6, 7];

graphics.prototype.modeToLayerDisplay = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 1, 1, 1, 1],
  [0, 0, 1, 1, 1, 1, 1, 1],
  [0, 0, 1, 0, 1, 1, 1, 1],
  [0, 0, 1, 0, 1, 1, 1, 1],
  [0, 0, 1, 0, 1, 1, 1, 1]
];

graphics.prototype.displayENUMS = {
  //DISPSTAT
  VBLANKSET : 1,
  HBLANKSET : 2, 
  VCOUNTERSET : 4,
  VBLANKCLEAR : ~1,
  HBLANKCLEAR : ~2,
  VCOUNTERCLEAR : ~4,
  VBLANKIRQENABLE : 8,
  HBLANKIRQENABLE : 16,
  VCOUNTIRQENABLE : 32,
  VCOUNTSETTING : 0xFF00, //1111111100000000

  //DISPCNT
  MODE : 7,
  DISPLAYFRAME : 16,
  OBJMAPPINGMODE : 64,
  FORCEDBLANK : 128,
  BG0DISPLAY : 256,
  BG1DISPLAY : 512,
  BG2DISPLAY : 1024,
  BG3DISPLAY : 2048, 
  OBJDISPLAY : 4096,
  WIN0DISPLAY : 8192,
  WIN1DISPLAY : 16384,
  WINOBJDISPLAY : 32768
};

graphics.prototype.updateDISPCNT = function (newDISPCNTVal) {
  this.mode = this.updateLayersMode(this.mode, newDISPCNTVal & this.displayENUMS["MODE"]);

  this.page = newDISPCNTVal & this.displayENUMS["DISPLAYFRAME"];
  this.objMappingMode = newDISPCNTVal & this.displayENUMS["OBJMAPPINGMODE"];

  this.bg0Display = this.updateBGDisplay(this.bgNumToLayerIndex[0], this.bg0Display, newDISPCNTVal & this.displayENUMS["BG0DISPLAY"]);
  this.bg1Display = this.updateBGDisplay(this.bgNumToLayerIndex[1], this.bg1Display, newDISPCNTVal & this.displayENUMS["BG1DISPLAY"]);
  this.bg2Display = this.updateBGDisplay(this.bgNumToLayerIndex[2], this.bg2Display, newDISPCNTVal & this.displayENUMS["BG2DISPLAY"]);
  this.bg3Display = this.updateBGDisplay(this.bgNumToLayerIndex[3], this.bg3Display, newDISPCNTVal & this.displayENUMS["BG3DISPLAY"]);
  this.objDisplay = this.updateObjDisplay(this.objDisplay, newDISPCNTVal & this.displayENUMS["OBJDISPLAY"]);

  this.windowEnabled = this.windowController.setDisplay( (newDISPCNTVal & (this.displayENUMS["WIN0DISPLAY"] + this.displayENUMS["WIN1DISPLAY"] + this.displayENUMS["WINOBJDISPLAY"])) >>> 13 );
  this.objectLayer.setMappingMode(this.objMappingMode);
};

graphics.prototype.updateDISPSTAT= function (newDISPSTATVal) {
  this.vblankIRQEnable = newDISPSTATVal & this.displayENUMS["VBLANKIRQENABLE"];
  this.hblankIRQEnable = newDISPSTATVal & this.displayENUMS["HBLANKIRQENABLE"];
  this.vCountIRQEnable = newDISPSTATVal & this.displayENUMS["VCOUNTIRQENABLE"];
  this.vCountSetting = (newDISPSTATVal & this.displayENUMS["VCOUNTSETTING"]) >>> 8;
};

graphics.prototype.updateBLDCNT = function (newBLDCNTVal) {
  this.blendMode = (newBLDCNTVal & 192) >>> 6

  this.firstTarget[0] = newBLDCNTVal & 1;
  this.firstTarget[1] = newBLDCNTVal & 2;
  this.firstTarget[2] = newBLDCNTVal & 4;
  this.firstTarget[3] = newBLDCNTVal & 8;
  this.firstTarget[4] = newBLDCNTVal & 16;
  this.firstTarget[5] = newBLDCNTVal & 32;

  this.secondTarget[0] = newBLDCNTVal & 256;
  this.secondTarget[1] = newBLDCNTVal & 512;
  this.secondTarget[2] = newBLDCNTVal & 1024;
  this.secondTarget[3] = newBLDCNTVal & 2048;
  this.secondTarget[4] = newBLDCNTVal & 4096;
  this.secondTarget[5] = newBLDCNTVal & 8192;
};

graphics.prototype.updateBLDALPHA = function (newBLDALPHAVal) {
  this.eva = newBLDALPHAVal & 31;
  this.eva = this.eva > 16 ? 16 : this.eva;

  this.evb = (newBLDALPHAVal & 7936) >>> 8;
  this.evb = this.evb > 16 ? 16 : this.evb;
};

graphics.prototype.updateBLDY = function (newBLDYVal) {
  this.evy = newBLDYVal & 31;
  this.evy = this.evy > 16 ? 16 : this.evy;
};

graphics.prototype.addCallbacks = function (hblankCallback, vblankCallback) {
  this.hblankCallback = hblankCallback;
  this.vblankCallback = vblankCallback;
};

graphics.prototype.setHblank = function () {
  this.hblank = true;
  this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["HBLANKSET"];

  if (this.hblankIRQEnable) //if hblank irq enabled, throw interrupt
  {
    this.ioregionMem[this.ifByte1] |= 2;
    this.cpu.awake();
  }

  //DMA
  this.hblankCallback();
};

graphics.prototype.setVblank = function () {
  this.vblank = true;
  this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["VBLANKSET"];

  if (this.vblankIRQEnable) //if vblank irq enabled, throw interrupt
  {
    this.ioregionMem[this.ifByte1] |= 1;
    this.cpu.awake();
  }

  //copy over ref point to internal ref registers (happens every vblank)
  this.bg0.copyRefPoint();
  this.bg1.copyRefPoint();
  this.bg2.copyRefPoint();
  this.bg3.copyRefPoint();

  //DMA
  this.vblankCallback();
};

graphics.prototype.setVCount = function (scanline) {
  if (this.vCountSetting === scanline)
  {
    this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["VCOUNTERSET"];
    if (this.vCountIRQEnable) //if vcount irq enabled, throw interrupt
    {
     this.ioregionMem[this.ifByte1] |= 4;
     this.cpu.awake();
    }
  }
  else
  {
    this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["VCOUNTERCLEAR"];
  }
  this.ioregionMem[this.vcountByte1] = scanline;
};

//when mode updated, recalculates number of active layers (if layer is part of mode and is on)
//then sorts all active layers
graphics.prototype.updateLayersMode = function (oldMode, newMode) {
  if (oldMode !== newMode)
  {
    this.numActiveLayers = 0;
    let layers = this.layers;
    let modeToLayerDisplay = this.modeToLayerDisplay;

    for (let i = 0; i < layers.length; i ++)
    {
      let layer = layers[i];

      layer.sortVal = 20;
      if (modeToLayerDisplay[newMode][i] && layer.display)
      {
        if (layer.isObj)
        {
          if (this.objDisplay)
          {
            this.numActiveLayers ++;
            layer.sortVal = layer.layerNum + (layer.prio * 5);
          }
        }
        else
        {
          this.numActiveLayers ++;
          layer.sortVal = layer.layerNum + (layer.prio * 5);
        }
      }
    }
    this.sortLayers(layers.length);
  }
  return newMode;
};

//resorts backing layers when a backgrounds priority is changed
//number of active layers used for final screen remains unchanged
//called by background, bg priority is managed by background
graphics.prototype.updateBGPriority = function (bgNum, oldPrio, newPrio) {
  if (oldPrio !== newPrio)
  {
    let layerIndex = this.bgNumToLayerIndex[bgNum];
    let layer = this.layers[layerIndex];
    layer.prio = newPrio;
    if (this.modeToLayerDisplay[this.mode][layerIndex] && layer.display)
    {
      layer.sortVal = layer.layerNum + (layer.prio * 5);
      this.sortLayers(this.numActiveLayers);
    }
  }
  return newPrio;
};

//resorts backing layers when a backgrounds display is changed (turned on or off)
//number of active layers used for final screen either incremented or decremented since 
graphics.prototype.updateBGDisplay = function (layerIndex, oldDisplay, newDisplay) {
  if (oldDisplay !== newDisplay)
  {
    let layer = this.layers[layerIndex];
    layer.display = newDisplay;
    if (this.modeToLayerDisplay[this.mode][layerIndex])
    {
      layer.sortVal = newDisplay ? (layer.layerNum + (layer.prio * 5)) : 20;
      this.numActiveLayers += newDisplay ? 1 : -1;
      this.sortLayers(newDisplay ? this.layers.length : (this.numActiveLayers + 1));
    }
  }
  return newDisplay;
};

//object layer split into four layers
//whereas with regular backgrounds whose display dictates if a layer is displayed or not
//when object layer display is turned off (turns )
//when object layer display is turned on
graphics.prototype.updateObjDisplay = function (oldDisplay, newDisplay) {
  if (oldDisplay !== newDisplay)
  {
    let layers = this.layers;
    let objLayer0Index = this.objLayerNumToLayerIndex[0];
    let objLayer1Index = this.objLayerNumToLayerIndex[1];
    let objLayer2Index = this.objLayerNumToLayerIndex[2];
    let objLayer3Index = this.objLayerNumToLayerIndex[3];

    if (newDisplay) //turn on all obj layers that have display on
    {
      layers[objLayer0Index].sortVal = layers[objLayer0Index].display ? layers[objLayer0Index].layerNum + (layers[objLayer0Index].prio * 5) : 20;
      layers[objLayer1Index].sortVal = layers[objLayer1Index].display ? layers[objLayer1Index].layerNum + (layers[objLayer1Index].prio * 5) : 20;
      layers[objLayer2Index].sortVal = layers[objLayer2Index].display ? layers[objLayer2Index].layerNum + (layers[objLayer2Index].prio * 5) : 20;
      layers[objLayer3Index].sortVal = layers[objLayer3Index].display ? layers[objLayer3Index].layerNum + (layers[objLayer3Index].prio * 5) : 20;

      this.numActiveLayers += layers[objLayer0Index].display ? 1 : 0;
      this.numActiveLayers += layers[objLayer1Index].display ? 1 : 0;
      this.numActiveLayers += layers[objLayer2Index].display ? 1 : 0;
      this.numActiveLayers += layers[objLayer3Index].display ? 1 : 0;
    }
    else //turn off all obj layers
    {
      layers[objLayer0Index].sortVal = 20;
      layers[objLayer1Index].sortVal = 20;
      layers[objLayer2Index].sortVal = 20;
      layers[objLayer3Index].sortVal = 20;

      this.numActiveLayers += layers[objLayer0Index].display ? -1 : 0;
      this.numActiveLayers += layers[objLayer1Index].display ? -1 : 0;
      this.numActiveLayers += layers[objLayer2Index].display ? -1 : 0;
      this.numActiveLayers += layers[objLayer3Index].display ? -1 : 0;
    }
    this.sortLayers(layers.length);
  }
  return newDisplay;
};

//'turns on' or 'turns off' and object layer (each one corresponding to a sprite priority)
//is called by the object layer, as object layer manages sprite priorities
graphics.prototype.updateObjLayerDisplay = function (objLayerNum, newDisplay) {
  let layer = this.layers[this.objLayerNumToLayerIndex[objLayerNum]];
  layer.display = newDisplay;

  if (this.objDisplay)
  {
    layer.sortVal = newDisplay ? ((layer.prio * 5) + layer.layerNum) : 20;
    this.numActiveLayers += newDisplay ? 1 : -1;
    this.sortLayers(newDisplay ? this.layers.length : (this.numActiveLayers + 1));
  }
};

//sorts all layers in layer array up to maxIndex 
//(sorts only active layers when priority is changed, else, if layer removed or if mode change, sorts all layers)
//uses selection sort
graphics.prototype.sortLayers = function (maxIndex) {
  let layers = this.sortedLayers;
  let curMax = layers[0].sortVal;
  let curMaxIndex = 0;

  while (maxIndex !== 0)
  {
    for (let i = 0; i < maxIndex; i ++)
    {
      if (layers[i].sortVal > curMax)
      {
        curMaxIndex = i;
        curMax = layers[i].sortVal;
      }
    }
    //swap
    let temp = layers[maxIndex - 1];
    layers[maxIndex - 1] = layers[curMaxIndex];
    layers[curMaxIndex] = temp;
    maxIndex --;

    curMax = layers[0].sortVal;
    curMaxIndex = 0;
  }

  for (let i = 0; i < layers.length; i ++)
  {
    this.sortedScanlineArrs[i] = layers[i].scanlineArr;
    this.sortedWindowIndices[i] = layers[i].windowIndex;
    this.sortedIsObj[i] = layers[i].isObj;
  }
};


graphics.prototype.renderScanlineMode0 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  let backdrop = this.paletteRamMem16[0];

  if (this.objDisplay)
  {
    this.objectLayer.renderScanline(scanline);
  }
  if (this.bg0Display)
  {
    this.bg0.renderScanlineMode0(scanline);
  }
  if (this.bg1Display)
  {
    this.bg1.renderScanlineMode0(scanline);
  }
  if (this.bg2Display)
  {
    this.bg2.renderScanlineMode0(scanline);
  }
  if (this.bg3Display)
  {
    this.bg3.renderScanlineMode0(scanline);
  }
  
  if (this.windowEnabled)
  {
    this.mergeLayersWindow(this.windowController.getEnableScanline(scanline), this.windowController.windowCNT, imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
  else
  {
    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode1 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  let backdrop = this.paletteRamMem16[0];

  if (this.objDisplay)
  {
    this.objectLayer.renderScanline(scanline);
  }
  if (this.bg0Display)
  {
    this.bg0.renderScanlineMode0(scanline);
  }
  if (this.bg1Display)
  {
    this.bg1.renderScanlineMode0(scanline);
  }
  if (this.bg2Display)
  {
    this.bg2.renderScanlineMode2(scanline);
  }
  
  if (this.windowEnabled)
  {
    this.mergeLayersWindow(this.windowController.getEnableScanline(scanline), this.windowController.windowCNT, imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
  else
  {
    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode2 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  let backdrop = this.paletteRamMem16[0];

  if (this.objDisplay)
  {
    this.objectLayer.renderScanline(scanline);
  }
  if (this.bg2Display)
  {
    this.bg2.renderScanlineMode2(scanline);
  }
  if (this.bg3Display)
  {
    this.bg3.renderScanlineMode2(scanline);
  }
  
  if (this.windowEnabled)
  {
    this.mergeLayersWindow(this.windowController.getEnableScanline(scanline), this.windowController.windowCNT, imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
  else
  {
    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode3 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  let backdrop = this.paletteRamMem16[0];

  if (this.objDisplay)
  {
    this.objectLayer.renderScanline(scanline);
  }
  if (this.bg2Display)
  {
    this.bg2.renderScanlineMode3(scanline);
  }

  if (this.windowEnabled)
  {
    this.mergeLayersWindow(this.windowController.getEnableScanline(scanline), this.windowController.windowCNT, imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
  else
  {
    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode4 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  let backdrop = this.paletteRamMem16[0];

  if (this.objDisplay)
  {
    this.objectLayer.renderScanline(scanline);
  }
  if (this.bg2Display)
  {
    this.bg2.renderScanlineMode4(scanline, this.page);
  }

  if (this.windowEnabled)
  {
    this.mergeLayersWindow(this.windowController.getEnableScanline(scanline), this.windowController.windowCNT, imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
  else
  {
    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode5 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  let backdrop = this.paletteRamMem16[0];

  if (this.objDisplay)
  {
    this.objectLayer.renderScanline(scanline);
  }
  if (this.bg2Display)
  {
    this.bg2.renderScanlineMode5(scanline);
  }

  if (this.windowEnabled)
  {
    this.mergeLayersWindow(this.windowController.getEnableScanline(scanline), this.windowController.windowCNT, imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
  else
  {
    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

//blending is off
graphics.prototype.blendMode0 = function(color) { 
  return color;
};

//alpha blending
graphics.prototype.blendMode1 = function(color, eva, evb, evy, firstTargetMatch, secondTarget, scanlineArrs, windowIndices, isObj, layerIndex, pixelNum, numActiveLayers, backdrop) {
  if (firstTargetMatch)
  {
    let secondColor = backdrop;
    let secondColorWindowIndex = 5;
    for (let p = layerIndex + 1; p < numActiveLayers; p ++)
    {
      if ((scanlineArrs[p][pixelNum] !== 0x8888) && !(isObj[p] && isObj[layerIndex]))
      {
        secondColor = scanlineArrs[p][pixelNum];
        secondColorWindowIndex = windowIndices[p];
        break;
      }
    }
    //sometimes backdrop may be blended to itself, resulting in a brightness change
    if (secondTarget[secondColorWindowIndex])
    {
      let r = ((color & 31) * eva) >>> 4;
      let g = (((color & 992) >>> 5) * eva) >>> 4;
      let b = (((color & 31744) >>> 10) * eva) >>> 4;

      let blendR = (((secondColor & 31) * evb) >>> 4) + r;
      let blendG = ((((secondColor & 992) >>> 5) * evb) >>> 4) + g;
      let blendB = ((((secondColor & 31744) >>> 10) * evb) >>> 4) + b;

      return (((blendB & 32) ? 31 : blendB) << 10) + (((blendG & 32) ? 31 : blendG) << 5) + ((blendR & 32) ? 31 : blendR);
    }
  }
  return color;
};

//brightness increase
graphics.prototype.blendMode2 = function(color, eva, evb, evy, firstTargetMatch) { 
  if (firstTargetMatch)
  {
    let r = (color & 31);
    let g = (color & 992) >>> 5;
    let b = (color & 31744) >>> 10;

    r += ((31 - r) * evy) >>> 4;
    g += ((31 - g) * evy) >>> 4;  
    b += ((31 - b) * evy) >>> 4;  
    
    return (b << 10) + (g << 5) + r;
  }
  return color;
};

//brightness decrease
graphics.prototype.blendMode3 = function(color, eva, evb, evy, firstTargetMatch) { 
  if (firstTargetMatch)
  {
    let r = (color & 31);
    let g = (color & 992) >>> 5;
    let b = (color & 31744) >>> 10;

    r -= (r * evy) >>> 4;
    g -= (g * evy) >>> 4;  
    b -= (b * evy) >>> 4;  
    
    return (b << 10) + (g << 5) + r;
  }
  return color;
};

//take top pixel (non-transparent pixel in uppermost layer)
//if blending enabled, take top two and blend if criteria met
graphics.prototype.mergeLayers = function (imageDataArr, imageDataIndex, backdrop, convertColor) {
  //attributes of each layer in sorted layers
  let scanlineArrs = this.sortedScanlineArrs;
  let windowIndices = this.sortedWindowIndices;
  let isObjArr = this.sortedIsObj;

  let blendMode = this.blendMode;
  let firstTarget = this.firstTarget;
  let secondTarget = this.secondTarget;
  let eva = this.eva;
  let evb = this.evb;
  let evy = this.evy;
  let blend = (blendMode === 0) ? this.blendMode0 : (blendMode === 1 ? this.blendMode1 : (blendMode === 2 ? this.blendMode2 : this.blendMode3));
  let blendAlpha = this.blendMode1;

  let numActiveLayers = this.numActiveLayers;

  for (let i = 0; i < 240; i ++)
  {
    let color = backdrop;
    let windowIndex = 5; //serves as the blend index as well
    let isObj = false;

    for (var p = 0; p < numActiveLayers; p ++)
    {
      if (scanlineArrs[p][i] !== 0x8888)
      {
        color = scanlineArrs[p][i];
        windowIndex = windowIndices[p];
        isObj = isObjArr[p];
        break;
      }
    }

    if (isObj && (color & 0x8000)) //semi trans obj
    {
      imageDataArr[i + imageDataIndex] = convertColor[blendAlpha(color, eva, evb, evy, true, secondTarget, scanlineArrs, windowIndices, isObjArr, p, i, numActiveLayers, backdrop)];
    }
    else
    {
      imageDataArr[i + imageDataIndex] = convertColor[blend(color, eva, evb, evy, firstTarget[windowIndex], secondTarget, scanlineArrs, windowIndices, isObjArr, p, i, numActiveLayers, backdrop)];
    }
  }
};

//like above, but only takes top pixel if enabled in window
//also, only blends if blending is enabled in window
graphics.prototype.mergeLayersWindow = function (enableScanline, windowCNT, imageDataArr, imageDataIndex, backdrop, convertColor) {
  //attributes of each layer in sorted layers
  let scanlineArrs = this.sortedScanlineArrs;
  let windowIndices = this.sortedWindowIndices;
  let isObjArr = this.sortedIsObj;

  let blendMode = this.blendMode;
  let firstTarget = this.firstTarget;
  let secondTarget = this.secondTarget;
  let eva = this.eva;
  let evb = this.evb;
  let evy = this.evy;
  let blend = (blendMode === 0) ? this.blendMode0 : (blendMode === 1 ? this.blendMode1 : (blendMode === 2 ? this.blendMode2 : this.blendMode3));
  let blendAlpha = this.blendMode1;

  let numActiveLayers = this.numActiveLayers;

  for (let i = 0; i < 240; i ++)
  {
    let color = backdrop;
    let windowIndex = 5; //serves as the blend index as well
    let isObj = false;
    let blendEnable = windowCNT[enableScanline[i]][5];

    for (var p = 0; p < numActiveLayers; p ++)
    {
      if (scanlineArrs[p][i] !== 0x8888 && (windowCNT[enableScanline[i]][windowIndices[p]]))
      {
        color = scanlineArrs[p][i];
        windowIndex = windowIndices[p];
        isObj = isObjArr[p];
        break;
      }
    }

    if (isObj && (color & 0x8000)) //semi trans obj
    {
      imageDataArr[i + imageDataIndex] = convertColor[blendAlpha(color, eva, evb, evy, blendEnable, secondTarget, scanlineArrs, windowIndices, isObjArr, p, i, numActiveLayers, backdrop)];
    }
    else
    {
      imageDataArr[i + imageDataIndex] = convertColor[blend(color, eva, evb, evy, firstTarget[windowIndex] && blendEnable, secondTarget, scanlineArrs, windowIndices, isObjArr, p, i, numActiveLayers, backdrop)];
    }
  }
};

graphics.prototype.update = function(numCycles) {
  if (this.vblank)
  {
    this.pixel += numCycles;
    if (this.pixel === 1232) //should hblank be toggled in dispstat in vblank? (gbatek says no hblank interrupts generated during vblank, but the conditions are? no games seem to rely on this anyway)
    {
      this.pixel = 0;
      this.scanline ++;
      if (this.scanline === 228) //end of vblank
      {
        this.scanline = 0;
        this.vblank = false;
        this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["VBLANKCLEAR"];
        this.setVCount(0);
        return 960;
      }
      this.setVCount(this.scanline);
      return 1232;
    }
    return 1232 - this.pixel;
  }
  else if (this.hblank)
  {
    this.pixel += numCycles;
    if (this.pixel === 1232) //end of hblank
    {
      this.pixel = 0;
      this.hblank = false;
      this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["HBLANKCLEAR"];
      this.scanline ++;
      if (this.scanline === 160) //start of vblank
      {
        this.setVCount(160);
        this.setVblank();
        this.finishDraw();
        return 1232;
      }
      this.setVCount(this.scanline);
      return 960;
    }
    return 1232 - this.pixel;
  }
  else
  {
    this.pixel += numCycles;
    if (this.pixel === 960)
    {
      this.setHblank();
      this.renderScanline[this.mode](this.scanline, this.scanline * 240, this.imageDataArr, this.convertColor);
      return 272;
    }
    return 960 - this.pixel;
  }
};

//ui related code should really be at emu level :/
graphics.prototype.finishDraw = function () {
  this.backingContext.putImageData(this.imageData, 0, 0);
  this.visibleContext.drawImage(this.backingCanvasElement, 0, 0, this.backingCanvasElement.width, this.backingCanvasElement.height, 0, 0, this.visibleCanvasElement.width, this.visibleCanvasElement.height);
  this.setFrameComplete();
};

//debugging
graphics.prototype.updateRegisters = function(mode) {
  for (let i = 0; i <= 15; i++)
  {
    this.registersDOM[i].textContent = parseInt(this.registers[i][0]).toString(16);
  }
  //show SPSR
  if (mode)
  {
    this.registersDOM[16].textContent = parseInt(this.registers[17][0]).toString(16);
  }
  let CPSR = this.registers[16][0];
  this.cpsrDOM[0].textContent = bitSlice(CPSR, 31, 31);
  this.cpsrDOM[1].textContent = bitSlice(CPSR, 30, 30);
  this.cpsrDOM[2].textContent = bitSlice(CPSR, 29, 29);
  this.cpsrDOM[3].textContent = bitSlice(CPSR, 28, 28);
  this.cpsrDOM[5].textContent = bitSlice(CPSR, 7, 7);
  this.cpsrDOM[6].textContent = bitSlice(CPSR, 6, 6);
  this.cpsrDOM[7].textContent = bitSlice(CPSR, 5, 5);
  this.cpsrDOM[8].textContent = this.valToMode[bitSlice(CPSR, 0, 4)] + "(" + bitSlice(CPSR, 0, 4) + ")";
  this.cpsrDOM[9].textContent = getBytes(CPSR, 0);
};

//returns JSON of inner state
graphics.prototype.serialize = function() {
  let copy = {};

  //copy.imageDataArr = [...this.imageDataArr];
  copy.imageDataArr = [...compressBinaryData(this.imageDataArr, 4)];

  copy.pixel = this.pixel;
  copy.scanline = this.scanline;
  copy.hblank = this.hblank;
  copy.vblank = this.vblank;

  copy.mode = this.mode;
  copy.page = this.page;
  copy.objMappingMode = this.objMappingMode;
  copy.bg0Display = this.bg0Display;
  copy.bg1Display = this.bg1Display;
  copy.bg2Display = this.bg2Display;
  copy.bg3Display = this.bg3Display;
  copy.objDisplay = this.objDisplay;
  copy.win0Display = this.win0Display;
  copy.win1Display = this.win1Display;
  copy.winOBJDisplay = this.winOBJDisplay;
  copy.windowEnabled = this.windowEnabled;

  copy.blendMode = this.blendMode;
  copy.firstTarget = [...this.firstTarget];
  copy.secondTarget = [...this.secondTarget];
  copy.eva = this.eva;
  copy.evb = this.evb;
  copy.evy = this.evy;

  copy.hblankIRQEnable = this.hblankIRQEnable;
  copy.vblankIRQEnable = this.vblankIRQEnable;
  copy.vCountIRQEnable = this.vCountIRQEnable;
  copy.vCountSetting = this.vCountSetting;

  copy.bg0 = this.bg0.serialize();
  copy.bg1 = this.bg1.serialize();
  copy.bg2 = this.bg2.serialize();
  copy.bg3 = this.bg3.serialize();

  copy.objectLayer = this.objectLayer.serialize();

  copy.windowController = this.windowController.serialize();

  //remove refs to scanline arrs, these have to be re-set
  copy.layers = this.layers.map(x => {
    let layer = _.clone(x);
    layer.scanlineArr = null;
    return layer;
  });
  copy.sortedLayers = this.sortedLayers.map(x => {
    let layer = _.clone(x);
    layer.scanlineArr = null;
    return layer;
  });
  copy.numActiveLayers = this.numActiveLayers;

  return copy;
}
 
graphics.prototype.setState = function(saveState) {

  //have to copy in data, as imageDataArr backing buffer is tied to another object
  //also to preserve type as typed arr, as typed arr serialized as normal array
  // saveState.imageDataArr.forEach((x, index) => {
  //   this.imageDataArr[index] = x;
  // });
  copyArrIntoArr(decompressBinaryData(new Uint8Array(saveState.imageDataArr), 4), this.imageDataArr);


  this.pixel = saveState.pixel;
  this.scanline = saveState.scanline;
  this.hblank = saveState.hblank;
  this.vblank = saveState.vblank;

  this.mode = saveState.mode;
  this.page = saveState.page;
  this.objMappingMode = saveState.objMappingMode;
  this.bg0Display = saveState.bg0Display;
  this.bg1Display = saveState.bg1Display;
  this.bg2Display = saveState.bg2Display;
  this.bg3Display = saveState.bg3Display;
  this.objDisplay = saveState.objDisplay;
  this.win0Display = saveState.win0Display;
  this.win1Display = saveState.win1Display;
  this.winOBJDisplay = saveState.winOBJDisplay;
  this.windowEnabled = saveState.windowEnabled;

  this.blendMode = saveState.blendMode;
  this.firstTarget = [...saveState.firstTarget];
  this.secondTarget = [...saveState.secondTarget];
  this.eva = saveState.eva;
  this.evb = saveState.evb;
  this.evy = saveState.evy;

  this.hblankIRQEnable = saveState.hblankIRQEnable;
  this.vblankIRQEnable = saveState.vblankIRQEnable;
  this.vCountIRQEnable = saveState.vCountIRQEnable;
  this.vCountSetting = saveState.vCountSetting;

  this.bg0.setState(saveState.bg0);
  this.bg1.setState(saveState.bg1);
  this.bg2.setState(saveState.bg2);
  this.bg3.setState(saveState.bg3);

  this.objectLayer.setState(saveState.objectLayer);
  this.windowController.setState(saveState.windowController);

  //kinda hacky - restoring the object refs to background scanline arr after deserialization
  this.layers = _.cloneDeep(saveState.layers);
  this.layers.forEach(x => {
    switch (x.code) {
      case "BG0":
        x.scanlineArr = this.bg0.scanlineArr;
        break;
      case "BG1":
        x.scanlineArr = this.bg1.scanlineArr;
        break;
      case "BG2":
        x.scanlineArr = this.bg2.scanlineArr;
        break;
      case "BG3":
        x.scanlineArr = this.bg3.scanlineArr;
        break;
      case "OL0":
        x.scanlineArr = this.objectLayer.PBGs[0];
        break;
      case "OL1":
        x.scanlineArr = this.objectLayer.PBGs[1];
        break;
      case "OL2":
        x.scanlineArr = this.objectLayer.PBGs[2];
        break;
      case "OL3":
        x.scanlineArr = this.objectLayer.PBGs[3];
        break;
    }
  });

  //restore refs to layer objects
  this.sortedLayers = saveState.sortedLayers;
  this.sortedLayers = this.sortedLayers.map((sortedLayer) => _.find(this.layers, (layer) => layer.code === sortedLayer.code));

  this.numActiveLayers = saveState.numActiveLayers;
  this.sortedScanlineArrs = this.sortedLayers.map(x => x.scanlineArr);
  this.sortedWindowIndices = this.sortedLayers.map(x => x.windowIndex);
  this.sortedIsObj = this.sortedLayers.map(x => x.isObj);
}