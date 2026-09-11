import { LatentSamplePreview } from '../types';
import { EnvironmentGAN } from './gan';

interface CurriculumState {
  rngState: number;
  poolDiversity: number;
  activeScore: number;
  bestScore: number;
  targetRegret: number;
}

const stateByGan = new WeakMap<EnvironmentGAN, CurriculumState>();
let installed = false;

const TARGET_REGRET = 0.45;
const SELECTION_INTERVAL = 6;
const MIN_REPLACEMENT_MARGIN = 0.04;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function hashLatent(latent: number[]) {
  let hash = 2166136261 >>> 0;
  for (const value of latent) {
    const quantized = Math.round((Number.isFinite(value) ? value : 0) * 10000);
    hash ^= quantized >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 0x9e3779b9;
}

function stateFor(gan: EnvironmentGAN): CurriculumState {
  let state = stateByGan.get(gan);
  if (!state) {
    state = {
      rngState: hashLatent(gan.activeLatent || []),
      poolDiversity: 0.5,
      activeScore: 0.5,
      bestScore: 0.5,
      targetRegret: TARGET_REGRET,
    };
    stateByGan.set(gan, state);
  }
  return state;
}

function random01(state: CurriculumState) {
  let x = state.rngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 4294967296;
}

function gaussian(state: CurriculumState) {
  const u1 = Math.max(1e-7, random01(state));
  const u2 = random01(state);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
}

function mutateLatent(base: number[], sigma: number, state: CurriculumState) {
  return base.map((value) => {
    const mutated = value + gaussian(state) * sigma;
    return Math.max(-3, Math.min(3, mutated));
  });
}

function randomLatent(dim: number, state: CurriculumState) {
  return Array.from({ length: dim }, () => Math.max(-3, Math.min(3, gaussian(state))));
}

interface ThumbnailStats {
  data: number[];
  complexity: number;
  mean: number;
  stdev: number;
  gradient: number;
  nodeCount: number;
  archetype: string;
  dominantFeature: string;
}

function synthesizeThumbnail(gan: EnvironmentGAN, latent: number[], cols = 20, rows = 20): ThumbnailStats {
  const gOut = gan.forwardGenerator(latent, gan.curriculumDifficulty, gan.generatedMapEntropy);
  const freq1 = 1.0 + Math.abs(gOut[0]) * 2.5;
  const freq2 = 1.8 + Math.abs(gOut[1]) * 3.2;
  const phase1 = gOut[2] * Math.PI;
  const phase2 = gOut[3] * Math.PI;
  const ridgeStrength = 0.3 + (gOut[4] + 1) * 0.4 * gan.curriculumDifficulty;
  const craterScale = 0.2 + Math.abs(gOut[5]) * 0.6;
  const harmonicCoeff = gOut[6] * 0.8;
  const data = new Array(cols * rows).fill(0);

  let min = 1;
  let max = 0;
  let sum = 0;
  let gradientSum = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = (c / cols) * 2 - 1;
      const ny = (r / rows) * 2 - 1;
      const distCenter = Math.sqrt(nx * nx + ny * ny);
      const wave1 = Math.sin(nx * freq1 * Math.PI + phase1) * Math.cos(ny * freq1 * Math.PI + phase2);
      const wave2 = Math.cos(nx * freq2 * 1.5 - phase2) * Math.sin(ny * freq2 * 1.5 + phase1) * 0.5;
      const ridge = 1 - Math.abs(Math.sin((nx + ny) * 3.5 * gan.curriculumDifficulty + gOut[7] * 2));
      const crater = Math.exp(-Math.pow((distCenter - craterScale) * 3, 2)) * gOut[8];
      const value = Math.max(0.02, Math.min(0.95, (wave1 + wave2 + ridge * ridgeStrength + crater * 0.5 + 1.5) / 3));
      const index = r * cols + c;
      data[index] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
      if (c > 0) gradientSum += Math.abs(value - data[index - 1]);
      if (r > 0) gradientSum += Math.abs(value - data[index - cols]);
    }
  }

  const mean = sum / data.length;
  let variance = 0;
  for (const value of data) variance += (value - mean) ** 2;
  variance /= Math.max(1, data.length);
  const stdev = Math.sqrt(variance);
  const gradient = gradientSum / Math.max(1, data.length * 2);
  const range = max - min;
  const complexity = clamp01(range * 0.7 + gradient * 2.4 + stdev * 0.75 + gan.curriculumDifficulty * 0.12);

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
  }

  return {
    data,
    complexity,
    mean,
    stdev,
    gradient,
    nodeCount: Math.floor(8 + Math.abs(gOut[24] || 0) * 8),
    archetype,
    dominantFeature,
  };
}

function terrainDistance(a: number[], b: number[]) {
  const count = Math.min(a.length, b.length);
  if (!count) return 0;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.abs(a[i] - b[i]);
  return clamp01((total / count) * 3.2);
}

function usability(stats: ThumbnailStats) {
  const centered = clamp01(1 - Math.abs(stats.mean - 0.5) * 2.2);
  const variation = stats.stdev < 0.055
    ? clamp01(stats.stdev / 0.055)
    : stats.stdev > 0.29
      ? clamp01(1 - (stats.stdev - 0.29) * 3.2)
      : 1;
  const gradient = stats.gradient > 0.26 ? clamp01(1 - (stats.gradient - 0.26) * 2.5) : 1;
  return clamp01(centered * 0.4 + variation * 0.4 + gradient * 0.2);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function installEnvironmentCurriculum() {
  if (installed) return;
  installed = true;

  EnvironmentGAN.prototype.refreshCandidateLatents = function refreshAdaptiveCandidates(this: EnvironmentGAN) {
    const state = stateFor(this);
    const active = [...this.activeLatent];
    const exploration = 1 - clamp01(this.lastAgentRegret);
    const sigma = 0.12 + exploration * 0.3;

    this.candidateLatents = [active];
    for (let i = 0; i < 4; i++) {
      this.candidateLatents.push(mutateLatent(active, sigma * (0.8 + i * 0.18), state));
    }
    this.candidateLatents.push(mutateLatent(active, sigma * 1.8, state));
    this.candidateLatents.push(randomLatent(this.latentDim, state));
    this.updateLatentPreviews();
  };

  EnvironmentGAN.prototype.updateLatentPreviews = function updateAdaptivePreviews(this: EnvironmentGAN): LatentSamplePreview[] {
    const state = stateFor(this);
    if (!this.candidateLatents.length) {
      this.candidateLatents = [[...this.activeLatent]];
    }

    const stats = this.candidateLatents.map((latent) => synthesizeThumbnail(this, latent));
    const activeStats = stats[0];
    const targetComplexity = clamp01(0.85 - clamp01(this.lastAgentRegret) * 0.55);
    let diversitySum = 0;

    const previews = this.candidateLatents.map((latent, index) => {
      const item = stats[index];
      const diversity = index === 0 ? 0 : terrainDistance(item.data, activeStats.data);
      diversitySum += diversity;
      const challengeFit = clamp01(1 - Math.abs(item.complexity - targetComplexity) / 0.7);
      const usable = usability(item);
      const noveltyFit = index === 0 ? 0.55 : clamp01(0.35 + diversity * 0.65);
      const priority = clamp01(challengeFit * 0.5 + usable * 0.32 + noveltyFit * 0.18);
      const isActive = index === 0 || latent.every((value, i) => Math.abs(value - this.activeLatent[i]) < 0.01);

      return {
        id: `curriculum_candidate_${index}`,
        name: isActive ? `Active (${item.archetype})` : `Candidate #${index + 1}`,
        latentVector: [...latent],
        terrainThumbnail: item.data,
        cols: 20,
        rows: 20,
        discriminatorScore: round2(challengeFit),
        complexity: round2(item.complexity),
        priorityScore: round2(priority),
        isActive,
        archetype: item.archetype,
        dominantFeature: item.dominantFeature,
        nodeCount: item.nodeCount,
      };
    });

    state.poolDiversity = previews.length > 1 ? clamp01(diversitySum / (previews.length - 1)) : 0;
    state.activeScore = previews[0]?.priorityScore ?? 0.5;
    state.bestScore = previews.reduce((best, preview) => Math.max(best, preview.priorityScore), state.activeScore);
    this.generatedMapEntropy = round2(clamp01(activeStats.stdev * 2.4 + activeStats.gradient * 2.2));
    this.diversityScore = round2(state.poolDiversity);
    this.cachedPreviews = previews;
    return previews;
  };

  EnvironmentGAN.prototype.trainStep = function adaptiveCurriculumStep(
    this: EnvironmentGAN,
    _realFeatures: number[],
    agentLearningRegret = 0.5,
    _learningRate = 0.006
  ) {
    const state = stateFor(this);
    this.epoch++;
    this.lastAgentRegret = clamp01(agentLearningRegret);

    const targetDifficulty = clamp01(0.22 + (1 - this.lastAgentRegret) * 0.68);
    this.curriculumDifficulty += (targetDifficulty - this.curriculumDifficulty) * 0.035;
    this.curriculumDifficulty = clamp01(this.curriculumDifficulty);

    if (this.epoch === 1 || this.epoch % SELECTION_INTERVAL === 0) {
      this.refreshCandidateLatents();
      const active = this.cachedPreviews[0];
      const best = this.cachedPreviews.reduce((winner, candidate) =>
        candidate.priorityScore > winner.priorityScore ? candidate : winner,
        active
      );

      if (best && active && best.id !== active.id && best.priorityScore >= active.priorityScore + MIN_REPLACEMENT_MARGIN) {
        this.activeLatent = [...best.latentVector];
        this.updateLatentPreviews();
      }
    } else {
      this.updateLatentPreviews();
    }

    const bestPriority = this.cachedPreviews.reduce((best, item) => Math.max(best, item.priorityScore), 0);
    const activePriority = this.cachedPreviews.find((item) => item.isActive)?.priorityScore ?? state.activeScore;
    const curriculumGap = clamp01(1 - bestPriority);
    const regretGap = clamp01(Math.abs(this.lastAgentRegret - state.targetRegret));

    this.generatorLoss = curriculumGap;
    this.discriminatorLoss = regretGap;
    this.discriminatorRealScore = activePriority;
    this.discriminatorFakeScore = bestPriority;

    if (this.epoch % SELECTION_INTERVAL === 0) {
      this.lossHistory.push({
        step: this.epoch,
        gLoss: Math.round(curriculumGap * 1000) / 1000,
        dLoss: Math.round(regretGap * 1000) / 1000,
      });
      if (this.lossHistory.length > 50) this.lossHistory.shift();
    }

    return { gLoss: curriculumGap, dLoss: regretGap };
  };
}

export const ENVIRONMENT_CURRICULUM = {
  targetRegret: TARGET_REGRET,
  selectionInterval: SELECTION_INTERVAL,
  replacementMargin: MIN_REPLACEMENT_MARGIN,
};
