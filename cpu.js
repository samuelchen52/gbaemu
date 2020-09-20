//three stage pipeline, fetch -> decode -> execute
//pc is 2 instructions ahead of the instruction being executed

//processor modes
//user(default), system(priveleged user), IRQ(interrupt request), 
//FIQ(fast interrput request): this mode goes unused by default,
//SVC (supervisor mode): entered when a software interrupt call is executed (when calling the BIOS via SWI instructions)
//ABT (abort mode) : entered after data or instruction prefetch abort
//UND (undefined mode): entered when an undefined instruction is executed  




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

  	let state = stateENUMS["THUMB"]; //starting state is ARM
  	let mode = modeENUMS["SYSTEM"]; //starting mode is SYSTEM
    let modeVal = 16; //all modes but user are non privileged


    const registerIndices = [
    //                     1 1 1 1 1 1
    //r0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 C S 
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1], //modeENUMS["USER"]
      [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0], //modeENUMS["FIQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,1], //modeENUMS["SVC"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,2], //modeENUMS["ABT"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,3], //modeENUMS["IRQ"]
      [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,0,4], //modeENUMS["UND"]
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
  		new Uint32Array(6), //R15, every mode has banked registers for this register  (program counter)
  		new Uint32Array(1), //CPSR, shared (current program status register)
  		new Uint32Array(5) //SPSR, every mode has banked registers for this register (saved process status register) besides USER/SYSTEM
  	];
  	
  	registers[15][mode] = pc; //set initial pc
    registers[16][0] += 32 + 16; //set THUMB bit and set USER mode in CPSR



    //ARM or THUMB
    const changeState = function (newState) {
      if (stateENUMS[newState] === undefined) 
      {
        throw Error("undefined state!"); 
      }
      else
      {
        registers[16][0] &= 0xFFFFFFDF; //clear t bit in CPSR
        if (stateENUMS[newState])
        {
          registers[16][0] += 32; //set t bit in CPSR if THUMB
        }
        state = stateENUMS[newState];
      }
    }

    //USER, SYSTEM, FIQ, etc..
    //all modes besides USER are privileged
    const changeMode = function (newMode) {
      mode = modeENUMS[newMode];
      priveleged = newMode === "USER" ? false : true;
      if (mode === undefined) {throw Error("undefined mode!"); }
    }

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

  	const THUMB = thumb(MMU, registers, changeState, changeMode, setNZCV, registerIndices);
  	const ARM = arm(MMU, registers, changeState, changeMode, getModeVal, setNZCV, registerIndices);

  	return {
      fetch : function() {
        console.log("mem addr: 0x" + registers[15][mode].toString(16))
        if (state === stateENUMS["ARM"])
        {
          return MMU.readMem(registers[15][mode], 4);
        }
        else //state === stateEnums["THUMB"]
        {
          return MMU.readMem(registers[15][mode], 2);
        }
      },
  		decode : function (instr) {
  			let opcode;

  			if (state === stateENUMS["ARM"])
  			{
  				opcode = ARM.decode(instr);
  			}
  			else //state === stateEnums["THUMB"]
  			{
  				opcode = THUMB.decode(instr);
  			}
  			return opcode;
  		},
  		execute : function (instr, opcode) {
  			if (state === stateENUMS["ARM"])
  			{
  				//ARM.execute(instr, opcode, modeToVal[mode]);
  			}
  			else //state === stateEnums["THUMB"]
  			{
  				THUMB.execute(instr, opcode, mode);
  			}
  			//decode
  			registers[15][mode] += (state === stateENUMS["ARM"] ? 4 : 2); //increment pc
  			return true;
  		},

      getState : function() {
        return state;
      },

      getMode : function() {
        return mode;
      },

      getModeVal : function() {
        return modeVal;
      },

      getRegisters : function() {
        return registers;
      }
  	}
}