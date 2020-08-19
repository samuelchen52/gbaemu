const arm = function(memory, registers) {




	return 
	{
		decode : function (instr) {
			//3322 2222 2222 1111 1111 1100 0000 0000
			//1098 7654 3210 9876 5432 1098 7654 3210
			//xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx

			//stt0 -> use register after shifting with 5 bits
			//0tt1 -> use register after shifting with bottom byte of another register
			//mmmm mmmm -> use 8 bit imm after 4 bit imm shift

			switch (bitSlice(instr, 24, 27)) //bits 25 to 27
			{
				case 0: //FIRST GROUP OF INSTRUCTIONS
				if (bitSlice(instr, 4, 4))
				{
					if (bitSlice(instr, 7, 7))
					{
						switch (bitSlice(instr, 4, 7))
						{
							case 9: 
							if (bitSlice(instr, 23, 23)) //MULL / MLAL
							{

							}
							else //MUL / MLA
							{ 

							}
							break;

							case 11:
							switch (bitSlice(instr, 20, 22))
							{
								case 0: break; //STRH p=0 i=0, check if bits 8 - 11 are set to 0

								case 1: break; //LDRH p=0 i=0, check if bits 8 - 11 are set to 0

								case 4: break;	//STRH p=0 i=1

								case 5: break;	//LDRH p=0 i=1
							}
							break;

							case 13: 
							switch (bitSlice(instr, 20, 22))
							{

								case 1: break; //LDRSB p=0 i=0, check if bits 8 - 11 are set to 0

								case 5: break;	//LDRSB p=0 i=1
							}
							break;

							case 15:
							switch (bitSlice(instr, 20, 22))
							{

								case 1: break; //LDRSH p=0 i=0, check if bits 8 - 11 are set to 0

								case 5: break;	//LDRSH p=0 i=1
							} 
							break;
						}
					}
					else
					{
						switch (bitSlice(instr, 21, 23))
						{
							case 0: break;	//AND 0tt1

							case 1: break;	//EOR 0tt1

							case 2: break;	//SUB 0tt1 

							case 3: break;	//RSB 0tt1 

							case 4: break;	//ADD 0tt1 

							case 5: break;	//ADC 0tt1 

							case 6: break;	//SBC 0tt1 

							case 7: break;	//RSC 0tt1 
						}
					}
				}
				else
				{
					switch (bitSlice(instr, 21, 23))
					{
						case 0: break;	//AND stt0

						case 1: break;	//EOR stt0

						case 2: break;	//SUB stt0 

						case 3: break;	//RSB stt0 

						case 4: break;	//ADD stt0 

						case 5: break;	//ADC stt0 

						case 6: break;	//SBC stt0 

						case 7: break;	//RSC stt0 
					}
					throw Error("encountered undefined instruction!");
				}
				break;

				case 1:
				break;

				case 2:
				break;

				case 3:
				break;

				//LDR / STR
				case 4:
				case 5:
				case 6:
				case 7:
				break;

				//LDM / STM
				case 8:
				case 9:
				break;

				//B / BL
				case 10:
				case 11:
				break;

				//LDC / STC
				case 12:
				case 13:
				break;

				//MRC / MCR	
				case 14:
				break;

				//SW INTERRUPT
				case 15:
				break;

			}
			//undefined instruction
			throw Error("encountered undefined instruction!");
		},
		execute : function (opcode) {
			switch (opcode)
			{
				case 0:
				blahblah();
				break;
			}
			return true;
		}
	}
}