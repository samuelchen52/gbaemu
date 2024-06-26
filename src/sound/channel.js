/*
    todo, compared to other emulator:
    frequency cap seems to be lower
    when changing sweep direction to add, sound stops?

    channel 1 / channel 2
*/
const squareChannel = function(REG_SOUNDCNT_LEN, REG_SOUNDCNT_FREQ, REG_SOUNDCNT_SWEEP) {
    this.soundLength; //the length of time this channel will produce sound (in cpu cycles)
    this.wavePattern = 0; //determines the wave pattern of the channel
    this.envelopeStepTime; //delay between envelope increase / decrease
    this.envelopeMode; //bool, if true, increase else decrease
    this.initialEnvelopeValue = 0; //initial volume

    this.minFrequency = 64;
    this.maxFrequency = 131072;
    this.frequencyVal; //initial frequency val from register
    this.frequency;
    this.timedMode; //bool, if true, will play for a duration of sound length, otherwise forever
    //this.soundReset; //when this is set, envelope and frequency reset to init value (technically not state that needs to be maintained)

    this.sweepShifts; //3 bit number that dictates magnitude of change in frequency
    this.sweepMode; //bool, if true, freq will increase
    this.sweepTime; //3 bit number that dictates delay is between each sweep

    this.cyclesPerSweepStep = 0; //change freq every cyclesPerSweepStep
    this.cyclesPerEnvelopeStep = 0; //change volume every cyclesPerEnvelopeStep

    //volume
    this.maxVolume = Math.pow(2, 4) - 1;
    this.volume; 
    this.cyclesSinceEnvelopeChange;

    //frequency
    this.wavePeriodInSeconds;
    this.wavePeriodInCycles; //in CPU cycles
    this.cyclesSinceFrequencyChange;

    //duty cycle
    this.wavePeriodCycle; //current cycles that have elapsed since last wave position
    this.wavePeriodPos; //8 possible postions, based on which 1/8 interval of the wave cycle we are currently on
    //determines the output of the wave based on the current wave pattern and wave position. indexed by wave duty bits (0 - 3), then by wave position (0 - 7)
    this.wavePatternArr = [
        [0,0,0,0,0,0,0,1], 
        [0,0,0,0,0,0,1,1],
        [0,0,0,0,1,1,1,1],
        [1,1,1,1,1,1,0,0],
    ]

    //track length of time sound has been playing, in cpu cycles
    this.currSoundLength;

    REG_SOUNDCNT_LEN.addCallback((REGSOUNDCNTLENVal) => this.updateREGSOUNDCNTLEN(REGSOUNDCNTLENVal) );
    REG_SOUNDCNT_FREQ.addCallback((REGSOUNDCNTFREQVal) => this.updateREGSOUNDCNTFREQ(REGSOUNDCNTFREQVal) );
    if (REG_SOUNDCNT_SWEEP)
        REG_SOUNDCNT_SWEEP.addCallback((REGSOUNDCNTSWEEPVal) => this.updateREGSOUNDCNTSWEEP(REGSOUNDCNTSWEEPVal) );
};

squareChannel.prototype.updateREGSOUNDCNTLEN = function(REGSOUNDCNTLENVal) {
    //(64-register value)*(1/256) seconds
    this.soundLength = (REGSOUNDCNTLENVal & IORegisterMasks["REG_SOUNDCNT_LEN_LENGTH"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_LEN_LENGTH"];
    this.soundLength = ((64 - this.soundLength) * (1/256)) * CYCLES_PER_SECOND;
    this.currSoundLength = 0;

    this.wavePattern = (REGSOUNDCNTLENVal & IORegisterMasks["REG_SOUNDCNT_LEN_WAVE_DUTY"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_LEN_WAVE_DUTY"];
    this.envelopeStepTime = (REGSOUNDCNTLENVal & IORegisterMasks["REG_SOUNDCNT_LEN_ENV_STEP_TIME"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_LEN_ENV_STEP_TIME"];
    this.envelopeMode = (REGSOUNDCNTLENVal & IORegisterMasks["REG_SOUNDCNT_LEN_ENV_MODE"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_LEN_ENV_MODE"];
    this.initialEnvelopeValue = (REGSOUNDCNTLENVal & IORegisterMasks["REG_SOUNDCNT_LEN_ENV_INIT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_LEN_ENV_INIT"];

    //step time in seconds = 1/64 seconds * envelopeStepTime -> 1/64 seconds * 16777216 cycles per second * envelopeStepTime ->  262144 cycles * envelopeStepTime 
    this.cyclesPerEnvelopeStep = 262144 * this.envelopeStepTime;  
};

squareChannel.prototype.updateREGSOUNDCNTFREQ = function(REGSOUNDCNTFREQVal) {
    this.frequencyVal = (REGSOUNDCNTFREQVal & IORegisterMasks["REG_SOUNDCNT_FREQ_SOUND_FREQ"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_FREQ_SOUND_FREQ"];
    this.timedMode = (REGSOUNDCNTFREQVal & IORegisterMasks["REG_SOUNDCNT_FREQ_TIMED_MODE"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_FREQ_TIMED_MODE"];
    if ((REGSOUNDCNTFREQVal & IORegisterMasks["REG_SOUNDCNT_FREQ_SOUND_RESET"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_FREQ_SOUND_RESET"]) {
        this.volume = this.initialEnvelopeValue;

        //frequency -> 4194304/(32*(2048-register value)).
        this.frequency = 4194304 / (32 * ( 2048 - this.frequencyVal));
        this.wavePeriodInSeconds = 1 / this.frequency;
        this.wavePeriodInCycles = Math.floor(this.wavePeriodInSeconds * CYCLES_PER_SECOND);
    }
};

squareChannel.prototype.updateREGSOUNDCNTSWEEP = function(REGSOUNDCNTSWEEPVal) {
    this.sweepShifts = (REGSOUNDCNTSWEEPVal & IORegisterMasks["REG_SOUNDCNT_SWEEP_SHIFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_SWEEP_SHIFT"];
    this.sweepMode = (REGSOUNDCNTSWEEPVal & IORegisterMasks["REG_SOUNDCNT_SWEEP_INCREASE"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_SWEEP_INCREASE"];
    this.sweepTime = (REGSOUNDCNTSWEEPVal & IORegisterMasks["REG_SOUNDCNT_SWEEP_SWEEP_TIME"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_SWEEP_SWEEP_TIME"];

    //sweep time in seconds = sweep time * 7.8 ms ~= sweepTime * 128000 cycles 
    this.cyclesPerSweepStep = this.sweepTime * 131072;
};

//executes numCycles, returns the number of cycles before the next "event" 
//the only event is when it stops (sets status bit on control register, which can be read)

//we're going to call this every sampling rate cycles
//techincally, for max accruacy, it should be called anytime state changes, since these channels are continous
//if state hasn't changed between each sample rate, which is 52k, then the sound generated won't be changed
//hopefully, it comes out fine (seemed to work out fine for timers, which are also dynamic :/ ?)
squareChannel.prototype.update = function(numCycles) {
    this.updateVolume(numCycles);
    this.updateFrequency(numCycles);
    this.updateDutyCycle(numCycles);
    this.updateDuration(numCycles);
};

squareChannel.prototype.updateVolume = function(numCycles) {
    if (this.cyclesPerEnvelopeStep === 0)
        return;

    this.cyclesSinceEnvelopeChange += numCycles;
    this.volume += Math.floor(this.cyclesSinceEnvelopeChange / this.cyclesPerEnvelopeStep) * (this.envelopeMode ? 1 : -1);
    this.cyclesSinceEnvelopeChange %= this.cyclesPerEnvelopeStep;

    //cut off volume
    if (this.volume < 0)
        this.volume = 0;
    else if (this.volume > this.maxVolume)
        this.volume = this.maxVolume;
};

squareChannel.prototype.updateFrequency = function(numCycles) {
    if (this.cyclesPerSweepStep === 0 || this.sweepShifts === 0 || this.frequency > this.maxFrequency)
        return;

    this.cyclesSinceFrequencyChange += numCycles;
    //new period calculated as follows -> period += or -= period / 2 ^ sweepshifts
    for (let i = 0; i < Math.floor(this.cyclesSinceFrequencyChange / this.cyclesPerSweepStep); i ++) {
        let tempWavePeriodInSeconds = this.wavePeriodInSeconds + (this.wavePeriodInSeconds / Math.pow(2, this.sweepShifts) * (this.sweepMode ? 1 : -1));
        let tempFrequency = Math.floor(1 / tempWavePeriodInSeconds);

        if (tempFrequency <= this.minFrequency)
            break;
        else {
            this.wavePeriodInSeconds = tempWavePeriodInSeconds;
            this.frequency = tempFrequency;

            if (this.frequency > this.maxFrequency)
                break;
        }
    }
    this.cyclesSinceFrequencyChange %= this.cyclesPerSweepStep;
};

squareChannel.prototype.updateDutyCycle = function(numCycles) {
    if (this.wavePeriodInCycles === 0)
        return;

    this.wavePeriodCycle += numCycles;

    if (this.wavePeriodCycle >= this.wavePeriodInCycles) {
        this.wavePeriodCycle %= this.wavePeriodInCycles;
        this.wavePeriodInCycles = Math.floor(this.wavePeriodInSeconds * CYCLES_PER_SECOND); //set at the end of a wave 
    }

    this.wavePeriodPos = Math.floor(this.wavePeriodCycle / this.wavePeriodInCycles / .125);
};

squareChannel.prototype.updateDuration = function(numCycles) {
    this.currSoundLength += numCycles;
};

squareChannel.prototype.getSample = function() {
    if (
        (this.volume <= 0) 
        || (this.frequency > this.maxFrequency) //stop playing sound if frequency exceeds maximum val
        || (this.timedMode && (this.currSoundLength > this.soundLength)) //stop playing sound if we've reached the max sound length 
    )
        return 0;
    else
        return (this.wavePatternArr[this.wavePattern][this.wavePeriodPos] * (this.volume / this.maxVolume)); //normalize volume with 1 represent max volume val
};

squareChannel.prototype.init = function() {    
    //init volume
    this.volume = this.initialEnvelopeValue;
    this.cyclesSinceEnvelopeChange = 0;
    this.currSoundLength = 0;

    //init frequency
    if (this.frequencyVal) {
        this.frequency = 4194304 / (32 * ( 2048 - this.frequencyVal));
        this.wavePeriodInSeconds = 1 / this.frequency;
        this.wavePeriodInCycles = Math.floor(this.wavePeriodInSeconds * CYCLES_PER_SECOND);
    }
    else {
        this.frequency = 0;
        this.wavePeriodInSeconds = 0;
        this.wavePeriodInCycles = 0;
    }
    this.cyclesSinceFrequencyChange = 0;

    //init wave period stuff
    this.wavePeriodCycle = 0;
    this.wavePeriodPos = 0;
};

squareChannel.prototype.serialize = function() {
    let copy = {};

    copy.soundLength = this.soundLength;
    copy.wavePattern = this.wavePattern;
    copy.envelopeStepTime = this.envelopeStepTime;
    copy.envelopeMode = this.envelopeMode;
    copy.initialEnvelopeValue = this.initialEnvelopeValue;

    copy.frequencyVal = this.frequencyVal;
    copy.frequency = this.frequency;
    copy.timedMode = this.timedMode;

    copy.sweepShifts = this.sweepShifts;
    copy.sweepMode = this.sweepMode;
    copy.sweepTime = this.sweepTime;

    copy.cyclesPerSweepStep = this.cyclesPerSweepStep;
    copy.cyclesPerEnvelopeStep = this.cyclesPerEnvelopeStep;

    //volume
    copy.volume = this.volume; 
    copy.cyclesSinceEnvelopeChange = this.cyclesSinceEnvelopeChange;

    //frequency
    copy.wavePeriodInSeconds = this.wavePeriodInSeconds;
    copy.wavePeriodInCycles = this.wavePeriodInCycles;
    copy.cyclesSinceFrequencyChange = this.cyclesSinceFrequencyChange;

    //duty cycle
    copy.wavePeriodCycle = this.wavePeriodCycle;
    copy.wavePeriodPos = this.wavePeriodPos;

    copy.currSoundLength = this.currSoundLength;

    return copy;
};

squareChannel.prototype.setState = function(saveState) {
    this.soundLength = saveState.soundLength;
    this.wavePattern = saveState.wavePattern;
    this.envelopeStepTime = saveState.envelopeStepTime;
    this.envelopeMode = saveState.envelopeMode;
    this.initialEnvelopeValue = saveState.initialEnvelopeValue;

    this.frequencyVal = saveState.frequencyVal;
    this.frequency = saveState.frequency;
    this.timedMode = saveState.timedMode;

    this.sweepShifts = saveState.sweepShifts;
    this.sweepMode = saveState.sweepMode;
    this.sweepTime = saveState.sweepTime;

    this.cyclesPerSweepStep = saveState.cyclesPerSweepStep;
    this.cyclesPerEnvelopeStep = saveState.cyclesPerEnvelopeStep;

    this.volume = saveState.volume; 
    this.cyclesSinceEnvelopeChange = saveState.cyclesSinceEnvelopeChange;

    this.wavePeriodInSeconds = saveState.wavePeriodInSeconds;
    this.wavePeriodInCycles = saveState.wavePeriodInCycles;
    this.cyclesSinceFrequencyChange = saveState.cyclesSinceFrequencyChange;

    this.wavePeriodCycle = saveState.wavePeriodCycle;
    this.wavePeriodPos = saveState.wavePeriodPos;

    this.currSoundLength = saveState.currSoundLength;
};

/*
    channel 3
*/
const DACChannel = function(REG_SOUND3CNT_L, REG_SOUND3CNT_H, REG_SOUND3CNT_X, REGS_WAVE_RAM) {

    //REG_SOUND3CNT_L
    this.bankMode = 0; //true -> 1 buffer (32 samples), false -> 2 buffers (64 samples)
    this.bankSelectedVal = 0; //true -> bank 1 else bank 0
    this.bankSelected = 0;
    this.enable = 0;

    //REG_SOUND3CNT_H
    this.soundLength = 0; //sound length, in cycles
    this.volumeRatio; //0, 25%, 50%, 75%, 100%

    //REG_SOUND3CNT_X
    this.sampleRate;
    this.timedMode; //0 = loop, 1 = timed
    //soundreset bit
    
    this.currSoundLength = 0;

    //wave ram single bank (bank mode = 1)
    this.sampleBuffer = new Array(32).map(x => 0);
    //wave ram alternating banks (bank mode = 0)
    this.sampleBuffer0 = new Array(32).map(x => 0);
    this.sampleBuffer1 = new Array(32).map(x => 0);

    this.sampleIndex = 0;
    this.numCycle = 0;
    this.cyclesPerSample = 0;

    REG_SOUND3CNT_L.addCallback(REGSOUND3CNTLVal => {
        this.bankMode = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_L_BANK_MODE"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_L_BANK_MODE"];
        this.bankSelectedVal = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_L_BANK_SELECT"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_L_BANK_SELECT"];
        this.bankSelected = this.bankSelectedVal;
        this.enable = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_L_ENABLE"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_L_ENABLE"];
    });
    REG_SOUND3CNT_H.addCallback(REGSOUND3CNTLVal => {
        //(256-n)/256
        this.soundLength = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_H_LENGTH"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_H_LENGTH"];
        this.soundLength = ((256 - this.soundLength) / 256) * CYCLES_PER_SECOND;

        //000=Mute
        // 001=100%
        // 100=75%
        // 010=50%
        // 011=25%
        this.volumeRatio = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_H_VOLUME_RATIO"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_H_VOLUME_RATIO"];
        switch(this.volumeRatio)
        {
            case 0:
                this.volumeRatio = 0;
                break;
            case 1:
                this.volumeRatio = 1;
                break;
            case 4:
                this.volumeRatio = .75;
                break;
            case 2:
                this.volumeRatio = .5;
                break;
            case 3:
                this.volumeRatio = .25;
                break;
        }
    });
    REG_SOUND3CNT_X.addCallback(REGSOUND3CNTLVal => {
        //2097152/(2048-n)
        this.sampleRate = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_X_FREQ"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_X_FREQ"];
        this.sampleRate = 2097152 / (2048 - this.sampleRate);
        this.cyclesPerSample = (1 / this.sampleRate) * CYCLES_PER_SECOND;

        this.timedMode = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_X_TIMED_MODE"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_X_TIMED_MODE"];
        let soundReset = (REGSOUND3CNTLVal & IORegisterMasks["REG_SOUND3CNT_X_SOUND_RESET"]) >>> IORegisterMaskShifts["REG_SOUND3CNT_X_SOUND_RESET"];
        if (soundReset)
            this.init();
    });


    //8 wave ram registers, halfword (2 bytes) each, at 4 bits per sample == 32 samples total
    //samples are extracted from the bytes in order of mem address (MSBs first!)
    // let REG_WAVE_RAM0_L = REGS_WAVE_RAM[0];
    // let REG_WAVE_RAM0_H = REGS_WAVE_RAM[1];
    // let REG_WAVE_RAM1_L = REGS_WAVE_RAM[2];
    // let REG_WAVE_RAM1_H = REGS_WAVE_RAM[3];
    // let REG_WAVE_RAM2_L = REGS_WAVE_RAM[4];
    // let REG_WAVE_RAM2_H = REGS_WAVE_RAM[5];
    // let REG_WAVE_RAM3_L = REGS_WAVE_RAM[6];
    // let REG_WAVE_RAM3_H = REGS_WAVE_RAM[7];
    for (let i = 0; i < REGS_WAVE_RAM.length; i ++)
    {
        let REG_WAVE_RAM = REGS_WAVE_RAM[i];
        REG_WAVE_RAM.addCallback(REGWAVERAMVal => {
            let bufferOffset = i * 4;
    
            let firstByte = REGWAVERAMVal >>> 8; //LS byte
            let secondByte = REGWAVERAMVal & 0xFF; //MS byte
    
            let firstSample = firstByte >>> 4;
            let secondSample = firstByte & 0xF;
            let thirdSample = secondByte >>> 4;
            let fourthSample = secondByte & 0xF;;
    
            this.sampleBuffer[bufferOffset] = firstSample;
            this.sampleBuffer[bufferOffset + 1] = secondSample;
            this.sampleBuffer[bufferOffset + 2] = thirdSample;
            this.sampleBuffer[bufferOffset + 3] = fourthSample;

            if (!this.bankMode) {
                let inactiveSampleBuffer = this.bankSelected ? this.sampleBuffer0 : this.sampleBuffer1;
                inactiveSampleBuffer[bufferOffset] = firstSample;
                inactiveSampleBuffer[bufferOffset + 1] = secondSample;
                inactiveSampleBuffer[bufferOffset + 2] = thirdSample;
                inactiveSampleBuffer[bufferOffset + 3] = fourthSample;
            }
        });
    };
}

DACChannel.prototype.init = function() {    

    //this.frequency = frequencyval * whatever;
    this.currSoundLength = 0;
    this.sampleIndex = 0;
    this.numCycle = 0;
    this.bankSelected = this.bankSelectedVal;
};

DACChannel.prototype.update = function(numCycles) {    
    if (this.cyclesPerSample === 0)
        return;

    this.numCycle += numCycles;

    this.sampleIndex += Math.floor(this.numCycle / this.cyclesPerSample);
    this.numCycle %= this.cyclesPerSample;

    //this.sampleBuffer.length
    if (this.sampleIndex === 32) {
        this.sampleIndex = 0;
        //switch the bank if we are in two bank mode (i.e. play the other buffer)
        if (this.bankMode)
            this.bankSelected = !this.bankSelected;
    }

    //sound length
    this.currSoundLength += numCycles;
};

DACChannel.prototype.getSample = function() {
    if (!this.enable || (this.timedMode && (this.currSoundLength > this.soundLength)))
        return 0;
    else {
        let sampleBuffer = this.bankSelected ? this.sampleBuffer1 : this.sampleBuffer0;
        return (sampleBuffer[this.sampleIndex] / 15) * this.volumeRatio; //normalize volume with 1 represent max volume val
    }
};

DACChannel.prototype.serialize = function() {
    let copy = {};

    copy.bankMode = this.bankMode;
    copy.bankSelectedVal = this.bankSelectedVal;
    copy.bankSelected = this.bankSelected;
    copy.enable = this.enable;

    copy.soundLength = this.soundLength;
    copy.volumeRatio = this.volumeRatio;

    copy.sampleRate = this.sampleRate;
    copy.timedMode = this.timedMode;
    
    copy.currSoundLength = this.currSoundLength;

    copy.sampleBuffer = [...this.sampleBuffer];
    copy.sampleBuffer0 = [...this.sampleBuffer0];
    copy.sampleBuffer1 = [...this.sampleBuffer1];

    copy.sampleIndex = this.sampleIndex;
    copy.numCycle = this.numCycle;
    copy.cyclesPerSample = this.cyclesPerSample;

    return copy;
};

DACChannel.prototype.setState = function(saveState) {
    this.bankMode = saveState.bankMode;
    this.bankSelectedVal = saveState.bankSelectedVal;
    this.bankSelected = saveState.bankSelected;
    this.enable = saveState.enable;

    this.soundLength = saveState.soundLength;
    this.volumeRatio = saveState.volumeRatio;

    this.sampleRate = saveState.sampleRate;
    this.timedMode = saveState.timedMode;
    
    this.currSoundLength = saveState.currSoundLength;

    this.sampleBuffer = [...saveState.sampleBuffer];
    this.sampleBuffer0 = [...saveState.sampleBuffer0];
    this.sampleBuffer1 = [...saveState.sampleBuffer1];

    this.sampleIndex = saveState.sampleIndex;
    this.numCycle = saveState.numCycle;
    this.cyclesPerSample = saveState.cyclesPerSample;
};

//channel 4
const noiseChannel = function(REGSOUNDCNTL, REGSOUNDCNTH) {
    this.soundLength = 0; //the length of time this channel will produce sound (in cpu cycles)
    this.timedMode = 0; //0 -> loop, 1 -> play up to length

    this.envelopeStepTime; //delay between envelope increase / decrease
    this.envelopeMode; //bool, if true, increase else decrease
    this.initialEnvelopeValue = 0; //initial volume

    this.mode = 0; //0 -> 15 stages, 1 -> 7 stages

    this.clockDivisor = 2;  //000: f*2
                            //001: f
                            //010: f/2
                            //011: f/3
                            //100: f/4
                            //101: f/5
                            //110: f/6
                            //111: f/7       
    this.preScaler = 0;
    this.frequency = 4194304 / 8 / this.clockDivisor / Math.pow(2, this.preScaler + 1); //in cycles ->  524288 Hz / r / 2^(s+1), where r = clockdivisor, s = pre scaler

    //freq
    this.cyclesPerStep = CYCLES_PER_SECOND / this.frequency;
    this.cyclesSinceStep = 0;

    //volume
    this.maxVolume = Math.pow(2, 4) - 1;
    this.volume; 
    this.cyclesSinceEnvelopeChange;
    this.cyclesPerEnvelopeStep = 0; //change volume every cyclesPerEnvelopeStep

    //track length of time sound has been playing, in cpu cycles
    this.currSoundLength = 0;

    this.shiftRegisterVal = this.mode ? 0x40 : 0x4000; // X=40h (7bit) or X=4000h (15bit)
    this.output = 0; //will be "drained" whenever get sample is called

    REGSOUNDCNTL.addCallback((REGSOUNDCNTLVal) => this.updateREGSOUNDCNTL(REGSOUNDCNTLVal));
    REGSOUNDCNTH.addCallback((REGSOUNDCNTHVal) => this.updateREGSOUNDCNTH(REGSOUNDCNTHVal));
}

noiseChannel.prototype.init = function() {    
    this.cyclesSinceStep = 0;
    this.volume = this.initialEnvelopeValue;
    this.cyclesSinceEnvelopeChange = 0;
    this.currSoundLength = 0;
    this.shiftRegisterVal = this.mode ? 0x40 : 0x4000; // X=40h (7bit) or X=4000h (15bit)
    this.output = 0;
};

noiseChannel.prototype.updateREGSOUNDCNTL = function(REGSOUNDCNTLVal) {
    this.soundLength = (REGSOUNDCNTLVal & IORegisterMasks["REG_SOUND4CNT_L_LENGTH"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_L_LENGTH"];
    this.soundLength = ((64 - this.soundLength) * (1/256)) * CYCLES_PER_SECOND;

    this.envelopeStepTime = (REGSOUNDCNTLVal & IORegisterMasks["REG_SOUND4CNT_L_ENV_STEP_TIME"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_L_ENV_STEP_TIME"];
    this.envelopeMode = (REGSOUNDCNTLVal & IORegisterMasks["REG_SOUND4CNT_L_ENV_MODE"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_L_ENV_MODE"];
    this.initialEnvelopeValue = (REGSOUNDCNTLVal & IORegisterMasks["REG_SOUND4CNT_L_ENV_INIT"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_L_ENV_INIT"];

    //step time in seconds = 1/64 seconds * envelopeStepTime -> 1/64 seconds * 16777216 cycles per second * envelopeStepTime ->  262144 cycles * envelopeStepTime 
    this.cyclesPerEnvelopeStep = 262144 * this.envelopeStepTime;
};

noiseChannel.prototype.updateREGSOUNDCNTH = function(REGSOUNDCNTHVal) {
    this.clockDivisor = (REGSOUNDCNTHVal & IORegisterMasks["REG_SOUND4CNT_H_CLOCK_DIVISOR"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_H_CLOCK_DIVISOR"];
    if (this.clockDivisor === 0)
        this.clockDivisor = .5;
    
    this.mode = (REGSOUNDCNTHVal & IORegisterMasks["REG_SOUND4CNT_H_MODE"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_H_MODE"];
    this.preScaler = (REGSOUNDCNTHVal & IORegisterMasks["REG_SOUND4CNT_H_PRE_SCALER"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_H_PRE_SCALER"];
    this.timedMode = (REGSOUNDCNTHVal & IORegisterMasks["REG_SOUND4CNT_H_TIMED_MODE"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_H_TIMED_MODE"];

    this.frequency = 524288 / this.clockDivisor / Math.pow(2, this.preScaler + 1); //in cycles ->  524288 Hz / r / 2^(s+1), where r = clockdivisor, s = pre scaler
    this.shiftRegisterVal = this.mode ? 0x40 : 0x4000; // X=40h (7bit) or X=4000h (15bit)
    this.cyclesPerStep = CYCLES_PER_SECOND / this.frequency;

    //note that the belogic sound 4 demo sets the reset bit to 1 (which is a write only bit) when writing to this register
    //in my implementation, when the demo reads back the value set in this register, I return 1 for the reset bit
    //however, in mgba, it seems to always return 0
    //this results in different behavior in the demo (when changing any cnt_h parameters, the sound replays on mine, not the case on mgba)
    //reading from write only bits is supposed to be undefined behavior, so hopefully games don't rely on reading zeroes from write only bits...

    let reset = (REGSOUNDCNTHVal & IORegisterMasks["REG_SOUND4CNT_H_RESET"]) >>> IORegisterMaskShifts["REG_SOUND4CNT_H_RESET"];
    if (reset)
        this.init();
};

noiseChannel.prototype.update = function(numCycles) {
    this.updateVolume(numCycles);
    this.updateDuration(numCycles);
    this.updateOutput(numCycles);
};

//identical to psg
noiseChannel.prototype.updateVolume = function(numCycles) {
    if (this.cyclesPerEnvelopeStep === 0)
        return;

    this.cyclesSinceEnvelopeChange += numCycles;
    this.volume += Math.floor(this.cyclesSinceEnvelopeChange / this.cyclesPerEnvelopeStep) * (this.envelopeMode ? 1 : -1);
    this.cyclesSinceEnvelopeChange %= this.cyclesPerEnvelopeStep;

    //cut off volume
    if (this.volume < 0)
        this.volume = 0;
    else if (this.volume > this.maxVolume)
        this.volume = this.maxVolume;
};

noiseChannel.prototype.updateDuration = function(numCycles) {
    this.currSoundLength += numCycles;
};

// 7bit:  X=X SHR 1, IF carry THEN Out=HIGH, X=X XOR 60h ELSE Out=LOW
// 15bit: X=X SHR 1, IF carry THEN Out=HIGH, X=X XOR 6000h ELSE Out=LOW
noiseChannel.prototype.updateOutput = function(numCycles) {
    // if (this.cyclesPerStep === 0)
    //     return;

    this.cyclesSinceStep += numCycles;

    for (let i = 0; i < Math.floor(this.cyclesSinceStep / this.cyclesPerStep); i ++) {
        this.output = this.shiftRegisterVal & 0x1;
        this.shiftRegisterVal = this.shiftRegisterVal >>> 1;

        if (this.output)
            this.shiftRegisterVal = this.shiftRegisterVal ^ (this.mode ? 0x60 : 0x6000);
    }
    this.cyclesSinceStep %= this.cyclesPerStep;
};

noiseChannel.prototype.getSample = function() {
    if ((this.volume <= 0) 
        || (this.timedMode && this.currSoundLength > this.soundLength)
        || !this.output)
        return 0;
    else {
        //return this.output * (this.volume / this.maxVolume);
        return (this.volume / this.maxVolume);
    }
};

noiseChannel.prototype.serialize = function() {
    let copy = {};

    copy.soundLength = this.soundLength;
    copy.timedMode = this.timedMode;

    copy.envelopeStepTime = this.envelopeStepTime;
    copy.envelopeMode = this.envelopeMode;
    copy.initialEnvelopeValue = this.initialEnvelopeValue;

    copy.mode = this.mode;

    copy.clockDivisor = this.clockDivisor;
    copy.preScaler = this.preScaler;
    copy.frequency = this.frequency;

    copy.cyclesPerStep = this.cyclesPerStep;
    copy.cyclesSinceStep = this.cyclesSinceStep;

    copy.volume = this.volume; 
    copy.cyclesSinceEnvelopeChange = this.cyclesSinceEnvelopeChange;
    copy.cyclesPerEnvelopeStep = this.cyclesPerEnvelopeStep;

    copy.currSoundLength = this.currSoundLength;

    copy.shiftRegisterVal = this.shiftRegisterVal;
    copy.output = this.output;

    return copy;
};

noiseChannel.prototype.setState = function(saveState) {
    this.soundLength = saveState.soundLength;
    this.timedMode = saveState.timedMode;

    this.envelopeStepTime = saveState.envelopeStepTime;
    this.envelopeMode = saveState.envelopeMode;
    this.initialEnvelopeValue = saveState.initialEnvelopeValue;

    this.mode = saveState.mode;

    this.clockDivisor = saveState.clockDivisor;
    this.preScaler = saveState.preScaler;
    this.frequency = saveState.frequency;

    this.cyclesPerStep = saveState.cyclesPerStep;
    this.cyclesSinceStep = saveState.cyclesSinceStep;

    this.volume = saveState.volume; 
    this.cyclesSinceEnvelopeChange = saveState.cyclesSinceEnvelopeChange;
    this.cyclesPerEnvelopeStep = saveState.cyclesPerEnvelopeStep;

    this.currSoundLength = saveState.currSoundLength;

    this.shiftRegisterVal = saveState.shiftRegisterVal;
    this.output = saveState.output;
};

//direct sound A / B
const directSoundChannel = function(timerController, REG_FIFO, REG_SOUNDCNT_H, REG_SOUNDCNT_H_TIMER_MASK, REG_SOUNDCNT_H_TIMER_MASK_SHIFT, REG_SOUNDCNT_H_RESET_MASK, REG_SOUNDCNT_H_RESET_MASK_SHIFT) {
    //take in the soundcnt h
    this.timerMask = REG_SOUNDCNT_H_TIMER_MASK;
    this.timerMaskShift = REG_SOUNDCNT_H_TIMER_MASK_SHIFT;
    this.resetMask = REG_SOUNDCNT_H_RESET_MASK;
    this.resetMaskShift = REG_SOUNDCNT_H_RESET_MASK_SHIFT;

    //will pass in the mask
    //timer callback will pass in timer num of overflow
    //so if timer num == this.timer num, then set timeroverflow
    this.selectedTimer = 0; //0 or 1

    //called after buffer is empty -> used by DMA
    this.bufferDrainedCallbacks = [];

    this.sampleBuffer = new crappyFIFOQueue(100000); //16 signed bytes

    //when triggered, a sample will be "drained"
    this.timerOverflow = false;

    REG_SOUNDCNT_H.addCallback(REGSOUNDCNTHVal => this.updateREGSOUNDCNTH(REGSOUNDCNTHVal));
    REG_FIFO.addCallback(REGFIFOVal => this.updateREGFIFO(REGFIFOVal));

    timerController.timer0.addTimerOverflowCallback((timerNum) => this.timerOverflowCallback(timerNum));
    timerController.timer1.addTimerOverflowCallback((timerNum) => this.timerOverflowCallback(timerNum));
}

directSoundChannel.prototype.updateREGSOUNDCNTH = function(REGSOUNDCNTHVal) {
    this.selectedTimer = (REGSOUNDCNTHVal & this.timerMask) >>> this.timerMaskShift;
    let reset = (REGSOUNDCNTHVal & this.resetMask) >>> this.resetMaskShift;
    //not sure if this is correct
    if (reset)
        this.sampleBuffer.clear();
};

directSoundChannel.prototype.updateREGFIFO = function(REGFIFOVal) {
    //the LSBs are played first
    this.sampleBuffer.push(REGFIFOVal & 0xFF);
    this.sampleBuffer.push((REGFIFOVal & 0xFF00) >>> 8);
    this.sampleBuffer.push((REGFIFOVal & 0xFF0000) >>> 16);
    this.sampleBuffer.push((REGFIFOVal & 0xFF000000) >>> 24);

    //on buffer overflow, i think its supposed to reset??
    // if (this.sampleBuffer.length > 16)
    //     this.sampleBuffer.clear();
};

directSoundChannel.prototype.addBufferDrainedCallback = function(callback) {
    this.bufferDrainedCallbacks.push(callback);
};

directSoundChannel.prototype.timerOverflowCallback = function(timerNum) {
    if (this.selectedTimer !== timerNum)
        return;
    
    this.timerOverflow = true;
    if (this.sampleBuffer.length <= 4)
        this.bufferDrainedCallbacks.forEach(bufferDrainedCallback => bufferDrainedCallback());
};

directSoundChannel.prototype.getSample = function() {
    let sample = 0;
    if (this.timerOverflow && this.sampleBuffer.length) {
        sample = this.sampleBuffer.pop();
        this.timerOverflow = false;
    }

    //normalize 8 bit signed samples from [-127, 128] to [-1, 1]
    return ((sample + 127) / 255) * 2 - 1;
};

directSoundChannel.prototype.init = function() {
    this.sampleBuffer.clear();
};

directSoundChannel.prototype.serialize = function() {
    let copy = {};

    copy.selectedTimer = this.selectedTimer;

    //take the samples out, serialize, then shove em back in
    let samples = this.sampleBuffer.popMulti(this.sampleBuffer.length);
    copy.sampleBuffer = [...samples];
    this.sampleBuffer.pushMulti(samples);

    copy.timerOverflow = this.timerOverflow;

    return copy;
};

directSoundChannel.prototype.setState = function(saveState) {
    this.selectedTimer = saveState.selectedTimer;

    //take the samples out, put the saved ones in
    this.sampleBuffer.popMulti(this.sampleBuffer.length);
    this.sampleBuffer.pushMulti(saveState.sampleBuffer);

    this.timerOverflow = saveState.timerOverflow;
};
