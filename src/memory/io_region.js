const IORegisterMasks = {
	//REG_SOUNDCNT_SWEEP
	REG_SOUNDCNT_SWEEP_SHIFT: convertStringToBitMask("111"),
	REG_SOUNDCNT_SWEEP_INCREASE: convertStringToBitMask("1000"),
	REG_SOUNDCNT_SWEEP_SWEEP_TIME: convertStringToBitMask("1110000"),
	//REG_SOUNDCNT_LEN
	REG_SOUNDCNT_LEN_LENGTH: convertStringToBitMask("111111"),
	REG_SOUNDCNT_LEN_WAVE_DUTY: convertStringToBitMask("11000000"),
	REG_SOUNDCNT_LEN_ENV_STEP_TIME: convertStringToBitMask("11100000000"),
	REG_SOUNDCNT_LEN_ENV_MODE: convertStringToBitMask("100000000000"),
	REG_SOUNDCNT_LEN_ENV_INIT: convertStringToBitMask("1111000000000000"),
	//REG_SOUNDCNT_FREQ
	REG_SOUNDCNT_FREQ_SOUND_FREQ: convertStringToBitMask("11111111111"),
	REG_SOUNDCNT_FREQ_TIMED_MODE: convertStringToBitMask("100000000000000"),
	REG_SOUNDCNT_FREQ_SOUND_RESET: convertStringToBitMask("1000000000000000"),
	//REG_MASTER_SOUNDCNT
	
	//REG_MASTER_SOUNDSTAT
	REG_MASTER_SOUNDSTAT_1: convertStringToBitMask("1"),
	REG_MASTER_SOUNDSTAT_2: convertStringToBitMask("10"),
	REG_MASTER_SOUNDSTAT_3: convertStringToBitMask("100"),
	REG_MASTER_SOUNDSTAT_4: convertStringToBitMask("1000"),
	REG_MASTER_SOUNDSTAT_ENABLE: convertStringToBitMask("10000000"),

	//REG_SOUND3CNT_L
	REG_SOUND3CNT_L_BANK_MODE: convertStringToBitMask("100000"),
	REG_SOUND3CNT_L_BANK_SELECT: convertStringToBitMask("1000000"),
	REG_SOUND3CNT_L_ENABLE: convertStringToBitMask("10000000"),

	//REG_SOUND3CNT_H
	REG_SOUND3CNT_H_LENGTH: convertStringToBitMask("11111111"),
	REG_SOUND3CNT_H_VOLUME_RATIO: convertStringToBitMask("1110000000000000"),

	//REG_SOUND3CNT_X
	REG_SOUND3CNT_X_FREQ: convertStringToBitMask("11111111111"),
	REG_SOUND3CNT_X_TIMED_MODE: convertStringToBitMask("100000000000000"),
	REG_SOUND3CNT_X_SOUND_RESET: convertStringToBitMask("1000000000000000"),

	//REG_SOUNDCNT_L (DMG sound control)
	REG_SOUNDCNT_L_LEFT_VOLUME: convertStringToBitMask("111"),
	REG_SOUNDCNT_L_RIGHT_VOLUME: convertStringToBitMask("1110000"),
	REG_SOUNDCNT_L_SOUND1_LEFT: convertStringToBitMask("100000000"),
	REG_SOUNDCNT_L_SOUND2_LEFT: convertStringToBitMask("1000000000"),
	REG_SOUNDCNT_L_SOUND3_LEFT: convertStringToBitMask("10000000000"),
	REG_SOUNDCNT_L_SOUND4_LEFT: convertStringToBitMask("100000000000"),
	REG_SOUNDCNT_L_SOUND1_RIGHT: convertStringToBitMask("1000000000000"),
	REG_SOUNDCNT_L_SOUND2_RIGHT: convertStringToBitMask("10000000000000"),
	REG_SOUNDCNT_L_SOUND3_RIGHT: convertStringToBitMask("100000000000000"),
	REG_SOUNDCNT_L_SOUND4_RIGHT: convertStringToBitMask("1000000000000000"),

	//REG_SOUNDCNT_H (Direct sound control)
	REG_SOUNDCNT_H_DMG_SOUND_RATIO: convertStringToBitMask("11"),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_RATIO: convertStringToBitMask("100"),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_RATIO: convertStringToBitMask("1000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_RIGHT: convertStringToBitMask("100000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_LEFT: convertStringToBitMask("1000000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_TIMER: convertStringToBitMask("10000000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_RESET: convertStringToBitMask("100000000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_RIGHT: convertStringToBitMask("1000000000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_LEFT: convertStringToBitMask("10000000000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_TIMER: convertStringToBitMask("100000000000000"),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_RESET: convertStringToBitMask("1000000000000000"),

	//REG_SOUND4CNT_L
	REG_SOUND4CNT_L_LENGTH: convertStringToBitMask("111111"),
	REG_SOUND4CNT_L_ENV_STEP_TIME: convertStringToBitMask("11100000000"),
	REG_SOUND4CNT_L_ENV_MODE: convertStringToBitMask("100000000000"),
	REG_SOUND4CNT_L_ENV_INIT: convertStringToBitMask("1111000000000000"),

	//REG_SOUND4CNT_H
	REG_SOUND4CNT_H_CLOCK_DIVISOR: convertStringToBitMask("111"),
	REG_SOUND4CNT_H_MODE: convertStringToBitMask("1000"),
	REG_SOUND4CNT_H_PRE_SCALER: convertStringToBitMask("11110000"),
	REG_SOUND4CNT_H_TIMED_MODE: convertStringToBitMask("100000000000000"),
	REG_SOUND4CNT_H_RESET: convertStringToBitMask("1000000000000000"),
};

const IORegisterMaskShifts = {
	//REG_SOUNDCNT_SWEEP
	REG_SOUNDCNT_SWEEP_SHIFT: numChars("111", '0'),
	REG_SOUNDCNT_SWEEP_INCREASE: numChars("1000", '0'),
	REG_SOUNDCNT_SWEEP_SWEEP_TIME: numChars("1110000", '0'),
	//REG_SOUNDCNT_LEN
	REG_SOUNDCNT_LEN_LENGTH: numChars("111111", '0'),
	REG_SOUNDCNT_LEN_WAVE_DUTY: numChars("11000000", '0'),
	REG_SOUNDCNT_LEN_ENV_STEP_TIME: numChars("11100000000", '0'),
	REG_SOUNDCNT_LEN_ENV_MODE: numChars("100000000000", '0'),
	REG_SOUNDCNT_LEN_ENV_INIT: numChars("1111000000000000", '0'),
	//REG_SOUNDCNT_FREQ
	REG_SOUNDCNT_FREQ_SOUND_FREQ: numChars("11111111111", '0'),
	REG_SOUNDCNT_FREQ_TIMED_MODE: numChars("100000000000000", '0'),
	REG_SOUNDCNT_FREQ_SOUND_RESET: numChars("1000000000000000", '0'),
	//REG_MASTER_SOUNDSTAT
	REG_MASTER_SOUNDSTAT_1: numChars("1", '0'),
	REG_MASTER_SOUNDSTAT_2: numChars("10", '0'),
	REG_MASTER_SOUNDSTAT_3: numChars("100", '0'),
	REG_MASTER_SOUNDSTAT_4: numChars("1000", '0'),
	REG_MASTER_SOUNDSTAT_ENABLE: numChars("10000000", '0'),
	//REG_SOUND3CNT_L
	REG_SOUND3CNT_L_BANK_MODE: numChars("100000", '0'),
	REG_SOUND3CNT_L_BANK_SELECT: numChars("1000000", '0'),
	REG_SOUND3CNT_L_ENABLE: numChars("10000000", '0'),
	//REG_SOUND3CNT_H
	REG_SOUND3CNT_H_LENGTH: numChars("11111111", '0'),
	REG_SOUND3CNT_H_VOLUME_RATIO: numChars("1110000000000000", '0'),
	//REG_SOUND3CNT_X
	REG_SOUND3CNT_X_FREQ: numChars("11111111111", '0'),
	REG_SOUND3CNT_X_TIMED_MODE: numChars("100000000000000", '0'),
	REG_SOUND3CNT_X_SOUND_RESET: numChars("1000000000000000", '0'),
	//REG_SOUNDCNT_L (DMG sound control)
	REG_SOUNDCNT_L_LEFT_VOLUME: numChars("111", '0'),
	REG_SOUNDCNT_L_RIGHT_VOLUME: numChars("1110000", '0'),
	REG_SOUNDCNT_L_SOUND1_LEFT: numChars("100000000", '0'),
	REG_SOUNDCNT_L_SOUND2_LEFT: numChars("1000000000", '0'),
	REG_SOUNDCNT_L_SOUND3_LEFT: numChars("10000000000", '0'),
	REG_SOUNDCNT_L_SOUND4_LEFT: numChars("100000000000", '0'),
	REG_SOUNDCNT_L_SOUND1_RIGHT: numChars("1000000000000", '0'),
	REG_SOUNDCNT_L_SOUND2_RIGHT: numChars("10000000000000", '0'),
	REG_SOUNDCNT_L_SOUND3_RIGHT: numChars("100000000000000", '0'),
	REG_SOUNDCNT_L_SOUND4_RIGHT: numChars("1000000000000000", '0'),
	//REG_SOUNDCNT_H (Direct sound control)
	REG_SOUNDCNT_H_DMG_SOUND_RATIO: numChars("11", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_RATIO: numChars("100", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_RATIO: numChars("1000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_RIGHT: numChars("100000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_LEFT: numChars("1000000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_TIMER: numChars("10000000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_A_RESET: numChars("100000000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_RIGHT: numChars("1000000000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_LEFT: numChars("10000000000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_TIMER: numChars("100000000000000", '0'),
	REG_SOUNDCNT_H_DIRECT_SOUND_B_RESET: numChars("1000000000000000", '0'),
	//REG_SOUND4CNT_L
	REG_SOUND4CNT_L_LENGTH: numChars("111111", '0'),
	REG_SOUND4CNT_L_ENV_STEP_TIME: numChars("11100000000", '0'),
	REG_SOUND4CNT_L_ENV_MODE: numChars("100000000000", '0'),
	REG_SOUND4CNT_L_ENV_INIT: numChars("1111000000000000", '0'),
	//REG_SOUND4CNT_H
	REG_SOUND4CNT_H_CLOCK_DIVISOR: numChars("111", '0'),
	REG_SOUND4CNT_H_MODE: numChars("1000", '0'),
	REG_SOUND4CNT_H_PRE_SCALER: numChars("11110000", '0'),
	REG_SOUND4CNT_H_TIMED_MODE: numChars("100000000000000", '0'),
	REG_SOUND4CNT_H_RESET: numChars("1000000000000000", '0'),
};

const ioRegion = function() {

	let ioregENUMS = { 
		IOREG : 0, 
		IOREGREADONLY : 1, 
		IOREGWRITEONLY : 2, 
		IOREGBYTE : 3, 
		IOREGBYTEWRITEONLY : 4, 
		IOREGWORD : 5, 
		IOREGWORDWRITEONLY : 6, 
		IOREGIF : 7, 
		IOREGDISPSTAT : 8, 
		IOREGTMCNTL : 9, 
		UNUSED : 10,
		IOREGBYTEREADWRITE: 11,
		IOREGREADWRITE: 12,
		IOREGWORDREADWRITE: 13,
	};


	this.memory = new Uint8Array(1024);
	this.memory16 = new Uint16Array(this.memory.buffer);
	this.memory32 = new Uint32Array(this.memory.buffer);
	this.ioRegs = [];
	let ioregInitArr = [
	//LCD IO REGISTERS
	{name: "DISPCNT", type: ioregENUMS["IOREG"]},
	{name: "GREENSWAP", type: ioregENUMS["IOREG"]},
	{name: "DISPSTAT", type: ioregENUMS["IOREGDISPSTAT"]},
	{name: "VCOUNT", type: ioregENUMS["IOREGREADONLY"]},
	{name: "BG0CNT", type: ioregENUMS["IOREG"]},
	{name: "BG1CNT", type: ioregENUMS["IOREG"]},
	{name: "BG2CNT", type: ioregENUMS["IOREG"]},
	{name: "BG3CNT", type: ioregENUMS["IOREG"]},
	{name: "BG0HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG0VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG1HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG1VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3HOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3VOFS", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PA", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PB", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PC", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2PD", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG2X", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "BG2Y", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "BG3PA", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3PB", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3PC", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3PD", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "BG3X", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "BG3Y", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "WIN0H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WIN1H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WIN0V", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WIN1V", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "WININ0", type: ioregENUMS["IOREGBYTE"]},
	{name: "WININ1", type: ioregENUMS["IOREGBYTE"]},
	{name: "WINOUT", type: ioregENUMS["IOREGBYTE"]},
	{name: "WINOBJ", type: ioregENUMS["IOREGBYTE"]},
	{name: "MOSAIC", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "BLDCNT", type: ioregENUMS["IOREG"]},
	{name: "BLDALPHA", type: ioregENUMS["IOREG"]},
	{name: "BLDY", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(4)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//SOUND IO REGISTERS
	{name: "SOUND1CNT_L", type: ioregENUMS["IOREG"]}, //RW
	{name: "SOUND1CNT_H", type: ioregENUMS["IOREG"]}, //RW
	{name: "SOUND1CNT_X", type: ioregENUMS["IOREG"]}, //RW
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND2CNT_L", type: ioregENUMS["IOREG"]}, //RW
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND2CNT_H", type: ioregENUMS["IOREG"]}, //RW
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND3CNT_L", type: ioregENUMS["IOREG"]}, //RW
	{name: "SOUND3CNT_H", type: ioregENUMS["IOREG"]}, //RW
	{name: "SOUND3CNT_X", type: ioregENUMS["IOREG"]}, //RW
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND4CNT_L", type: ioregENUMS["IOREG"]}, //RW
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUND4CNT_H", type: ioregENUMS["IOREG"]}, //RW
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUNDCNT_L", type: ioregENUMS["IOREG"]}, //RW
	{name: "SOUNDCNT_H", type: ioregENUMS["IOREG"]}, //RW
	{name: "SOUNDCNT_X", type: ioregENUMS["IOREGREADWRITE"], readBits: "0000000000001111"},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "SOUNDBIAS", type: ioregENUMS["IOREGREADONLY"]}, // type is actually BIOS, implement later
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "REG_WAVE_RAM0_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM0_H", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM1_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM1_H", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM2_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM2_H", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM3_L", type: ioregENUMS["IOREG"]},
	{name: "REG_WAVE_RAM3_H", type: ioregENUMS["IOREG"]},
	{name: "REG_FIFO_A", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "REG_FIFO_B", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	// {name: "REG_FIFO_A_L", type: ioregENUMS["IOREGWRITEONLY"]},
	// {name: "REG_FIFO_A_H", type: ioregENUMS["IOREGWRITEONLY"]},
	// {name: "REG_FIFO_B_L", type: ioregENUMS["IOREGWRITEONLY"]},
	// {name: "REG_FIFO_B_H", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(3)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//DMA IO REGISTERS
	{name: "DMA0SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA0DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA0CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA0CNTH", type: ioregENUMS["IOREG"]},
	{name: "DMA1SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA1DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA1CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA1CNTH", type: ioregENUMS["IOREG"]},
	{name: "DMA2SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA2DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA2CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA2CNTH", type: ioregENUMS["IOREG"]},
	{name: "DMA3SAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA3DAD", type: ioregENUMS["IOREGWORDWRITEONLY"]},
	{name: "DMA3CNTL", type: ioregENUMS["IOREGWRITEONLY"]},
	{name: "DMA3CNTH", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(15)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//TIMER IO REGISTERS
	{name: "TM0CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM0CNTH", type: ioregENUMS["IOREG"]},
	{name: "TM1CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM1CNTH", type: ioregENUMS["IOREG"]},
	{name: "TM2CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM2CNTH", type: ioregENUMS["IOREG"]},
	{name: "TM3CNTL", type: ioregENUMS["IOREGTMCNTL"]},
	{name: "TM3CNTH", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(7)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//SERIAL COMMUNICATION (1) IO REGISTERS
	{name: "SIOMULTI0", type: ioregENUMS["IOREG"]},
	{name: "SIOMULTI1", type: ioregENUMS["IOREG"]},
	{name: "SIOMULTI2", type: ioregENUMS["IOREG"]},
	{name: "SIOMULTI3", type: ioregENUMS["IOREG"]},
	{name: "SIOCNT", type: ioregENUMS["IOREG"]},
	{name: "SIODATA8", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(1)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//KEYPAD INPUT IO REGISTERS
	{name: "KEYINPUT", type: ioregENUMS["IOREGREADONLY"]},
	{name: "KEYCNT", type: ioregENUMS["IOREG"]},
	//SERIAL COMMUNICATION (2) IO REGISTERS
	{name: "RCNT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "JOYCNT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "JOY_RECV", type: ioregENUMS["IOREGWORD"]},
	{name: "JOY_TRANS", type: ioregENUMS["IOREGWORD"]},
	{name: "JOYSTAT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	...(new Array(82)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	//INTERRUPT, WAITSTATE, AND POWERDOWN CONTROL IO REGISTERS
	{name: "IE", type: ioregENUMS["IOREG"]},
	{name: "IF", type: ioregENUMS["IOREGIF"]},
	{name: "WAITCNT", type: ioregENUMS["IOREG"]},
	{name: "UNUSED", type: ioregENUMS["UNUSED"]},
	{name: "IME", type: ioregENUMS["IOREG"]},
	...(new Array(123)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	{name: "POSTFLG", type: ioregENUMS["IOREGBYTE"]},
	{name: "HALTCNT", type: ioregENUMS["IOREGBYTEWRITEONLY"]},
	...(new Array(136)).fill({name: "UNUSED", type: ioregENUMS["UNUSED"]}),
	];

	//initialize ioregs array
	let unusedreg = new ioRegUnused("UNUSED", this, -1);
	let ioregAddr = 0;
	let newioreg;
	let size;
	for (let i = 0; i < ioregInitArr.length; i ++)
	{
		let type = ioregInitArr[i]["type"];
		let name = ioregInitArr[i]["name"];
		let readBits = ioregInitArr[i]["readBits"];

		switch(type)
		{
			case ioregENUMS["IOREG"]: newioreg = new ioReg(name, this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGREADONLY"]: newioreg = new ioRegReadOnly(name, this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGWRITEONLY"]: newioreg = new ioRegWriteOnly(name, this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGBYTE"]: newioreg = new ioRegByte(name, this, ioregAddr); size = 1; break;
			case ioregENUMS["IOREGBYTEWRITEONLY"]: newioreg = new ioRegByteWriteOnly(name, this, ioregAddr); size = 1; break;
			case ioregENUMS["IOREGWORD"]: newioreg = new ioRegWord(name, this, ioregAddr); size = 4; break;
			case ioregENUMS["IOREGWORDWRITEONLY"]: newioreg = new ioRegWordWriteOnly(name, this, ioregAddr); size = 4; break;
			case ioregENUMS["IOREGIF"]: newioreg = new ioRegIF(name, this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGDISPSTAT"]: newioreg = new ioRegDISPSTAT(name, this, ioregAddr); size = 2; break;
			case ioregENUMS["IOREGTMCNTL"]: newioreg = new ioRegTMCNTL(name, this, ioregAddr); size = 2; break;
			case ioregENUMS["UNUSED"]: newioreg = unusedreg; size = 2; break;
			case ioregENUMS["IOREGBYTEREADWRITE"]: newioreg = new ioRegByteReadWrite(name, this, ioregAddr, convertStringToBitMask(readBits)); size = 1; break;
			case ioregENUMS["IOREGREADWRITE"]: newioreg = new ioRegReadWrite(name, this, ioregAddr, convertStringToBitMask(readBits)); size = 2; break;
			case ioregENUMS["IOREGWORDREADWRITE"]: newioreg = new ioRegWordReadWrite(name, this, ioregAddr, convertStringToBitMask(readBits)); size = 4; break;
			default: throw Error("undefined IO register type!");
		}
		for (let p = 0; p < size; p ++)
		{
			this.ioRegs.push(newioreg);
		}
		ioregAddr += size;
	}

	//this.getIOReg("IE").addCallback(()=> {console.log("THIS ROM IS USING INTERRUPTS!!")});
	// this.getIOReg("DMA0SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("DMA1SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("DMA2SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("DMA3SAD").addCallback(()=> {console.log("THIS ROM IS USING DMA!!")});
	// this.getIOReg("TM0CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	// this.getIOReg("TM1CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	// this.getIOReg("TM2CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	// this.getIOReg("TM3CNTL").addCallback(()=> {console.log("THIS ROM IS USING TIMER!!")});
	//this.getIOReg("HALTCNT").addCallback(()=> {console.log("THIS ROM IS USING HALT!!")});
	//this.getIOReg("WAITCNT").addCallback(()=> {console.log("THIS ROM IS USING WAITCNT!!")});
	this.memory[this.getIOReg("SOUNDBIAS").regIndex + 1] = 0x2;
}

ioRegion.prototype.read8 = function (memAddr) {
	return this.ioRegs[memAddr].read8(memAddr);
}

ioRegion.prototype.read16 = function (memAddr) {
	return this.ioRegs[memAddr].read16(memAddr);
}

ioRegion.prototype.read32 = function (memAddr) {
	return this.ioRegs[memAddr].read32(memAddr);
}

ioRegion.prototype.write8 = function (memAddr, val) {
	this.ioRegs[memAddr].write8(memAddr, val);
}

ioRegion.prototype.write16 = function (memAddr, val) {
	this.ioRegs[memAddr].write16(memAddr, val);
}

ioRegion.prototype.write32 = function (memAddr, val) {
	this.ioRegs[memAddr].write32(memAddr, val);
}

ioRegion.prototype.getIOReg = function (name) {
	for (let i = 0; i < this.ioRegs.length; i++)
	{
		if (this.ioRegs[i].name === name)
		{
			return this.ioRegs[i];
		}
	}
	throw Error("failed to retrieve ioreg: " + name);
}

ioRegion.prototype.dumpMemory = function (memAddr) {
	let memory = this.memory;
	let numBytes = 12 * 16 + memAddr;
	for (let i = memAddr; i < numBytes; i += 16)
	{
		let str = "";
		for (let p = 0; p < 16; p ++)
		{
			str += memory[i + p].toString(16).padStart(2, "0") + " "; 
		}
		console.log((i & 0xFF).toString(16).padStart(2, "0") + ": " + str);
	}
};


//returns JSON of inner state
ioRegion.prototype.serialize = function() {
	let copy = {};

	copy.memory = [...compressBinaryData(this.memory, 1)];

	return copy;
}
  
ioRegion.prototype.setState = function(saveState) {
	copyArrIntoArr(decompressBinaryData(new Uint8Array(saveState.memory), 1), this.memory);
}