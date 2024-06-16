
const sound = function(mmu, timerController) {
    this.sampleRate = 32768;

    //sound api stuff
    this.audioContext = new AudioContext({ sampleRate : this.sampleRate });
    //this.audioContext = new AudioContext();
    this.processorNode = {
        port: { postMessage : () => {}}
    };
    this.audioContext.audioWorklet.addModule("src/sound/audio_worklet_node.js")
        .then(() => { 
            this.processorNode = new AudioWorkletNode(this.audioContext, "audio_worklet_node"); 
            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = this.audioContext.createBuffer(1, 128, 32768);
            this.currentSource.loop = true;
            this.currentSource.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);
            this.currentSource.start();
        })
        .catch((e) => { 
            console.log("error loading worklet node:"); 
            console.log(e); 
        });
    this.numCycle = 0;
    this.cyclesPerSample = 512; //gba runs at 16mm hz, this means around 32k sampling rate
    this.sampleIndex = 0;
    this.sampleArrLength = 2048;
    this.sampleArr = new Array(this.sampleArrLength) //audioBuffer.getChannelData(0);
    this.soundStart = 0;
    this.soundLength = this.sampleArrLength / this.sampleRate; // in seconds, this will basically dictate how much time will pass before we drain the sample buffer i.e. latency
    this.pctSoundFinishedThreshold = .85;
    this.sampleDebt = 0;
    this.sampleDebtThreshold = this.sampleArrLength * 2;

    //TODO: add left and right. just doing one flag for both channels for now
    this.DMGVolumeMultiplier = 0;
    this.sound1Enable = 0;
    this.sound2Enable = 0;
    this.sound3Enable = 0;
    this.sound4Enable = 0;
    this.sound5Enable = 0;
    this.sound6Enable = 0;

    this.DMGCHannelOutputRatio = .25 // == 0
    this.directSoundAOutputRatio = .5 // == 0
    this.directSoundBOutputRatio = .5 // == 0

    this.numChannelsEnabled = 0;

    this.enable = false;
    
    let ioregion = mmu.getMemoryRegion("IOREGISTERS");
    let soundEnable = ioregion.getIOReg("SOUNDCNT_X");
    let DMGSoundOutputControl = ioregion.getIOReg("SOUNDCNT_L");
    let directSoundOutputControl = ioregion.getIOReg("SOUNDCNT_H");

    soundEnable.addCallback((SOUNDCNTXVal) => { 
        this.updateREGSOUNDCNTX(SOUNDCNTXVal);
    });
    DMGSoundOutputControl.addCallback(SOUNDCNTLVal => {
        this.updateREGSOUNDCNTL(SOUNDCNTLVal);
    });
    directSoundOutputControl.addCallback((REGSOUNDCNTHVal) => { 
        this.updateREGSOUNDCNTH(REGSOUNDCNTHVal);
    });



    //channels
    this.squareChannel1 = new squareChannel(ioregion.getIOReg("SOUND1CNT_H"), ioregion.getIOReg("SOUND1CNT_X"), ioregion.getIOReg("SOUND1CNT_L"));
    this.squareChannel2 = new squareChannel(ioregion.getIOReg("SOUND2CNT_L"), ioregion.getIOReg("SOUND2CNT_H"));
    this.DACChannel3 = new DACChannel(ioregion.getIOReg("SOUND3CNT_L"), ioregion.getIOReg("SOUND3CNT_H"), ioregion.getIOReg("SOUND3CNT_X"), 
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
    this.noiseChannel4 = new noiseChannel(ioregion.getIOReg("SOUND4CNT_L"), ioregion.getIOReg("SOUND4CNT_H"));
    //direct sound A
    this.directSoundChannel5 = new directSoundChannel(timerController, ioregion.getIOReg("REG_FIFO_A"), ioregion.getIOReg("SOUNDCNT_H"), 
        IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_A_TIMER"], IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_A_TIMER"], IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_A_RESET"], IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_A_RESET"]);
    //direct sound B
    this.directSoundChannel6 = new directSoundChannel(timerController, ioregion.getIOReg("REG_FIFO_A"), ioregion.getIOReg("SOUNDCNT_H"), 
        IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_B_TIMER"], IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_B_TIMER"], IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_B_RESET"], IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_B_RESET"]);

    //actively playing
    this.currentSource = {
        stop : () => {}
    };
    this.currentSampleArr = [];
};

sound.prototype.updateREGSOUNDCNTX = function(SOUNDCNTXVal) {
    let enable = (SOUNDCNTXVal & IORegisterMasks["REG_MASTER_SOUNDSTAT_ENABLE"]) >>> IORegisterMaskShifts["REG_MASTER_SOUNDSTAT_ENABLE"];
    if (enable)
        this.start(this.enable); 
};

sound.prototype.updateREGSOUNDCNTL = function(SOUNDCNTLVal) {
    let DMGVolumeMultiplierLeft = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_LEFT_VOLUME"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_LEFT_VOLUME"];
    let DMGVolumeMultiplierRight = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_RIGHT_VOLUME"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_RIGHT_VOLUME"];

    let sound1EnableLeft = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND1_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND1_LEFT"];
    let sound1EnableRight = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND1_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND1_RIGHT"];
    let sound2EnableLeft = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND2_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND2_LEFT"];
    let sound2EnableRight = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND2_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND2_RIGHT"];
    let sound3EnableLeft = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND3_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND3_LEFT"];
    let sound3EnableRight = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND3_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND3_RIGHT"];
    let sound4EnableLeft = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND4_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND4_LEFT"];
    let sound4EnableRight = (SOUNDCNTLVal & IORegisterMasks["REG_SOUNDCNT_L_SOUND4_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_L_SOUND4_RIGHT"];

    if (DMGVolumeMultiplierLeft !== DMGVolumeMultiplierRight)
        console.log("volume multipler left different from right!");

    //just take the avg of the two for now for now
    this.DMGVolumeMultiplier = ((DMGVolumeMultiplierLeft + DMGVolumeMultiplierRight) / 2) / 7;
    this.sound1Enable = sound1EnableLeft || sound1EnableRight;
    this.sound2Enable = sound2EnableLeft || sound2EnableRight;
    this.sound3Enable = sound3EnableLeft || sound3EnableRight;
    this.sound4Enable = sound4EnableLeft || sound4EnableRight;

    this.updateNumChannelsUpdated();
}

sound.prototype.updateREGSOUNDCNTH = function(SOUNDCNTHVal) {
    this.DMGCHannelOutputRatio = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DMG_SOUND_RATIO"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DMG_SOUND_RATIO"];
    this.directSoundAOutputRatio = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_A_RATIO"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_A_RATIO"];
    this.directSoundBOutputRatio = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_B_RATIO"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_B_RATIO"];

    let directSoundAEnableLeft = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_A_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_A_LEFT"];
    let directSoundAEnableRight = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_A_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_A_RIGHT"];

    let directSoundBEnableLeft = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_B_LEFT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_B_LEFT"];
    let directSoundBEnableRight = (SOUNDCNTHVal & IORegisterMasks["REG_SOUNDCNT_H_DIRECT_SOUND_B_RIGHT"]) >>> IORegisterMaskShifts["REG_SOUNDCNT_H_DIRECT_SOUND_B_RIGHT"];

    this.sound5Enable = directSoundAEnableLeft || directSoundAEnableRight;
    this.sound6Enable = directSoundBEnableLeft || directSoundBEnableRight;

    switch (this.DMGCHannelOutputRatio)
    {
        case 0:
        case 3:
            this.DMGCHannelOutputRatio = .25;
            break;
        case 1:
            this.DMGCHannelOutputRatio = .50;
            break;
        case 2:
            this.DMGCHannelOutputRatio = 1;
            break;
    }
    this.directSoundAOutputRatio = this.directSoundAOutputRatio ? 1 : .50;
    this.directSoundBOutputRatio = this.directSoundBOutputRatio ? 1 : .50;

    this.updateNumChannelsUpdated();
}

sound.prototype.updateNumChannelsUpdated = function() {
    this.numChannelsEnabled = 0;
    if (this.sound1Enable)
        this.numChannelsEnabled ++;
    if (this.sound2Enable)
        this.numChannelsEnabled ++;
    if (this.sound3Enable)
        this.numChannelsEnabled ++;
    if (this.sound4Enable)
        this.numChannelsEnabled ++;
    if (this.sound5Enable)
        this.numChannelsEnabled ++;
    if (this.sound6Enable)
        this.numChannelsEnabled ++;
}

sound.prototype.mix = function(sound1, sound2, sound3, sound4, sound5, sound6, numChannelsEnabled) {
    return (sound1 + sound2 + sound3 + sound4 + sound5 + sound6) / numChannelsEnabled;
}

sound.prototype.getSample = function() {
    let sound1 = this.sound1Enable ? this.squareChannel1.getSample() * this.DMGCHannelOutputRatio * this.DMGVolumeMultiplier : 0;
    let sound2 = this.sound2Enable ? this.squareChannel2.getSample() * this.DMGCHannelOutputRatio * this.DMGVolumeMultiplier : 0;
    let sound3 = this.sound3Enable ? this.DACChannel3.getSample() * this.DMGCHannelOutputRatio * this.DMGVolumeMultiplier : 0;
    let sound4 = this.sound4Enable ? this.noiseChannel4.getSample() * this.DMGCHannelOutputRatio * this.DMGVolumeMultiplier : 0;
    let sound5 = this.sound5Enable ? this.directSoundChannel5.getSample() * this.directSoundAOutputRatio : 0;
    let sound6 = this.sound6Enable ? this.directSoundChannel6.getSample() * this.directSoundBOutputRatio : 0;

    let sample = this.mix(sound1, sound2, sound3, sound4, sound5, sound6, this.numChannelsEnabled);
    
    return sample;
}

//in seconds
sound.prototype.soundStartTimeElapsed = function() {
    return this.audioContext.currentTime - this.soundStart;
}

// sound.prototype.playSound = function() {
//     //get remaining samples that have yet to be played from the sound buffer being currently being played
//     let currentSoundTimeLeft = this.soundLength - this.soundStartTimeElapsed();
//     let samplesRemaining = [];
//     if (currentSoundTimeLeft > 0) {
//         let numSamplesRemaining = Math.ceil((this.currentSampleArr.length * (currentSoundTimeLeft / this.soundLength)));
//         samplesRemaining = this.currentSampleArr.slice(this.currentSampleArr.length - numSamplesRemaining , this.currentSampleArr.length);
//     }

//     //determine the playback rate, which will either slow down or speed up the next sound being played
//     //i.e. if emulator is running fast then sound will speed up else slow down
//     let expectedNumSamples = ((this.soundLength)) * this.sampleRate;
//     let actualNumSamples = this.sampleIndex + samplesRemaining.length;
//     let playbackRate = actualNumSamples / expectedNumSamples;

//     //load up new sound buffer with samples (along with the remaining samples above)
//     this.currentSampleArr = this.sampleArr.slice(0, this.sampleIndex);
//     var buffer = this.audioContext.createBuffer(1, this.sampleIndex + samplesRemaining.length, this.sampleRate);
//     var channelData = buffer.getChannelData(0);
//     channelData.set(samplesRemaining.concat(this.currentSampleArr));
        
//     //stop the currently playing sound
//     //then immediately after, load up the next buffer of samples and play it
//     this.currentSource.stop();

//     this.currentSource = this.audioContext.createBufferSource();
//     this.currentSource.buffer = buffer;
//     this.currentSource.connect(this.audioContext.destination);
//     this.currentSource.playbackRate.value = playbackRate;
//     this.currentSource.start();

//     this.soundStart = this.audioContext.currentTime;

//     //reset the sample index cause we drained it
//     this.sampleIndex = 0;
// }

sound.prototype.playSound = function() {
    //cap elapsed time, we don't want to stretch out the buffer to huge lengths if elapsed time is somehow massive (e.g. browser prioritizes another tab)
    let elapsed = Math.min(this.soundLength * 10, this.soundStartTimeElapsed());
    let expectedNumSamples = elapsed * this.sampleRate;
    let actualNumSamples = this.sampleIndex;
    let adjust = 0;
    
    //sample debt, the diff between expected vs actual
    this.sampleDebt += expectedNumSamples - actualNumSamples;

    //when past the threshold, pay down the debt
    //this usually indicates emulator is playing abnormally fast / slow
    if (Math.abs(this.sampleDebt) > this.sampleDebtThreshold) {
        adjust = this.sampleDebt;

        //cap negative adjustment to -50%, just for safety
        //if emulator ever achieves faster than 2x speed, raise this cap
        if (adjust < 0 && Math.abs(adjust) > this.sampleIndex)
            adjust = this.sampleIndex * -.5;

        this.sampleDebt -= adjust;
    }

    let samples = this.sampleArr.slice(0, this.sampleIndex);
    if (adjust !== 0)
        samples = interpolateArray(samples, samples.length + adjust);
    this.processorNode.port.postMessage(samples);

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
    this.DACChannel3.update(numCycles);
    this.noiseChannel4.update(numCycles);
    //this.directSoundChannel5.update(numCycles); //driven by timer
    //this.directSoundChannel6.update(numCycles); //driven by timer

    if (this.numCycle === this.cyclesPerSample) {
        this.numCycle = 0;
        this.sampleArr[this.sampleIndex] = this.getSample();
        this.sampleIndex ++;

        //drain the buffer once full
        if (this.sampleIndex === this.sampleArrLength)
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
    this.DACChannel3.init();
    this.noiseChannel4.init();
    this.directSoundChannel5.init();
    this.directSoundChannel6.init();
}

sound.prototype.stop = function() {
    this.enable = false;
}