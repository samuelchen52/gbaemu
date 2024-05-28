
const sound = function(mmu) {
    //sound api stuff
    this.audioContext = new AudioContext();

    this.numCycle = 0;
    this.cyclesPerSample = 512; //gba runs at 16mm hz, this means around 32k sampling rate
    this.sampleIndex = 0;
    this.sampleArrLength = 4096; //32768 * 2
    this.sampleRate = 32768;
    this.sampleArr = new Array(this.sampleArrLength) //audioBuffer.getChannelData(0);
    this.soundStart = 0;
    this.soundLength = this.sampleArrLength / this.sampleRate; // in seconds, this will basically dictate how much time will pass before we drain the sample buffer i.e. latency
    this.pctSoundFinishedThreshold = .85;

    //TODO: add left and right. just doing one flag for both channels for now
    this.DMGVolumeMultiplier = 0;
    this.sound1Enable = 0;
    this.sound2Enable = 0;
    this.sound3Enable = 0;
    this.sound4Enable = 0;
    
    this.numChannelsEnabled = 0;

    this.enable = false;
    
    let ioregion = mmu.getMemoryRegion("IOREGISTERS");
    let soundEnable = ioregion.getIOReg("SOUNDCNT_X");
    let DMGSoundOutputControl = ioregion.getIOReg("SOUNDCNT_L");

    soundEnable.addCallback((soundEnableVal) => { 
        let enable = (soundEnableVal & IORegisterMasks["REG_MASTER_SOUNDSTAT_ENABLE"]) >>> IORegisterMaskShifts["REG_MASTER_SOUNDSTAT_ENABLE"];
        if (enable)
            this.start(this.enable); 

        //todo, have channels set bits 0-3 when sound length reached
        //also, set the bits on enable
    });
    DMGSoundOutputControl.addCallback(DMGSoundOutputControl => {
        let DMGVolumeMultiplierLeft = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_LEFT_VOLUME"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_LEFT_VOLUME"];
        let DMGVolumeMultiplierRight = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_RIGHT_VOLUME"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_RIGHT_VOLUME"];

        let sound1EnableLeft = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND1_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND1_LEFT"];
        let sound1EnableRight = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND1_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND1_RIGHT"];
        let sound2EnableLeft = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND2_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND2_LEFT"];
        let sound2EnableRight = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND2_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND2_RIGHT"];
        let sound3EnableLeft = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND3_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND3_LEFT"];
        let sound3EnableRight = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND3_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND3_RIGHT"];
        let sound4EnableLeft = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND4_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND4_LEFT"];
        let sound4EnableRight = (DMGSoundOutputControl & IORegisterMasks["REG_SOUNDCNT_L_SOUND4_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND4_RIGHT"];

        if (DMGVolumeMultiplierLeft !== DMGVolumeMultiplierRight)
            console.log("volume multipler left different from right!");

        //just take the avg of the two for now for now
        this.DMGVolumeMultiplier = ((DMGVolumeMultiplierLeft + DMGVolumeMultiplierRight) / 2) / 7;
        this.sound1Enable = sound1EnableLeft || sound1EnableRight;
        this.sound2Enable = sound2EnableLeft || sound2EnableRight;
        this.sound3Enable = sound3EnableLeft || sound3EnableRight;
        this.sound4Enable = sound4EnableLeft || sound4EnableRight;

        this.numChannelsEnabled = 0;
        if (this.sound1Enable)
            this.numChannelsEnabled ++;
        if (this.sound2Enable)
            this.numChannelsEnabled ++;
        if (this.sound3Enable)
            this.numChannelsEnabled ++;
        if (this.sound4Enable)
            this.numChannelsEnabled ++;
    });



    //channels
    this.squareChannel1 = new squareChannel(ioregion.getIOReg("SOUND1CNT_H"), ioregion.getIOReg("SOUND1CNT_X"), ioregion.getIOReg("SOUND1CNT_L"));
    this.squareChannel2 = new squareChannel(ioregion.getIOReg("SOUND2CNT_L"), ioregion.getIOReg("SOUND2CNT_H"));
    this.channel3 = new DACChannel(ioregion.getIOReg("SOUND3CNT_L"), ioregion.getIOReg("SOUND3CNT_H"), ioregion.getIOReg("SOUND3CNT_X"), 
        [   
            ioregion.getIOReg("REG_WAVE_RAM0_L"),
            ioregion.getIOReg("REG_WAVE_RAM0_H"),
            ioregion.getIOReg("REG_WAVE_RAM1_L"),
            ioregion.getIOReg("REG_WAVE_RAM1_H"),
            ioregion.getIOReg("REG_WAVE_RAM2_L"),
            ioregion.getIOReg("REG_WAVE_RAM2_H"),
            ioregion.getIOReg("REG_WAVE_RAM3_L"),
            ioregion.getIOReg("REG_WAVE_RAM3_H"),
        ]
    );

    //actively playing
    this.currentSource = {
        stop : () => {}
    };
    this.currentSampleArr = [];
};

sound.prototype.mix = function(sound1, sound2, sound3, numChannelsEnabled) {
    return (sound1 + sound2 + sound3) / numChannelsEnabled;
}

sound.prototype.getSample = function() {
    let sound1 = this.sound1Enable ? this.squareChannel1.getSample() : 0;
    let sound2 = this.sound2Enable ? this.squareChannel2.getSample() : 0;
    let sound3 = this.sound3Enable ? this.channel3.getSample() : 0;
    // let sound4 = this.channel1.getSample();
    // let sound5 = this.channel1.getSample();
    // let sound6 = this.channel1.getSample();

    let dmgSample = this.mix(sound1, sound2, sound3, this.numChannelsEnabled) * this.DMGVolumeMultiplier;
    
    return dmgSample;
}

//in seconds
sound.prototype.soundStartTimeElapsed = function() {
    return this.audioContext.currentTime - this.soundStart;
}

sound.prototype.playSound = function() {
    //get remaining samples that have yet to be played from the sound buffer being currently being played
    let currentSoundTimeLeft = this.soundLength - this.soundStartTimeElapsed();
    let samplesRemaining = [];
    if (currentSoundTimeLeft > 0) {
        let numSamplesRemaining = Math.ceil((this.currentSampleArr.length * (currentSoundTimeLeft / this.soundLength)));
        samplesRemaining = this.currentSampleArr.slice(this.currentSampleArr.length - numSamplesRemaining , this.currentSampleArr.length);
    }

    //determine the playback rate, which will either slow down or speed up the next sound being played
    //i.e. if emulator is running fast then sound will speed up else slow down
    let expectedNumSamples = ((this.soundLength)) * this.sampleRate;
    let actualNumSamples = this.sampleIndex + samplesRemaining.length;
    let playbackRate = actualNumSamples / expectedNumSamples;

    //load up new sound buffer with samples (along with the remaining samples above)
    this.currentSampleArr = this.sampleArr.slice(0, this.sampleIndex);
    var buffer = this.audioContext.createBuffer(1, this.sampleIndex + samplesRemaining.length, this.sampleRate);
    var channelData = buffer.getChannelData(0);
    channelData.set(samplesRemaining.concat(this.currentSampleArr));
        
    //stop the currently playing sound
    //then immediately after, load up the next buffer of samples and play it
    this.currentSource.stop();

    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.audioContext.destination);
    this.currentSource.playbackRate.value = playbackRate;
    this.currentSource.start();

    this.soundStart = this.audioContext.currentTime;

    //reset the sample index cause we drained it
    this.sampleIndex = 0;
}

//executes numCycles, returns the number of cycles before the next "event" 
sound.prototype.update = function(numCycles) {
    if (!this.enable)
        return this.cyclesPerSample;

    this.numCycle += numCycles;

    this.squareChannel1.update(numCycles);
    this.squareChannel2.update(numCycles);
    this.channel3.update(numCycles);

    if (this.numCycle === this.cyclesPerSample) {
        this.numCycle = 0;
        this.sampleArr[this.sampleIndex] = this.getSample();
        this.sampleIndex ++;

        //drain the buffer if it overflows or we are nearing the end of the samples being currently played
        if (this.sampleIndex === this.sampleArrLength 
            || (this.soundStartTimeElapsed() / this.soundLength) > this.pctSoundFinishedThreshold)
            this.playSound();
    }

    if (this.numCycle > this.cyclesPerSample)
        throw new Error("wtf")
    
    return this.cyclesPerSample - this.numCycle;
};

sound.prototype.start = function() {
    this.enable = true;
    //init stuff
    this.soundStart = this.audioContext.currentTime;
    //for each channel, init
    this.squareChannel1.init();
    this.squareChannel2.init();
    this.channel3.init();
}

sound.prototype.stop = function() {
    this.enable = false;
}