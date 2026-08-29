import { SeededRandom } from './communication';

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));

export interface GeneratedWorld {
  cols: number;
  rows: number;
  terrain: Float32Array;
  params: number[];
  features: number[];
  discriminatorScore: number;
  generation: number;
}

export interface GanMetrics {
  generation: number;
  discriminatorScore: number;
  archiveSize: number;
  targetDifficulty: number;
  obstacleDensity: number;
  roughness: number;
  novelty: number;
}

/**
 * Tiny self-adversarial environment GAN.
 * "Real" examples are ONLY Origo-generated worlds that previously produced
 * useful challenge. There is no external terrain corpus or human example data.
 */
export class CleanroomEnvironmentGAN {
  private readonly latentDim = 6;
  private readonly outputDim = 5;
  private generatorWeights: number[][];
  private generatorBias: number[];
  private discriminatorWeights: number[];
  private discriminatorBias = 0;
  private archive: number[][] = [];
  private generation = 0;
  private lastScore = 0.5;
  private lastParams = [0.25, 0.4, 0.2, 0.55, 0.25];
  private lastNovelty = 1;
  private targetDifficulty = 0.55;

  constructor(private rng: SeededRandom) {
    this.generatorWeights = Array.from({ length: this.outputDim }, () =>
      Array.from({ length: this.latentDim }, () => this.rng.normal() * 0.22),
    );
    this.generatorBias = [-1.05, -0.3, -0.9, 0.25, -0.8];
    this.discriminatorWeights = Array.from({ length: this.outputDim }, () => this.rng.normal() * 0.15);
  }

  private generator(latent: number[]) {
    return this.generatorWeights.map((row, o) => {
      let z = this.generatorBias[o];
      for (let i = 0; i < this.latentDim; i++) z += row[i] * latent[i];
      return sigmoid(z);
    });
  }

  private discriminator(features: number[]) {
    let z = this.discriminatorBias;
    for (let i = 0; i < this.outputDim; i++) z += this.discriminatorWeights[i] * features[i];
    return sigmoid(z);
  }

  private novelty(features: number[]) {
    if (!this.archive.length) return 1;
    let best = Infinity;
    for (const prior of this.archive) {
      let d = 0;
      for (let i = 0; i < features.length; i++) d += (features[i] - prior[i]) ** 2;
      best = Math.min(best, Math.sqrt(d / features.length));
    }
    return clamp(best * 3);
  }

  generate(cols = 24, rows = 15): GeneratedWorld {
    const latent = Array.from({ length: this.latentDim }, () => this.rng.normal());
    const params = this.generator(latent);
    const [density, roughness, ridge, spread, texture] = params;
    const terrain = new Float32Array(cols * rows);
    let blocked = 0;
    let roughAccum = 0;

    const phaseA = this.rng.next() * Math.PI * 2;
    const phaseB = this.rng.next() * Math.PI * 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x / Math.max(1, cols - 1);
        const ny = y / Math.max(1, rows - 1);
        const waves =
          Math.sin(nx * Math.PI * (2 + roughness * 5) + phaseA) * 0.18 +
          Math.cos(ny * Math.PI * (2 + roughness * 4) + phaseB) * 0.18;
        const centerRidge = Math.exp(-((nx - 0.55) ** 2) / 0.025) * ridge * (0.25 + Math.abs(ny - 0.5));
        const noise = this.rng.normal() * (0.08 + texture * 0.18);
        const value = clamp(0.34 + waves + centerRidge + noise + density * 0.22);
        terrain[y * cols + x] = value;
        if (value > 0.73) blocked++;
        roughAccum += Math.abs(waves) + Math.abs(noise);
      }
    }

    const actualDensity = blocked / terrain.length;
    const actualRoughness = clamp(roughAccum / terrain.length * 2.2);
    const features = [actualDensity, actualRoughness, ridge, spread, texture];
    const score = this.discriminator(features);
    const novelty = this.novelty(features);

    this.generation++;
    this.lastScore = score;
    this.lastParams = params;
    this.lastNovelty = novelty;

    return { cols, rows, terrain, params, features, discriminatorScore: score, generation: this.generation };
  }

  learn(world: GeneratedWorld, recentSuccess: number) {
    const challenge = clamp(1 - Math.abs(recentSuccess - 0.72) / 0.72);
    const novelty = this.novelty(world.features);
    if (challenge > 0.62 && novelty > 0.08) {
      this.archive.push([...world.features]);
      if (this.archive.length > 48) this.archive.shift();
    }

    const lrD = 0.055;
    const trainDisc = (features: number[], label: number) => {
      const p = this.discriminator(features);
      const err = label - p;
      for (let i = 0; i < this.outputDim; i++) this.discriminatorWeights[i] += lrD * err * features[i];
      this.discriminatorBias += lrD * err;
    };

    if (this.archive.length) {
      const real = this.archive[Math.floor(this.rng.next() * this.archive.length)];
      trainDisc(real, 1);
    }
    trainDisc(world.features, challenge > 0.62 ? 1 : 0);

    const score = this.discriminator(world.features);
    const lrG = 0.018;
    for (let o = 0; o < this.outputDim; o++) {
      const grad = this.discriminatorWeights[o] * score * (1 - score);
      this.generatorBias[o] += lrG * grad;
    }

    const pressure = clamp((recentSuccess - 0.68) * 0.12, -0.025, 0.025);
    this.generatorBias[0] += pressure;
    this.generatorBias[1] += pressure * 0.8;
    this.generatorBias[4] += pressure * 0.7;
    this.targetDifficulty = clamp(this.targetDifficulty + pressure * 0.7, 0.25, 0.9);
  }

  metrics(): GanMetrics {
    return {
      generation: this.generation,
      discriminatorScore: this.lastScore,
      archiveSize: this.archive.length,
      targetDifficulty: this.targetDifficulty,
      obstacleDensity: this.lastParams[0],
      roughness: this.lastParams[1],
      novelty: this.lastNovelty,
    };
  }
}
