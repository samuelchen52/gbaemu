
const sound = function(mmu) {

    window.sound = this;

    //sound api stuff
    this.audioContext = new AudioContext();
    // let audioBuffer = audioContext.createBuffer(1, 32768, 32768);
    // this.source = audioContext.createBufferSource();
    // this.source.buffer = audioBuffer;
    // this.source.connect(audioContext.destination);

    this.numCycle2 = 0;


    this.numCycle = 0;
    this.cyclesPerSample = 512; //gba runs at 16mm hz, this means around 32k sampling rate
    this.sampleIndex = 0;
    this.sampleArrLength = 4096; //32768 * 2
    this.sampleRate = 32768;
    this.sampleArr = new Array(this.sampleArrLength) //audioBuffer.getChannelData(0);
    this.soundStart;
    //this.soundLength = (.75 * this.sampleArrLength) / this.sampleRate; // in seconds, this will basically dictate how much time will pass before we drain the sample buffer i.e. latency
    this.soundLength = this.sampleArrLength / this.sampleRate; // in seconds, this will basically dictate how much time will pass before we drain the sample buffer i.e. latency
    this.soundFinished = false;

    this.enable = false;
    
    let ioregion = mmu.getMemoryRegion("IOREGISTERS");
    let soundEnable = ioregion.getIOReg("SOUNDCNT_X");

    soundEnable.addCallback((soundEnableVal) => { 
        this.enable = (soundEnableVal & IORegisterMasks["REG_MASTER_SOUNDSTAT_ENABLE"]) >>> IORegisterMaskShifts["REG_MASTER_SOUNDSTAT_ENABLE"];
        this.start(this.enable); 
    });

    this.squareChannel1 = new squareChannel(ioregion.getIOReg("SOUND1CNT_H"), ioregion.getIOReg("SOUND1CNT_X"), ioregion.getIOReg("SOUND1CNT_L"));
    this.squareChannel2 = new squareChannel(ioregion.getIOReg("SOUND2CNT_L"), ioregion.getIOReg("SOUND2CNT_H"));

    // // Define PCM data (this is just an example, replace it with your actual PCM data)
    // const pcmData = generateSineWave(samples, frequency, 32768);

    // // Create an AudioBuffer to hold the PCM data
    // const audioBuffer = audioContext.createBuffer(1, pcmData.length, 32768);

    // // Fill the AudioBuffer with the PCM data
    // const channelData = audioBuffer.getChannelData(0);
    // for (let i = 0; i < pcmData.length; i++) {
    //     channelData[i] = pcmData[i];
    // }

    // // Create an AudioBufferSourceNode
    // const source = audioContext.createBufferSource();
    // source.buffer = audioBuffer;

    // // Connect the AudioBufferSourceNode to the AudioContext's destination (e.g., speakers)
    // source.connect(audioContext.destination);

    // // Start playing the audio
    // source.start();
    
    //sound channels 1 - 6


    //actively playing
    this.currentSource = {
        stop : () => {}
    };
    this.currentSampleArr = [];
};

sound.prototype.mix = function(sound1, sound2) {
    return sound1 + sound2;
}

sound.prototype.getSample = function() {
    let sound1 = this.squareChannel1.getSample();
    let sound2 = this.squareChannel2.getSample();
    // let sound3 = this.channel1.getSample();
    // let sound4 = this.channel1.getSample();
    // let sound5 = this.channel1.getSample();
    // let sound6 = this.channel1.getSample();

    let res = this.mix(sound1, sound2);

    if (isNaN(res))
        4 + 2;
    return res;

    //return this.mix(sound1, sound2, sound3, sound4, sound5, sound6);
}

//in seconds
sound.prototype.soundStartTimeElapsed = function() {
    return this.audioContext.currentTime - this.soundStart;
}

sound.prototype.playSound = function() {
    //this.numCycle2 = 0;
    //return;
    //console.log(this.sampleArr.map(x => "" + x).join("\n"));
    // let sum = 0;
    // this.sampleArr.forEach(x => sum += x);
    // console.log(sum);

    // let someSound = [];
    // for (let i = 0; i < 32768; i ++)
    // {
    //     if (i % 512 < (512 /2))
    //         someSound.push(-.5);
    //     else
    //         someSound.push(.5);
    // }

    // let expectedNumSamples = ((this.audioContext.currentTime - this.soundStart)) * this.sampleRate;
    // let actualNumSamples = this.sampleIndex + 1;
    // let playbackRate = actualNumSamples / expectedNumSamples;

    //get remaining samples
    let currentSoundTimeLeft = this.soundLength - this.soundStartTimeElapsed();
    let samplesRemaining = [];
    if (currentSoundTimeLeft > 0) {
        let numSamplesRemaining = Math.ceil((this.currentSampleArr.length * (currentSoundTimeLeft / this.soundLength)));
        samplesRemaining = this.currentSampleArr.slice(this.currentSampleArr.length - numSamplesRemaining , this.currentSampleArr.length);
    }


    let expectedNumSamples = ((this.soundLength)) * this.sampleRate;
    let actualNumSamples = this.sampleIndex + samplesRemaining.length;
    let playbackRate;
    // if (Math.abs(actualNumSamples - expectedNumSamples) > actualNumSamples / 2)
    //     playbackRate = actualNumSamples / expectedNumSamples;
    // else
        playbackRate = actualNumSamples / expectedNumSamples;
    //playbackRate = 1;
    //playbackRate = .80;

    //let playbackRate = 1;

    //  if (this.sampleArr.find(x => x > 0)) {
    //     console.log(this.sampleIndex + 1);
    // }
    if (this.sampleArr.find(x => x > 0)) {
        console.log(samplesRemaining.length);

        console.log("sound begin: " + (this.audioContext.currentTime)); 
        //console.log("num samples generated: " + (this.sampleIndex + 1));
        console.log("expected numSamples: " + expectedNumSamples);
        console.log("actual numSamples: " + actualNumSamples);
        console.log("playback rate: " + playbackRate);
        console.log("")
    }

    this.currentSampleArr = this.sampleArr.slice(0, this.sampleIndex);

    try {

    var buffer = this.audioContext.createBuffer(1, this.sampleIndex + samplesRemaining.length, this.sampleRate);
    var channelData = buffer.getChannelData(0);

        channelData.set(samplesRemaining.concat(this.currentSampleArr));
    }
    catch {
        console.log();
    }
        
        
    //kill the callback so that toggling of soundfinished flag doesnt bleed over (only happens when buffer fills up fully)
    this.currentSource.onended = null;
    this.currentSource.stop();

    //new AudioContext().createBufferSource().stop

    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.audioContext.destination);
    this.currentSource.playbackRate.value = playbackRate;
    //console.log("STARTING");
    this.currentSource.onended = () => { 
        //console.log("seconds elapsed: " + (this.audioContext.currentTime - this.soundStart)); 
        console.log("sound end: " + (this.audioContext.currentTime)); 

        this.soundFinished = true
    };
    this.currentSource.start();

    this.soundFinished = false;
    this.soundStart = this.audioContext.currentTime;

    //reset the sample index cause we drained it
        this.sampleIndex = 0;

    //source.stop(this.audioContext.currentTime + (this.sampleRate / this.sampleArrLength) / 2);

    // if (this.prevSource)
    //     this.prevSource.stop();
    // this.prevSource = source;
    // source.

}

// sound.prototype.playSound2 = function() {
//     //this.numCycle2 = 0;
//     //return;
//     //console.log(this.sampleArr.map(x => "" + x).join("\n"));
//     // let sum = 0;
//     // this.sampleArr.forEach(x => sum += x);
//     // console.log(sum);

//     // let someSound = [];
//     // for (let i = 0; i < 32768; i ++)
//     // {
//     //     if (i % 512 < (512 /2))
//     //         someSound.push(-.5);
//     //     else
//     //         someSound.push(.5);
//     // }

//     // let expectedNumSamples = ((this.audioContext.currentTime - this.soundStart)) * this.sampleRate;
//     // let actualNumSamples = this.sampleIndex + 1;
//     // let playbackRate = actualNumSamples / expectedNumSamples;

//     let expectedNumSamples = ((this.soundLength)) * this.sampleRate;
//     let actualNumSamples = this.sampleIndex;
//     let playbackRate;
//     // if (Math.abs(actualNumSamples - expectedNumSamples) > actualNumSamples / 2)
//     //     playbackRate = actualNumSamples / expectedNumSamples;
//     // else
//         playbackRate = actualNumSamples / expectedNumSamples;

//     //let playbackRate = 1;

//     //  if (this.sampleArr.find(x => x > 0)) {
//     //     console.log(this.sampleIndex + 1);
//     // }
//     if (this.sampleArr.find(x => x > 0)) {
//         console.log("sound begin: " + (this.audioContext.currentTime)); 
//         //console.log("num samples generated: " + (this.sampleIndex + 1));
//         console.log("expected numSamples: " + expectedNumSamples);
//         console.log("actual numSamples: " + actualNumSamples);
//         console.log("playback rate: " + playbackRate);
//         console.log("")
//     }

//     var buffer = this.audioContext.createBuffer(1, this.sampleIndex, this.sampleRate);
//     var channelData = buffer.getChannelData(0);
//     channelData.set(this.sampleArr.slice(0, this.sampleIndex));

//     //kill the callback so that toggling of soundfinished flag doesnt bleed over (only happens when buffer fills up fully)
//     this.currentSource.onended = null;

//     this.currentSource = this.audioContext.createBufferSource();
//     this.currentSource.buffer = buffer;
//     this.currentSource.connect(this.audioContext.destination);
//     this.currentSource.playbackRate.value = playbackRate;
//     //console.log("STARTING");
//     this.currentSource.onended = () => { 
//         //console.log("seconds elapsed: " + (this.audioContext.currentTime - this.soundStart)); 
//         console.log("sound end: " + (this.audioContext.currentTime)); 

//         this.soundFinished = true
//         setTimeout(() => {
//             this.playSound2();    
//         });
        
//     };
//     this.currentSource.start();

//     this.soundFinished = false;
//     this.soundStart = this.audioContext.currentTime;

//     //reset the sample index cause we drained it
//         //this.sampleIndex = 0;

//     //source.stop(this.audioContext.currentTime + (this.sampleRate / this.sampleArrLength) / 2);

//     // if (this.prevSource)
//     //     this.prevSource.stop();
//     // this.prevSource = source;
//     // source.

// }

//executes numCycles, returns the number of cycles before the next "event" 
sound.prototype.update = function(numCycles) {
    if (!this.enable)
        return this.cyclesPerSample;
    // this.numCycle += numCycles;

    // this.squareChannel1.update(numCycles);
    // this.squareChannel2.update(numCycles);

    // if (this.numCycle === this.cyclesPerSample) {
    //     this.numCycle = 0;
    //     this.sampleArr[this.sampleIndex] = this.getSample();

    //     this.sampleIndex ++;
    //     if (this.sampleIndex === this.sampleArrLength) {
    //         this.sampleIndex = 0;
    //         this.playSound();
    //     }

    //     //soundchannels.sample()

    // }

    // if (this.numCycle > this.cyclesPerSample)
    //     throw new Error("wtf")
    
    // //this.numCycle %= this.cyclesPerSample;
    // return this.cyclesPerSample - this.numCycle;
    this.numCycle += numCycles;

    this.squareChannel1.update(numCycles);
    this.squareChannel2.update(numCycles);

    if (this.numCycle === this.cyclesPerSample) {
        this.numCycle = 0;
        this.sampleArr[this.sampleIndex] = this.getSample();
        this.sampleIndex ++;

        //drain sound buffer
        // if (this.sampleIndex === this.sampleArrLength || this.soundFinished)
        //     this.playSound();

        //drain the buffer if it overflows or we are nearing the end of the samples being currently played
        if (this.sampleIndex === this.sampleArrLength 
            || (this.soundStartTimeElapsed() / this.soundLength) > .85)
            this.playSound();
        //else
            //this.sampleIndex ++;


        //soundchannels.sample()

    }

    if (this.numCycle > this.cyclesPerSample)
        throw new Error("wtf")
    
    //this.numCycle %= this.cyclesPerSample;
    return this.cyclesPerSample - this.numCycle;
};

sound.prototype.start = function(enable) {
    // if (enable) {
        this.soundStart = this.audioContext.currentTime;
        this.soundFinished = false;
        //for each channel, start
        this.squareChannel1.start();
        this.squareChannel2.start();
    // }
    // else {
    //     //for each channel, stop
    // }
}

//1 frame passes
//1 frame worth of samples
//play the samples
//after buffer drained (sound ends)
//three outcomes
//buffer is perfectly full (num samples matches the amount of time spent draining), play as normal
//buffer overflow, there are more samples than there should be in the time spent draining -> playback rate increase
//buffer underflow, there arent enough samples -> playback rate decrease

//doing this, should normalize to perfectly full case

//implementation
//keep an extra large buffer for holding more samples
//playsound condition is (prev sound finished, maybe init this with a jank settimeout) //and numSamples == ideal buffer length)
//init soundfinished = true
//on end, soundfinished = false (callback attached, how do we serialize this?? prob just default to set the flag to false on setstate, and let the sound get screwed up for a brief moment)
//check how many samples are in the buffer while prev samples were being drained
//if are too much, play em faster, flag gets set faster in the callback, so that next iteration is perfect buffer elength
//too little, play em slower, flag gets set slower in the callback, so that next iteration is perfect buffer elength

//in essence, if emulator running uber fast, sound is going to be sped up
//in the other direction, sound is going to be slow
//if fps is janky, this algo will tend towards ideal

//playback rate can be modified to induce slow / fast

//play after sound finished -> how do we initialize this?
//play after sound finished + num cycles -> will result in gaps if sound finishes but num cycles hasnt finished, but initialization would work fine...
//play after sound finished OR sound buffer full -> this fulfills both cases above!!!! on init, once sound buffer is full, play them (and just init sound drain time to max buff len)
//on subsequent calls, unless cpu is running really fast, will hit the sound finished condition and flow into fast / slow cases above
//if cpu is running really fast, we need to drain the buffers anyway cause we got no space, nothing we can do about it, in which case we play the sound resulting in sound overlap

//init souund start in start fn to date.now
//time elapsed = actual samples / (date.now - sound start).milliseconds * convert to numsamples = playback rate
//sample rate * seconds = ideal samples


//how do we handle sound overflow
//because the play condition will hover around full buffer, overflow will happen very frequently, especaiilly if we reduce the length of the sound buffer (latency)
//thus, we want to add a bit of leeway somehow

//what if we make the sound play fast, to make the cpu slower relatively
//this would mean less samples in the buffer,
//it would calculate that 

//sound plays
//sound finishes
//see if num samples expected vs actual
//adjust playback rate
//will tend towards initial buffer length in terms of sound length

//what we want is for it to tend towards some smaller buf length, which allows for overflow
//becaues if it tends towards initial buffer length, the playsound condition will be the buffer full condition, which means choppiness
//instead of adjust playback rate to tend towards the length of the previous sound, have it tend towards a set length (say, 75% of the buffer)
//implement some easing as well (25% of some static amount at a time, if less than that, just close the gap)
//done

//how do we remove the delay in the sound?
//double buffering
//we kind of already have a double buffering because after draining the buffer immediately starts filling up
//if we drain 


//nah, simple approach is to have the sounds overlap. need to tend the timing such that it is close to perfect, and then kill the previous sound
//this ensures that when playing the next one, we have zero gaps
//this WILL introduce artifacts if we cut off a big chunk from the previous sound, but a timing issue is much easier to solve than trying to thwart
//javascripts single threaded nature (where we are totally at the mercy of the event loop which is causing our issues)