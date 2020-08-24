const arm = function(memory, registers)
{
	return 
	{
		decode : function (instr) {
			// 1111 1100 0000 0000
			// 5432 1098 7654 3210
			// xxxx xxxx xxxx xxxx
			switch (bitSlice(instr, 13, 15)) //MAIN SWITCH
			{
				case 0:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 0; break; //LSL IMM5

					case 1: return 1; break; //LSR IMM5

					case 2: return 2; break; //ASR IMM5

					case 3:
					switch (bitSlice(instr, 9, 12))
					{
						case 0: return 3; break; //ADD REGISTER

						case 1: return 4; break; //SUBTRACT REGISTER

						case 2: return 5; break; //ADD IMM3

						case 3: return 6; break; //SUB IMM3
					}
					break;
				}
				break;

				case 1:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 7; break; //MOV IMM8

					case 1: return 8; break; //CMP IMM8

					case 2: return 9; break; //ADD IMM8

					case 3: return 10; break; //SUB IMM8
				}
				break;

				case 2:
				switch (bitSlice(instr, 10, 12))
				{
					case 0:
					switch(bitSlice(instr, 6, 9))
					{
						case 0:  return 11; break; //AND
						case 1:  return 12; break; //XOR
						case 2:  return 13; break; //LSL
						case 3:  return 14; break; //LSR
						case 4:  return 15; break; //ASR
						case 5:  return 16; break; //ADC
						case 6:  return 17; break; //SBC
						case 7:  return 18; break; //ROTATE RIGHT
						case 8:  return 19; break; //TST
						case 9:  return 20; break; //NEG
						case 10: return 21; break; //CMP
						case 11: return 22; break; //NEGCMP
						case 12: return 23; break; //OR
						case 13: return 24; break; //MUL
						case 14: return 25; break; //BIT CLEAR
						case 15: return 26; break; //NOT
					}
					break;

					case 1:
					switch(bitSlice(instr, 8, 9))
					{
						case 0: return 27; break; //ADD check if there is a 1 in next two bits

						case 1: return 28; break; //CMP check if there is a 1 in next two bits

						case 2: return 29; break; //MOV check if there is a 1 in next two bits

						case 3: return 30; break; //BX check if some bits are zero
					}

					case 2:
					case 3:
					return 31;
					break; //LDR IMM (PC)

					case 4:
					return bitSlice(instr, 9, 9) === 0 ? 32 : 33;
					break; //return bit 9 === 0 ? STR REG OFFSET : STRH REG OFFSET

					case 5:
					return bitSlice(instr, 9, 9) === 0 ? 34 : 35;
					break; //return bit 9 === 0 ? STRB REG OFFSET : LDSB REG OFFSET

					case 6:
					return bitSlice(instr, 9, 9) === 0 ? 36 : 37;
					break; //return bit 9 === 0 ? LDR REG OFFSET : LDRH REG OFFSET

					case 7:
					return bitSlice(instr, 9, 9) === 0 ? 38 : 39;
					break; //return bit 9 === 0 ? LDRB REG OFFSET : LDSH REG OFFSET
				}
				break;

				case 3:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: return 40; break; //STR IMM OFFSET
					case 1: return 41; break; //LDR IMM OFFSET
					case 2: return 42; break; //STRB IMM OFFSET
					case 3: return 43; break; //LDRB IMM OFFSET
				}
				break;

				case 4:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: return 44; break; //STRH IMM OFFSET
					case 1: return 45; break; //LDRH IMM OFFSET
					case 2: return 46; break; //STR IMM OFFSET(SP)
					case 3: return 47; break; //LDR IMM OFFSET(SP)
				}
				break;

				case 5:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: return 48; break; //ADD RD PC IMM
					case 1: return 49; break; //ADD RD SP IMM
					case 2:
					return bitSlice(instr, 10, 10) === 0 ? (bit 7 === 0 ? 50 : 51) : 52;
					//return if bit 10 === 0 ? (bit 7 === 0 ? ADD SP IMM : ADD SP -IMM) : PUSH
					break;
					case 3: return 53; break; //POP
				} 
				break;

				case 6:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 54; break; //STMIA
					case 1: return 55; break; //LDMIA
					case 2: return 56; break; //CONDITIONAL BRANCH
					case 3: 
					return bitSlice(instr, 8, 10) === 7 ? 57 : 56;
					break; //return bits 8 - 10 are all 1 ? SW INTR : CONDITIONAL BRANCH
				}
				break;

				case 7:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: return 58; break; //UNCONDITIONAL BRANCH
					case 2: return 59; break; //LONG BRANCH 1
					case 3: return 60; break; //LONG BRANCH 2
				}
				break;
			}
			//undefined instruction
			throw Error("encountered undefined instruction!");
		},
		execute : function (opcode) {
			return true;
		}
	}
}