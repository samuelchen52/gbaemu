//wrapper object for scanline arr to make sorting easier
const layer = function (scanlineArr, windowIndex, prio, display, isObj, sortVal, layerNum) {
  this.scanlineArr = scanlineArr;
  this.windowIndex = windowIndex;
  this.prio = prio;
  this.display = display;
  this.isObj = isObj;
  this.sortVal = sortVal;
  this.layerNum = layerNum;
};

const graphics = function(mmu, cpu, setFrameComplete) {

  this.mmu = mmu;
  this.registers = cpu.registers;
  this.setFrameComplete = setFrameComplete;
  this.cpu = cpu;

  //debugging stuff
	this.registersDOM = $(".register");
	this.cpsrDOM = $(".statusregister"); //N, Z, C, V, Q, I, F, T, Mode, all
	this.valToMode = []; //modes indexed by their value in the CPSR
  this.valToMode[31] = "SYSTEM";
  this.valToMode[16] = "USER";
  this.valToMode[17] = "FIQ"; //never used
  this.valToMode[19] = "SVC";
  this.valToMode[23] = "ABT";
  this.valToMode[18] = "IRQ";
  this.valToMode[27] = "UND";
	this.registerIndices = [
    //                     1 1 1 1 1 1
    //r0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 C S 
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"]
      [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0], //modeENUMS["FIQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1], //modeENUMS["SVC"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,2], //modeENUMS["ABT"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,3], //modeENUMS["IRQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,4], //modeENUMS["UND"]
    ];

  this.displayENUMS = {
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



  //canvas buffer
	this.context = document.getElementById("screen").getContext("2d");
	this.imageData = this.context.createImageData(240, 160);
  this.imageDataArr = new Uint32Array(this.imageData.data.buffer); //new Uint32Array(this.imageData.data.buffer);

  //dummy transparent pixel buffer
  this.transparentScanline = new Uint16Array(240).fill(0x8000);

  //graphics related memory
  this.ioregion = this.mmu.getMemoryRegion("IOREGISTERS");
  this.ioregionMem = this.ioregion.memory; //0x4000000
  this.paletteRamMem = this.mmu.getMemoryRegion("PALETTERAM").memory; //0x5000000
  this.paletteRamMem16 = new Uint16Array(this.paletteRamMem.buffer);
  this.vramMem = this.mmu.getMemoryRegion("VRAM").memory; //0x6000000
  this.oamRegion = this.mmu.getMemoryRegion("OAM"); //0x7000000

  //state variables
  this.pixel = 0; //current pixel we are drawing on current scanline
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

  //interrupt enables
  this.hblankIRQEnable = false;
  this.vblankIRQEnable = false;
  this.vCountIRQEnable = false;
  this.vCountSetting = 0; //number for vcount match


  //graphics hardware ioregs
  this.dispcnt = this.ioregion.getIOReg("DISPCNT");
  this.dispcnt.addCallback((newDISPCNTVal) => {this.updateDISPCNT(newDISPCNTVal)});

  this.dispstat = this.ioregion.getIOReg("DISPSTAT");
  this.dispstat.addCallback((newDISPSTATVal) => {this.updateDISPSTAT(newDISPSTATVal)});
  this.dispstatByte1 = this.dispstat.regIndex;
  this.dispstatByte2 = this.dispstat.regIndex + 1;

  this.vcount = this.ioregion.getIOReg("VCOUNT");
  this.vcountByte1 = this.vcount.regIndex;

  this.if = this.ioregion.getIOReg("IF");
  this.ifByte1 = this.if.regIndex;

  //blending stuff
  this.blendMode = 0;
  this.firstTarget = [0, 0, 0, 0, 0, 0]; //bg0-3, obj, bd
  this.secondTarget = [0, 0, 0, 0, 0, 0];
  this.eva = 0;
  this.evb = 0;
  this.evy = 0;

  this.ioregion.getIOReg("BLDCNT").addCallback((newBLDCNTVal) => {this.updateBLDCNT(newBLDCNTVal)});
  this.ioregion.getIOReg("BLDALPHA").addCallback((newBLDALPHAVal) => {this.updateBLDALPHA(newBLDALPHAVal)});
  this.ioregion.getIOReg("BLDY").addCallback((newBLDYVal) => {this.updateBLDY(newBLDYVal)});

  //backgrounds
  this.bg0 = new background(this.ioregion.getIOReg("BG0CNT"), this.ioregion.getIOReg("BG0HOFS"), this.ioregion.getIOReg("BG0VOFS"), null, null, null, null, null, null, this.vramMem, this.paletteRamMem, this, 0);
  this.bg1 = new background(this.ioregion.getIOReg("BG1CNT"), this.ioregion.getIOReg("BG1HOFS"), this.ioregion.getIOReg("BG1VOFS"), null, null, null, null, null, null, this.vramMem, this.paletteRamMem, this, 1);
  this.bg2 = new background(this.ioregion.getIOReg("BG2CNT"), this.ioregion.getIOReg("BG2HOFS"), this.ioregion.getIOReg("BG2VOFS"), this.ioregion.getIOReg("BG2X"), this.ioregion.getIOReg("BG2Y"),
    this.ioregion.getIOReg("BG2PA"), this.ioregion.getIOReg("BG2PB"), this.ioregion.getIOReg("BG2PC"), this.ioregion.getIOReg("BG2PD"), this.vramMem, this.paletteRamMem, this, 2);
  this.bg3 = new background(this.ioregion.getIOReg("BG3CNT"), this.ioregion.getIOReg("BG3HOFS"), this.ioregion.getIOReg("BG3VOFS"), this.ioregion.getIOReg("BG3X"), this.ioregion.getIOReg("BG3Y"),
    this.ioregion.getIOReg("BG3PA"), this.ioregion.getIOReg("BG3PB"), this.ioregion.getIOReg("BG3PC"), this.ioregion.getIOReg("BG3PD"), this.vramMem, this.paletteRamMem, this, 3);
  this.objectLayer = new objectLayer(this.vramMem, this.paletteRamMem16, this.oamRegion, this);

  //window
  this.windowController = new windowController(this.ioregion.getIOReg("WIN0H"), this.ioregion.getIOReg("WIN1H"), this.ioregion.getIOReg("WIN0V"), this.ioregion.getIOReg("WIN1V"),
    this.ioregion.getIOReg("WININ0"), this.ioregion.getIOReg("WININ1"), this.ioregion.getIOReg("WINOUT"), this.ioregion.getIOReg("WINOBJ"), this.objectLayer.sprites);

  //DMA callback
  this.hblankCallback = null;
  this.vblankCallback = null;

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
  //using the number 0x8000 as the transparent color, two situations where this will be interpreted wrongly
  //when an object is using the alpha blend flag and its pixels are the color 0x0000, this will write 0x8000
  //when the color 0x8000 is being used, as opposed to 0x0000 i.e. some game wants to use the color black, but instead of writing all zeroes, its setting the 15th bit for some reason
  for (let i = 0; i < 32768; i ++)
  {
    this.convertColor[i] = 0xFF000000 + ((i & 31744) << 9) + ((i & 992) << 6) + ((i & 31) << 3);
    this.convertColor[i + 32768] = this.convertColor[i]; //account for 15th bit being set sometimes in colors (e.g. BIOS backdrop)
  }  

  //stuff for sorting and merging
  this.layers = [
    new layer(this.bg0.scanlineArr, 0, 0, 0, false, 20, 1),
    new layer(this.bg1.scanlineArr, 1, 0, 0, false, 20, 2),
    new layer(this.bg2.scanlineArr, 2, 0, 0, false, 20, 3),
    new layer(this.bg3.scanlineArr, 3, 0, 0, false, 20, 4),
    new layer(this.objectLayer.PBGs[0], 4, 0, 1, true, 20, 0),
    new layer(this.objectLayer.PBGs[1], 4, 1, 0, true, 20, 0),
    new layer(this.objectLayer.PBGs[2], 4, 2, 0, true, 20, 0),
    new layer(this.objectLayer.PBGs[3], 4, 3, 0, true, 20, 0)
  ];

  this.sortedLayers = [
    this.layers[0],
    this.layers[1],
    this.layers[2],
    this.layers[3],
    this.layers[4],
    this.layers[5],
    this.layers[6],
    this.layers[7]
  ];

  this.sortedScanlineArrs = [
    this.layers[0].scanlineArr,
    this.layers[1].scanlineArr,
    this.layers[2].scanlineArr,
    this.layers[3].scanlineArr,
    this.layers[4].scanlineArr,
    this.layers[5].scanlineArr,
    this.layers[6].scanlineArr,
    this.layers[7].scanlineArr
  ];

  this.sortedWindowIndices = [
    this.layers[0].windowIndex,
    this.layers[1].windowIndex,
    this.layers[2].windowIndex,
    this.layers[3].windowIndex,
    this.layers[4].windowIndex,
    this.layers[5].windowIndex,
    this.layers[6].windowIndex,
    this.layers[7].windowIndex
  ];

  this.sortedIsObj = [
    this.layers[0].isObj,
    this.layers[1].isObj,
    this.layers[2].isObj,
    this.layers[3].isObj,
    this.layers[4].isObj,
    this.layers[5].isObj,
    this.layers[6].isObj,
    this.layers[7].isObj
  ];

  this.numActiveLayers = 0;

  window.graphics = this;
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
}

graphics.prototype.updateDISPSTAT= function (newDISPSTATVal) {
  this.vblankIRQEnable = newDISPSTATVal & this.displayENUMS["VBLANKIRQENABLE"];
  this.hblankIRQEnable = newDISPSTATVal & this.displayENUMS["HBLANKIRQENABLE"];
  this.vCountIRQEnable = newDISPSTATVal & this.displayENUMS["VCOUNTIRQENABLE"];
  this.vCountSetting = (newDISPSTATVal & this.displayENUMS["VCOUNTSETTING"]) >>> 8;
}

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
}

graphics.prototype.updateBLDALPHA = function (newBLDALPHAVal) {
  this.eva = newBLDALPHAVal & 31;
  this.eva = this.eva > 16 ? 16 : this.eva;

  this.evb = (newBLDALPHAVal & 7936) >>> 8;
  this.evb = this.evb > 16 ? 16 : this.evb;
}

graphics.prototype.updateBLDY = function (newBLDYVal) {
  this.evy = newBLDYVal & 31;
  this.evy = this.evy > 16 ? 16 : this.evy;
}

graphics.prototype.setHblank = function () {
  this.hblank = true;
  this.ioregionMem[this.dispstatByte1] |= this.displayENUMS["HBLANKSET"];

  if (this.hblankIRQEnable) //if hblank irq enabled, throw interrupt
  {
    this.ioregionMem[this.ifByte1] |= 2;
    this.cpu.halt = false;
    this.cpu.checkInterrupt = true;
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
    this.cpu.halt = false;
    this.cpu.checkInterrupt = true;
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
     this.cpu.halt = false;
     this.cpu.checkInterrupt = true;
    }
  }
  else
  {
    this.ioregionMem[this.dispstatByte1] &= this.displayENUMS["VCOUNTERCLEAR"];
  }
  this.ioregionMem[this.vcountByte1] = scanline;
};

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
    this.sortActiveLayers(layers.length);
  }
  return newMode;
};

graphics.prototype.updateBGPriority = function (layerIndex, oldPrio, newPrio) {
  if (oldPrio !== newPrio)
  {
    let layer = this.layers[layerIndex];
    layer.prio = newPrio;
    if (this.modeToLayerDisplay[this.mode][layerIndex] && layer.display)
    {
      layer.sortVal = layer.layerNum + (layer.prio * 5);
      this.sortActiveLayers(this.numActiveLayers);
    }
  }
  return newPrio;
};

//master bg display
graphics.prototype.updateBGDisplay = function (layerIndex, oldDisplay, newDisplay) {
  if (oldDisplay !== newDisplay)
  {
    let layer = this.layers[layerIndex];
    layer.display = newDisplay;
    if (this.modeToLayerDisplay[this.mode][layerIndex])
    {
      layer.sortVal = newDisplay ? (layer.layerNum + (layer.prio * 5)) : 20;
      this.numActiveLayers += newDisplay ? 1 : -1;
      this.sortActiveLayers(newDisplay ? this.layers.length : (this.numActiveLayers + 1));
    }
  }
  return newDisplay;
};

//master obj display
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
    this.sortActiveLayers(layers.length);
  }
  return newDisplay;
};

graphics.prototype.updateObjLayerDisplay = function (layerIndex, newDisplay) {
  let layer = this.layers[layerIndex];
  layer.display = newDisplay;

  if (this.objDisplay)
  {
    layer.sortVal = newDisplay ? ((layer.prio * 5) + layer.layerNum) : 20;
    this.numActiveLayers += newDisplay ? 1 : -1;
    this.sortActiveLayers(newDisplay ? this.layers.length : (this.numActiveLayers + 1));
  }
};

graphics.prototype.sortActiveLayers = function (maxIndex) {
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
  if (this.bg2Display)
  {
    let backdrop = this.paletteRamMem16[0];
    this.bg2.renderScanlineMode3(scanline);

    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode4 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  if (this.bg2Display)
  {
    let backdrop = this.paletteRamMem16[0];
    this.bg2.renderScanlineMode4(scanline, this.page);

    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

graphics.prototype.renderScanlineMode5 = function(scanline, imageDataIndex, imageDataArr, convertColor) { 
  if (this.bg2Display)
  {
    let backdrop = this.paletteRamMem16[0];
    this.bg2.renderScanlineMode5(scanline, this.page);

    this.mergeLayers(imageDataArr, imageDataIndex, backdrop, this.convertColor);
  }
};

//blending is off
graphics.prototype.blendMode0 = function(color) { 
  return color;
};

//alpha blending
graphics.prototype.blendMode1 = function(color, eva, evb, firstTargetMatch, secondTarget, scanlineArrs, windowIndices, isObj, layerIndex, pixelNum, numActiveLayers, backdrop) {
  if (firstTargetMatch)
  {
    let secondColor = backdrop;
    let secondColorWindowIndex = 5;
    for (let p = layerIndex + 1; p < numActiveLayers; p ++)
    {
      if ((scanlineArrs[p][pixelNum] !== 0x8000) && !(isObj[p] && isObj[layerIndex]))
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
graphics.prototype.blendMode2 = function(color, eva, evb, firstTargetMatch) { 
  if (firstTargetMatch)
  {
    let r = (color & 31);
    let g = (color & 992) >>> 5;
    let b = (color & 31744) >>> 10;

    r += ((31 - r) * eva) >>> 4;
    g += ((31 - g) * eva) >>> 4;  
    b += ((31 - b) * eva) >>> 4;  
    
    return (b << 10) + (g << 5) + r;
  }
  return color;
};

//brightness decrease
graphics.prototype.blendMode3 = function(color, eva, evb, firstTargetMatch) { 
  if (firstTargetMatch)
  {
    let r = (color & 31);
    let g = (color & 992) >>> 5;
    let b = (color & 31744) >>> 10;

    r -= (r * eva) >>> 4;
    g -= (g * eva) >>> 4;  
    b -= (b * eva) >>> 4;  
    
    return (b << 10) + (g << 5) + r;
  }
  return color;
};

graphics.prototype.mergeLayers = function (imageDataArr, imageDataIndex, backdrop, convertColor) {
  let scanlineArrs = this.sortedScanlineArrs;
  let windowIndices = this.sortedWindowIndices;
  let isObjArr = this.sortedIsObj;

  let blendMode = this.blendMode;
  let firstTarget = this.firstTarget;
  let secondTarget = this.secondTarget;
  let eva = (blendMode === 1) ? this.eva : this.evy;
  let evb = this.evb;
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
      if (scanlineArrs[p][i] !== 0x8000)
      {
        color = scanlineArrs[p][i];
        windowIndex = windowIndices[p];
        isObj = isObjArr[p];
        break;
      }
    }

    if (isObj && (color & 0x8000)) //semi trans obj
    {
      imageDataArr[i + imageDataIndex] = convertColor[blendAlpha(color, eva, evb, true, secondTarget, scanlineArrs, windowIndices, isObjArr, p, i, numActiveLayers, backdrop)];
    }
    else
    {
      imageDataArr[i + imageDataIndex] = convertColor[blend(color, eva, evb, firstTarget[windowIndex], secondTarget, scanlineArrs, windowIndices, isObjArr, p, i, numActiveLayers, backdrop)];
    }
  }
}

graphics.prototype.mergeLayersWindow = function (enableScanline, windowCNT, imageDataArr, imageDataIndex, backdrop, convertColor) {
  let scanlineArrs = this.sortedScanlineArrs;
  let windowIndices = this.sortedWindowIndices;
  let isObjArr = this.sortedIsObj;

  let blendMode = this.blendMode;
  let firstTarget = this.firstTarget;
  let secondTarget = this.secondTarget;
  let eva = (blendMode === 1) ? this.eva : this.evy;
  let evb = this.evb;
  let blend = (blendMode === 0) ? this.blendMode0 : (blendMode === 1 ? this.blendMode1 : (blendMode === 2 ? this.blendMode2 : this.blendMode3));
  let blendAlpha = this.blendMode1;

  let numActiveLayers = this.numActiveLayers;

  for (let i = 0; i < 240; i ++)
  {
    let color = backdrop;
    for (let p = 0; p < numActiveLayers; p ++)
    {
      if ((scanlineArrs[p][i] !== 0x8000) && (windowCNT[enableScanline[i]][windowIndices[p]]))
      {
        color = scanlineArrs[p][i];
        break;
      }
    }
    imageDataArr[i + imageDataIndex] = convertColor[color];
  }
}

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


graphics.prototype.finishDraw = function () {
  this.context.putImageData(this.imageData, 0, 0);
  this.setFrameComplete();
}

//debugging
graphics.prototype.updateRegisters = function(mode) {
  for (let i = 0; i <= 15; i++)
  {
    this.registersDOM[i].textContent = parseInt(this.registers[i][this.registerIndices[mode][i]]).toString(16);
  }
  //show SPSR
  if (mode)
  {
    this.registersDOM[16].textContent = parseInt(this.registers[17][this.registerIndices[mode][17]]).toString(16);
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



// let fn1 = function (x = 5, y = 10) {
//   let somevar = x + y;
// }

// let fn2 = function (x = 5, y = 10) {
//   let somevar = x * y;
// }

// let fn3 = function (x = 5, y = 10) {
//   let somevar = x / y;
// }

// let fn4 = function (x = 5, y = 10) {
//   let somevar = x - y;
// }

// let mode = 1;

// let timenow = (new Date).getTime();
// for (let i = 0; i < 1000000000; i++)
// {
//   let fn = (mode === 1) ? fn1 : (mode === 2 ? fn2 : (mode === 3 ? fn3 : fn4));
//   fn();
// }
// console.log((new Date).getTime() - timenow);

// mode = 3;
// timenow = (new Date).getTime();
// for (let i = 0; i < 1000000000;)
// {
//   let fn = (mode === 1) ? fn1 : (mode === 2 ? fn2 : (mode === 3 ? fn3 : fn4));
//   for (let p = 0; p < 30; p ++)
//   {
//     fn();
//     i ++;
//   }
// }
// console.log((new Date).getTime() - timenow);