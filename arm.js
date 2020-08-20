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

			switch (bitSlice(instr, 24, 27))
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
				}
				break;
				//3322 2222 2222 1111 1111 1100 0000 0000
				//1098 7654 3210 9876 5432 1098 7654 3210
				//xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx
				case 1:
				if (bitSlice(instr, 4, 4))
				{
					if (bitSlice(instr, 7, 7))
					{
						switch (bitSlice(instr, 21, 23))
						{
							case 0: break;	//TST 0tt1 check if S bit has been set to 1

							case 1: 
							if (bitSlice(instr, 20, 20)) //S bit differentiates TEQ from BRANCH AND EXCHANGE with this parsing
							{
								//TEQ
							}
							else
							{
								//BRANCH AND EXCHANGE check if a whole bunch of bits are set
							}
							break;	//TEQ 0tt1 check if S bit has been set to 1 

							case 2: break;	//CMP 0tt1 check if S bit has been set to 1

							case 3: break;	//CMN 0tt1 check if S bit has been set to 1

							case 4: break;	//ORR 0tt1 

							case 5: break;	//MOV 0tt1 check if some bits are set to zero

							case 6: break;	//BIC 0tt1 

							case 7: break;	//MVN 0tt1 check if some bits are set to zero
						}
					}
					else
					{
						switch (bitSlice(instr, 5, 6))
						{
							case 0:
							break;	//SWP check if a bunch of bits are zero

							case 1:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 0:
								break;	//STRH p=1 i=0 check if bits are zero 

								case 1:
								break;	//LDRH p=1 i=0 check if bits are zero

								case 2:
								break;	//STRH p=1 i=1

								case 3:
								break;	//LDRH p=1 i=1
							}
							break;

							case 2:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 1:
								break;	//LDRSB p=1 i=0	check if bits are zero

								case 3:
								break;	//LDRSB p=1 i=1
							}
							break;

							case 3:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 1:
								break;	//LDRSH p=1 i=0	check if bits are zero

								case 3:
								break;	//LDRSH p=1 i=1
							}
							break;
						}
					}
				}
				else
				{
					switch(bitSlice(instr, 20, 23))
					{
						case 0:
						case 4:
						break;	//MRS check if a whole bunch of bits are set
						
						case 2:
						case 6:
						break;	//MRS register check if a whole bunch of bits are set

						case 1:
						break;	//TST stt0

						case 3:
						break;	//TEQ stt0

						case 5:
						break;	//CMP stt0

						case 7:
						break;	//CMN stt0

						case 8:
						case 9:
						break;	//ORR stt0

						case 10:
						case 11:
						break;	//MOV stt0 check if some bits are set to zero

						case 12:
						case 13:
						break;	//BIC stt0

						case 14:
						case 15:
						break;	//MVN stt0 check if some bits are set to zero

					}
				}
				break;

				case 2:
				switch (bitSlice(instr, 21, 23))
				{
					case 0: break;	//AND imm
					case 1: break;	//EOR imm
					case 2: break;	//SUB imm 
					case 3: break;	//RSB imm 
					case 4: break;	//ADD imm 
					case 5: break;	//ADC imm 
					case 6: break;	//SBC imm 
					case 7: break;	//RSC imm 
				}
				break;

				case 3:
				switch (bitSlice(instr, 21, 23))
				{
					case 0: break;	//TST imm check if 20th bit zero
					case 1: break;	//TEQ imm or MSR imm (if 20th bit is 0)
					case 2: break;	//CMP imm check if 20th bit zero
					case 3: break;	//CMN imm or MSR imm (if 20th bit is 0)
					case 4: break;	//ORR imm 
					case 5: break;	//MOV imm check if some bits are set to zero
					case 6: break;	//BIC imm 
					case 7: break;	//MVN imm check if some bits are set to zero
				}
				break;

				//LDR / STR i=0
				case 4:
				case 5:
				break;

				//LDR / STR i=1 check if bit is zero
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

				//MRC / MCR	/ CDP
				case 14:
				//return 4th is zero ? CDP : MRC / MCR
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