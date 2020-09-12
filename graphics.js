const graphics = function(mmu, registers) {

	const registersDOM = $(".register");
	const cpsrDOM = $(".statusregister"); //N, Z, C, V, Q, I, F, T, Mode, all

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

	return {

		//displays register values on screen for current mode
		updateRegisters : function(mode) {
			for (let i = 0; i <= 15; i++)
			{
				registersDOM[i].textContent = registers[i][registerIndices[mode][i]];
			}
			let CPSR = registers[16][0];
			cpsrDOM[0].textContent = bitSlice(CPSR, 31, 31);
			cpsrDOM[1].textContent = bitSlice(CPSR, 30, 30);
			cpsrDOM[2].textContent = bitSlice(CPSR, 29, 29);
			cpsrDOM[3].textContent = bitSlice(CPSR, 28, 28);
			cpsrDOM[5].textContent = bitSlice(CPSR, 7, 7);
			cpsrDOM[6].textContent = bitSlice(CPSR, 6, 6);
			cpsrDOM[7].textContent = bitSlice(CPSR, 5, 5);
			cpsrDOM[8].textContent = bitSlice(CPSR, 0, 4);
			cpsrDOM[9].textContent = getBytes(CPSR, 0);
		},

		updateScreen : function(){

		}
	}

}