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
    const modeENUMS = {USER : 0, SYSTEM : 0, FIQ : 1, SVC : 2, ABT : 3, IRQ : 4, UND : 5};

  	let state = stateENUMS["THUMB"];
  	let mode = modeENUMS["USER"];
  	//USER and SYSTEM share the same set of registers (these two are basically the same mode, register-wise)


  	//availability of registers depends on the current mode
  	//in THUMB state, only a subset of the registers are available 
  	const registers = [
  		Uint32Array(1), //R0         ^       ^
      Uint32Array(1), //R1         |       |
      Uint32Array(1), //R2         |       |
      Uint32Array(1), //R3         |       |
      Uint32Array(1), //R4         |       |
      Uint32Array(1), //R5         |       |
      Uint32Array(1), //R6         |       |     
      Uint32Array(1), //R7 shared (LO) registers R0 - R7 (in both ARM and THUMB state) 
  		Uint32Array(2), //R8 		     ^			 ^
  		Uint32Array(2), //R9   		   |			 |
  		Uint32Array(2), //R10  		   |			 |
  		Uint32Array(2), //R11  		   |			 |
  		Uint32Array(2), //R12, shared among all modes except FIQ mode, unavailable in THUMB STATE
  		Uint32Array(6), //R13, every mode has banked registers for this register (stack pointer in the THUMB state)
  		Uint32Array(6), //R14, every mode has banked registers for this register  (link register)
  		Uint32Array(6), //R15, every mode has banked registers for this register  (program counter)
  		Uint32Array(1), //CPSR, shared (current program status register)
  		Uint32Array(5) //SPSR, every mode has banked registers for this register (saved process status register) besides USER/SYSTEM
  	];
  	
  	registers[15][mode] = pc; //set initial pc

    const changeState = function (newState) {
      state = stateENUMS[newState];
      //have to set the bit 5 of the CPSR
      if (state === undefined) {throw Error("undefined state!"); }
    }

    const changeMode = function (newMode) {
      mode = modeENUMS[newMode];
      if (mode === undefined) {throw Error("undefined mode!"); }
    }

    //CPSR nzcv xxxx xxxx xxxx xxxx xxxx xxxx xxxx 
    //if setting the cpsr condition flags, n and z flags are ALWAYS set
    //thus, we set those based on the result (check if negative and if zero, respectively)
    //then, if cflag and vflag were passed in, then we set those too
    const setNZCV = function (nflag, zflag, cflag, vflag) { 
      //let cflag = for subtraction, x - y -> cflag = y > x ?, for addition, if result < x || result < y
      //let neg = 0, 1 -> -1 for both negative, 1 for both positive, 0 for 1 neg 1 positive. vflag = sign bit === 1 ? return if 1, : return if -1  
      let newNZCV = 0;
      newNZCV = nflag ? 1 : 0;
      newNZCV = zflag ? ((newNZCV << 1) + 1) : newNZCV << 1;
      newNZCV = cflag ? ((newNZCV << 1) + 1) : newNZCV << 1;
      newNZCV = vflag ? ((newNZCV << 1) + 1) : newNZCV << 1;

      registers[16][0] &= 0x00FFFFFF; //set first byte to zero
      registers[16][0] += (newNZCV << 28); //add new flags to CPSR
    }

  	const THUMB = thumb(MMU, registers, changeState, changeMode, setNZCV);
  	const ARM = arm(MMU, registers, changeState, changeMode, setNZCV);

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
  		execute : function (instr, opcode, mode) {
  			if (state === stateENUMS["ARM"])
  			{
  				//ARM.execute(opcode);
  			}
  			else //state === stateEnums["THUMB"]
  			{
  				//THUMB.execute(opcode);
  			}
  			//decode
  			registers[15][mode] += (state === stateENUMS["ARM"] ? 4 : 2); //increment pc
  			return true;
  		},

      getState : function() {
        return state;
      }
  	}
}