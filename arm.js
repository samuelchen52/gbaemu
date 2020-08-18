const arm = function(memory, registers) {




	return 
	{
		decode : function (instr) {
			//3322 2222 2222 2222 2222 2100 0000 0000
			//1098 7654 3210 9876 5432 1098 7654 3210
			//xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx

			switch (bitSlice(instr, 24, 27)) //bits 25 to 27
			{
				case 0:
				
			}
			//undefined instruction
			return -1;
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