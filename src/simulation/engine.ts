/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpeciesType, SimulationMetrics, EnvironmentPreset } from '../types';
import { SimulationEnvironment } from './environment';
import { Agent, SPECIES_CONFIGS } from './agent';
import { soundEngine } from '../audio/soundEngine';

export const SIMULATION_PRESETS: EnvironmentPreset[] = [
  {
    id: 'harmonic_territory',
    name: 'Harmonic Territorial Equilibrium',
    description: '4 co-evolving species balancing resonance fields, creating rich polyphonic chord progressions.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 5,
      [SpeciesType.Predator]: 3,
      [SpeciesType.Architect]: 4,
      [SpeciesType.Glider]: 4,
    },
    terrainRoughness: 0.5,
    harmonicDecayRate: 0.985,
    acousticSpeed: 3.2,
    energySpawnRate: 12,
    learningRate: 0.008,
    curiosityWeight: 0.15,
    soundPreset: {
      id: 'lydian_dream',
      name: 'Lydian Dream',
      scaleName: 'lydian',
      rootNote: 48,
      scale: [0, 2, 4, 6, 7, 9, 11, 12],
      tempoBpm: 120,
      fmModulation: 0.5,
      reverbDecay: 0.5,
      delayFeedback: 0.3,
      filterCutoff: 4200,
      bassBoost: false,
    },
  },
  {
    id: 'predator_echolocation',
    name: 'Predator-Prey Sonar Hunt',
    description: 'Predators track prey exclusively via acoustic soundwaves, producing dark rhythmic sub-bass pulses and high-tension arpeggios.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 3,
      [SpeciesType.Predator]: 6,
      [SpeciesType.Architect]: 2,
      [SpeciesType.Glider]: 5,
    },
    terrainRoughness: 0.8,
    harmonicDecayRate: 0.97,
    acousticSpeed: 4.0,
    energySpawnRate: 8,
    learningRate: 0.012,
    curiosityWeight: 0.22,
    soundPreset: {
      id: 'phrygian_hunt',
      name: 'Phrygian Tension',
      scaleName: 'phrygian_dominant',
      rootNote: 45, // A2
      scale: [0, 1, 4, 5, 7, 8, 10, 12],
      tempoBpm: 135,
      fmModulation: 0.7,
      reverbDecay: 0.4,
      delayFeedback: 0.45,
      filterCutoff: 3200,
      bassBoost: true,
    },
  },
  {
    id: 'crystal_architects',
    name: 'Crystal Monolith Terraformers',
    description: 'Architects shape the landscape into resonant sound chambers, spawning harmonic crystal bells.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 6,
      [SpeciesType.Predator]: 1,
      [SpeciesType.Architect]: 7,
      [SpeciesType.Glider]: 2,
    },
    terrainRoughness: 0.65,
    harmonicDecayRate: 0.99,
    acousticSpeed: 2.8,
    energySpawnRate: 16,
    learningRate: 0.006,
    curiosityWeight: 0.12,
    soundPreset: {
      id: 'pentatonic_zen',
      name: 'Pentatonic Zen',
      scaleName: 'pentatonic_major',
      rootNote: 50, // D3
      scale: [0, 2, 4, 7, 9, 12],
      tempoBpm: 105,
      fmModulation: 0.35,
      reverbDecay: 0.65,
      delayFeedback: 0.25,
      filterCutoff: 5000,
      bassBoost: false,
    },
  },
  {
    id: 'curiosity_void',
    name: 'Curiosity Void Walker',
    description: 'Maximizes intrinsic curiosity exploration in chaotic multi-harmonic wavefields.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 4,
      [SpeciesType.Predator]: 3,
      [SpeciesType.Architect]: 3,
      [SpeciesType.Glider]: 6,
    },
    terrainRoughness: 0.9,
    harmonicDecayRate: 0.96,
    acousticSpeed: 3.8,
    energySpawnRate: 14,
    learningRate: 0.015,
    curiosityWeight: 0.4,
    soundPreset: {
      id: 'dorian_cyber',
      name: 'Dorian Cyberpunk',
      scaleName: 'dorian',
      rootNote: 48,
      scale: [0, 2, 3, 5, 7, 9, 10, 12],
      tempoBpm: 128,
      fmModulation: 0.65,
      reverbDecay: 0.45,
      delayFeedback: 0.35,
      filterCutoff: 4600,
      bassBoost: true,
    },
  },
];

export class SimulationEngine {
  public env: SimulationEnvironment;
  public agents: Agent[] = [];
  public selectedAgentId: string | null = null;

  // Hyperparameters
  public learningRate: number = 0.008;
  public gamma: number = 0.95;
  public curiosityWeight: number = 0.15;
  public mutationRate: number = 0.08;
  public simulationSpeed: number = 1; // 1x, 2x, 5x, 10x turbo

  // Simulation Clock & Generation
  public stepCount: number = 0;
  public episodeCount: number = 1;
  public isRunning: boolean = true;
  public isAudioActive: boolean = true;

  // Active Preset
  public activePreset: EnvironmentPreset = SIMULATION_PRESETS[0];

  // Best Performing Hall of Fame Brains (for Self-Play evolutionary bootstrapping)
  public hallOfFame: Record<SpeciesType, Agent[]> = {
    [SpeciesType.Resonator]: [],
    [SpeciesType.Predator]: [],
    [SpeciesType.Architect]: [],
    [SpeciesType.Glider]: [],
  };

  // Metrics history
  public rewardHistory: { step: number; rewards: Record<SpeciesType, number> }[] = [];
  public lossHistory: { step: number; loss: number }[] = [];
  private lastFpsTime = performance.now();
  private frameCount = 0;
  private currentFps = 60;

  constructor(width: number = 1000, height: number = 700) {
    this.env = new SimulationEnvironment(width, height);
    this.applyPreset(this.activePreset);
  }

  public applyPreset(preset: EnvironmentPreset) {
    this.activePreset = preset;
    this.learningRate = preset.learningRate;
    this.curiosityWeight = preset.curiosityWeight;
    this.env.decayRate = preset.harmonicDecayRate;
    this.env.waveSpeed = preset.acousticSpeed;

    // Apply Sound Preset to WebAudio engine
    soundEngine.setScale(preset.soundPreset.scaleName);
    soundEngine.setRootNote(preset.soundPreset.rootNote);
    soundEngine.setFilterCutoff(preset.soundPreset.filterCutoff);
    soundEngine.setReverbMix(preset.soundPreset.reverbDecay);
    soundEngine.setDelayMix(preset.soundPreset.delayFeedback);

    this.resetSimulation(preset.speciesDistribution, preset.terrainRoughness);
  }

  public resetSimulation(
    distribution: Record<SpeciesType, number> = this.activePreset.speciesDistribution,
    roughness: number = 0.5
  ) {
    this.agents = [];
    this.env.generateProceduralTerrain(roughness);
    this.env.seedEnergyNodes(this.activePreset.energySpawnRate);

    // Spawn agents according to distribution
    Object.entries(distribution).forEach(([speciesKey, count]) => {
      const species = speciesKey as SpeciesType;
      for (let i = 0; i < count; i++) {
        const x = 50 + Math.random() * (this.env.width - 100);
        const y = 50 + Math.random() * (this.env.height - 100);
        this.agents.push(new Agent(species, x, y, undefined, 1));
      }
    });

    if (this.agents.length > 0) {
      this.selectedAgentId = this.agents[0].id;
    }
  }

  /**
   * Main step function called on requestAnimationFrame
   */
  public step(): void {
    if (!this.isRunning) return;

    // FPS calculation
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // Step physics & RL agents for `simulationSpeed` sub-steps
    for (let sub = 0; sub < this.simulationSpeed; sub++) {
      this.stepCount++;

      // 1. Update procedural environment physics
      this.env.update(1.0);

      // 2. Step all agents
      for (let i = this.agents.length - 1; i >= 0; i--) {
        const agent = this.agents[i];
        const isPrimary = agent.id === this.selectedAgentId || (i === 0 && !this.selectedAgentId);
        agent.step(this.env, this.agents, this.stepCount, this.isAudioActive && sub === 0, isPrimary);

        // Train agent via pure RL periodically (every 16 steps)
        if (this.stepCount % 16 === 0) {
          agent.train(this.learningRate, this.gamma, this.curiosityWeight);
        }

        // 3. Death & Self-Play Replenishment
        if (agent.energy <= 0 || agent.age > 1800) {
          soundEngine.releaseAgentSynth(agent.id);
          this.handleAgentReproduction(agent);
          this.agents.splice(i, 1);
        }
      }

      // Check population minimums per species
      this.maintainPopulationBalance();

      // Step Procedural Environment GAN Training (Every 32 steps)
      if (this.stepCount % 32 === 0) {
        let avgTd = 0;
        for (const a of this.agents) avgTd += a.lastTdError;
        const agentRegret = Math.min(1.0, (avgTd / Math.max(1, this.agents.length)) * 2.0);
        this.env.stepGANTraining(agentRegret, this.learningRate * 0.75);
      }

      // 4. Update Ambient Soundscape every 8 steps
      if (this.stepCount % 8 === 0 && this.isAudioActive) {
        this.updateAcousticEcosystem();
      }

      // 5. Record periodic metrics history
      if (this.stepCount % 120 === 0) {
        this.recordMetrics();
      }
    }
  }

  /**
   * Natural selection & evolutionary bootstrapping
   */
  private handleAgentReproduction(deceased: Agent) {
    const species = deceased.species;
    const speciesHof = this.hallOfFame[species];

    // Add to Hall of Fame if performed well
    if (deceased.totalReward > 10) {
      speciesHof.push(deceased);
      if (speciesHof.length > 8) {
        speciesHof.sort((a, b) => b.totalReward - a.totalReward);
        speciesHof.pop();
      }
    }

    // Spawn replacement offspring
    let parentBrain = deceased.brain;
    if (speciesHof.length > 0 && Math.random() < 0.7) {
      const randomParent = speciesHof[Math.floor(Math.random() * speciesHof.length)];
      if (Math.random() < 0.5 && speciesHof.length > 1) {
        const partner = speciesHof[Math.floor(Math.random() * speciesHof.length)];
        parentBrain = randomParent.brain.crossover(partner.brain);
      } else {
        parentBrain = randomParent.brain.clone();
      }
    }

    // Apply mutation
    parentBrain.mutate(this.mutationRate, 0.15);

    const x = 50 + Math.random() * (this.env.width - 100);
    const y = 50 + Math.random() * (this.env.height - 100);
    const offspring = new Agent(species, x, y, parentBrain, deceased.generation + 1);
    offspring.eloRating = Math.max(800, deceased.eloRating);

    this.agents.push(offspring);

    // If selected agent died, switch selection
    if (this.selectedAgentId === deceased.id) {
      this.selectedAgentId = offspring.id;
    }
  }

  private maintainPopulationBalance() {
    const targetDist = this.activePreset.speciesDistribution;
    const currentCounts: Record<SpeciesType, number> = {
      [SpeciesType.Resonator]: 0,
      [SpeciesType.Predator]: 0,
      [SpeciesType.Architect]: 0,
      [SpeciesType.Glider]: 0,
    };

    for (const a of this.agents) {
      currentCounts[a.species]++;
    }

    Object.entries(targetDist).forEach(([spKey, targetCount]) => {
      const species = spKey as SpeciesType;
      const count = currentCounts[species];
      if (count < targetCount) {
        const x = 50 + Math.random() * (this.env.width - 100);
        const y = 50 + Math.random() * (this.env.height - 100);
        const newAgent = new Agent(species, x, y, undefined, 1);
        this.agents.push(newAgent);
      }
    });
  }

  /**
   * Modulate ambient WebAudio synthesis based on self-play equilibrium
   */
  private updateAcousticEcosystem() {
    let totalField = 0;
    for (let i = 0; i < this.env.harmonicGrid.length; i += 4) {
      totalField += Math.abs(this.env.harmonicGrid[i]);
    }
    const avgField = totalField / (this.env.harmonicGrid.length / 4);

    // Compute dominant species by Elo rating
    let bestSpecies = SpeciesType.Resonator;
    let maxElo = -1;

    const eloSums: Record<SpeciesType, { sum: number; count: number }> = {
      [SpeciesType.Resonator]: { sum: 0, count: 0 },
      [SpeciesType.Predator]: { sum: 0, count: 0 },
      [SpeciesType.Architect]: { sum: 0, count: 0 },
      [SpeciesType.Glider]: { sum: 0, count: 0 },
    };

    for (const a of this.agents) {
      eloSums[a.species].sum += a.eloRating;
      eloSums[a.species].count++;
    }

    Object.entries(eloSums).forEach(([sp, data]) => {
      const avg = data.count > 0 ? data.sum / data.count : 0;
      if (avg > maxElo) {
        maxElo = avg;
        bestSpecies = sp as SpeciesType;
      }
    });

    const entropy = Math.min(1.0, avgField * 1.8);
    soundEngine.updateAmbientEcosystemSound(entropy, bestSpecies, avgField);
  }

  private recordMetrics() {
    const rewards: Record<SpeciesType, number> = {
      [SpeciesType.Resonator]: 0,
      [SpeciesType.Predator]: 0,
      [SpeciesType.Architect]: 0,
      [SpeciesType.Glider]: 0,
    };
    const counts: Record<SpeciesType, number> = {
      [SpeciesType.Resonator]: 0,
      [SpeciesType.Predator]: 0,
      [SpeciesType.Architect]: 0,
      [SpeciesType.Glider]: 0,
    };

    let totalTd = 0;
    for (const a of this.agents) {
      rewards[a.species] += a.recentReward;
      counts[a.species]++;
      totalTd += a.lastTdError;
    }

    Object.keys(rewards).forEach((k) => {
      const sp = k as SpeciesType;
      if (counts[sp] > 0) {
        rewards[sp] = Math.round((rewards[sp] / counts[sp]) * 100) / 100;
      }
    });

    this.rewardHistory.push({ step: this.stepCount, rewards });
    if (this.rewardHistory.length > 50) this.rewardHistory.shift();

    this.lossHistory.push({
      step: this.stepCount,
      loss: Math.round((totalTd / Math.max(1, this.agents.length)) * 1000) / 1000,
    });
    if (this.lossHistory.length > 50) this.lossHistory.shift();
  }

  public getMetrics(): SimulationMetrics {
    const avgRewardBySpecies: Record<SpeciesType, number> = {
      [SpeciesType.Resonator]: 0,
      [SpeciesType.Predator]: 0,
      [SpeciesType.Architect]: 0,
      [SpeciesType.Glider]: 0,
    };
    const eloBySpecies: Record<SpeciesType, number> = {
      [SpeciesType.Resonator]: 0,
      [SpeciesType.Predator]: 0,
      [SpeciesType.Architect]: 0,
      [SpeciesType.Glider]: 0,
    };
    const counts: Record<SpeciesType, number> = {
      [SpeciesType.Resonator]: 0,
      [SpeciesType.Predator]: 0,
      [SpeciesType.Architect]: 0,
      [SpeciesType.Glider]: 0,
    };

    let totalTd = 0;
    for (const a of this.agents) {
      avgRewardBySpecies[a.species] += a.recentReward;
      eloBySpecies[a.species] += a.eloRating;
      counts[a.species]++;
      totalTd += a.lastTdError;
    }

    Object.keys(avgRewardBySpecies).forEach((k) => {
      const sp = k as SpeciesType;
      if (counts[sp] > 0) {
        avgRewardBySpecies[sp] = Math.round((avgRewardBySpecies[sp] / counts[sp]) * 100) / 100;
        eloBySpecies[sp] = Math.round(eloBySpecies[sp] / counts[sp]);
      }
    });

    return {
      stepCount: this.stepCount,
      episodeCount: this.episodeCount,
      fps: this.currentFps,
      avgRewardBySpecies,
      eloBySpecies,
      totalPopulation: this.agents.length,
      averageTdError: Math.round((totalTd / Math.max(1, this.agents.length)) * 1000) / 1000,
      harmonicEntropy: 0.65,
      activeSoundNodes: this.env.energyNodes.length,
      rewardHistory: this.rewardHistory,
      lossHistory: this.lossHistory,
    };
  }

  public getSelectedAgent(): Agent | null {
    return this.agents.find((a) => a.id === this.selectedAgentId) || null;
  }

  public regenerateWithGAN(difficulty?: number) {
    this.env.generateGANEnvironment(undefined, difficulty);
  }

  public applyLatentSample(latent: number[]) {
    this.env.generateGANEnvironment(latent);
  }

  public resampleLatentSpace() {
    this.env.gan.refreshCandidateLatents();
  }

  public getGANMetrics() {
    return this.env.gan.getMetrics();
  }
}
