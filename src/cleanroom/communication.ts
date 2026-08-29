import { ACOUSTIC_FEATURES, actionToPacket, receiveAcousticPacket } from './acoustics';

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface TrainMetrics {
  update: number;
  episodes: number;
  batchSuccess: number;
  batchReward: number;
  successOn: number;
  successOff: number;
  noiseStress: number;
  leftHz: number;
  rightHz: number;
  leftAmplitude: number;
  rightAmplitude: number;
  leftDurationMs: number;
  rightDurationMs: number;
  signalGapHz: number;
  mutualInformationBits: number;
  senderEntropy: number;
  receiverEntropy: number;
  approxKl: number;
  clipFraction: number;
}

export interface AblationReport {
  acousticOn: number;
  acousticOff: number;
  highNoise: number;
  frequencyOnly: number;
  samples: number;
}

interface Sample {
  obs: number[];
  raw: number[];
  oldLogProb: number;
  advantage: number;
}

interface ValueRow {
  obs: number[];
  reward: number;
}

interface PolicyState {
  inputDim: number;
  outputDim: number;
  weights: number[][];
  bias: number[];
  logStd: number[];
}

interface ValueState {
  weights: number[];
  bias: number;
}

interface RandomState {
  state: number;
  spare: number | null;
}

export interface EngineCheckpoint {
  version: 2;
  seed: number;
  updateCount: number;
  episodeCount: number;
  rng: RandomState;
  sender: PolicyState;
  receiver: PolicyState;
  senderValue: ValueState;
  receiverValue: ValueState;
  humanDataStatus: 'ZERO';
  experiment: 'hidden-state-acoustic-communication';
  createdAt: string;
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

  snapshot(): RandomState {
    return { state: this.state, spare: this.spare };
  }

  restore(snapshot: RandomState) {
    this.state = snapshot.state >>> 0;
    this.spare = snapshot.spare;
  }
}

class GaussianPolicy {
  private weights: number[][];
  private bias: number[];
  private logStd: number[];

  constructor(private inputDim: number, private outputDim: number, rng: SeededRandom) {
    this.weights = Array.from({ length: outputDim }, () =>
      Array.from({ length: inputDim }, () => rng.normal() * 0.08),
    );
    this.bias = Array(outputDim).fill(0) as number[];
    this.logStd = Array(outputDim).fill(-0.7) as number[];
  }

  mean(obs: number[]): number[] {
    return this.weights.map((row, output) => {
      let value = this.bias[output];
      for (let i = 0; i < this.inputDim; i++) value += row[i] * obs[i];
      return value;
    });
  }

  deterministic(obs: number[]): number[] {
    return this.mean(obs).map(Math.tanh);
  }

  private logProbability(obs: number[], raw: number[]): number {
    const means = this.mean(obs);
    let sum = 0;
    for (let output = 0; output < this.outputDim; output++) {
      const std = Math.exp(this.logStd[output]);
      const z = (raw[output] - means[output]) / std;
      sum += -0.5 * z * z - this.logStd[output] - 0.5 * Math.log(TAU);
    }
    return sum;
  }

  sample(obs: number[], rng: SeededRandom) {
    const means = this.mean(obs);
    const raw = means.map((mean, output) => mean + Math.exp(this.logStd[output]) * rng.normal());
    return {
      raw,
      action: raw.map(Math.tanh),
      logProb: this.logProbability(obs, raw),
    };
  }

  updatePpo(samples: Sample[], learningRate = 0.035, clip = 0.2, epochs = 4) {
    let totalKl = 0;
    let totalSeen = 0;
    let clippedCount = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradWeights = Array.from({ length: this.outputDim }, () => Array(this.inputDim).fill(0) as number[]);
      const gradBias = Array(this.outputDim).fill(0) as number[];
      const gradLogStd = Array(this.outputDim).fill(0) as number[];
      let used = 0;

      for (const sample of samples) {
        const means = this.mean(sample.obs);
        const newLogProb = this.logProbability(sample.obs, sample.raw);
        const logRatio = clamp(newLogProb - sample.oldLogProb, -10, 10);
        const ratio = Math.exp(logRatio);
        totalKl += sample.oldLogProb - newLogProb;
        totalSeen++;

        const clipped =
          (sample.advantage >= 0 && ratio > 1 + clip) ||
          (sample.advantage < 0 && ratio < 1 - clip);
        if (clipped) {
          clippedCount++;
          continue;
        }

        const coefficient = sample.advantage * ratio;
        for (let output = 0; output < this.outputDim; output++) {
          const std = Math.exp(this.logStd[output]);
          const variance = std * std;
          const delta = sample.raw[output] - means[output];
          const dMean = delta / variance;
          const dLogStd = (delta * delta) / variance - 1;
          for (let input = 0; input < this.inputDim; input++) {
            gradWeights[output][input] += coefficient * dMean * sample.obs[input];
          }
          gradBias[output] += coefficient * dMean;
          gradLogStd[output] += coefficient * dLogStd;
        }
        used++;
      }

      if (used === 0) continue;
      for (let output = 0; output < this.outputDim; output++) {
        for (let input = 0; input < this.inputDim; input++) {
          this.weights[output][input] += (learningRate * gradWeights[output][input]) / used;
        }
        this.bias[output] += (learningRate * gradBias[output]) / used;
        this.logStd[output] = clamp(this.logStd[output] + (learningRate * gradLogStd[output]) / used, -2.7, 0);
      }
    }

    return {
      approxKl: totalSeen ? totalKl / totalSeen : 0,
      clipFraction: totalSeen ? clippedCount / totalSeen : 0,
    };
  }

  entropy(): number {
    return this.logStd.reduce((sum, value) => sum + value + 0.5 * Math.log(TAU * Math.E), 0);
  }

  snapshot(): PolicyState {
    return {
      inputDim: this.inputDim,
      outputDim: this.outputDim,
      weights: this.weights.map(row => [...row]),
      bias: [...this.bias],
      logStd: [...this.logStd],
    };
  }

  restore(state: PolicyState) {
    if (state.inputDim !== this.inputDim || state.outputDim !== this.outputDim) throw new Error('Checkpoint policy shape mismatch');
    this.weights = state.weights.map(row => [...row]);
    this.bias = [...state.bias];
    this.logStd = [...state.logStd];
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

  update(rows: ValueRow[], learningRate = 0.06, epochs = 3) {
    if (!rows.length) return;
    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradWeights = Array(this.inputDim).fill(0) as number[];
      let gradBias = 0;
      for (const row of rows) {
        const error = row.reward - this.predict(row.obs);
        for (let i = 0; i < this.inputDim; i++) gradWeights[i] += error * row.obs[i];
        gradBias += error;
      }
      for (let i = 0; i < this.inputDim; i++) this.weights[i] += (learningRate * gradWeights[i]) / rows.length;
      this.bias += (learningRate * gradBias) / rows.length;
    }
  }

  snapshot(): ValueState {
    return { weights: [...this.weights], bias: this.bias };
  }

  restore(state: ValueState) {
    if (state.weights.length !== this.inputDim) throw new Error('Checkpoint value shape mismatch');
    this.weights = [...state.weights];
    this.bias = state.bias;
  }
}

function mutualInformationBinaryPairs(pairs: Array<[-1 | 1, number]>, bins = 8): number {
  const counts = Array.from({ length: 2 }, () => Array(bins).fill(0) as number[]);
  for (const [hidden, frequencyNorm] of pairs) {
    const h = hidden === -1 ? 0 : 1;
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(frequencyNorm * bins)));
    counts[h][bin]++;
  }
  const total = pairs.length || 1;
  const pH = counts.map(row => row.reduce((a, b) => a + b, 0) / total);
  const pB = Array(bins).fill(0) as number[];
  for (let b = 0; b < bins; b++) pB[b] = (counts[0][b] + counts[1][b]) / total;
  let mi = 0;
  for (let h = 0; h < 2; h++) {
    for (let b = 0; b < bins; b++) {
      const joint = counts[h][b] / total;
      if (joint > 0 && pH[h] > 0 && pB[b] > 0) mi += joint * Math.log2(joint / (pH[h] * pB[b]));
    }
  }
  return mi;
}

export class CommunicationEngine {
  private rng: SeededRandom;
  private sender: GaussianPolicy;
  private receiver: GaussianPolicy;
  private senderValue = new LinearValue(1);
  private receiverValue = new LinearValue(ACOUSTIC_FEATURES);
  private updateCount = 0;
  private episodeCount = 0;
  private lastBatchSuccess = 0.5;
  private lastBatchReward = 0;
  private lastApproxKl = 0;
  private lastClipFraction = 0;

  constructor(public readonly seed = 302) {
    this.rng = new SeededRandom(seed);
    this.sender = new GaussianPolicy(1, 3, this.rng);
    this.receiver = new GaussianPolicy(ACOUSTIC_FEATURES, 1, this.rng);
  }

  private protocol(hiddenState: -1 | 1) {
    const [frequencyControl, amplitudeControl, durationControl] = this.sender.deterministic([hiddenState]);
    return actionToPacket({ frequencyControl, amplitudeControl, durationControl });
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
      const packet = actionToPacket({
        frequencyControl: signal.action[0],
        amplitudeControl: signal.action[1],
        durationControl: signal.action[2],
      });
      const acoustic = receiveAcousticPacket(packet, 0.6, 0.5, this.rng, true);
      const receiverObs = acoustic.features;
      const response = this.receiver.sample(receiverObs, this.rng);
      const choice: -1 | 1 = response.action[0] < 0 ? -1 : 1;
      const taskReward = choice === hiddenState ? 1 : -1;
      const energyCost = 0.01 * packet.amplitude * (packet.durationSec / 0.5);
      const reward = taskReward - energyCost;

      if (choice === hiddenState) wins++;
      rewardSum += reward;

      senderSamples.push({ obs: senderObs, raw: signal.raw, oldLogProb: signal.logProb, advantage: reward - this.senderValue.predict(senderObs) });
      receiverSamples.push({ obs: receiverObs, raw: response.raw, oldLogProb: response.logProb, advantage: reward - this.receiverValue.predict(receiverObs) });
      senderValues.push({ obs: senderObs, reward });
      receiverValues.push({ obs: receiverObs, reward });
    }

    const senderStats = this.sender.updatePpo(senderSamples);
    const receiverStats = this.receiver.updatePpo(receiverSamples);
    this.senderValue.update(senderValues);
    this.receiverValue.update(receiverValues);

    this.updateCount++;
    this.episodeCount += count;
    this.lastBatchSuccess = wins / count;
    this.lastBatchReward = rewardSum / count;
    this.lastApproxKl = (senderStats.approxKl + receiverStats.approxKl) / 2;
    this.lastClipFraction = (senderStats.clipFraction + receiverStats.clipFraction) / 2;
    return this.metrics();
  }

  private evaluate(enabled: boolean, samples: number, noiseScale = 1, frequencyOnly = false) {
    const evalRng = new SeededRandom((this.seed ^ (this.updateCount * 2654435761) ^ (enabled ? 0x9e3779b9 : 0x7f4a7c15)) >>> 0);
    let wins = 0;
    const miPairs: Array<[-1 | 1, number]> = [];

    for (let i = 0; i < samples; i++) {
      const hiddenState = evalRng.binaryState();
      const packet = this.protocol(hiddenState);
      const acoustic = receiveAcousticPacket(packet, 0.6, 0.5, evalRng, enabled, noiseScale);
      const features = frequencyOnly
        ? acoustic.features.map((value, index) => (index < 8 ? value : 0))
        : acoustic.features;
      const choice: -1 | 1 = this.receiver.deterministic(features)[0] < 0 ? -1 : 1;
      if (choice === hiddenState) wins++;
      if (enabled) miPairs.push([hiddenState, clamp((packet.frequencyHz - 120) / 1080, 0, 0.999999)]);
    }

    return { success: wins / samples, mutualInformationBits: enabled ? mutualInformationBinaryPairs(miPairs) : 0 };
  }

  runAblations(samples = 2000): AblationReport {
    return {
      acousticOn: this.evaluate(true, samples).success,
      acousticOff: this.evaluate(false, samples).success,
      highNoise: this.evaluate(true, samples, 35).success,
      frequencyOnly: this.evaluate(true, samples, 1, true).success,
      samples,
    };
  }

  metrics(): TrainMetrics {
    const on = this.evaluate(true, 1000);
    const off = this.evaluate(false, 1000);
    const stress = this.evaluate(true, 1000, 35);
    const left = this.protocol(-1);
    const right = this.protocol(1);

    return {
      update: this.updateCount,
      episodes: this.episodeCount,
      batchSuccess: this.lastBatchSuccess,
      batchReward: this.lastBatchReward,
      successOn: on.success,
      successOff: off.success,
      noiseStress: stress.success,
      leftHz: left.frequencyHz,
      rightHz: right.frequencyHz,
      leftAmplitude: left.amplitude,
      rightAmplitude: right.amplitude,
      leftDurationMs: left.durationSec * 1000,
      rightDurationMs: right.durationSec * 1000,
      signalGapHz: Math.abs(left.frequencyHz - right.frequencyHz),
      mutualInformationBits: on.mutualInformationBits,
      senderEntropy: this.sender.entropy(),
      receiverEntropy: this.receiver.entropy(),
      approxKl: this.lastApproxKl,
      clipFraction: this.lastClipFraction,
    };
  }

  demo(channelEnabled = true) {
    const hiddenState = this.rng.binaryState();
    const packet = this.protocol(hiddenState);
    const acoustic = receiveAcousticPacket(packet, 0.6, 0.5, this.rng, channelEnabled);
    const response = this.receiver.deterministic(acoustic.features)[0];
    const choice: -1 | 1 = response < 0 ? -1 : 1;
    return {
      hiddenState,
      signalHz: packet.frequencyHz,
      amplitude: packet.amplitude,
      durationMs: packet.durationSec * 1000,
      receivedAmplitude: acoustic.receivedAmplitude,
      choice,
      correct: choice === hiddenState,
    };
  }

  exportCheckpoint(): EngineCheckpoint {
    return {
      version: 2,
      seed: this.seed,
      updateCount: this.updateCount,
      episodeCount: this.episodeCount,
      rng: this.rng.snapshot(),
      sender: this.sender.snapshot(),
      receiver: this.receiver.snapshot(),
      senderValue: this.senderValue.snapshot(),
      receiverValue: this.receiverValue.snapshot(),
      humanDataStatus: 'ZERO',
      experiment: 'hidden-state-acoustic-communication',
      createdAt: new Date().toISOString(),
    };
  }

  importCheckpoint(checkpoint: EngineCheckpoint) {
    if (checkpoint.version !== 2 || checkpoint.experiment !== 'hidden-state-acoustic-communication') throw new Error('Unsupported checkpoint');
    if (checkpoint.seed !== this.seed) throw new Error('Checkpoint seed does not match current run');
    this.updateCount = checkpoint.updateCount;
    this.episodeCount = checkpoint.episodeCount;
    this.rng.restore(checkpoint.rng);
    this.sender.restore(checkpoint.sender);
    this.receiver.restore(checkpoint.receiver);
    this.senderValue.restore(checkpoint.senderValue);
    this.receiverValue.restore(checkpoint.receiverValue);
  }
}
