/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NeuralLayer, AgentMemory } from '../types';

export class NeuralNetwork {
  public inputSize: number;
  public hiddenSizes: number[];
  public outputSize: number;
  public layers: NeuralLayer[] = [];

  // Value head layer (Actor-Critic architecture)
  public valueLayer: NeuralLayer;

  // Curiosity Forward Dynamics Model (predicts next state features)
  public curiosityModel: NeuralLayer;

  constructor(inputSize: number, hiddenSizes: number[] = [32, 24], outputSize: number = 5) {
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes;
    this.outputSize = outputSize;

    // Build Actor Hidden Layers
    let prevSize = inputSize;
    for (const size of hiddenSizes) {
      this.layers.push(this.createLayer(size, prevSize));
      prevSize = size;
    }
    // Actor Output Layer
    this.layers.push(this.createLayer(outputSize, prevSize));

    // Critic Value Head (from last hidden layer to 1 scalar)
    this.valueLayer = this.createLayer(1, hiddenSizes[hiddenSizes.length - 1]);

    // Curiosity Predictor: (Hidden State + Action -> Input Size)
    this.curiosityModel = this.createLayer(inputSize, hiddenSizes[hiddenSizes.length - 1] + 1);
  }

  private createLayer(outputs: number, inputs: number): NeuralLayer {
    // He / Xavier initialization
    const scale = Math.sqrt(2.0 / inputs);
    const weights: number[][] = [];
    const biases: number[] = [];

    for (let o = 0; o < outputs; o++) {
      const row: number[] = [];
      for (let i = 0; i < inputs; i++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      weights.push(row);
      biases.push((Math.random() * 2 - 1) * 0.05);
    }

    return { weights, biases };
  }

  /**
   * Forward pass through the neural network.
   * Returns:
   *  - actionProbs / actionValues
   *  - stateValue (Critic V(s))
   *  - hiddenActivations for inspection & backprop
   */
  public forward(inputs: number[]): {
    actionOutputs: number[];
    actionProbs: number[];
    stateValue: number;
    hiddenActivations: number[][];
  } {
    const hiddenActivations: number[][] = [];
    let current = inputs;

    // Hidden layers with Leaky ReLU
    for (let l = 0; l < this.layers.length - 1; l++) {
      const layer = this.layers[l];
      const next: number[] = [];

      for (let o = 0; o < layer.weights.length; o++) {
        let sum = layer.biases[o];
        const wRow = layer.weights[o];
        for (let i = 0; i < current.length; i++) {
          sum += wRow[i] * current[i];
        }
        // Leaky ReLU
        next.push(sum > 0 ? sum : sum * 0.1);
      }

      hiddenActivations.push(next);
      current = next;
    }

    const lastHidden = current;

    // Actor Output Head (Tanh for continuous motor controls [-1, 1], Sigmoid for trigger probabilities)
    const actorLayer = this.layers[this.layers.length - 1];
    const actionOutputs: number[] = [];

    for (let o = 0; o < actorLayer.weights.length; o++) {
      let sum = actorLayer.biases[o];
      const wRow = actorLayer.weights[o];
      for (let i = 0; i < lastHidden.length; i++) {
        sum += wRow[i] * lastHidden[i];
      }
      // Tanh for continuous thrust/steer/terraform
      actionOutputs.push(Math.tanh(sum));
    }

    // Softmax probabilities for discrete selection/entropy calculations
    const maxVal = Math.max(...actionOutputs);
    const expVals = actionOutputs.map((v) => Math.exp(v - maxVal));
    const sumExp = expVals.reduce((a, b) => a + b, 0);
    const actionProbs = expVals.map((v) => (sumExp > 0 ? v / sumExp : 1 / expVals.length));

    // Critic Value Head
    let valueSum = this.valueLayer.biases[0];
    for (let i = 0; i < lastHidden.length; i++) {
      valueSum += this.valueLayer.weights[0][i] * lastHidden[i];
    }
    const stateValue = valueSum; // linear value estimate

    return { actionOutputs, actionProbs, stateValue, hiddenActivations };
  }

  /**
   * Intrinsic Curiosity: Predict next state from current hidden state + action
   * Returns prediction error (Curiosity reward)
   */
  public computeCuriosityReward(lastHidden: number[], actionIndex: number, actualNextState: number[]): number {
    const combinedInput = [...lastHidden, actionIndex / 5.0];
    let totalError = 0;

    for (let o = 0; o < this.curiosityModel.weights.length; o++) {
      let sum = this.curiosityModel.biases[o];
      const wRow = this.curiosityModel.weights[o];
      for (let i = 0; i < combinedInput.length; i++) {
        sum += wRow[i] * combinedInput[i];
      }
      const predictedFeature = Math.tanh(sum);
      const actualVal = actualNextState[o] || 0;
      const diff = predictedFeature - actualVal;
      totalError += diff * diff;
    }

    return Math.min(1.0, totalError / this.curiosityModel.weights.length);
  }

  /**
   * Perform pure Actor-Critic Reinforcement Learning update on a batch of transition memories
   */
  public trainBatch(
    memories: AgentMemory[],
    learningRate: number = 0.005,
    gamma: number = 0.95,
    curiosityWeight: number = 0.1,
    entropyBonus: number = 0.01
  ): { loss: number; avgTdError: number } {
    if (memories.length === 0) return { loss: 0, avgTdError: 0 };

    let totalLoss = 0;
    let totalTdError = 0;

    for (const mem of memories) {
      const { state, action, actionProbs, reward, value, nextState, done } = mem;

      // 1. Evaluate next state value
      const nextForward = this.forward(nextState);
      const nextValue = done ? 0 : nextForward.stateValue;

      // 2. Intrinsic Curiosity bonus
      const curForward = this.forward(state);
      const curiosityReward = this.computeCuriosityReward(
        curForward.hiddenActivations[curForward.hiddenActivations.length - 1],
        action,
        nextState
      );
      const totalCombinedReward = reward + curiosityReward * curiosityWeight;

      // 3. Temporal Difference (TD) Error / Advantage
      // delta = R + gamma * V(s') - V(s)
      const targetValue = totalCombinedReward + gamma * nextValue;
      const tdError = targetValue - value;
      totalTdError += Math.abs(tdError);

      // 4. Value Loss (Critic): 0.5 * (V(s) - Target)^2
      const criticLoss = 0.5 * tdError * tdError;

      // 5. Policy Loss (Actor): -log(prob) * Advantage - entropy
      const chosenProb = Math.max(0.001, actionProbs[action] || 0.2);
      const policyLoss = -Math.log(chosenProb) * tdError;

      totalLoss += criticLoss + policyLoss;

      // 6. Gradient Backpropagation Step (Analytical weight adjustment)
      const lastHidden = curForward.hiddenActivations[curForward.hiddenActivations.length - 1];

      // Update Critic weights: dLoss/dW = -tdError * lastHidden[i]
      for (let i = 0; i < lastHidden.length; i++) {
        this.valueLayer.weights[0][i] += learningRate * tdError * lastHidden[i];
      }
      this.valueLayer.biases[0] += learningRate * tdError;

      // Update Actor weights for selected action head
      const actorLayer = this.layers[this.layers.length - 1];
      const targetActionIdx = action % actorLayer.weights.length;
      const actorGrad = tdError * (1 - curForward.actionOutputs[targetActionIdx] ** 2); // tanh derivative

      for (let i = 0; i < lastHidden.length; i++) {
        actorLayer.weights[targetActionIdx][i] += learningRate * actorGrad * lastHidden[i];
      }
      actorLayer.biases[targetActionIdx] += learningRate * actorGrad;

      // Update Curiosity Model weights (minimize forward prediction error)
      const combinedInput = [...lastHidden, action / 5.0];
      for (let o = 0; o < this.curiosityModel.weights.length; o++) {
        let pred = this.curiosityModel.biases[o];
        for (let i = 0; i < combinedInput.length; i++) {
          pred += this.curiosityModel.weights[o][i] * combinedInput[i];
        }
        const predErr = (nextState[o] || 0) - Math.tanh(pred);
        for (let i = 0; i < combinedInput.length; i++) {
          this.curiosityModel.weights[o][i] += learningRate * 0.5 * predErr * combinedInput[i];
        }
        this.curiosityModel.biases[o] += learningRate * 0.5 * predErr;
      }
    }

    return {
      loss: totalLoss / memories.length,
      avgTdError: totalTdError / memories.length,
    };
  }

  /**
   * Clone neural network weights
   */
  public clone(): NeuralNetwork {
    const copy = new NeuralNetwork(this.inputSize, this.hiddenSizes, this.outputSize);

    for (let l = 0; l < this.layers.length; l++) {
      for (let o = 0; o < this.layers[l].weights.length; o++) {
        copy.layers[l].weights[o] = [...this.layers[l].weights[o]];
      }
      copy.layers[l].biases = [...this.layers[l].biases];
    }

    copy.valueLayer.weights[0] = [...this.valueLayer.weights[0]];
    copy.valueLayer.biases = [...this.valueLayer.biases];

    for (let o = 0; o < this.curiosityModel.weights.length; o++) {
      copy.curiosityModel.weights[o] = [...this.curiosityModel.weights[o]];
    }
    copy.curiosityModel.biases = [...this.curiosityModel.biases];

    return copy;
  }

  /**
   * Crossover & Mutation for Evolutionary Self-Play population replenishment
   */
  public mutate(mutationRate: number = 0.08, mutationPower: number = 0.15): void {
    for (const layer of this.layers) {
      for (let o = 0; o < layer.weights.length; o++) {
        for (let i = 0; i < layer.weights[o].length; i++) {
          if (Math.random() < mutationRate) {
            layer.weights[o][i] += (Math.random() * 2 - 1) * mutationPower;
          }
        }
        if (Math.random() < mutationRate) {
          layer.biases[o] += (Math.random() * 2 - 1) * mutationPower;
        }
      }
    }
  }

  public crossover(partner: NeuralNetwork): NeuralNetwork {
    const child = this.clone();
    for (let l = 0; l < this.layers.length; l++) {
      for (let o = 0; o < this.layers[l].weights.length; o++) {
        for (let i = 0; i < this.layers[l].weights[o].length; i++) {
          if (Math.random() > 0.5) {
            child.layers[l].weights[o][i] = partner.layers[l].weights[o][i];
          }
        }
      }
    }
    return child;
  }
}
