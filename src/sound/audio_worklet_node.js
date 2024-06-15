/******************
    helper class
******************/
const crappyFIFOQueue = function(bufferLen) {
	this.arr = new Float64Array(bufferLen);
	this.headIndex = this.arr.length - 1;
	this.tailIndex = this.headIndex; //next insertion index
	this.length = 0;
}


crappyFIFOQueue.prototype.push = function(val) {
	this.arr[this.tailIndex] = val;
	this.length ++;
	
	this.tailIndex --;

	//if we've run out of space, move everything to the end of the buffer
	if (this.tailIndex === 0) {
		this.reset();
	}
};

crappyFIFOQueue.prototype.pop = function() {
	if (this.length === 0)
		throw new Error("shouldnt be popping");

	let poppedVal = this.arr[this.headIndex];
	
	this.headIndex --;
	this.length --;

	return poppedVal;
}

crappyFIFOQueue.prototype.pushMulti = function(vals) {
	//if we've run out of space, move everything to the end of the buffer
	if (vals.length >= this.tailIndex) {
		console.log("reset");
		this.reset();
	}

	for (let i = 0; i < vals.length; i ++)
	{		
		this.arr[this.tailIndex] = vals[i];
		this.length ++;
		this.tailIndex --;

	}
};

crappyFIFOQueue.prototype.popMulti = function(num) {
	if (num > this.length)
		throw new Error("shouldnt be popping");

	let poppedVals = this.arr.slice(this.headIndex + 1 - num, this.headIndex + 1).reverse();
	
	this.headIndex -= num;
	this.length -= num;

	return poppedVals;
};

crappyFIFOQueue.prototype.reset = function() {
	//if we've run out of space, move everything to the end of the buffer
	for (let i = this.tailIndex; i < (this.tailIndex + this.length); i++)
	{
		let endIndex = this.arr.length - 1 - i;
		this.arr[endIndex] = this.arr[i];
	}
	
	let diff = this.headIndex - this.tailIndex;

	this.headIndex = this.arr.length - 1;
	this.tailIndex = this.headIndex - diff;
}

crappyFIFOQueue.prototype.clear = function() {
	this.reset();
	this.length = 0;
	this.tailIndex --;
	this.headIndex = this.tailIndex;
}
/******************
******************/



class GBAAudioWorkletNode extends AudioWorkletProcessor {
  constructor() {
    super();
	this.emptySamples = new Array(128).fill(0);
    this.fifo = new crappyFIFOQueue(500000);
	//this determines the max amount of samples left in the fifo before pushing new ones. 
	//i.e. the maximum possible delay (in samples) before the playing of a batch of new samples
	//this is to ensure that we remove built up latency caused by emulator running slow then fast
	this.maxDelaySamples = 4096;
    this.port.onmessage = this.onmessage;
  }

  onmessage = (e) => {
	if (this.fifo.length > this.maxDelaySamples) {
		let excessSamples = this.fifo.length - this.maxDelaySamples;
		this.fifo.popMulti(excessSamples);
	}

    this.fifo.pushMulti(e.data);
  }

  process(inputList, outputList, parameters) {
    const sourceLimit = Math.min(inputList.length, outputList.length);
    let samples = this.emptySamples;
    if (this.fifo.length >= 128)
        samples = this.fifo.popMulti(128); //audio worklet nodes processes 128 samples at a time
	// else
	// 	console.log(":/")

    for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
      let input = inputList[inputNum];
      let output = outputList[inputNum];
      let channelCount = Math.min(input.length, output.length);


      for (let channel = 0; channel < channelCount; channel++) {
        let sampleCount = input[channel].length;

        for (let i = 0; i < sampleCount; i++)
           output[channel][i] = samples[i];
      }
    }
    return true;
  }
}

registerProcessor("audio_worklet_node", GBAAudioWorkletNode);