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
					case 0: break; //LSL IMM5

					case 1: break; //LSR IMM5

					case 2: break; //ASR IMM5

					case 3:
					switch (bitSlice(instr, 9, 12))
					{
						case 0: break; //ADD REGISTER

						case 1: break; //SUBTRACT REGISTEr

						case 2: break; //ADD IMM3

						case 3: break; //SUB IMM3
					}
					break;
				}
				break;

				case 1:
				switch (bitSlice(instr, 11, 12))
				{
					case 0: break; //MOV IMM 8

					case 1: break; //CMP IMM8

					case 2: break; //ADD IMM8

					case 3: break; //SUB IMM8
				}
				break;

				case 2:
				switch (bitSlice(instr, 10, 12))
				{
					case 0:
					switch(bitSlice(instr, 6, 9))
					{
						case 0:  break; //AND
						case 1:  break; //XOR
						case 2:  break; //LSL
						case 3:  break; //LSR
						case 4:  break; //ASR
						case 5:  break; //ADC
						case 6:  break; //SBC
						case 7:  break; //ROTATE RIGHT
						case 8:  break; //TST
						case 9:  break; //NEG
						case 10: break; //CMP
						case 11: break; //NEGCMP
						case 12: break; //OR
						case 13: break; //MUL
						case 14: break; //BIT CLEAR
						case 15: break; //NOT
					}
					break;

					case 1:
					switch(bitSlice(instr, 8, 9))
					{
						case 0: break; //ADD check if there is a 1 in next two bits

						case 1: break; //CMP check if there is a 1 in next two bits

						case 2: break; //MOV check if there is a 1 in next two bits

						case 3: break; //BX check if some bits are zero
					}

					case 2:
					case 3:
					break; //LRD IMM (PC)

					case 4:
					break; //return bit 9 === 0 ? STR REG OFFSET : STRH REG OFFSET

					case 5:
					break; //return bit 9 === 0 ? STRB REG OFFSET : LDSB REG OFFSET

					case 6:
					break; //return bit 9 === 0 ? LDR REG OFFSET : LDRH REG OFFSET

					case 7:
					break; //return bit 9 === 0 ? LDRB REG OFFSET : LDSH REG OFFSET
				}
				break;

				case 3:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: break; //STR IMM OFFSET
					case 1: break; //LDR IMM OFFSET
					case 2: break; //STRB IMM OFFSET
					case 3: break; //LDRB IMM OFFSET
				}
				break;

				case 4:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: break; //STRH IMM OFFSET
					case 1: break; //LDRH IMM OFFSET
					case 2: break; //STR IMM OFFSET(SP)
					case 3: break; //LDR IMM OFFSET(SP)
				}
				break;

				case 5:
				switch(bitSlice(instr, 11, 12))
				{
					case 0: break; //ADD RD PC IMM
					case 1: break; //ADD RD SP IMM
					case 2:
					//return if bit 10 === 0 ? (bit 7 === 0 ? ADD SP IMM : ADD SP -IMM) : PUSH
					break;
					case 3: break; //POP
				} 
				break;

				case 6:
				switch (bitSlice(instr, 12, 11))
				{
					case 0: break; //STMIA
					case 1: break; //LDMIA
					case 2: break; //CONDITIONAL BRANCH
					case 3: break; //return bits 8 - 10 are all 1 ? SW INTR : CONDITIONAL BRANCH
				}
				break;

				case 7:
				switch (bitSlice(instr, 12, 11))
				{
					case 0: break; //UNCONDITIONAL BRANCH
					case 2: break; //LONG BRANCH 1
					case 3: break; //LONG BRANCH 2
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