/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SpeciesType {
  Resonator = 'RESONATOR',   // Focuses on harmonic fields, creates melodic tones
  Predator = 'PREDATOR',     // Hunts rivals, generates deep bass impacts & percussion
  Architect = 'ARCHITECT',   // Terraforms terrain & builds crystal nodes, warm drone chords
  Glider = 'GLIDER'          // High agility wave-surfer, produces crystalline arpeggios
}

export interface SpeciesConfig {
  type: SpeciesType;
  name: string;
  color: string;
  secondaryColor: string;
  glowColor: string;
  description: string;
  soundRole: string;
  baseSpeed: number;
  maxEnergy: number;
}

export interface NeuralLayer {
  weights: number[][]; // [outputs][inputs]
  biases: number[];
}

export interface AgentMemory {
  state: number[];
  action: number;
  actionProbs: number[];
  reward: number;
  value: number;
  nextState: number[];
  done: boolean;
}

export interface AgentSensoryInput {
  raycasts: number[];       // Distance to obstacles/boundaries (6 directions)
  rivalDetect: number[];     // Proximity to rival species (4 directions)
  allyDetect: number[];      // Proximity to same species (4 directions)
  energyDetect: number[];    // Proximity to food / harmonic energy nodes (4 directions)
  localHarmonicField: number;// Local field intensity (-1 to 1)
  localTerrainHeight: number;// Local elevation (0 to 1)
  velocityNorm: number;     // Normalized speed (0 to 1)
  internalEnergy: number;   // Agent energy reserve (0 to 1)
  soundPressure: number;    // Acoustic wave intensity at current spot (0 to 1)
  timeSine: number;         // Sin of global clock for rhythmic synchronization
  timeCosine: number;       // Cos of global clock
}

export interface AgentAction {
  thrust: number;           // Forward/backward force (-1 to 1)
  steer: number;            // Angular turn (-1 to 1)
  sonicPulse: number;       // Trigger acoustic wave (0 to 1)
  terraform: number;        // Modify terrain/deposit harmonic field (-1 to 1)
  ability: number;          // Special species ability (shield/speed burst/node craft)
}

export interface RewardBreakdown {
  extrinsic: number;     // Energy harvesting, boundary survival, combat
  curiosity: number;     // Intrinsic state-prediction error bonus (ICM)
  topological: number;   // Interaction with terrain curvature & high-gradient features
  acoustic: number;      // Sonar reflection, resonance field stimulation, echo feedback
  coevolution: number;   // Inter-species territorial self-play synergy & predation
  total: number;
}

export interface AgentStats {
  id: string;
  species: SpeciesType;
  generation: number;
  totalReward: number;
  recentReward: number;
  eloRating: number;
  energy: number;
  age: number;
  kills: number;
  energyGathered: number;
  nodesCreated: number;
  pulsesEmitted: number;
  tdError: number;
  rewardBreakdown: RewardBreakdown;
  audioModulation: {
    pitchHz: number;
    fmIndex: number;
    timbreMorph: number;
    rhythmRateHz: number;
    filterCutoffHz: number;
    amplitude: number;
  };
}

export interface SynthModulationParams {
  agentId: string;
  species: SpeciesType;
  pitchNormalized: number;     // 0..1 mapped through scale quantizer
  fmModulationIndex: number;   // 0..1 dynamic harmonic multiplier
  timbreMorph: number;         // 0..1 (sine -> triangle -> saw -> resonant wavetable)
  rhythmTrigger: boolean;      // True if agent internal clock & state triggers a rhythmic pulse
  rhythmRate: number;          // 0.5..8.0 Hz polyrhythmic clock division
  filterCutoff: number;        // 200..10000 Hz dynamic VCF
  filterResonance: number;     // 1..12 Q
  amplitude: number;           // 0..1 VCA gain
  pan: number;                 // -1..1 stereo field
  reverbSend: number;          // 0..1
  delaySend: number;           // 0..1
}

export interface LatentSamplePreview {
  id: string;
  name: string;
  latentVector: number[];
  terrainThumbnail: number[]; // Flattened cols*rows low-res elevation array
  cols: number;
  rows: number;
  discriminatorScore: number;
  complexity: number;
  priorityScore: number; // 0..1 indicating how strongly generator prioritizes this sample
  isActive: boolean;
  archetype: string;
  dominantFeature: string;
  nodeCount: number;
}

export interface GANMetrics {
  epoch: number;
  generatorLoss: number;
  discriminatorLoss: number;
  discriminatorRealScore: number;
  discriminatorFakeScore: number;
  curriculumDifficulty: number; // 0..1 (controls topological complexity & obstacle density)
  generatedMapEntropy: number;
  diversityScore: number;
  agentRegret?: number;
  lossHistory: { step: number; gLoss: number; dLoss: number }[];
  latentSamples?: LatentSamplePreview[];
  activeLatentVector?: number[];
}

export interface GeneratedEnvironmentData {
  terrainMap: Float32Array; // cols * rows values [0..1]
  harmonicSeedMap: Float32Array; // cols * rows values [-1..1]
  nodePlacements: { x: number; y: number; energy: number; frequency: number }[];
  complexityScore: number;
  latentVector: number[];
}

export interface SoundPreset {
  id: string;
  name: string;
  scaleName: string;
  rootNote: number; // MIDI note (e.g. 48 = C3, 57 = A3)
  scale: number[];  // Semitone offsets
  tempoBpm: number;
  fmModulation: number;
  reverbDecay: number;
  delayFeedback: number;
  filterCutoff: number;
  bassBoost: boolean;
}

export interface EnvironmentPreset {
  id: string;
  name: string;
  description: string;
  speciesDistribution: Record<SpeciesType, number>;
  terrainRoughness: number;
  harmonicDecayRate: number;
  acousticSpeed: number;
  energySpawnRate: number;
  learningRate: number;
  curiosityWeight: number;
  soundPreset: SoundPreset;
}

export interface SimulationMetrics {
  stepCount: number;
  episodeCount: number;
  fps: number;
  avgRewardBySpecies: Record<SpeciesType, number>;
  eloBySpecies: Record<SpeciesType, number>;
  totalPopulation: number;
  averageTdError: number;
  harmonicEntropy: number;
  activeSoundNodes: number;
  rewardHistory: { step: number; rewards: Record<SpeciesType, number> }[];
  lossHistory: { step: number; loss: number }[];
}

export interface EnergyNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  energy: number;
  maxEnergy: number;
  harmonicFrequency: number;
  hue: number;
  pulsePhase: number;
}

export interface AcousticWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  intensity: number;
  frequency: number;
  color: string;
  speed: number;
  sourceSpecies: SpeciesType;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  glow: boolean;
}
