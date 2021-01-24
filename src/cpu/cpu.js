//37 registers: 31 general registers (Rxx) and 6 status registers (xPSR)
//some registers are banked upon entering interrupt handler routines
//registers are 32 bits (4 bytes)
//R0-R12 (general purpose registers): only R0-R7 (Lo) are accessible in THUMB mode
//R13 (stack pointer in THUMB mode)
//R14 (link register): address of branch and link + sizeof(instruction) stored in here
//after function call for returning from a subroutine
//R15 (program counter)
//CPSR (current program status register)
//SPSR (saved program status register): used to store the CPSR upon a mode switch

//shared registers between all modes
//R0-R7, R15, CPSR
//unique registers (all SPSR)
//SPSR_fiq, SPSR_sv, SPSR_abt, SPSR_irq, SPSR_und
//banked registers
//R8_fiq-R14_fiq, R13_svc-R14_svc, R13_abt-R14_abt, R13_irq-R14_irq, R13_und-R14_und
//rest are partially shared

const cpu = function (pc, mmu) {

    window.irq = 0;
    this.mmu = mmu;

  	this.stateENUMS = {ARM : 0, THUMB : 1};
    this.modeENUMS = {USER : 0, SYSTEM : 0, FIQ : 1, SVC : 2, ABT : 3, IRQ : 4, UND : 5}; //value also corresponds to row in register indices
    this.valToMode = []; //modes indexed by their value in the CPSR
    this.valToMode[31] = "SYSTEM"; //11111
    this.valToMode[16] = "USER"; //10001
    this.valToMode[17] = "FIQ"; //never used
    this.valToMode[19] = "SVC"; //10011
    this.valToMode[23] = "ABT";
    this.valToMode[18] = "IRQ"; //10010
    this.valToMode[27] = "UND";

  	this.state = this.stateENUMS["ARM"]; //starting state is ARM
    this.insize = 4; //instruction size
  	this.mode = this.modeENUMS["SYSTEM"]; //starting mode is SYSTEM
    this.halt = false;

    this.r8 = new Uint32Array(1);
    this.r9 = new Uint32Array(1);
    this.r10 = new Uint32Array(1);
    this.r11 = new Uint32Array(1);
    this.r12 = new Uint32Array(1);

    this.r8_FIQ = new Uint32Array(1);
    this.r9_FIQ = new Uint32Array(1);
    this.r10_FIQ = new Uint32Array(1);
    this.r11_FIQ = new Uint32Array(1);
    this.r12_FIQ = new Uint32Array(1);

    this.r13 = [new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1)];
    this.r14 = [new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1)];
    this.SPSR = [[null], new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1), new Uint32Array(1)]; //no SPSR for USER mode

    this.registers = [
      new Uint32Array(1), //R0         ^       ^
      new Uint32Array(1), //R1         |       |
      new Uint32Array(1), //R2         |       |
      new Uint32Array(1), //R3         |       |
      new Uint32Array(1), //R4         |       |
      new Uint32Array(1), //R5         |       |
      new Uint32Array(1), //R6         |       |     
      new Uint32Array(1), //R7 shared (LO) registers R0 - R7 (in both ARM and THUMB state) 
      this.r8, //R8         ^       ^
      this.r9, //R9         |       |
      this.r10, //R10        |       |
      this.r11, //R11        |       |
      this.r12, //R12, shared among all modes except FIQ mode, unavailable in THUMB STATE
      this.r13[0], //R13, every mode has banked registers for this register (stack pointer in the THUMB state)
      this.r14[0], //R14, every mode has banked registers for this register  (link register)
      new Uint32Array(1), //R15, shared (program counter)
      new Uint32Array(1), //CPSR, shared (current program status register)
      this.SPSR[0] //SPSR, every mode has banked registers for this register (saved process status register) besides USER/SYSTEM
    ];
  	
    //set pc, mode bits in CPSR, sp
  	this.registers[15][0] = pc; //set initial pc
    this.registers[16][0] += 31; //set SYSTEM mode, set ARM state, set I and F bit?
    this.r13[0][0] = 0x03007F00; //USER/SYSTEM stack pointer
    this.r13[4][0] = 0x03007FA0; //IRQ stack pointer
    this.r13[2][0] = 0x03007FE0; //SVC stack pointer

    //cpu pipeline (pipeline[0] holds instruction to be decoded, pipeline[1] and pipeline[2] hold the opcode and the instruction itself to be executed)
    this.pipeline = new Uint32Array(3);

    //ARM and THUMB 
    this.THUMB = new thumb(this, mmu);
    this.ARM = new arm(this, mmu);

    //interrupt stuff
    let ioregion = this.mmu.getMemoryRegion("IOREGISTERS");
    let IF = ioregion.getIOReg("IF"); //vcountByte1
    this.ioregionMem16 = new Uint16Array(ioregion.memory.buffer);
    this.ifVal = IF.regIndex >>> 1;

    this.interruptEnable = 0;
    this.masterInterruptEnable = 0;
    this.checkInterrupt = false;

    ioregion.getIOReg("IME").addCallback((newIMEVal) => {this.updateIME(newIMEVal)});
    ioregion.getIOReg("IE").addCallback((newIEVal) => {this.updateIE(newIEVal)});
    ioregion.getIOReg("HALTCNT").addCallback((newHALTCNTVal) => {this.updateHALTCNT(newHALTCNTVal)});

    //debugging stuff
    window.cpu = this;
    const ARM = this.ARM;
    const THUMB = this.THUMB;
    this.LOG = log(this.registers);
    $("#decode").change(function()
    {
      let instr = parseInt($(this).val(), 16);
      console.log("ARM opcode: " + ARM.decode(instr));
      console.log("THUMB opcode: " + THUMB.decode(instr));
    });
    $("#fetch").click(function()
    {
      console.log("data: 0x" + (mmu.read32(parseInt($("#addr").val(), 16), 4) >>> 0).toString(16).padStart(0, 8));
    });
};

cpu.prototype.updateIME = function (newIMEVal) {
  this.masterInterruptEnable = newIMEVal & 1;
  //start any queued up interrupts
  this.checkInterrupt = true;
};

cpu.prototype.updateIE = function (newIEVal) {
  this.interruptEnable = newIEVal;
  //start any queued up interrupts
  this.checkInterrupt = true;
};

cpu.prototype.updateHALTCNT = function (newHALTCNTVal) {
  this.halt = !(newHALTCNTVal & 128);
  if (!this.halt)
  {
    throw Error("unimplemented stop mode");
  }
};


//interrupt handling functions -------------------------------------------------------------------
cpu.prototype.startSWI = function (swiNum) {
  //console.log("swi 0x" + swiNum + " at: " + (this.registers[15][0] - this.insize * 2).toString(16));
  this.r14[2][0] = this.registers[15][0] - (this.state ? 2 : 4); //set r14_svc to return address (PC is two instructions ahead of swi instruction that called this, so minus one instruction size to get to next instruction)
  this.SPSR[2][0] = this.registers[16][0]; //save CPSR in SPSR_svc
  this.registers[16][0] &= 0xFFFFFF00;
  this.registers[16][0] += 147; //128 (i bit) + 19 (svc mode)
  this.changeMode(this.modeENUMS["SVC"]);
  this.changeState(this.stateENUMS["ARM"]);
  this.registers[15][0] = 0x8; //set pc to swi exception vector

  this.resetPipeline();
};

cpu.prototype.startIRQ = function () {
  //console.log(this.interruptCause);
  //check if bit in IE matches any bits in IF e.g. vblank, check master interrupt enable bit and CPSR interrupt enable bit
  if ((this.interruptEnable & this.ioregionMem16[this.ifVal]) && !(this.registers[16][0] & 128) && this.masterInterruptEnable)
  {
    // if (window.debug)
    // {
    //   console.log("INTERRUPT FIRE");
    // }
    //throw Error();
    // console.log("[-----------------------INTERRUPT-------------------------------]");
    this.r14[4][0] = this.registers[15][0] - (this.state ? 0 : 4); //set r14_irq to return address (PC is two instructions ahead of current instruction and bios returns by subs r15, r14, -4, so minus one instruction size in arm)
    this.SPSR[4][0] = this.registers[16][0]; //save CPSR in SPSR_irq
    this.registers[16][0] &= 0xFFFFFF00;
    this.registers[16][0] += 146; //128 (i bit) + 18 (irq mode)
    this.changeMode(this.modeENUMS["IRQ"]);
    this.changeState(this.stateENUMS["ARM"]);
    this.registers[15][0] = 0x18; //set pc to irq exception vector

    this.initPipeline();
  }
};

cpu.prototype.awake = function () {
  this.halt = false;
  this.checkInterrupt = true;
};

//setter functions for internal state-------------------------------------------------------------------
cpu.prototype.changeState = function (newState) {
  if (newState === undefined) 
  {
    throw Error("undefined state!"); 
  }
  else
  {
    //console.log("switching to " + newState + " state")
    //set to arm by default
    this.insize = 4;
    this.registers[16][0] &= 0xFFFFFFDF; //clear t bit in CPSR

    //if thumb, set to thumb
    if (newState === this.stateENUMS["THUMB"])
    {
      this.insize = 2;
      this.registers[16][0] += 32; //set t bit in CPSR
    }

    this.state = newState; //set internal state
  }
};

//handles changing of mode (register switching)
cpu.prototype.changeMode = function (newMode) {
  if (newMode === undefined)
  {
    throw Error("invalid mode!");
  }

  if (newMode !== this.mode)
  {
    if (this.mode === this.modeENUMS["FIQ"]) //switch out FIQ registers
    {
      console.log("FIQ mode used?");
      this.registers[8] = this.r8;
      this.registers[9] = this.r9;
      this.registers[10] = this.r10;
      this.registers[11] = this.r11;
      this.registers[12] = this.r12;
    }
    else if (newMode === this.modeENUMS["FIQ"]) //switch in FIQ registers
    {
      console.log("FIQ mode used?");
      this.registers[8] = this.r8_FIQ;
      this.registers[9] = this.r9_FIQ;
      this.registers[10] = this.r10_FIQ;
      this.registers[11] = this.r11_FIQ;
      this.registers[12] = this.r12_FIQ;
    }

    //console.log(this.registers);
    //switch in r13, r14, SPSR for new mode
    this.registers[13] = this.r13[newMode];
    this.registers[14] = this.r14[newMode];
    this.registers[17] = this.SPSR[newMode];
    //console.log(this.registers);

    this.mode = newMode;
  }
};

cpu.prototype.setCPSR = function (newCPSR) {
  this.registers[16][0] = newCPSR;
  this.changeMode(this.modeENUMS[this.valToMode[newCPSR & 31]]);

  if (this.state !== ((newCPSR & 32) >>> 5))
  {
    throw Error("changing t bit manually!");
  }

  //start any queued up interrupts
  this.checkInterrupt = true;
};


//fetch, decode, execute functions-------------------------------------------------------------------
cpu.prototype.fetch = function() {
  if (this.state === this.stateENUMS["ARM"])
  {
    return this.mmu.read32(this.registers[15][0]);
  }
  else //state === stateEnums["THUMB"]
  {
    return this.mmu.read16(this.registers[15][0]);
  }
};

cpu.prototype.decode = function (instr) {
  if (this.state === this.stateENUMS["ARM"])
  {
    return this.ARM.decode(instr);
  }
  else //state === stateEnums["THUMB"]
  {
    return this.THUMB.decode(instr);
  }
};
    
cpu.prototype.execute = function (instr, opcode) {
  if (this.state === this.stateENUMS["ARM"])
  {
    return this.ARM.execute(instr, opcode);
  }
  else //state === stateEnums["THUMB"]
  {
    return this.THUMB.execute(instr, opcode);
  }
};

//pipeline functions -----------------------------------------------------------------------------
cpu.prototype.initPipeline = function () {
  this.resetPipeline();
  this.registers[15][0] += this.insize;
}

cpu.prototype.resetPipeline = function (){
  this.registers[15][0] &= this.state === 0 ? 0xFFFFFFFC : 0xFFFFFFFE; //align the new r15(pc) value

  this.pipeline[1] = this.fetch();
  this.pipeline[2] = this.decode(this.pipeline[1]);
  this.registers[15][0] += this.insize;

  this.pipeline[0] = this.fetch();
};

//main run function ----------------------------------------------------------------------------------------
// cpu.prototype.run = function(debug, inum) {
//   this.instructionNum = inum;
//   try {
//     if (this.halt)
//     {
//       return;
//     }
//     if (this.checkInterrupt)
//     {
//       this.checkInterrupt = false;
//       this.startIRQ();
//     }
//     var pipelinecopy0 = this.pipeline[0];
//     var pipelinecopy1 = this.pipeline[1];
//     var pipelinecopy2 = this.pipeline[2];

//     this.pipeline[0] = this.fetch();

//     this.pipeline[1] = pipelinecopy0;
//     this.pipeline[2] = this.decode(pipelinecopy0);   

//     if (debug)
//     {
//       //console.log(this.pipelinecopy[2]);
//       console.log("[" + inum +  "] executing opcode: " + (this.state ? THUMBopcodes[pipelinecopy2] : ARMopcodes[pipelinecopy2]) + " at Memory addr: 0x" + (this.registers[15][0] - (this.state ? 4 : 8)).toString(16));
//     }
//     if (inum >= 1)
//     {
//       //this.LOG.logRegs(this.mode);
//     }
//     // if ((this.registers[15][0] - (this.state ? 4 : 8)) === 0x0000013C)
//     // {
//     //   console.log("[--------------------------RETURN-------------------------------]");
//     // }
//     this.execute(pipelinecopy1, pipelinecopy2);
//     console.log(this.registers);
//   }
//   catch (err)
//   {
//     console.log("[" + inum +  "] executing opcode: " + (this.state ? THUMBopcodes[pipelinecopy2] : ARMopcodes[pipelinecopy2]) + " at Memory addr: 0x" + (this.registers[15][0] - (this.state ? 4 : 8)).toString(16));
//     console.log(err);
//     console.log("instr: " + pipelinecopy1.toString(16));
//     throw Error(err);
//   }

//   this.registers[15][0] += this.insize; //increment pc
// }

cpu.prototype.run = function(numCycles) {
  let mmu = this.mmu;
  let pipeline = this.pipeline;
  let registers = this.registers;

  for (let i = 0; ((i + mmu.numCycles) < numCycles) && !this.halt;) 
  { 
    if (this.checkInterrupt)
    {
      this.startIRQ();
      this.checkInterrupt = false;
    }

    let pipelinecopy0 = pipeline[0];
    let pipelinecopy1 = pipeline[1];
    let pipelinecopy2 = pipeline[2];

    pipeline[0] = this.fetch();

    pipeline[1] = pipelinecopy0;
    pipeline[2] = this.decode(pipelinecopy0);   

    i += this.execute(pipelinecopy1, pipelinecopy2);
    registers[15][0] += this.insize; //increment pc
  }
  mmu.numCycles = 0;


  // if (!this.halt)
  // {
  //   if (this.checkInterrupt)
  //   {
  //     this.startIRQ();
  //     this.checkInterrupt = false;
  //   }

  //   let pipeline = this.pipeline
  //   let pipelinecopy0 = pipeline[0];
  //   let pipelinecopy1 = pipeline[1];
  //   let pipelinecopy2 = pipeline[2];

  //   pipeline[0] = this.fetch();

  //   pipeline[1] = pipelinecopy0;
  //   pipeline[2] = this.decode(pipelinecopy0);   

  //   this.execute(pipelinecopy1, pipelinecopy2);
  //   this.registers[15][0] += this.insize; //increment pc
  //   return 0;
  // }
};
