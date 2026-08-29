const TAU = Math.PI * 2;

export interface TrainMetrics {
  update: number;
  episodes: number;
  batchSuccess: number;
  batchReward: number;
  successOn: number;
  successOff: number;
  leftHz: number;
  rightHz: number;
  signalGapHz: number;
  senderEntropy: number;
  receiverEntropy: number;
}

interface Sample {
  obs: number[];
  raw: number;
  oldLogProb: number;
  advantage: number;
}

interface ValueRow {
  obs: number[];
  reward: number;
}

export class SeededRandom {
  private state: number;
  private spare: number | null = null;

  constructor(seed = 302) {
    this.state = (seed >>> 0) || 1;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  normal(): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return value;
    }
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    const magnitude = Math.sqrt(-2 * Math.log(u));
    this.spare = magnitude * Math.sin(TAU * v);
    return magnitude * Math.cos(TAU * v);
  }

  binaryState(): -1 | 1 {
    return this.next() < 0.5 ? -1 : 1;
  }
}

class GaussianPolicy {
  private weights: number[];
  private bias = 0;
  private logStd = -0.7;

  constructor(private inputDim: number, rng: SeededRandom) {
    this.weights = Array.from({ length: inputDim }, () => rng.normal() * 0.08);
  }

  mean(obs: number[]): number {
    let value = this.bias;
    for (let i = 0; i < this.inputDim; i++) value += this.weights[i] * obs[i];
    return value;
  }

  private logProbability(obs: number[], raw: number): number {
    const mean = this.mean(obs);
    const std = Math.exp(this.logStd);
    const z = (raw - mean) / std;
    return -0.5 * z * z - this.logStd - 0.5 * Math.log(TAU);
  }

  sample(obs: number[], rng: SeededRandom) {
    const mean = this.mean(obs);
    const std = Math.exp(this.logStd);
    const raw = mean + std * rng.normal();
    return {
      raw,
      action: Math.tanh(raw),
      logProb: this.logProbability(obs, raw),
    };
  }

  updatePpo(samples: Sample[], learningRate = 0.05, clip = 0.2, epochs = 4) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradWeights = Array(this.inputDim).fill(0) as number[];
      let gradBias = 0;
      let gradLogStd = 0;
      let used = 0;

      for (const sample of samples) {
        const mean = this.mean(sample.obs);
        const std = Math.exp(this.logStd);
        const newLogProb = this.logProbability(sample.obs, sample.raw);
        const ratio = Math.exp(Math.max(-10, Math.min(10, newLogProb - sample.oldLogProb)));
        const clipped =
          (sample.advantage >= 0 && ratio > 1 + clip) ||
          (sample.advantage < 0 && ratio < 1 - clip);
        if (clipped) continue;

        const coefficient = sample.advantage * ratio;
        const delta = sample.raw - mean;
        const variance = std * std;
        const dMean = delta / variance;
        const dLogStd = (delta * delta) / variance - 1;

        for (let i = 0; i < this.inputDim; i++) {
          gradWeights[i] += coefficient * dMean * sample.obs[i];
        }
        gradBias += coefficient * dMean;
        gradLogStd += coefficient * dLogStd;
        used++;
      }

      if (used === 0) continue;
      for (let i = 0; i < this.inputDim; i++) {
        this.weights[i] += (learningRate * gradWeights[i]) / used;
      }
      this.bias += (learningRate * gradBias) / used;
      this.logStd = Math.max(-2.5, Math.min(0, this.logStd + (learningRate * gradLogStd) / used));
    }
  }

  entropy(): number {
    return this.logStd + 0.5 * Math.log(TAU * Math.E);
  }
}

class LinearValue {
  private weights: number[];
  private bias = 0;

  constructor(private inputDim: number) {
    this.weights = Array(inputDim).fill(0) as number[];
  }

  predict(obs: number[]): number {
    let value = this.bias;
    for (let i = 0; i < this.inputDim; i++) value += this.weights[i] * obs[i];
    return value;
  }

  update(rows: ValueRow[], learningRate = 0.08, epochs = 3) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradWeights = Array(this.inputDim).fill(0) as number[];
      let gradBias = 0;
      for (const row of rows) {
        const error = row.reward - this.predict(row.obs);
        for (let i = 0; i < this.inputDim; i++) gradWeights[i] += error * row.obs[i];
        gradBias += error;
      }
      for (let i = 0; i < this.inputDim; i++) {
        this.weights[i] += (learningRate * gradWeights[i]) / rows.length;
      }
      this.bias += (learningRate * gradBias) / rows.length;
    }
  }
}

export class CommunicationEngine {
  private rng: SeededRandom;
  private sender: GaussianPolicy;
  private receiver: GaussianPolicy;
  private senderValue = new LinearValue(1);
  private receiverValue = new LinearValue(1);
  private updateCount = 0;
  private episodeCount = 0;
  private lastBatchSuccess = 0.5;
  private lastBatchReward = 0;

  constructor(public readonly seed = 302) {
    this.rng = new SeededRandom(seed);
    this.sender = new GaussianPolicy(1, this.rng);
    this.receiver = new GaussianPolicy(1, this.rng);
  }

  private toHz(normalized: number): number {
    return 120 + ((normalized + 1) / 2) * 1080;
  }

  trainBatch(count = 512): TrainMetrics {
    const senderSamples: Sample[] = [];
    const receiverSamples: Sample[] = [];
    const senderValues: ValueRow[] = [];
    const receiverValues: ValueRow[] = [];
    let wins = 0;
    let rewardSum = 0;

    for (let i = 0; i < count; i++) {
      const hiddenState = this.rng.binaryState();
      const senderObs = [hiddenState];
      const signal = this.sender.sample(senderObs, this.rng);

      // Continuous acoustic value plus physical noise. No symbolic message ID,
      // note, scale, human example, or supplied target mapping exists here.
      const received = Math.max(-1, Math.min(1, signal.action + this.rng.normal() * 0.02));
      const receiverObs = [received];
      const response = this.receiver.sample(receiverObs, this.rng);
      const choice: -1 | 1 = response.action < 0 ? -1 : 1;
      const reward = choice === hiddenState ? 1 : -1;

      if (choice === hiddenState) wins++;
      rewardSum += reward;

      senderSamples.push({
        obs: senderObs,
        raw: signal.raw,
        oldLogProb: signal.logProb,
        advantage: reward - this.senderValue.predict(senderObs),
      });
      receiverSamples.push({
        obs: receiverObs,
        raw: response.raw,
        oldLogProb: response.logProb,
        advantage: reward - this.receiverValue.predict(receiverObs),
      });
      senderValues.push({ obs: senderObs, reward });
      receiverValues.push({ obs: receiverObs, reward });
    }

    this.sender.updatePpo(senderSamples);
    this.receiver.updatePpo(receiverSamples);
    this.senderValue.update(senderValues);
    this.receiverValue.update(receiverValues);

    this.updateCount++;
    this.episodeCount += count;
    this.lastBatchSuccess = wins / count;
    this.lastBatchReward = rewardSum / count;
    return this.metrics();
  }

  metrics(): TrainMetrics {
    const evalRng = new SeededRandom((this.seed ^ (this.updateCount * 2654435761)) >>> 0);
    const samples = 1000;
    let successOn = 0;
    let successOff = 0;

    for (let i = 0; i < samples; i++) {
      const hiddenState = evalRng.binaryState();
      const senderObs = [hiddenState];
      const signal = this.sender.sample(senderObs, evalRng);
      const received = Math.max(-1, Math.min(1, signal.action + evalRng.normal() * 0.02));

      const onChoice: -1 | 1 = this.receiver.sample([received], evalRng).action < 0 ? -1 : 1;
      const offChoice: -1 | 1 = this.receiver.sample([0], evalRng).action < 0 ? -1 : 1;
      if (onChoice === hiddenState) successOn++;
      if (offChoice === hiddenState) successOff++;
    }

    const leftSignal = Math.tanh(this.sender.mean([-1]));
    const rightSignal = Math.tanh(this.sender.mean([1]));
    const leftHz = this.toHz(leftSignal);
    const rightHz = this.toHz(rightSignal);

    return {
      update: this.updateCount,
      episodes: this.episodeCount,
      batchSuccess: this.lastBatchSuccess,
      batchReward: this.lastBatchReward,
      successOn: successOn / samples,
      successOff: successOff / samples,
      leftHz,
      rightHz,
      signalGapHz: Math.abs(leftHz - rightHz),
      senderEntropy: this.sender.entropy(),
      receiverEntropy: this.receiver.entropy(),
    };
  }

  demo(channelEnabled = true) {
    const hiddenState = this.rng.binaryState();
    const signalNorm = Math.tanh(this.sender.mean([hiddenState]));
    const signalHz = this.toHz(signalNorm);
    const received = channelEnabled ? signalNorm : 0;
    const response = Math.tanh(this.receiver.mean([received]));
    const choice: -1 | 1 = response < 0 ? -1 : 1;
    return {
      hiddenState,
      signalHz,
      choice,
      correct: choice === hiddenState,
    };
  }
}
