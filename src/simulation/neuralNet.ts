/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stabilized in Origo functional-music phase 1.
 * This keeps the existing lightweight browser network API while preventing
 * NaN poisoning, fixing curiosity input dimensionality, and training hidden layers.
 * A dedicated continuous-control TF.js policy can replace this compatibility
 * implementation without changing the music/session contracts.
 */

import { NeuralLayer, AgentMemory } from '../types';

const EPS = 1e-6;

function finite(value: number, fallback: number = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finite(value)));
}

export class NeuralNetwork {
  public inputSize: number;
  public hiddenSizes: number[];
  public outputSize: number;
  public layers: NeuralLayer[] = [];
  public valueLayer: NeuralLayer;
  public curiosityModel: NeuralLayer;

  constructor(inputSize: number, hiddenSizes: number[] = [32, 24], outputSize: number = 5) {
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes;
    this.outputSize = outputSize;

    let prevSize = inputSize;
    for (const size of hiddenSizes) {
      this.layers.push(this.createLayer(size, prevSize));
      prevSize = size;
    }
    this.layers.push(this.createLayer(outputSize, prevSize));

    this.valueLayer = this.createLayer(1, hiddenSizes[hiddenSizes.length - 1]);
    this.curiosityModel = this.createLayer(inputSize, hiddenSizes[hiddenSizes.length - 1] + 1);
  }

  private createLayer(outputs: number, inputs: number): NeuralLayer {
    const scale = Math.sqrt(2.0 / Math.max(1, inputs));
    const weights: number[][] = [];
    const biases: number[] = [];
    for (let o = 0; o < outputs; o++) {
      const row: number[] = [];
      for (let i = 0; i < inputs; i++) row.push((Math.random() * 2 - 1) * scale);
      weights.push(row);
      biases.push((Math.random() * 2 - 1) * 0.05);
    }
    return { weights, biases };
  }

  private sanitizeVector(input: number[], size: number): number[] {
    const out = new Array(size).fill(0);
    for (let i = 0; i < size; i++) out[i] = clamp(input[i] ?? 0, -4, 4);
    return out;
  }

  public forward(inputs: number[]): {
    actionOutputs: number[];
    actionProbs: number[];
    stateValue: number;
    hiddenActivations: number[][];
  } {
    const hiddenActivations: number[][] = [];
    let current = this.sanitizeVector(inputs, this.inputSize);

    for (let l = 0; l < this.layers.length - 1; l++) {
      const layer = this.layers[l];
      const next: number[] = [];
      for (let o = 0; o < layer.weights.length; o++) {
        let sum = finite(layer.biases[o]);
        const wRow = layer.weights[o];
        for (let i = 0; i < current.length; i++) sum += finite(wRow[i]) * current[i];
        next.push(clamp(sum > 0 ? sum : sum * 0.1, -20, 20));
      }
      hiddenActivations.push(next);
      current = next;
    }

    const lastHidden = current;
    const actorLayer = this.layers[this.layers.length - 1];
    const actionOutputs: number[] = [];
    for (let o = 0; o < actorLayer.weights.length; o++) {
      let sum = finite(actorLayer.biases[o]);
      for (let i = 0; i < lastHidden.length; i++) sum += finite(actorLayer.weights[o][i]) * lastHidden[i];
      actionOutputs.push(Math.tanh(clamp(sum, -20, 20)));
    }

    const maxVal = Math.max(...actionOutputs);
    const expVals = actionOutputs.map((v) => Math.exp(clamp(v - maxVal, -20, 20)));
    const sumExp = expVals.reduce((a, b) => a + b, 0);
    const actionProbs = expVals.map((v) => v / Math.max(EPS, sumExp));

    let valueSum = finite(this.valueLayer.biases[0]);
    for (let i = 0; i < lastHidden.length; i++) valueSum += finite(this.valueLayer.weights[0][i]) * lastHidden[i];
    const stateValue = clamp(valueSum, -1000, 1000);

    return { actionOutputs, actionProbs, stateValue, hiddenActivations };
  }

  private curiosityHidden(source: number[]): number[] {
    const expectedHidden = this.hiddenSizes[this.hiddenSizes.length - 1];
    if (source.length === expectedHidden) return this.sanitizeVector(source, expectedHidden);
    const fwd = this.forward(source);
    return fwd.hiddenActivations[fwd.hiddenActivations.length - 1] || new Array(expectedHidden).fill(0);
  }

  /**
   * Accepts either the raw sensory state OR the last hidden activation.
   * The old live loop passed raw state into a hidden-state model, yielding
   * undefined multiplications and NaN rewards. This adapter makes both call
   * sites dimensionally correct.
   */
  public computeCuriosityReward(source: number[], actionIndex: number, actualNextState: number[]): number {
    const hidden = this.curiosityHidden(source);
    const combinedInput = [...hidden, clamp(actionIndex / Math.max(1, this.outputSize), 0, 1)];
    const target = this.sanitizeVector(actualNextState, this.inputSize);
    let totalError = 0;

    for (let o = 0; o < this.curiosityModel.weights.length; o++) {
      let sum = finite(this.curiosityModel.biases[o]);
      const wRow = this.curiosityModel.weights[o];
      for (let i = 0; i < combinedInput.length; i++) sum += finite(wRow[i]) * combinedInput[i];
      const predicted = Math.tanh(clamp(sum, -20, 20));
      const diff = predicted - target[o];
      totalError += diff * diff;
    }

    return clamp(totalError / Math.max(1, this.curiosityModel.weights.length), 0, 1);
  }

  public trainBatch(
    memories: AgentMemory[],
    learningRate: number = 0.005,
    gamma: number = 0.95,
    _curiosityWeight: number = 0.1,
    entropyBonus: number = 0.01
  ): { loss: number; avgTdError: number } {
    if (memories.length === 0) return { loss: 0, avgTdError: 0 };

    const lr = clamp(learningRate, 0.00001, 0.05);
    const discount = clamp(gamma, 0, 0.9999);
    let totalLoss = 0;
    let totalTdError = 0;
    let trained = 0;

    for (const mem of memories) {
      if (!Number.isFinite(mem.reward)) continue;

      const current = this.forward(mem.state);
      const next = this.forward(mem.nextState);
      const value = finite(mem.value, current.stateValue);
      const nextValue = mem.done ? 0 : next.stateValue;

      // Agent.step already puts curiosity into the stored shaped reward.
      // Do not add it a second time here.
      const targetValue = clamp(mem.reward + discount * nextValue, -100, 100);
      const tdError = clamp(targetValue - value, -20, 20);
      totalTdError += Math.abs(tdError);

      const action = Math.max(0, Math.min(this.outputSize - 1, Math.floor(mem.action || 0)));
      const chosenProb = Math.max(0.001, current.actionProbs[action] || 1 / this.outputSize);
      const entropy = -current.actionProbs.reduce((sum, p) => sum + p * Math.log(Math.max(EPS, p)), 0);
      const criticLoss = 0.5 * tdError * tdError;
      const policyLoss = -Math.log(chosenProb) * tdError - entropyBonus * entropy;
      totalLoss += finite(criticLoss + policyLoss);

      const hidden = current.hiddenActivations;
      const lastHidden = hidden[hidden.length - 1];
      if (!lastHidden) continue;

      const actorLayer = this.layers[this.layers.length - 1];
      const actorOutput = current.actionOutputs[action];
      const actorSignal = clamp(tdError * (1 - actorOutput * actorOutput), -10, 10);

      // Snapshot downstream weights for hidden gradient before updates.
      const actorWeights = [...actorLayer.weights[action]];
      const criticWeights = [...this.valueLayer.weights[0]];
      let hiddenGrad = lastHidden.map((_, i) =>
        clamp(actorWeights[i] * actorSignal + criticWeights[i] * tdError, -10, 10)
      );

      for (let i = 0; i < lastHidden.length; i++) {
        actorLayer.weights[action][i] = clamp(actorLayer.weights[action][i] + lr * actorSignal * lastHidden[i], -8, 8);
        this.valueLayer.weights[0][i] = clamp(this.valueLayer.weights[0][i] + lr * tdError * lastHidden[i], -8, 8);
      }
      actorLayer.biases[action] = clamp(actorLayer.biases[action] + lr * actorSignal, -8, 8);
      this.valueLayer.biases[0] = clamp(this.valueLayer.biases[0] + lr * tdError, -8, 8);

      // Backpropagate into all hidden layers. This was previously missing.
      for (let l = this.layers.length - 2; l >= 0; l--) {
        const layer = this.layers[l];
        const layerOut = hidden[l];
        const layerIn = l === 0 ? this.sanitizeVector(mem.state, this.inputSize) : hidden[l - 1];
        const gradAtLayer = hiddenGrad.map((g, o) => g * ((layerOut[o] ?? 0) > 0 ? 1 : 0.1));
        const gradPrev = new Array(layerIn.length).fill(0);

        for (let o = 0; o < layer.weights.length; o++) {
          const signal = clamp(gradAtLayer[o] ?? 0, -10, 10);
          const oldRow = [...layer.weights[o]];
          for (let i = 0; i < layerIn.length; i++) {
            gradPrev[i] += finite(oldRow[i]) * signal;
            layer.weights[o][i] = clamp(finite(layer.weights[o][i]) + lr * signal * layerIn[i], -8, 8);
          }
          layer.biases[o] = clamp(finite(layer.biases[o]) + lr * signal, -8, 8);
        }
        hiddenGrad = gradPrev.map((g) => clamp(g, -10, 10));
      }

      // Train curiosity predictor against the raw next sensory state.
      const combinedInput = [...lastHidden, action / Math.max(1, this.outputSize)];
      const targetNext = this.sanitizeVector(mem.nextState, this.inputSize);
      for (let o = 0; o < this.curiosityModel.weights.length; o++) {
        let predLinear = finite(this.curiosityModel.biases[o]);
        for (let i = 0; i < combinedInput.length; i++) predLinear += finite(this.curiosityModel.weights[o][i]) * combinedInput[i];
        const pred = Math.tanh(clamp(predLinear, -20, 20));
        const err = clamp(targetNext[o] - pred, -4, 4);
        const derivative = 1 - pred * pred;
        const signal = clamp(err * derivative, -4, 4);
        for (let i = 0; i < combinedInput.length; i++) {
          this.curiosityModel.weights[o][i] = clamp(
            finite(this.curiosityModel.weights[o][i]) + lr * 0.5 * signal * combinedInput[i],
            -8,
            8
          );
        }
        this.curiosityModel.biases[o] = clamp(finite(this.curiosityModel.biases[o]) + lr * 0.5 * signal, -8, 8);
      }

      trained++;
    }

    if (trained === 0) return { loss: 0, avgTdError: 0 };
    return { loss: totalLoss / trained, avgTdError: totalTdError / trained };
  }

  public clone(): NeuralNetwork {
    const copy = new NeuralNetwork(this.inputSize, this.hiddenSizes, this.outputSize);
    const copyLayer = (from: NeuralLayer, to: NeuralLayer) => {
      to.weights = from.weights.map((row) => row.map((v) => finite(v)));
      to.biases = from.biases.map((v) => finite(v));
    };
    for (let l = 0; l < this.layers.length; l++) copyLayer(this.layers[l], copy.layers[l]);
    copyLayer(this.valueLayer, copy.valueLayer);
    copyLayer(this.curiosityModel, copy.curiosityModel);
    return copy;
  }

  private mutateLayer(layer: NeuralLayer, mutationRate: number, mutationPower: number) {
    for (let o = 0; o < layer.weights.length; o++) {
      for (let i = 0; i < layer.weights[o].length; i++) {
        if (Math.random() < mutationRate) {
          layer.weights[o][i] = clamp(finite(layer.weights[o][i]) + (Math.random() * 2 - 1) * mutationPower, -8, 8);
        }
      }
      if (Math.random() < mutationRate) {
        layer.biases[o] = clamp(finite(layer.biases[o]) + (Math.random() * 2 - 1) * mutationPower, -8, 8);
      }
    }
  }

  public mutate(mutationRate: number = 0.08, mutationPower: number = 0.15): void {
    const rate = clamp(mutationRate, 0, 1);
    const power = clamp(mutationPower, 0, 2);
    for (const layer of this.layers) this.mutateLayer(layer, rate, power);
    this.mutateLayer(this.valueLayer, rate, power * 0.5);
    this.mutateLayer(this.curiosityModel, rate, power * 0.5);
  }

  public crossover(partner: NeuralNetwork): NeuralNetwork {
    const child = this.clone();
    const mix = (a: NeuralLayer, b: NeuralLayer, out: NeuralLayer) => {
      for (let o = 0; o < out.weights.length; o++) {
        for (let i = 0; i < out.weights[o].length; i++) {
          if (Math.random() > 0.5) out.weights[o][i] = finite(b.weights[o]?.[i], a.weights[o]?.[i] ?? 0);
        }
        if (Math.random() > 0.5) out.biases[o] = finite(b.biases[o], a.biases[o] ?? 0);
      }
    };
    for (let l = 0; l < child.layers.length; l++) mix(this.layers[l], partner.layers[l], child.layers[l]);
    mix(this.valueLayer, partner.valueLayer, child.valueLayer);
    mix(this.curiosityModel, partner.curiosityModel, child.curiosityModel);
    return child;
  }
}
