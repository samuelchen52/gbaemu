//channel 1 / channel 2
const squareChannel = function(REG_SOUNDCNT_LEN, REG_SOUNDCNT_FREQ, REG_SOUNDCNT_SWEEP) {
    this.soundLength; //the length of time this channel will produce sound
    this.wavePattern = 0; //determines the wave pattern of the channel
    this.envelopeStepTime; //delay between envelope increase / decrease
    this.envelopeMode; //bool, if true, increase else decrease
    this.initialEnvelopeValue = 0; //initial volume

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

    REG_SOUNDCNT_LEN.addCallback((REGSOUNDCNTLENVal) => this.updateREGSOUNDCNTLEN(REGSOUNDCNTLENVal) );
    REG_SOUNDCNT_FREQ.addCallback((REGSOUNDCNTFREQVal) => this.updateREGSOUNDCNTFREQ(REGSOUNDCNTFREQVal) );
    if (REG_SOUNDCNT_SWEEP)
        REG_SOUNDCNT_SWEEP.addCallback((REGSOUNDCNTSWEEPVal) => this.updateREGSOUNDCNTSWEEP(REGSOUNDCNTSWEEPVal) );
};

squareChannel.prototype.updateREGSOUNDCNTLEN = function(REGSOUNDCNTLENVal) {
    this.soundLength = (REGSOUNDCNTLENVal & IORegisterMasks["REG_SOUNDCNT_LEN_LENGTH"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_LEN_LENGTH"];
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
    if (this.cyclesPerSweepStep === 0 || this.sweepShifts === 0 || this.frequency > 131072)
        return;

    this.cyclesSinceFrequencyChange += numCycles;
    //new period calculated as follows -> period += or -= period / 2 ^ sweepshifts
    for (let i = 0; i < Math.floor(this.cyclesSinceFrequencyChange / this.cyclesPerSweepStep); i ++) {
        let tempWavePeriodInSeconds = this.wavePeriodInSeconds + (this.wavePeriodInSeconds / Math.pow(2, this.sweepShifts) * (this.sweepMode ? 1 : -1));
        let tempFrequency = Math.floor(1 / tempWavePeriodInSeconds);

        if (tempFrequency <= 64)
            break;
        else {
            this.wavePeriodInSeconds = tempWavePeriodInSeconds;
            this.frequency = tempFrequency;

            if (this.frequency > 131072)
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
    

};

squareChannel.prototype.getSample = function() {
    
    if ((this.volume > 0) 
        && (this.frequency <= 131072) //stop playing sound if frequency exceeds maximum val
    )
        return (this.wavePatternArr[this.wavePattern][this.wavePeriodPos] * (this.volume / this.maxVolume)); //normalize volume with 1 represent max volume val

    return 0;
};

squareChannel.prototype.init = function() {    
    //init volume
    this.volume = this.initialEnvelopeValue;
    this.cyclesSinceEnvelopeChange = 0;

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


//channel 3
const DACChannel = function(mmu) {

}

//channel 4
const noiseChannel = function(mmu) {

}