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

  	const stateENUMS = {ARM : 0, THUMB : 1};
    const modeENUMS = {USER : 0, SYSTEM : 0, FIQ : 1, SVC : 2, ABT : 3, IRQ : 4, UND : 5}; //value also corresponds to row in register indices
    const valToMode = []; //modes indexed by their value in the CPSR
    valToMode[31] = "SYSTEM";
    valToMode[16] = "USER";
    valToMode[17] = "FIQ"; //never used
    valToMode[19] = "SVC";
    valToMode[23] = "ABT";
    valToMode[18] = "IRQ";
    valToMode[27] = "UND";

  	let state = stateENUMS["ARM"]; //starting state is ARM
    let insize = 4; //instruction size
  	let mode = modeENUMS["SYSTEM"]; //starting mode is SYSTEM
    let modeVal = 31; //all modes but user are non privileged


    const registerIndices = [
    //                     1 1 1 1 1 1
    //r0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 C S 
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"]
      [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0], //modeENUMS["FIQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1], //modeENUMS["SVC"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,2], //modeENUMS["ABT"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,3], //modeENUMS["IRQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,4], //modeENUMS["UND"]
    ];
  	//availability of registers depends on the current mode
  	//in THUMB state, only a subset of the registers are available 
  	const registers = [
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
  	registers[15][0] = pc; //set initial pc
    //registers[16][0] += 31 + 128 + 64; //clear ARM bit (already cleared), set SYSTEM mode in CPSR, set I and F bit
    registers[16][0] += 31; //set SYSTEM mode

    //set default sp values
    registers[13][0] = 0x03007F00; //USER/SYSTEM
    registers[13][4] = 0x03007FA0; //IRQ
    registers[13][2] = 0x03007FE0; //SVC

    //set default r0 and r14?
    //registers[0][0] = 0xCA5;
    //registers[14][0] = 0x8000000;

    //pipeline -> [instr, instr, opcode] execute will take pipeline[1] and pipeline[2] as args, decode will take pipeline[0] as arg
    const pipeline = new Uint32Array(3);
    const pipelinecopy = new Uint32Array(3);
    let pipelineResetFlag = false;

    let curpc = pc; //internal pc (for detecting changes to r15)

    //setter functions for ARM and THUMB objects for manipulating CPU state///////////////////////////////////
    //'ARM' or 'THUMB'
    const changeState = function (newState) {
      if (stateENUMS[newState] === undefined) 
      {
        throw Error("undefined state!"); 
      }
      else
      {
        console.log("switching to " + newState + " state")
        //set to arm by default
        insize = 4;
        registers[16][0] &= 0xFFFFFFDF; //clear t bit in CPSR
        if (stateENUMS[newState]) //if thumb, set to thumb
        {
          insize = 2;
          registers[16][0] += 32; //set t bit in CPSR
        }

        state = stateENUMS[newState]; //set internal state
      }
    };

    //USER, SYSTEM, FIQ, etc.. all modes besides USER are privileged
    const changeMode = function (newModeVal) {
      modeVal = newModeVal;
      mode = modeENUMS[valToMode[newModeVal]];
      if (mode === undefined)
      {
        throw Error("changing mode to undefined value");
      }
      console.log("set mode to " + valToMode[newModeVal]);
    };

    //CPSR nzcv xxxx xxxx xxxx xxxx xxxx xxxx xxxx 
    const setNZCV = function (nflag, zflag, cflag, vflag) { 
      let newNZCV = 0;

      newNZCV = nflag ? 1 : 0;
      newNZCV = zflag ? ((newNZCV << 1) + 1) : newNZCV << 1;
      newNZCV = cflag === undefined ? ((newNZCV << 1) + bitSlice(registers[16][0], 29, 29)) : (cflag ? ((newNZCV << 1) + 1) : newNZCV << 1);
      newNZCV = vflag === undefined ? ((newNZCV << 1) + bitSlice(registers[16][0], 28, 28)) : (vflag ? ((newNZCV << 1) + 1) : newNZCV << 1);

      registers[16][0] &= 0x00FFFFFF; //set first byte to zero
      registers[16][0] += (newNZCV << 28); //add new flags to CPSR
    }

    //tell cpu to reset pipeline
    const setPipelineResetFlag = function () {
      pipelineResetFlag = true;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  	const THUMB = thumb(MMU, registers, changeState, changeMode, setNZCV, setPipelineResetFlag, registerIndices);
  	const ARM = arm(MMU, registers, changeState, changeMode, setNZCV, setPipelineResetFlag,  registerIndices);

    const fetch = function() {
        if (state === stateENUMS["ARM"])
        {
          return MMU.readMem(registers[15][0], 4);
        }
        else //state === stateEnums["THUMB"]
        {
          return MMU.readMem(registers[15][0], 2);
        }
    };

    const decode = function (instr) {
        if (state === stateENUMS["ARM"])
        {
          return ARM.decode(instr);
        }
        else //state === stateEnums["THUMB"]
        {
          return THUMB.decode(instr);
        }
    };
    
    const execute = function (instr, opcode) {
        if (state === stateENUMS["ARM"])
        {
          ARM.execute(instr, opcode, mode);
        }
        else //state === stateEnums["THUMB"]
        {
          THUMB.execute(instr, opcode, mode);
        }
    };

    //resets pipeline by fetching
    const resetPipeline = function (){
      pipeline[1] = fetch();
      pipeline[2] = decode(pipeline[1]);
      registers[15][0] += insize;

      pipeline[0] = fetch();
      registers[15][0] += insize;

      curpc = registers[15][0];
    };

    //debugging
    $("#decode").change(function()
    {
      let instr = parseInt($(this).val(), 16);
      console.log("ARM opcode: " + ARM.decode(instr));
      console.log("THUMB opcode: " + THUMB.decode(instr));
    });

    const LOG = log(registers);

    //init pipeline contents
    resetPipeline();

  	return {
      run : function(debug, inum) {
        pipelinecopy[0] = pipeline[0];
        pipelinecopy[1] = pipeline[1];
        pipelinecopy[2] = pipeline[2];

        pipeline[0] = fetch();

        pipeline[1] = pipelinecopy[0];
        pipeline[2] = decode(pipelinecopy[0]);

        try{
          if (debug)
          console.log("[" + inum +  "] executing opcode: " + (state ? THUMBopcodes[pipelinecopy[2]] : ARMopcodes[pipelinecopy[2]]) + " at Memory addr: 0x" + (registers[15][0] - (state ? 4 : 8)).toString(16));
          LOG.logRegs(mode);
          execute(pipelinecopy[1], pipelinecopy[2]);
        }
        catch (err)
        {
          console.log("executing opcode: " + (state ? THUMBopcodes[pipelinecopy[2]] : ARMopcodes[pipelinecopy[2]]) + " at Memory addr: 0x" + (registers[15][0] - (state ? 4 : 8)).toString(16));
          console.log(err);
          throw Error(err);
        }

        if (pipelineResetFlag)
        {
          if (debug)
          console.log("resetting pipeline, pc was changed to 0x" + (registers[15][0]).toString(16));
          resetPipeline();
          pipelineResetFlag = false;
        }
        else
        {
          registers[15][0] += insize; //increment pc
        }
      },

      getState : function() {
        return state;
      },

      getMode : function() {
        return mode;
      },

      getRegisters : function() {
        return registers;
      }
  	}
}










    //   fetch : function() {
    //     console.log("mem addr: 0x" + registers[15][0].toString(16))
    //     if (state === stateENUMS["ARM"])
    //     {
    //       return MMU.readMem(registers[15][0], 4);
    //     }
    //     else //state === stateEnums["THUMB"]
    //     {
    //       return MMU.readMem(registers[15][0], 2);
    //     }
    //     registers[15][0] += (state === stateENUMS["ARM"] ? 4 : 2); //increment pc
    // },

    // decode : function (instr) {
    //     let opcode;

    //     if (state === stateENUMS["ARM"])
    //     {
    //       opcode = ARM.decode(instr);
    //     }
    //     else //state === stateEnums["THUMB"]
    //     {
    //       opcode = THUMB.decode(instr);
    //     }
    //     return opcode;
    // },
    
    // execute : function (instr, opcode) {
    //     if (state === stateENUMS["ARM"])
    //     {
    //       ARM.execute(instr, opcode, mode);
    //     }
    //     else //state === stateEnums["THUMB"]
    //     {
    //       THUMB.execute(instr, opcode, mode);
    //     }
    // },