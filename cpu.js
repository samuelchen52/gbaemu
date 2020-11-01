//three stage pipeline, fetch -> decode -> execute
//pc is 2 instructions ahead of the instruction being executed

//processor modes
//user(default), system(priveleged user), IRQ(interrupt request), 
//FIQ(fast interrput request): this mode goes unused by default,
//SVC (supervisor mode): entered when a software interrupt call is executed (when calling the BIOS via SWI instructions)
//ABT (abort mode) : entered after data or instruction prefetch abort
//UND (undefined mode): entered when an undefined instruction is executed  

//from PSI in emudev discord
// #define CARRY_ADD(a, b)  ((0xFFFFFFFF-a) < b)
// #define CARRY_SUB(a, b)  (a >= b)

// #define ADD_OVERFLOW(a, b, result) ((!(((a) ^ (b)) & 0x80000000)) && (((a) ^ (result)) & 0x80000000))
// #define SUB_OVERFLOW(a, b, result) (((a) ^ (b)) & 0x80000000) && (((a) ^ (result)) & 0x80000000)


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

//   General Internal Memory
//   00000000-00003FFF   BIOS - System ROM         (16 KBytes)
//   00004000-01FFFFFF   Not used
//   02000000-0203FFFF   WRAM - On-board Work RAM  (256 KBytes) 2 Wait
//   02040000-02FFFFFF   Not used
//   03000000-03007FFF   WRAM - On-chip Work RAM   (32 KBytes)
//   03008000-03FFFFFF   Not used
//   04000000-040003FE   I/O Registers
//   04000400-04FFFFFF   Not used
// Internal Display Memory
//   05000000-050003FF   BG/OBJ Palette RAM        (1 Kbyte)
//   05000400-05FFFFFF   Not used
//   06000000-06017FFF   VRAM - Video RAM          (96 KBytes)
//   06018000-06FFFFFF   Not used
//   07000000-070003FF   OAM - OBJ Attributes      (1 Kbyte)
//   07000400-07FFFFFF   Not used
// External Memory (Game Pak)
//   08000000-09FFFFFF   Game Pak ROM/FlashROM (max 32MB) - Wait State 0
//   0A000000-0BFFFFFF   Game Pak ROM/FlashROM (max 32MB) - Wait State 1
//   0C000000-0DFFFFFF   Game Pak ROM/FlashROM (max 32MB) - Wait State 2
//   0E000000-0E00FFFF   Game Pak SRAM    (max 64 KBytes) - 8bit Bus width
//   0E010000-0FFFFFFF   Not used
// Unused Memory Area
//   10000000-FFFFFFFF   Not used (upper 4bits of address bus unused)

const cpu = function (pc, MMU) {

    this.MMU = MMU;

  	this.stateENUMS = {ARM : 0, THUMB : 1};
    this.modeENUMS = {USER : 0, SYSTEM : 0, FIQ : 1, SVC : 2, ABT : 3, IRQ : 4, UND : 5}; //value also corresponds to row in register indices
    this.valToMode = []; //modes indexed by their value in the CPSR
    this.valToMode[31] = "SYSTEM";
    this.valToMode[16] = "USER";
    this.valToMode[17] = "FIQ"; //never used
    this.valToMode[19] = "SVC";
    this.valToMode[23] = "ABT";
    this.valToMode[18] = "IRQ";
    this.valToMode[27] = "UND";

  	this.state = this.stateENUMS["ARM"]; //starting state is ARM
    this.insize = 4; //instruction size
  	this.mode = this.modeENUMS["SYSTEM"]; //starting mode is SYSTEM


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

  	this.registers = [
  		new Uint32Array(1), //R0         ^       ^
      new Uint32Array(1), //R1         |       |
      new Uint32Array(1), //R2         |       |
      new Uint32Array(1), //R3         |       |
      new Uint32Array(1), //R4         |       |
      new Uint32Array(1), //R5         |       |
      new Uint32Array(1), //R6         |       |     
      new Uint32Array(1), //R7 shared (LO) registers R0 - R7 (in both ARM and THUMB state) 
  		new Uint32Array(2), //R8 		     ^			 ^
  		new Uint32Array(2), //R9   		   |			 |
  		new Uint32Array(2), //R10  		   |			 |
  		new Uint32Array(2), //R11  		   |			 |
  		new Uint32Array(2), //R12, shared among all modes except FIQ mode, unavailable in THUMB STATE
  		new Uint32Array(6), //R13, every mode has banked registers for this register (stack pointer in the THUMB state)
  		new Uint32Array(6), //R14, every mode has banked registers for this register  (link register)
  		new Uint32Array(1), //R15, shared (program counter)
  		new Uint32Array(1), //CPSR, shared (current program status register)
  		new Uint32Array(5) //SPSR, every mode has banked registers for this register (saved process status register) besides USER/SYSTEM
  	];
  	
    //set up registers
  	this.registers[15][0] = pc; //set initial pc
    this.registers[16][0] += 31; //set SYSTEM mode, set ARM state, set I and F bit?

    //set default sp values
    this.registers[13][0] = 0x03007F00; //USER/SYSTEM
    this.registers[13][4] = 0x03007FA0; //IRQ
    this.registers[13][2] = 0x03007FE0; //SVC

    //cpu pipeline (pipeline[0] holds instruction to be decoded, pipeline[1] and pipeline[2] hold the opcode and the instruction itself to be executed)
    this.pipeline = new Uint32Array(3);

    //ARM and THUMB 
    this.THUMB = new thumb(this.MMU, this.registers, this.changeState.bind(this), this.changeMode.bind(this), this.resetPipeline.bind(this), this.startSWI.bind(this), this.registerIndices);
    this.ARM = new arm(this.MMU, this.registers, this.changeState.bind(this), this.changeMode.bind(this), this.resetPipeline.bind(this), this.startSWI.bind(this), this.registerIndices);

    this.initPipeline();

    //debugging stuff
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
      console.log("data: 0x" + (MMU.read32(parseInt($("#addr").val(), 16), 4) >>> 0).toString(16).padStart(0, 8));
    });
};

//setter functions for internal state-------------------------------------------------------------------
cpu.prototype.changeState = function (newState) {
  if (this.stateENUMS[newState] === undefined) 
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
    if (this.stateENUMS[newState])
    {
      this.insize = 2;
      this.registers[16][0] += 32; //set t bit in CPSR
    }

    this.state = this.stateENUMS[newState]; //set internal state
  }
};

cpu.prototype.changeMode = function (newModeVal) {
  this.mode = this.modeENUMS[this.valToMode[newModeVal]];
  if (this.mode === undefined)
  {
    throw Error("changing mode to undefined value");
  }
  //console.log("set mode to " + valToMode[newModeVal]);
};


//fetch, decode, execute functions-------------------------------------------------------------------
cpu.prototype.fetch = function() {
  if (this.state === this.stateENUMS["ARM"])
  {
    return this.MMU.read32(this.registers[15][0]);
  }
  else //state === stateEnums["THUMB"]
  {
    return this.MMU.read16(this.registers[15][0]);
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
    this.ARM.execute(instr, opcode, this.mode);
  }
  else //state === stateEnums["THUMB"]
  {
    this.THUMB.execute(instr, opcode, this.mode);
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

//interrupt handling functions -------------------------------------------------------------------
cpu.prototype.startSWI = function () {
  console.log("swi at: " + (this.registers[15][0]).toString(16));

  this.registers[14][2] = this.registers[15][0] - (this.state ? 2 : 4); //set r14_svc to return address (PC is two instructions ahead)
  this.registers[17][1] = this.registers[16][0]; //save CPSR in SPSR_svc
  this.registers[16][0] = 147; //128 (i bit) + 19 (svc mode)
  this.mode = 2; //set internal mode
  this.state = 0; //set internal state
  this.insize = 4;
  this.registers[15][0] = 8; //set pc to swi exception vector

  this.resetPipeline();
}


//main run function ----------------------------------------------------------------------------------------
cpu.prototype.run = function(debug, inum) {
  try {
    var pipelinecopy0 = this.pipeline[0];
    var pipelinecopy1 = this.pipeline[1];
    var pipelinecopy2 = this.pipeline[2];

    this.pipeline[0] = this.fetch();

    this.pipeline[1] = pipelinecopy0;
    this.pipeline[2] = this.decode(pipelinecopy0);   

    if (debug)
    {
      //console.log(this.pipelinecopy[2]);
      console.log("[" + inum +  "] executing opcode: " + (this.state ? THUMBopcodes[pipelinecopy2] : ARMopcodes[pipelinecopy2]) + " at Memory addr: 0x" + (this.registers[15][0] - (this.state ? 4 : 8)).toString(16));
    }
    if (inum >= 1)
    {
      //this.LOG.logRegs(this.mode);
    }
    this.execute(pipelinecopy1, pipelinecopy2);
  }
  catch (err)
  {
    console.log("[" + inum +  "] executing opcode: " + (this.state ? THUMBopcodes[pipelinecopy2] : ARMopcodes[pipelinecopy2]) + " at Memory addr: 0x" + (this.registers[15][0] - (this.state ? 4 : 8)).toString(16));
    console.log(err);
    throw Error(err);
  }

  this.registers[15][0] += this.insize; //increment pc
}


// cpu.prototype.run = function () {
//   let pipelinecopy0 = this.pipeline[0];
//   let pipelinecopy1 = this.pipeline[1];
//   let pipelinecopy2 = this.pipeline[2];

//   this.pipeline[0] = this.fetch();

//   this.pipeline[1] = pipelinecopy0;
//   this.pipeline[2] = this.decode(pipelinecopy0);   

//   this.execute(pipelinecopy1, pipelinecopy2);
//   this.registers[15][0] += this.insize; //increment pc
// }



