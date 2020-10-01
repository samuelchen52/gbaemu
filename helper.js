const masks = new Array(33); //used for bitSlice
for (let i = 1; i <= 32; i ++)
{
	masks[i] = Math.pow(2, i) - 1;
}

const ARMopcodes = [
"MULL / MLAL",
"MUL / MLA",
"STRH p=0 i=0 check needed",
"LDRH p=0 i=0 check needed",
"STRH p=0 i=1",
"LDRH p=0 i=1",
"LDRSB p=0 i=0 check needed",
"LDRSB p=0 i=1",
"LDRSH p=0 i=0 check needed",
"LDRSH p=0 i=1",
"AND 0tt1",
"EOR 0tt1",
"SUB 0tt1",
"RSB 0tt1",
"ADD 0tt1",
"ADC 0tt1",
"SBC 0tt1",
"RSC 0tt1",
"AND stt0",
"EOR stt0",
"SUB stt0",
"RSB stt0",
"ADD stt0",
"ADC stt0",
"SBC stt0",
"RSC stt0",
"TST 0tt1 check needed",
"TEQ 0tt1",
"BRANCH AND EXCHANGE",
"CMP 0tt1 check needed",
"CMN 0tt1 check needed",
"ORR 0tt1",
"MOV 0tt1 check needed",
"BIC 0tt1",
"MVN 0tt1 check needed",
"SWP check needed",
"STRH p=1 i=0 check needed",
"LDRH p=1 i=0 check needed",
"STRH p=1 i=1",
"LDRH p=1 i=1",
"LDRSB p=1 i=0 check needed",
"LDRSB p=1 i=1",
"LDRSH p=1 i=0 check needed",
"LDRSH p=1 i=1",
"MRS check needed",
"MSR register check needed",
"TST stt0",
"TEQ stt0",
"CMP stt0",
"CMN stt0",
"ORR stt0",
"MOV stt0 check needed",
"BIC stt0",
"MVN stt0 check needed",
"AND imm",
"EOR imm",
"SUB imm",
"RSB imm",
"ADD imm",
"ADC imm",
"SBC imm",
"RSC imm",
"TST imm",
"MSR imm",
"TEQ imm",
"CMP imm",
"CMN imm",
"ORR imm",
"MOV imm check needed",
"BIC imm",
"MVN imm check needed",
"LDR / STR i=0",
"LDR / STR i=1 check needed",
"LDM / STM",
"B / BL",
"LDC / STC",
"CDP",
"MRC / MCR",
"SWP"
]

const THUMBopcodes = [
"LSL IMM5",
"LSR IMM5",
"ASR IMM5",
"ADD REGISTER",
"SUBTRACT REGISTER",
"ADD IMM3",
"SUB IMM3",
"MOV IMM8",
"CMP IMM8 ",
"ADD IMM8",
"SUB IMM8",
"AND",
"XOR",
"LSL",
"LSR",
"ASR",
"ADC",
"SBC",
"ROTATE RIGHT",
"TST",
"NEG",
"CMP",
"NEGCMP",
"OR",
"MUL",
"BIT CLEAR",
"NOT",
"ADD check needed",
"CMP check needed",
"MOV check needed",
"BX check needed",
"LDR IMM (PC)",
"STR REG OFFSET",
"STRH REG OFFSET",
"STRB REG OFFSET",
"LDSB REG OFFSET",
"LDR REG OFFSET",
"LDRH REG OFFSET",
"LDRB REG OFFSET",
"LDSH REG OFFSET",
"STR IMM OFFSET",
"LDR IMM OFFSET",
"STRB IMM OFFSET",
"LDRB IMM OFFSET",
"STRH IMM OFFSET",
"LDRH IMM OFFSET",
"STR IMM OFFSET (SP)",
"LDR IMM OFFSET (SP)",
"ADD RD PC IMM",
"ADD RD SP IMM",
"ADD SP IMM",
"ADD SP -IMM",
"PUSH",
"POP",
"STMIA",
"LDMIA",
"CONDITIONAL BRANCH",
"SWP",
"UNCONDITIONAL BRANCH",
"LONG BRANCH 1",
"LONG BRANCH 2"
]
var rgbstr = [ 'rgb(' , 0 , ',' , 0 , ',' , 0 , ')'];

//returns rgb string represented by 16bit num
//xbbbbbgggggrrrrr
function rgb(num)
{
	rgbstr[1] = (num & 31744) >>> 10;
	rgbstr[3] = (num & 992) >>> 5;
	rgbstr[5] = num & 31;

	return rgbstr.join('');
}

//gets the bytes of a 32 or 16 bit number
function getBytes (instr, state)
{
	let arr = new Uint8Array(4);
	if (!state) //ARM
	{
		arr[0] = (instr & 0xFF000000) >> 24;
		arr[1] = (instr & 0xFF0000) >> 16;
		arr[2] = (instr & 0xFF00) >> 8;
		arr[3] = (instr & 0xFF);
		return arr[0].toString(16) + " " + arr[1].toString(16) + " " + arr[2].toString(16) + " " + arr[3].toString(16);
	}
	else
	{
		arr[2] = (instr & 0xFF00) >> 8;
		arr[3] = (instr & 0xFF);
		return arr[2].toString(16) + " " + arr[3].toString(16);
	}
}

//returns bits from startBit to endBit from a 32 bit number
function bitSlice (num, startBit, endBit)
{
	if (arguments.length < 3)
	{
		throw Error("bitSlice takes at least two arguments");
	}
	if ((startBit < 0) || (endBit > 31))
	{
		throw Error("starting bit or ending bit out of range");
	}
	if (startBit > endBit)
	{
		throw Error("starting bit greater than ending bit");
	}

	return (num >> startBit) & (masks[endBit - startBit + 1]);
}

//rotates a 32 bit number right by 0 to 31 bits
function rotateRight(num, rotateBy)
{
	rotateBy %= 32;
	if (rotateBy !== 0)
	{
		let rightBits = bitSlice(num, 0, rotateBy - 1); //take the right bits that will be rotated to the left side
		return (rightBits << (32 - rotateBy)) + (num >>> rotateBy); //move right bits to the left, move the rest of the bits to the right, then add
	}
	else
	{
		return num;
	}
}
//4294967296
//shifts a 32 bit number (register) by shift amount
//possible t values (0=LSL, 1=LSR, 2=ASR, 3=ROR)
//returns the 32 bit result (32nd bit will be the last bit shifted out) and sets carry flag
function shiftReg (register, shiftamt, type)
{
	if (shiftamt === 0) //usually only LSL #0, but for register shifted by bottom byte of register, other ops with #0 are possible, behavior same?
	{
		carryFlag = undefined;
		return register;
	}

	//shiftamt nonzero
	let gt32 = shiftamt > 32;
	switch(type)
	{
		case 0: //LSL
		if (gt32)
		{
			carryFlag = 0;
			return 0;
		}
		else
		{ 
			carryFlag = bitSlice(register, 32 - shiftamt, 32 - shiftamt);
			return register << shiftamt;
		}
		break;

		case 1: //LSR
		if (gt32)
		{
			carryFlag = 0;
			return 0;
		}
		else
		{
			carryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return register >>> shiftamt;
		}
		break;

		case 2:
		if (gt32)
		{
			carryFlag = register >>> 31;
			return carryFlag ? 4294967295 : 0; //2 ^ 32 - 1 === 4294967295
		}
		else
		{
			carryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return (register >>> shiftamt) + ((register >> 31) ? (((1 << shiftamt) - 1) << (32 - shiftamt)) : 0);
		}
		break;

		case 3:
		shiftamt %= 32; //0 to 31
		if (!shiftamt) //if shiftamt is zero here, then it was a multiple of 32
		{
			carryFlag = register >>> shiftamt;
			return register;
		}
		else
		{
			carryFlag = bitSlice(register, shiftamt - 1, shiftamt - 1);
			return rotateRight(register, shiftamt);
		}
		break;

		default:
		throw Error("invalid shift type!");
	}
}


//assumes both instructions same length
function cmp(instr1, instr2)
{
	for (let i = 0; i < 39; i ++)
	{
		let char1 = instr1[i];
		let char2 = instr2[i];
		if (char1 !== char2)
		{
			if ((char1 !== "1") && (char1 !== "0"))
			{
				continue;
			}
			else if ((char2 !== "1") && (char2 !== "0"))
			{
				continue;
			}
			return false;
		}
	}
	return true;
}
//returns an array of arrays of strings
//used to check if any instructions match each other (we dont want that to happen otherwise we cant parse, obviously)
//looks like we documented all the instructions correctly, there are no matches (all arrays have only one string)
function instructionVal(instructionArr)
{
	let arr = [];
	for (let i = 0; i < instructionArr.length; i ++)
	{
		let matches = [instructionArr[i]];
		for (let p = i + 1; p < instructionArr.length; p ++)
		{

			if (cmp(matches[0], instructionArr[p]))
			{
				matches.push(instructionArr[p]);
			}
		}
		arr.push(matches);
	}
	return arr;
}

//sorts in ascending order according to sortby function
//sortby function returns 1 if argument 2 is greater than or equal to argument 1
function quicksort (arr, start, end, sortby)
{
	if (start < end)
	{
		//pick a index, swap with pivot
		var randomIndex = Math.floor((Math.random() * (end - start - 1)) + start);
		var temp = arr[randomIndex];
		arr[randomIndex] = arr[end];
		arr[end] = temp;

		var partition = arr[end];
		var low = start - 1;
		var pointer = start;

		//put everything higher than partition on the left
		while (pointer < end)
		{
			if (sortby(arr[pointer], partition))
			{
				low ++;
				temp = arr[low];
				arr[low] = arr[pointer];
				arr[pointer] = temp;
			}
			pointer ++;
		}

		//swap partition 
		var temp = arr[low + 1];
		arr[low + 1] = arr[end];
		arr[end] = temp;

		quicksort(arr, start, low, sortby);
		quicksort(arr, low + 2, end, sortby);

	}
};

var strData = "";
var strFileName = "output.txt";

const log = function (registers)
{
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
	return {
		logRegs : function (mode)
		{
			strData += registers[0][0].toString(16).padStart(8, '0') + " "
			+ registers[1][0].toString(16).padStart(8, '0') + " "
			+ registers[2][0].toString(16).padStart(8, '0') + " "
			+ registers[3][0].toString(16).padStart(8, '0') + " "
			+ registers[4][0].toString(16).padStart(8, '0') + " "
			+ registers[5][0].toString(16).padStart(8, '0') + " "
			+ registers[6][0].toString(16).padStart(8, '0') + " "
			+ registers[7][0].toString(16).padStart(8, '0') + " "

			+ registers[8][0].toString(16).padStart(8, '0') + " "
			+ registers[9][0].toString(16).padStart(8, '0') + " "
			+ registers[10][0].toString(16).padStart(8, '0') + " "
			+ registers[11][0].toString(16).padStart(8, '0') + " "
			+ registers[12][0].toString(16).padStart(8, '0') + " "

			+ registers[13][registerIndices[mode][13]].toString(16).padStart(8, '0') + " "
			+ registers[14][registerIndices[mode][14]].toString(16).padStart(8, '0') + " "

			//+ (registers[15][0] - 4).toString(16).padStart(8, '0') + " "

			+ "cpsr: " + registers[16][0].toString(16).padStart(8, '0') + "\n";
		}
	}
}

//00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 03007F00 00000000 08000004 cpsr: 0000001F | EA00002E: b $080000BC
//0 - 133
//144 - 172
//https://stackoverflow.com/questions/21012580/is-it-possible-to-write-data-to-file-using-only-javascript
function download(strData, strFileName, strMimeType) {
    var D = document,
        A = arguments,
        a = D.createElement("a"),
        d = A[0],
        n = A[1],
        t = A[2] || "text/plain";

    //build download link:
    a.href = "data:" + strMimeType + "charset=utf-8," + escape(strData);


    if (window.MSBlobBuilder) { // IE10
        var bb = new MSBlobBuilder();
        bb.append(strData);
        return navigator.msSaveBlob(bb, strFileName);
    } /* end if(window.MSBlobBuilder) */



    if ('download' in a) { //FF20, CH19
        a.setAttribute("download", n);
        a.innerHTML = "downloading...";
        D.body.appendChild(a);
        setTimeout(function() {
            var e = D.createEvent("MouseEvents");
            e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
            D.body.removeChild(a);
        }, 66);
        return true;
    }; /* end if('download' in a) */



    //do iframe dataURL download: (older W3)
    var f = D.createElement("iframe");
    D.body.appendChild(f);
    f.src = "data:" + (A[2] ? A[2] : "application/octet-stream") + (window.btoa ? ";base64" : "") + "," + (window.btoa ? window.btoa : escape)(strData);
    setTimeout(function() {
        D.body.removeChild(f);
    }, 333);
    return true;
}

let sigs = instructionVal([
	// 'cccc 0000 110S nnnn dddd ssss stt0 mmmm |SBC subtract with carry',
	// 'cccc 0000 010S nnnn dddd ssss stt0 mmmm |SUB subtract',
	// 'cccc 0000 011S nnnn dddd ssss stt0 mmmm |RSB reverse subtract',
	// 'cccc 0000 001S nnnn dddd ssss stt0 mmmm |EOR exclusive or',
	// 'cccc 0000 111S nnnn dddd ssss stt0 mmmm |RSC reverse subtract with carry',
	// 'cccc 0000 101S nnnn dddd ssss stt0 mmmm |ADC add with carry',
	// 'cccc 0000 000S nnnn dddd ssss stt0 mmmm |AND and',
	// 'cccc 0000 100S nnnn dddd ssss stt0 mmmm |ADD addition',
	// 'cccc 0000 010S nnnn dddd ssss 0tt1 mmmm |SUB subtract',
	// 'cccc 0000 011S nnnn dddd ssss 0tt1 mmmm |RSB reverse subtract',
	// 'cccc 0000 111S nnnn dddd ssss 0tt1 mmmm |RSC reverse subtract with carry',
	// 'cccc 0000 000S nnnn dddd ssss 0tt1 mmmm |AND and',
	// 'cccc 0000 001S nnnn dddd ssss 0tt1 mmmm |EOR exclusive or',
	// 'cccc 0000 110S nnnn dddd ssss 0tt1 mmmm |SBC subtract with carry',
	// 'cccc 0000 100S nnnn dddd ssss 0tt1 mmmm |ADD addition',
	// 'cccc 0000 101S nnnn dddd ssss 0tt1 mmmm |ADC add with carry',
	// 'cccc 0000 1uas hhhh llll ssss 1001 mmmm |MULTIPLY LONG AND MULTIPLY-ACCUMULATE LONG',
	// 'cccc 0000 00as dddd nnnn ssss 1001 mmmm |MULTIPLY AND MULTIPLY-ACCUMULATE',
	// 'cccc 0000 u000 nnnn dddd 0000 1011 mmmm |p=0 i=0 STRH',
	// 'cccc 0000 u101 nnnn dddd mmmm 1011 mmmm |p=0 i=1 LDRH',
	// 'cccc 0000 u100 nnnn dddd mmmm 1011 mmmm |p=0 i=1 STRH',
	// 'cccc 0000 u001 nnnn dddd 0000 1011 mmmm |p=0 i=0 LDRH',
	// 'cccc 0000 u001 nnnn dddd 0000 1101 mmmm |p=0 i=0 LDRSB',
	// 'cccc 0000 u101 nnnn dddd mmmm 1101 mmmm |p=0 i=1 LDRSB',
	// 'cccc 0000 u001 nnnn dddd 0000 1111 mmmm |p=0 i=0 LDRSH',
	// 'cccc 0000 u101 nnnn dddd mmmm 1111 mmmm |p=0 i=1 LDRSH',

	//'cccc 0001 0p00 1111 dddd 0000 0000 0000 |MRS',
	//'cccc 0001 0p10 fsxc 1111 0000 0000 mmmm |MSR register',
	// 'cccc 0001 101S 0000 dddd ssss stt0 mmmm |MOV move register or constant',
	// 'cccc 0001 0011 nnnn dddd ssss stt0 mmmm |TEQ test bitwise equality (dddd is either all 0s or 1s)',
	// 'cccc 0001 110S nnnn dddd ssss stt0 mmmm |BIC bit clear',
	// 'cccc 0001 111S 0000 dddd ssss stt0 mmmm |MVN move negative register',
	// 'cccc 0001 0001 nnnn dddd ssss stt0 mmmm |TST test bits (dddd is either all 0s or 1s)',
	// 'cccc 0001 100S nnnn dddd ssss stt0 mmmm |ORR or',
	// 'cccc 0001 0111 nnnn dddd ssss stt0 mmmm |CMN compare negative (dddd is either all 0s or 1s)',
	// 'cccc 0001 0101 nnnn dddd ssss stt0 mmmm |CMP compare (dddd is either all 0s or 1s)',
	// 'cccc 0001 110S nnnn dddd ssss 0tt1 mmmm |BIC bit clear',
	// 'cccc 0001 101S 0000 dddd ssss 0tt1 mmmm |MOV move register or constant',
	// 'cccc 0001 100S nnnn dddd ssss 0tt1 mmmm |ORR or',
	// 'cccc 0001 0101 nnnn dddd ssss 0tt1 mmmm |CMP compare (dddd is either all 0s or 1s)',
	// 'cccc 0001 0001 nnnn dddd ssss 0tt1 mmmm |TST test bits (dddd is either all 0s or 1s)',
	// 'cccc 0001 0011 nnnn dddd ssss 0tt1 mmmm |TEQ test bitwise equality (dddd is either all 0s or 1s)',
	// 'cccc 0001 0111 nnnn dddd ssss 0tt1 mmmm |CMN compare negative (dddd is either all 0s or 1s)',
	// 'cccc 0001 111S 0000 dddd ssss 0tt1 mmmm |MVN move negative register',
	// 'cccc 0001 0010 1111 1111 1111 0001 nnnn |BRANCH AND EXCHANGE',
	// 'cccc 0001 0b00 nnnn dddd 0000 1001 mmmm |SWP',
	// 'cccc 0001 u0w1 nnnn dddd 0000 1011 mmmm |p=1 i=0 LDRH',
	// 'cccc 0001 u1w0 nnnn dddd mmmm 1011 mmmm |p=1 i=1 STRH',
	// 'cccc 0001 u0w0 nnnn dddd 0000 1011 mmmm |p=1 i=0 STRH',
	// 'cccc 0001 u1w1 nnnn dddd mmmm 1011 mmmm |p=1 i=1 LDRH',
	// 'cccc 0001 u0w1 nnnn dddd 0000 1101 mmmm |p=1 i=0 LDRSB',
	// 'cccc 0001 u1w1 nnnn dddd mmmm 1101 mmmm |p=1 i=1 LDRSB',
	// 'cccc 0001 u0w1 nnnn dddd 0000 1111 mmmm |p=1 i=0 LDRSH',
	// 'cccc 0001 u1w1 nnnn dddd mmmm 1111 mmmm |p=1 i=1 LDRSH',

	// 'cccc 0010 011S nnnn dddd ssss mmmm mmmm |RSB reverse subtract',
	// 'cccc 0010 010S nnnn dddd ssss mmmm mmmm |SUB subtract',
	// 'cccc 0010 100S nnnn dddd ssss mmmm mmmm |ADD addition',
	// 'cccc 0010 110S nnnn dddd ssss mmmm mmmm |SBC subtract with carry',
	// 'cccc 0010 111S nnnn dddd ssss mmmm mmmm |RSC reverse subtract with carry',
	// 'cccc 0010 000S nnnn dddd ssss mmmm mmmm |AND and',
	// 'cccc 0010 001S nnnn dddd ssss mmmm mmmm |EOR exclusive or',
	// 'cccc 0010 101S nnnn dddd ssss mmmm mmmm |ADC add with carry',

	// 'cccc 010p ubwl nnnn dddd oooo oooo oooo |LDR / STR i = 0',
	// 'cccc 011p ubwl nnnn dddd ssss stt0 mmmm |LDR / STR i = 1',

	// 'cccc 0011 110S nnnn dddd ssss mmmm mmmm |BIC bit clear',
	// 'cccc 0011 111S 0000 dddd ssss mmmm mmmm |MVN move negative register',
	// 'cccc 0011 0011 nnnn dddd ssss mmmm mmmm |TEQ test bitwise equality (dddd is either all 0s or 1s)',
	// 'cccc 0011 100S nnnn dddd ssss mmmm mmmm |ORR or',
	// 'cccc 0011 0p10 fsxc 1111 ssss mmmm mmmm |MSR imm',
	// 'cccc 0011 101S 0000 dddd ssss mmmm mmmm |MOV move register or constant',
	// 'cccc 0011 0101 nnnn dddd ssss mmmm mmmm |CMP compare (dddd is either all 0s or 1s)',
	// 'cccc 0011 0111 nnnn dddd ssss mmmm mmmm |CMN compare negative (dddd is either all 0s or 1s)',
	// 'cccc 0011 0001 nnnn dddd ssss mmmm mmmm |TST test bits (dddd is either all 0s or 1s)',

	// 'cccc 100p uswl nnnn rrrr rrrr rrrr rrrr |LDM, STM',
	// 'cccc 101L oooo oooo oooo oooo oooo oooo |BRANCH / BRANCH AND LINK',
	// 'cccc 110p unwo nnnn dddd pppp mmmm mmmm |LDC / STC',
	// 'cccc 1110 oooo nnnn dddd pppp iii0 mmmm |CDP',
	// 'cccc 1110 oooa nnnn dddd pppp iii1 mmmm |MRC / MCR',
	// 'cccc 1111 xxxx xxxx xxxx xxxx xxxx xxxx |SOFTWARE INTERRUPT',

	//THUMB INSTRUCTIONS!!!!!!!!!!!!!!!
	///////////////////////////////////

	// '0000 0fff ffss sddd - LSL IMM5',
	// '0000 1fff ffss sddd - LSR IMM5',
	// '0001 0fff ffss sddd - ASR IMM5',

	// '0001 100n nnss sddd - ADD REGISTER',
	// '0001 101n nnss sddd - SUBTRACT REGISTER',
	// '0001 110n nnss sddd - ADD IMM3',
	// '0001 111n nnss sddd - SUB IMM3',

	// '0010 0ddd nnnn nnnn - MOV IMM8',
	// '0010 1ddd nnnn nnnn - CMP IMM8',
	// '0011 0ddd nnnn nnnn - ADD IMM8',
	// '0011 1ddd nnnn nnnn - SUB IMM8',

	// '0100 0000 00ss sddd - AND',
	// '0100 0000 01ss sddd - XOR',
	// '0100 0000 10ss sddd - LSL',
	// '0100 0000 11ss sddd - LSR',
	// '0100 0001 00ss sddd - ASR',
	// '0100 0001 01ss sddd - ADC',
	// '0100 0001 10ss sddd - SBC',
	// '0100 0001 11ss sddd - ROTATE RIGHT',
	// '0100 0010 00ss sddd - TST',
	// '0100 0010 01ss sddd - NEG',
	// '0100 0010 10ss sddd - CMP',
	// '0100 0010 11ss sddd - NEGCMP',
	// '0100 0011 00ss sddd - OR',
	// '0100 0011 01ss sddd - MUL',
	// '0100 0011 10ss sddd - BIT CLEAR',
	// '0100 0011 11ss sddd - NOT',

	// '0100 0100 10ss sddd - ADD using rd as hi register',
	// '0100 0100 01ss sddd - ADD using rs as hi register',
	// '0100 0100 11ss sddd - ADD both registers are hi',
	// '0100 0101 10ss sddd - CMP using rd as hi register',
	// '0100 0101 01ss sddd - CMP using rs as hi register',
	// '0100 0101 11ss sddd - CMP both registers are hi',
	// '0100 0110 10ss sddd - MOV using rd as hi register',
	// '0100 0110 01ss sddd - MOV using rs as hi register',
	// '0100 0110 11ss sddd - MOV both registers are hi',
	// '0100 0111 0sss s000 - BX only uses rs',

	// '0100 1ddd nnnn nnnn - LDR IMM (PC)',

	// '0101 000s ssbb bddd - STR REG OFFSET',
	// '0101 010s ssbb bddd - STRB REG OFFSET',
	// '0101 100s ssbb bddd - LDR REG OFFSET',
	// '0101 110s ssbb bddd - LDRB REG OFFSET',

	// '0101 001s ssbb bddd - STRH REG OFFSET',
	// '0101 011s ssbb bddd - LDSB REG OFFSET',
	// '0101 101s ssbb bddd - LDRH REG OFFSET',
	// '0101 111s ssbb bddd - LDSH REG OFFSET',

	// '0110 0sss ssbb bddd - STR IMM OFFSET',
	// '0110 1sss ssbb bddd - LDR IMM OFFSET ',
	// '0111 0sss ssbb bddd - STRB IMM OFFSET',
	// '0111 1sss ssbb bddd - LDRB IMM OFFSET',

	// '1000 0sss ssbb bddd - STRH IMM OFFSET',
	// '1000 1sss ssbb bddd - LDRH IMM OFFSET',

	// '1001 0ddd nnnn nnnn - STR IMM OFFSET(SP)',
	// '1001 1ddd nnnn nnnn - LDR IMM OFFSET(SP)',

	// '1010 0ddd nnnn nnnn - ADD RD PC IMM',
	// '1010 1ddd nnnn nnnn - ADD RD SP IMM',

	// '1011 0000 0nnn nnnn - ADD SP IMM',
	// '1011 0000 1nnn nnnn - ADD SP -IMM',

	// '1011 010p rrrr rrrr - PUSH',
	// '1011 110p rrrr rrrr - POP',

	// '1100 0bbb rrrr rrrr - STMIA',
	// '1100 1bbb rrrr rrrr - LDMIA',

	// '1101 oooo ssss ssss - CONDITIONAL BRANCH',
	// '1101 1111 nnnn nnnn - SW INTR',

	// '1110 0sss ssss ssss - UNCONDITIONAL BRANCH',

	// '1111 0nnn nnnn nnnn - LONG BRANCH 1',
	// '1111 1nnn nnnn nnnn - LONG BRANCH 2',
	
	]);

