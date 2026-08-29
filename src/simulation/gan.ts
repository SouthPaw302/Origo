/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GANMetrics, GeneratedEnvironmentData, LatentSamplePreview, NeuralLayer } from '../types';

export class EnvironmentGAN {
  public latentDim: number = 12;
  public conditionDim: number = 2; // [curriculumDifficulty, agentEntropy]
  public featureDim: number = 32; // Feature vector summarizing environment grid

  // Generator & Discriminator Neural Layers
  public gLayers: NeuralLayer[] = [];
  public dLayers: NeuralLayer[] = [];

  // Metrics & State
  public epoch: number = 0;
  public generatorLoss: number = 0.693;
  public discriminatorLoss: number = 0.693;
  public discriminatorRealScore: number = 0.5;
  public discriminatorFakeScore: number = 0.5;
  public curriculumDifficulty: number = 0.5;
  public generatedMapEntropy: number = 0.62;
  public diversityScore: number = 0.78;
  public lastAgentRegret: number = 0.5;
  public lossHistory: { step: number; gLoss: number; dLoss: number }[] = [];

  // Current active latent vector and candidate pool
  public activeLatent: number[];
  public candidateLatents: number[][] = [];
  public cachedPreviews: LatentSamplePreview[] = [];

  constructor(latentDim: number = 12) {
    this.latentDim = latentDim;
    this.activeLatent = this.sampleLatent();

    // 1. Build Generator Network: (latentDim + conditionDim) -> [48, 64, 48] -> featureDim (32 basis parameters)
    const gInputDim = this.latentDim + this.conditionDim;
    this.gLayers = [
      this.createLayer(48, gInputDim),
      this.createLayer(64, 48),
      this.createLayer(48, 64),
      this.createLayer(this.featureDim, 48),
    ];

    // 2. Build Discriminator Network: featureDim (32) -> [48, 32] -> 1 (Scalar validity score)
    this.dLayers = [
      this.createLayer(48, this.featureDim),
      this.createLayer(32, 48),
      this.createLayer(1, 32),
    ];

    // Seed candidate latent pool
    this.refreshCandidateLatents();
    this.updateLatentPreviews();
  }

  private createLayer(outputs: number, inputs: number): NeuralLayer {
    const scale = Math.sqrt(2.0 / inputs);
    const weights: number[][] = [];
    const biases: number[] = [];

    for (let o = 0; o < outputs; o++) {
      const row: number[] = [];
      for (let i = 0; i < inputs; i++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      weights.push(row);
      biases.push((Math.random() * 2 - 1) * 0.02);
    }
    return { weights, biases };
  }

  /**
   * Sample random Gaussian latent vector
   */
  public sampleLatent(): number[] {
    const z: number[] = [];
    for (let i = 0; i < this.latentDim; i++) {
      // Box-Muller transform for standard normal N(0, 1)
      const u1 = Math.max(1e-6, Math.random());
      const u2 = Math.random();
      const norm = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      z.push(norm);
    }
    return z;
  }

  /**
   * Forward pass through Generator to produce environment synthesis coefficients
   */
  public forwardGenerator(latent: number[], difficulty: number = this.curriculumDifficulty, agentEntropy: number = 0.5): number[] {
    let current = [...latent, difficulty, agentEntropy];

    for (let l = 0; l < this.gLayers.length; l++) {
      const layer = this.gLayers[l];
      const next: number[] = [];
      const isLast = l === this.gLayers.length - 1;

      for (let o = 0; o < layer.weights.length; o++) {
        let sum = layer.biases[o];
        const wRow = layer.weights[o];
        for (let i = 0; i < current.length; i++) {
          sum += wRow[i] * current[i];
        }
        // Leaky ReLU for hidden layers, Tanh for output parameters [-1, 1]
        next.push(isLast ? Math.tanh(sum) : (sum > 0 ? sum : sum * 0.1));
      }
      current = next;
    }
    return current;
  }

  /**
   * Forward pass through Discriminator to evaluate environment realism / structure
   */
  public forwardDiscriminator(features: number[]): { score: number; hiddenActivations: number[][] } {
    const hiddenActivations: number[][] = [];
    let current = features;

    for (let l = 0; l < this.dLayers.length; l++) {
      const layer = this.dLayers[l];
      const next: number[] = [];
      const isLast = l === this.dLayers.length - 1;

      for (let o = 0; o < layer.weights.length; o++) {
        let sum = layer.biases[o];
        const wRow = layer.weights[o];
        for (let i = 0; i < current.length; i++) {
          sum += wRow[i] * current[i];
        }
        if (isLast) {
          // Sigmoid for probability [0, 1]
          next.push(1 / (1 + Math.exp(-Math.max(-10, Math.min(10, sum)))));
        } else {
          next.push(sum > 0 ? sum : sum * 0.1);
        }
      }
      hiddenActivations.push(next);
      current = next;
    }

    return { score: current[0], hiddenActivations };
  }

  /**
   * Synthesize full procedural environment from GAN generator output
   */
  public generateEnvironment(
    cols: number,
    rows: number,
    width: number,
    height: number,
    latent?: number[],
    difficulty: number = this.curriculumDifficulty
  ): GeneratedEnvironmentData {
    const z = latent ?? this.activeLatent;
    this.activeLatent = z;
    const gOutputs = this.forwardGenerator(z, difficulty, this.generatedMapEntropy);

    const totalCells = cols * rows;
    const terrainMap = new Float32Array(totalCells);
    const harmonicSeedMap = new Float32Array(totalCells);

    // Extract generator parameter coefficients:
    // [0..5] Spatial wave frequencies and phases
    // [6..11] Acoustic crater & canyon parameters
    // [12..17] Harmonic resonance polarity and amplitude
    // [18..23] Ridge sharpness and roughness
    // [24..31] Crystal node distribution parameters
    const freq1 = 1.0 + Math.abs(gOutputs[0]) * 2.5;
    const freq2 = 1.8 + Math.abs(gOutputs[1]) * 3.2;
    const phase1 = gOutputs[2] * Math.PI;
    const phase2 = gOutputs[3] * Math.PI;
    const ridgeStrength = 0.3 + (gOutputs[4] + 1) * 0.4 * difficulty;
    const craterScale = 0.2 + Math.abs(gOutputs[5]) * 0.6;
    const harmonicCoeff = gOutputs[6] * 0.8;

    let minT = 999;
    let maxT = -999;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = (c / cols) * 2 - 1; // [-1, 1]
        const ny = (r / rows) * 2 - 1;
        const distCenter = Math.sqrt(nx * nx + ny * ny);

        // Multi-frequency GAN synthesis
        const wave1 = Math.sin(nx * freq1 * Math.PI + phase1) * Math.cos(ny * freq1 * Math.PI + phase2);
        const wave2 = Math.cos(nx * freq2 * 1.5 - phase2) * Math.sin(ny * freq2 * 1.5 + phase1) * 0.5;
        
        // Ridges / canyons generated by GAN
        const ridge = 1.0 - Math.abs(Math.sin((nx + ny) * 3.5 * difficulty + gOutputs[7] * 2));
        const crater = Math.exp(-Math.pow((distCenter - craterScale) * 3, 2)) * gOutputs[8];

        const rawElevation = (wave1 + wave2 + ridge * ridgeStrength + crater * 0.5 + 1.5) / 3.0;
        const idx = r * cols + c;

        terrainMap[idx] = Math.max(0.02, Math.min(0.95, rawElevation));
        if (terrainMap[idx] < minT) minT = terrainMap[idx];
        if (terrainMap[idx] > maxT) maxT = terrainMap[idx];

        // Harmonic resonance seed
        const harmVal = Math.sin(nx * 3.0 + phase1) * Math.cos(ny * 3.0 + phase2) * harmonicCoeff;
        harmonicSeedMap[idx] = Math.max(-1.0, Math.min(1.0, harmVal));
      }
    }

    // Generate procedural energy crystal node coordinates conditioned on GAN latent heads
    const nodeCount = Math.floor(10 + Math.abs(gOutputs[24]) * 8);
    const nodePlacements: { x: number; y: number; energy: number; frequency: number }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2 + (gOutputs[(25 + i) % 32] || 0);
      const rad = (0.2 + (Math.abs(gOutputs[(26 + i) % 32]) * 0.6)) * Math.min(width, height) * 0.45;
      const x = Math.max(40, Math.min(width - 40, width / 2 + Math.cos(angle) * rad));
      const y = Math.max(40, Math.min(height - 40, height / 2 + Math.sin(angle) * rad));
      const energy = 70 + Math.abs(gOutputs[(27 + i) % 32]) * 60;
      const freq = 0.15 + ((i % 8) / 8) * 0.8;
      nodePlacements.push({ x, y, energy, frequency: freq });
    }

    // Complexity score based on elevation variance and terrain entropy
    const complexityScore = Math.max(0.1, Math.min(1.0, (maxT - minT) * 1.2 + difficulty * 0.4));

    // Update candidate previews whenever main environment is synthesized
    this.updateLatentPreviews();

    return {
      terrainMap,
      harmonicSeedMap,
      nodePlacements,
      complexityScore,
      latentVector: [...z],
    };
  }

  /**
   * Refresh pool of candidate latent exploration vectors
   */
  public refreshCandidateLatents() {
    this.candidateLatents = [];
    // 1. Current active latent vector
    this.candidateLatents.push([...this.activeLatent]);

    // 2. High-curvature exploratory seed
    const zExploratory = this.sampleLatent().map((val) => val * 1.3);
    this.candidateLatents.push(zExploratory);

    // 3. Ridge & Labyrinth biased perturbation
    const zRidge = [...this.activeLatent];
    zRidge[4] = 1.8;
    zRidge[7] = 1.5;
    this.candidateLatents.push(zRidge);

    // 4. Harmonic caldera biased perturbation
    const zCaldera = [...this.activeLatent];
    zCaldera[5] = 2.0;
    zCaldera[8] = -1.6;
    this.candidateLatents.push(zCaldera);

    // 5. High-frequency acoustic spires perturbation
    const zSpires = [...this.activeLatent];
    zSpires[0] = 2.2;
    zSpires[1] = 2.8;
    zSpires[24] = 1.7;
    this.candidateLatents.push(zSpires);

    // 6. Resonance basin perturbation
    const zBasin = [...this.activeLatent];
    zBasin[6] = 1.9;
    zBasin[12] = 1.5;
    this.candidateLatents.push(zBasin);

    this.updateLatentPreviews();
  }

  /**
   * Generate 20x20 thumbnail elevation heightmaps and priority scores for all latent candidates
   */
  public updateLatentPreviews(): LatentSamplePreview[] {
    const thumbCols = 20;
    const thumbRows = 20;
    const previews: LatentSamplePreview[] = [];

    if (this.candidateLatents.length === 0) {
      this.refreshCandidateLatents();
    }

    const rawPriorityScores: number[] = [];

    for (let k = 0; k < this.candidateLatents.length; k++) {
      const z = this.candidateLatents[k];
      const gOut = this.forwardGenerator(z, this.curriculumDifficulty, this.generatedMapEntropy);

      const freq1 = 1.0 + Math.abs(gOut[0]) * 2.5;
      const freq2 = 1.8 + Math.abs(gOut[1]) * 3.2;
      const phase1 = gOut[2] * Math.PI;
      const phase2 = gOut[3] * Math.PI;
      const ridgeStrength = 0.3 + (gOut[4] + 1) * 0.4 * this.curriculumDifficulty;
      const craterScale = 0.2 + Math.abs(gOut[5]) * 0.6;
      const harmonicCoeff = gOut[6] * 0.8;

      const thumbTotal = thumbCols * thumbRows;
      const thumbData = new Array(thumbTotal);
      let minVal = 999;
      let maxVal = -999;

      for (let r = 0; r < thumbRows; r++) {
        for (let c = 0; c < thumbCols; c++) {
          const nx = (c / thumbCols) * 2 - 1;
          const ny = (r / thumbRows) * 2 - 1;
          const distCenter = Math.sqrt(nx * nx + ny * ny);

          const wave1 = Math.sin(nx * freq1 * Math.PI + phase1) * Math.cos(ny * freq1 * Math.PI + phase2);
          const wave2 = Math.cos(nx * freq2 * 1.5 - phase2) * Math.sin(ny * freq2 * 1.5 + phase1) * 0.5;
          const ridge = 1.0 - Math.abs(Math.sin((nx + ny) * 3.5 * this.curriculumDifficulty + gOut[7] * 2));
          const crater = Math.exp(-Math.pow((distCenter - craterScale) * 3, 2)) * gOut[8];

          const elevation = (wave1 + wave2 + ridge * ridgeStrength + crater * 0.5 + 1.5) / 3.0;
          const clamped = Math.max(0.02, Math.min(0.95, elevation));
          const idx = r * thumbCols + c;
          thumbData[idx] = clamped;

          if (clamped < minVal) minVal = clamped;
          if (clamped > maxVal) maxVal = clamped;
        }
      }

      // Feature extraction for Discriminator evaluation
      const thumbFloatArray = new Float32Array(thumbData);
      const features = this.extractEnvironmentFeatures(thumbFloatArray, thumbCols, thumbRows, 12);
      const discEval = this.forwardDiscriminator(features);
      const discScore = discEval.score;

      const complexity = Math.max(0.1, Math.min(1.0, (maxVal - minVal) * 1.2 + this.curriculumDifficulty * 0.4));

      // Calculate how strongly Generator prioritizes this candidate
      // Generator priority balances realism (discScore), matching difficulty, and exploratory entropy
      const rawPriority = (discScore * 0.4) + (complexity * this.curriculumDifficulty * 0.4) + (this.diversityScore * 0.2);
      rawPriorityScores.push(rawPriority);

      // Determine Archetype & Dominant Feature
      let archetype = 'Harmonic Plains';
      let dominantFeature = 'Balanced Resonance';
      if (Math.abs(gOut[5]) > 0.6 || Math.abs(gOut[8]) > 0.5) {
        archetype = 'Acoustic Caldera';
        dominantFeature = 'Resonant Basin & Craters';
      } else if (gOut[4] > 0.4 || gOut[7] > 0.4) {
        archetype = 'Ridge Labyrinth';
        dominantFeature = 'Topological Canyons';
      } else if (freq1 > 2.2 || freq2 > 3.0) {
        archetype = 'Acoustic Spires';
        dominantFeature = 'High-Frequency Contours';
      } else if (Math.abs(harmonicCoeff) > 0.5) {
        archetype = 'Harmonic Valley';
        dominantFeature = 'Standing Wave Nodes';
      } else if (this.curriculumDifficulty > 0.7) {
        archetype = 'Tectonic Faults';
        dominantFeature = 'Complex Saddle Points';
      }

      const isSampleActive = (k === 0 || this.areLatentsEqual(z, this.activeLatent));
      const nodeCount = Math.floor(8 + Math.abs(gOut[24]) * 8);

      previews.push({
        id: `latent_sample_${k}`,
        name: isSampleActive ? `Active (${archetype})` : `Candidate #${k + 1}`,
        latentVector: [...z],
        terrainThumbnail: thumbData,
        cols: thumbCols,
        rows: thumbRows,
        discriminatorScore: Math.round(discScore * 100) / 100,
        complexity: Math.round(complexity * 100) / 100,
        priorityScore: 0, // normalized below
        isActive: isSampleActive,
        archetype,
        dominantFeature,
        nodeCount,
      });
    }

    // Normalize priority scores across candidate pool [0..1]
    const maxP = Math.max(0.001, ...rawPriorityScores);
    const minP = Math.min(...rawPriorityScores);
    const rangeP = Math.max(0.001, maxP - minP);

    for (let k = 0; k < previews.length; k++) {
      previews[k].priorityScore = Math.round(((rawPriorityScores[k] - minP) / rangeP) * 100) / 100;
    }

    this.cachedPreviews = previews;
    return previews;
  }

  private areLatentsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > 0.01) return false;
    }
    return true;
  }

  /**
   * Set active latent vector and update sample previews
   */
  public setActiveLatent(latent: number[]) {
    this.activeLatent = [...latent];
    this.updateLatentPreviews();
  }

  /**
   * Extract high-level structural feature vector from an environment terrain grid for Discriminator
   */
  public extractEnvironmentFeatures(
    terrainMap: Float32Array,
    cols: number,
    rows: number,
    nodeCount: number
  ): number[] {
    const features = new Array(this.featureDim).fill(0);
    const total = cols * rows;

    let mean = 0;
    let variance = 0;
    let gradientSum = 0;

    for (let i = 0; i < total; i++) {
      mean += terrainMap[i];
    }
    mean /= Math.max(1, total);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const val = terrainMap[idx];
        variance += (val - mean) ** 2;

        if (c < cols - 1) {
          gradientSum += Math.abs(terrainMap[idx + 1] - val);
        }
        if (r < rows - 1) {
          gradientSum += Math.abs(terrainMap[idx + cols] - val);
        }
      }
    }

    variance /= Math.max(1, total);
    const avgGrad = gradientSum / Math.max(1, total * 2);

    // Populate summary feature slots
    features[0] = mean;
    features[1] = Math.sqrt(variance);
    features[2] = avgGrad;
    features[3] = nodeCount / 20.0;
    features[4] = this.curriculumDifficulty;

    // Sub-region elevation distributions
    for (let b = 0; b < 16; b++) {
      const startIdx = Math.floor((b / 16) * total);
      const endIdx = Math.floor(((b + 1) / 16) * total);
      let subSum = 0;
      for (let j = startIdx; j < endIdx; j++) {
        subSum += terrainMap[j];
      }
      features[5 + b] = subSum / Math.max(1, endIdx - startIdx);
    }

    return features;
  }

  /**
   * Co-evolutionary GAN Training Step (Minimax with RL Self-Play Regret Integration)
   */
  public trainStep(
    realFeatures: number[],
    agentLearningRegret: number = 0.5,
    learningRate: number = 0.006
  ): { gLoss: number; dLoss: number } {
    this.epoch++;

    // 1. Train Discriminator: D(real) -> 1, D(fake) -> 0
    const realEval = this.forwardDiscriminator(realFeatures);
    this.discriminatorRealScore = realEval.score;

    const fakeLatent = this.sampleLatent();
    const fakeGenOutput = this.forwardGenerator(fakeLatent, this.curriculumDifficulty, agentEntropy(realFeatures));
    const fakeEval = this.forwardDiscriminator(fakeGenOutput);
    this.discriminatorFakeScore = fakeEval.score;

    // Binary Cross Entropy Loss for Discriminator
    const dRealLoss = -Math.log(Math.max(1e-5, realEval.score));
    const dFakeLoss = -Math.log(Math.max(1e-5, 1 - fakeEval.score));
    const dTotalLoss = 0.5 * (dRealLoss + dFakeLoss);
    this.discriminatorLoss = dTotalLoss;

    // Backprop to Discriminator weights (Analytical update)
    const dLastLayer = this.dLayers[this.dLayers.length - 1];
    const realGrad = (1.0 - realEval.score) * 0.5;
    const fakeGrad = (-fakeEval.score) * 0.5;

    const realLastHidden = realEval.hiddenActivations[realEval.hiddenActivations.length - 2] || realFeatures;
    const fakeLastHidden = fakeEval.hiddenActivations[fakeEval.hiddenActivations.length - 2] || fakeGenOutput;

    for (let i = 0; i < dLastLayer.weights[0].length; i++) {
      dLastLayer.weights[0][i] += learningRate * (realGrad * (realLastHidden[i] || 0) + fakeGrad * (fakeLastHidden[i] || 0));
    }
    dLastLayer.biases[0] += learningRate * (realGrad + fakeGrad);

    // 2. Train Generator: Wants D(G(z)) -> 1 + Incentivized by RL Agent Learning Regret
    // (PAIRED objective: Environments where self-play agents show high entropy and learning progress)
    const gLatent = this.sampleLatent();
    const gGenOutputs = this.forwardGenerator(gLatent, this.curriculumDifficulty, this.generatedMapEntropy);
    const gEval = this.forwardDiscriminator(gGenOutputs);

    const adversarialLoss = -Math.log(Math.max(1e-5, gEval.score));
    const regretIncentive = (1.0 - agentLearningRegret) * 0.4; // reward if agent is learning
    const gTotalLoss = adversarialLoss + regretIncentive;
    this.generatorLoss = gTotalLoss;
    this.lastAgentRegret = agentLearningRegret;

    // Backprop to Generator output layer
    const gLastLayer = this.gLayers[this.gLayers.length - 1];
    const gTargetGrad = (1.0 - gEval.score) * 0.4 + agentLearningRegret * 0.2;

    for (let o = 0; o < gLastLayer.weights.length; o++) {
      for (let i = 0; i < gLastLayer.weights[o].length; i++) {
        gLastLayer.weights[o][i] += learningRate * gTargetGrad * 0.05;
      }
      gLastLayer.biases[o] += learningRate * gTargetGrad * 0.05;
    }

    // Update entropy and record loss history
    this.generatedMapEntropy = Math.min(1.0, 0.4 + (this.discriminatorRealScore - this.discriminatorFakeScore + 1) * 0.3);
    this.diversityScore = Math.min(1.0, 0.5 + Math.abs(this.generatorLoss - this.discriminatorLoss) * 0.3);

    // Periodically refresh preview evaluations during training
    if (this.epoch % 20 === 0) {
      this.updateLatentPreviews();
    }

    if (this.epoch % 10 === 0) {
      this.lossHistory.push({
        step: this.epoch,
        gLoss: Math.round(this.generatorLoss * 1000) / 1000,
        dLoss: Math.round(this.discriminatorLoss * 1000) / 1000,
      });
      if (this.lossHistory.length > 50) this.lossHistory.shift();
    }

    return { gLoss: this.generatorLoss, dLoss: this.discriminatorLoss };
  }

  public setCurriculumDifficulty(diff: number) {
    this.curriculumDifficulty = Math.max(0.0, Math.min(1.0, diff));
    this.updateLatentPreviews();
  }

  public getMetrics(): GANMetrics {
    return {
      epoch: this.epoch,
      generatorLoss: Math.round(this.generatorLoss * 1000) / 1000,
      discriminatorLoss: Math.round(this.discriminatorLoss * 1000) / 1000,
      discriminatorRealScore: Math.round(this.discriminatorRealScore * 100) / 100,
      discriminatorFakeScore: Math.round(this.discriminatorFakeScore * 100) / 100,
      curriculumDifficulty: Math.round(this.curriculumDifficulty * 100) / 100,
      generatedMapEntropy: Math.round(this.generatedMapEntropy * 100) / 100,
      diversityScore: Math.round(this.diversityScore * 100) / 100,
      agentRegret: Math.round(this.lastAgentRegret * 100) / 100,
      lossHistory: this.lossHistory,
      latentSamples: this.cachedPreviews,
      activeLatentVector: [...this.activeLatent],
    };
  }
}

function agentEntropy(features: number[]): number {
  return features[1] ? Math.min(1.0, features[1] * 2) : 0.5;
}
