const arm = function(mmu, registers, changeState, changeMode, setNZCV) {




	return {
		decode : function (instr) {
			//3322 2222 2222 1111 1111 1100 0000 0000
			//1098 7654 3210 9876 5432 1098 7654 3210
			//xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx

			//stt0 -> use register after shifting with 5 bits
			//0tt1 -> use register after shifting with bottom byte of another register
			//mmmm mmmm -> use 8 bit imm after 4 bit imm shift

			switch (bitSlice(instr, 24, 27)) //MAIN SWITCH
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
								return 0;
							}
							else //MUL / MLA
							{ 
								return 1;
							}
							break;

							case 11:
							switch (bitSlice(instr, 20, 22))
							{
								case 0: return 2; break;	//STRH p=0 i=0, check if bits 8 - 11 are set to 0

								case 1: return 3; break;	//LDRH p=0 i=0, check if bits 8 - 11 are set to 0

								case 4: return 4; break;	//STRH p=0 i=1

								case 5: return 5; break;	//LDRH p=0 i=1
							}
							break;

							case 13: 
							switch (bitSlice(instr, 20, 22))
							{

								case 1: return 6; break;	//LDRSB p=0 i=0, check if bits 8 - 11 are set to 0

								case 5: return 7; break;	//LDRSB p=0 i=1
							}
							break;

							case 15:
							switch (bitSlice(instr, 20, 22))
							{

								case 1: return 8; break;	//LDRSH p=0 i=0, check if bits 8 - 11 are set to 0

								case 5: return 9; break;	//LDRSH p=0 i=1
							} 
							break;
						}
					}
					else
					{
						switch (bitSlice(instr, 21, 23))
						{
							case 0: return 10; break;	//AND 0tt1

							case 1: return 11; break;	//EOR 0tt1

							case 2: return 12; break;	//SUB 0tt1 

							case 3: return 13; break;	//RSB 0tt1 

							case 4: return 14; break;	//ADD 0tt1 

							case 5: return 15; break;	//ADC 0tt1 

							case 6: return 16; break;	//SBC 0tt1 

							case 7: return 17; break;	//RSC 0tt1 
						}
					}
				}
				else
				{
					switch (bitSlice(instr, 21, 23))
					{
						case 0: return 18; break;	//AND stt0

						case 1: return 19; break;	//EOR stt0

						case 2: return 20; break;	//SUB stt0 

						case 3: return 21; break;	//RSB stt0 

						case 4: return 22; break;	//ADD stt0 

						case 5: return 23; break;	//ADC stt0 

						case 6: return 24; break;	//SBC stt0 

						case 7: return 25; break;	//RSC stt0 
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
							case 0: return 26; break;	//TST 0tt1 check if S bit has been set to 1

							case 1: 
							if (bitSlice(instr, 20, 20)) //S bit differentiates TEQ from BRANCH AND EXCHANGE with this parsing
							{
								return 27; //TEQ 0tt1
							}
							else
							{
								return 28; //BRANCH AND EXCHANGE check if a whole bunch of bits are set
							}
							break;

							case 2: return 29; break;	//CMP 0tt1 check if S bit has been set to 1

							case 3: return 30; break;	//CMN 0tt1 check if S bit has been set to 1

							case 4: return 31; break;	//ORR 0tt1 

							case 5: return 32; break;	//MOV 0tt1 check if some bits are set to zero

							case 6: return 33; break;	//BIC 0tt1 

							case 7: return 34; break;	//MVN 0tt1 check if some bits are set to zero
						}
					}
					else
					{
						switch (bitSlice(instr, 5, 6))
						{
							case 0:
							return 35;
							break;	//SWP check if a bunch of bits are zero

							case 1:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 0:
								return 36;
								break;	//STRH p=1 i=0 check if bits are zero 

								case 1:
								return 37;
								break;	//LDRH p=1 i=0 check if bits are zero

								case 2:
								return 38;
								break;	//STRH p=1 i=1

								case 3:
								return 39;
								break;	//LDRH p=1 i=1
							}
							break;

							case 2:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 1:
								return 40;
								break;	//LDRSB p=1 i=0	check if bits are zero

								case 3:
								return 41;
								break;	//LDRSB p=1 i=1
							}
							break;

							case 3:
							switch ((bitSlice(instr, 20, 20) << 1) + bitSlice(instr, 23, 23))
							{
								case 1:
								return 42;
								break;	//LDRSH p=1 i=0	check if bits are zero

								case 3:
								return 43;
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
						return 44;
						break;	//MRS check if a whole bunch of bits are set
						
						case 2:
						case 6:
						return 45;
						break;	//MRS register check if a whole bunch of bits are set

						case 1:
						return 46;
						break;	//TST stt0

						case 3:
						return 47;
						break;	//TEQ stt0

						case 5:
						return 48;
						break;	//CMP stt0

						case 7:
						return 49;
						break;	//CMN stt0

						case 8:
						case 9:
						return 50;
						break;	//ORR stt0

						case 10:
						case 11:
						return 51;
						break;	//MOV stt0 check if some bits are set to zero

						case 12:
						case 13:
						return 52;
						break;	//BIC stt0

						case 14:
						case 15:
						return 53;
						break;	//MVN stt0 check if some bits are set to zero

					}
				}
				break;

				case 2:
				switch (bitSlice(instr, 21, 23))
				{
					case 0: return 54; break;	//AND imm
					case 1: return 55; break;	//EOR imm
					case 2: return 56; break;	//SUB imm 
					case 3: return 57; break;	//RSB imm 
					case 4: return 58; break;	//ADD imm 
					case 5: return 59; break;	//ADC imm 
					case 6: return 60; break;	//SBC imm 
					case 7: return 61; break;	//RSC imm 
				}
				break;

				case 3:
				switch (bitSlice(instr, 21, 23))
				{
					case 0: return 62; break;	//TST imm check if 20th bit zero
					case 1: return bitSlice(instr, 20, 20) === 0 ? 63 : 64; break;	//TEQ imm or MSR imm (if 20th bit is 0)
					case 2: return 65; break;	//CMP imm check if 20th bit zero
					case 3: return bitSlice(instr, 20, 20) === 0 ? 63 : 66; break;	//CMN imm or MSR imm (if 20th bit is 0)
					case 4: return 67; break;	//ORR imm 
					case 5: return 68; break;	//MOV imm check if some bits are set to zero
					case 6: return 69; break;	//BIC imm 
					case 7: return 70; break;	//MVN imm check if some bits are set to zero
				}
				break;

				//LDR / STR i=0
				case 4:
				case 5:
				return 71;
				break;

				//LDR / STR i=1 check if bit is zero
				case 6:
				case 7:
				return 72;
				break;

				//LDM / STM
				case 8:
				case 9:
				return 73;
				break;

				//B / BL
				case 10:
				case 11:
				return 74;
				break;

				//LDC / STC
				case 12:
				case 13:
				return 75;
				break;

				//MRC / MCR	/ CDP
				case 14:
				//return 4th is zero ? CDP : MRC / MCR
				return bitSlice(instr, 4, 4) === 0 ? 76 : 77;
				break;

				//SW INTERRUPT
				case 15:
				return 78;
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