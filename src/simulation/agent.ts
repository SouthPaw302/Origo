/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpeciesType, SpeciesConfig, AgentMemory, AgentStats, AgentSensoryInput, RewardBreakdown, SynthModulationParams } from '../types';
import { NeuralNetwork } from './neuralNet';
import { SimulationEnvironment } from './environment';
import { soundEngine } from '../audio/soundEngine';

export const SPECIES_CONFIGS: Record<SpeciesType, SpeciesConfig> = {
  [SpeciesType.Resonator]: {
    type: SpeciesType.Resonator,
    name: 'Resonator',
    color: '#06b6d4', // Cyan
    secondaryColor: '#22d3ee',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    description: 'Harvests resonance fields, emits shimmering crystalline FM chord pulses',
    soundRole: 'FM Shimmer / Bell Arpeggios',
    baseSpeed: 2.6,
    maxEnergy: 140,
  },
  [SpeciesType.Predator]: {
    type: SpeciesType.Predator,
    name: 'Predator',
    color: '#f43f5e', // Rose / Red
    secondaryColor: '#fb7185',
    glowColor: 'rgba(244, 63, 94, 0.6)',
    description: 'Hunts rivals via echolocation, emits heavy bass stabs & percussive impacts',
    soundRole: 'Sub-Bass & Punch Hits',
    baseSpeed: 3.1,
    maxEnergy: 160,
  },
  [SpeciesType.Architect]: {
    type: SpeciesType.Architect,
    name: 'Architect',
    color: '#f59e0b', // Amber / Gold
    secondaryColor: '#fbbf24',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    description: 'Terraforms terrain, plants crystal nodes, sculpts warm resonant pad chords',
    soundRole: 'Resonant Pad & Drone Chords',
    baseSpeed: 2.2,
    maxEnergy: 180,
  },
  [SpeciesType.Glider]: {
    type: SpeciesType.Glider,
    name: 'Glider',
    color: '#a855f7', // Purple / Violet
    secondaryColor: '#c084fc',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    description: 'High-agility wave rider, weaves harmonic wind currents & crystalline sweeps',
    soundRole: 'Fast Glissando Sweeps',
    baseSpeed: 3.6,
    maxEnergy: 130,
  },
};

export class Agent {
  public id: string;
  public species: SpeciesType;
  public config: SpeciesConfig;

  // Kinematics
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public angle: number;
  public radius: number = 7.5;
  public energy: number;
  public maxEnergy: number;

  // Neural Brain & RL Memory
  public brain: NeuralNetwork;
  public memory: AgentMemory[] = [];
  public maxMemorySize: number = 64;

  // Performance Stats & Self-Play Metrics
  public generation: number = 1;
  public age: number = 0;
  public totalReward: number = 0;
  public recentReward: number = 0;
  public eloRating: number = 1200;
  public kills: number = 0;
  public energyGathered: number = 0;
  public nodesCreated: number = 0;
  public pulsesEmitted: number = 0;
  public lastTdError: number = 0;

  // Granular Reward Shaping Breakdown
  public lastRewardBreakdown: RewardBreakdown = {
    extrinsic: 0,
    curiosity: 0,
    topological: 0,
    acoustic: 0,
    coevolution: 0,
    total: 0,
  };

  // Evolving Audio Synthesis Parameters
  public currentAudioModulation = {
    pitchHz: 440,
    fmIndex: 0.5,
    timbreMorph: 0.5,
    rhythmRateHz: 2.0,
    filterCutoffHz: 2500,
    amplitude: 0.5,
  };

  // Internal rhythm phase accumulator
  public rhythmPhase: number = 0;

  // Visual & Action FX states
  public isPulseActive: boolean = false;
  public pulseCooldown: number = 0;
  public abilityCooldown: number = 0;
  public lastSensoryInput: number[] = [];
  public lastActionOutputs: number[] = [];
  public lastActionProbs: number[] = [];
  public lastStateValue: number = 0;
  public trail: { x: number; y: number; alpha: number }[] = [];

  constructor(
    species: SpeciesType,
    startX: number,
    startY: number,
    brain?: NeuralNetwork,
    generation: number = 1
  ) {
    this.id = 'agent_' + Math.random().toString(36).substring(2, 9);
    this.species = species;
    this.config = SPECIES_CONFIGS[species];
    this.x = startX;
    this.y = startY;
    this.angle = Math.random() * Math.PI * 2;
    this.maxEnergy = this.config.maxEnergy;
    this.energy = this.maxEnergy * 0.8;
    this.generation = generation;

    // Sensory input vector size:
    // 6 raycasts + 4 rival + 4 ally + 4 energy + 1 field + 1 terrain + 1 speed + 1 energy + 1 sound + 2 clock = 25 inputs
    const inputSize = 25;
    const outputSize = 5; // [thrust, steer, sonicPulse, terraform, ability]

    this.brain = brain ? brain.clone() : new NeuralNetwork(inputSize, [32, 24], outputSize);
  }

  /**
   * Gather sensory vector from environment and other agents
   */
  public perceive(env: SimulationEnvironment, allAgents: Agent[], globalClock: number): number[] {
    const inputs: number[] = [];

    // 1. Raycasts (6 angles relative to agent's heading: -90, -45, -15, +15, +45, +90 deg)
    const rayAngles = [-1.57, -0.78, -0.26, 0.26, 0.78, 1.57];
    for (const dTheta of rayAngles) {
      const rayDist = env.raycast(this.x, this.y, this.angle + dTheta, 180);
      inputs.push(rayDist);
    }

    // 2. Nearest Rival Detection (Distance, dx, dy, rival energy)
    let nearestRivalDist = 999;
    let rivalDx = 0;
    let rivalDy = 0;
    let rivalEnergy = 0;

    // 3. Nearest Ally Detection
    let nearestAllyDist = 999;
    let allyDx = 0;
    let allyDy = 0;

    for (const other of allAgents) {
      if (other.id === this.id) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (other.species === this.species) {
        if (dist < nearestAllyDist) {
          nearestAllyDist = dist;
          allyDx = dx / Math.max(1, dist);
          allyDy = dy / Math.max(1, dist);
        }
      } else {
        if (dist < nearestRivalDist) {
          nearestRivalDist = dist;
          rivalDx = dx / Math.max(1, dist);
          rivalDy = dy / Math.max(1, dist);
          rivalEnergy = other.energy / other.maxEnergy;
        }
      }
    }

    // Normalized proximity (0 = far away, 1 = right next to agent)
    inputs.push(Math.max(0, 1 - nearestRivalDist / 250), rivalDx, rivalDy, rivalEnergy);
    inputs.push(Math.max(0, 1 - nearestAllyDist / 250), allyDx, allyDy, nearestAllyDist < 50 ? 1 : 0);

    // 4. Nearest Energy Node Detection
    let nearestNodeDist = 999;
    let nodeDx = 0;
    let nodeDy = 0;
    let nodeCharge = 0;

    for (const node of env.energyNodes) {
      const dx = node.x - this.x;
      const dy = node.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestNodeDist) {
        nearestNodeDist = dist;
        nodeDx = dx / Math.max(1, dist);
        nodeDy = dy / Math.max(1, dist);
        nodeCharge = node.energy / node.maxEnergy;
      }
    }

    inputs.push(Math.max(0, 1 - nearestNodeDist / 300), nodeDx, nodeDy, nodeCharge);

    // 5. Environmental Physical/Acoustic Fields
    const fieldVal = env.sampleHarmonicField(this.x, this.y);
    const terrainHeight = env.sampleTerrain(this.x, this.y);
    const soundPressure = env.sampleAcousticPressure(this.x, this.y);
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) / (this.config.baseSpeed * 1.5);

    inputs.push(
      fieldVal,
      terrainHeight,
      Math.min(1, speed),
      this.energy / this.maxEnergy,
      soundPressure,
      Math.sin(globalClock * 0.05),
      Math.cos(globalClock * 0.05)
    );

    this.lastSensoryInput = inputs;
    return inputs;
  }

  /**
   * Execute Action step with RL forward pass, physics simulation,
   * procedural reward shaping, and dynamic audio synthesis.
   */
  public step(
    env: SimulationEnvironment,
    allAgents: Agent[],
    globalClock: number,
    enableAudio: boolean = true,
    isPrimaryAudioAgent: boolean = false
  ): number {
    this.age++;
    if (this.pulseCooldown > 0) this.pulseCooldown--;
    if (this.abilityCooldown > 0) this.abilityCooldown--;

    // 1. Perception
    const state = this.perceive(env, allAgents, globalClock);

    // 2. Neural Forward Pass
    const { actionOutputs, actionProbs, stateValue } = this.brain.forward(state);
    this.lastActionOutputs = actionOutputs;
    this.lastActionProbs = actionProbs;
    this.lastStateValue = stateValue;

    const [rawThrust, rawSteer, rawPulse, rawTerraform, rawAbility] = actionOutputs;

    // 3. Kinematic Physics Update
    const steerAngle = rawSteer * 0.18;
    this.angle += steerAngle;

    const thrustForce = Math.max(-0.4, rawThrust) * this.config.baseSpeed;
    const ax = Math.cos(this.angle) * thrustForce;
    const ay = Math.sin(this.angle) * thrustForce;

    this.vx = (this.vx + ax * 0.25) * 0.88;
    this.vy = (this.vy + ay * 0.25) * 0.88;

    this.x += this.vx;
    this.y += this.vy;

    // Boundary constraints & soft bounce
    const pad = 15;
    let hitBoundary = false;
    if (this.x < pad) { this.x = pad; this.vx = Math.abs(this.vx) * 0.6; hitBoundary = true; }
    if (this.x > env.width - pad) { this.x = env.width - pad; this.vx = -Math.abs(this.vx) * 0.6; hitBoundary = true; }
    if (this.y < pad) { this.y = pad; this.vy = Math.abs(this.vy) * 0.6; hitBoundary = true; }
    if (this.y > env.height - pad) { this.y = env.height - pad; this.vy = -Math.abs(this.vy) * 0.6; hitBoundary = true; }

    // Record trail for visual rendering
    this.trail.push({ x: this.x, y: this.y, alpha: 1.0 });
    if (this.trail.length > 10) this.trail.shift();
    for (const t of this.trail) t.alpha *= 0.85;

    // Energy consumption for movement
    const movementCost = 0.05 + (Math.abs(thrustForce) + Math.abs(steerAngle)) * 0.03;
    this.energy -= movementCost;

    // ==========================================
    // REWARD SHAPING MECHANISM
    // Multi-faceted incentive structure guiding exploration of novel GAN environments
    // ==========================================
    let rExtrinsic = 0.02; // Small base alive reward
    let rTopological = 0;  // Reward for exploring novel terrain curvature & saddle points
    let rAcoustic = 0;     // Reward for resonance field interactions & echo detection
    let rCoevolution = 0;  // Reward for interspecies self-play dynamic balance

    if (hitBoundary) {
      rExtrinsic -= 0.15;
    }

    // A. Topological Exploration Reward (GAN Environment interaction)
    // Sample gradient of procedural terrain around agent
    const tCurrent = env.sampleTerrain(this.x, this.y);
    const tAhead = env.sampleTerrain(this.x + Math.cos(this.angle) * 20, this.y + Math.sin(this.angle) * 20);
    const terrainGradient = Math.abs(tAhead - tCurrent);

    // Reward navigating high-complexity terrain contours without stalling
    const speedMagnitude = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (terrainGradient > 0.08 && speedMagnitude > 0.5) {
      rTopological += Math.min(0.25, terrainGradient * 1.5 * (speedMagnitude / this.config.baseSpeed));
    }

    // B. Acoustic & Resonance Reward
    const localHarmonicField = env.sampleHarmonicField(this.x, this.y);
    const soundPressure = env.sampleAcousticPressure(this.x, this.y);

    if (this.species === SpeciesType.Resonator) {
      rAcoustic += Math.max(0, localHarmonicField * 0.35);
    } else if (this.species === SpeciesType.Glider) {
      // Wave riding bonus on high acoustic energy fronts
      if (soundPressure > 0.2) {
        rAcoustic += soundPressure * 0.25;
      }
    }

    // 5. Environmental Interaction: Energy Nodes (Extrinsic)
    for (const node of env.energyNodes) {
      const dx = node.x - this.x;
      const dy = node.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.radius + node.radius) {
        const harvest = Math.min(node.energy, 4.0);
        node.energy -= harvest;
        this.energy = Math.min(this.maxEnergy, this.energy + harvest * 1.5);
        this.energyGathered += harvest;
        rExtrinsic += 0.45;

        if (enableAudio && Math.random() < 0.25) {
          soundEngine.triggerChime(node.harmonicFrequency);
        }
      }
    }

    // 6. Sonic Pulse Action (Echolocation & Acoustic waves)
    this.isPulseActive = rawPulse > 0.4;
    let pulseTriggeredThisStep = false;

    if (this.isPulseActive && this.pulseCooldown === 0 && this.energy > 8) {
      this.pulseCooldown = 18;
      this.energy -= 4;
      this.pulsesEmitted++;
      pulseTriggeredThisStep = true;

      const intensity = (rawPulse + 1) / 2; // 0.7 .. 1.0
      const pitchNorm = (this.y / env.height) * 0.8 + (rawTerraform + 1) * 0.1;

      env.addAcousticWave(this.x, this.y, this.species, this.config.color, intensity, pitchNorm);

      if (enableAudio) {
        soundEngine.triggerAgentSound(
          this.species,
          this.x / env.width,
          pitchNorm,
          intensity,
          this.lastTdError
        );
      }

      rAcoustic += 0.08;
    }

    // 7. Terraforming / Field Action
    if (Math.abs(rawTerraform) > 0.3) {
      const terraformAmount = rawTerraform * 0.08;
      if (this.species === SpeciesType.Architect) {
        env.deformTerrain(this.x, this.y, terraformAmount, 30);
        rTopological += 0.12;
        this.energy -= 0.03;
      } else {
        env.depositHarmonicEnergy(this.x, this.y, terraformAmount * 0.5, 25);
        rAcoustic += 0.05;
      }
    }

    // 8. Special Species Ability
    if (rawAbility > 0.6 && this.abilityCooldown === 0 && this.energy > 15) {
      this.abilityCooldown = 60;
      this.energy -= 10;

      switch (this.species) {
        case SpeciesType.Predator: {
          this.vx += Math.cos(this.angle) * 8.0;
          this.vy += Math.sin(this.angle) * 8.0;
          rExtrinsic += 0.1;
          break;
        }
        case SpeciesType.Architect: {
          if (env.energyNodes.length < env.maxNodes + 4) {
            env.spawnEnergyNode(this.x, this.y);
            this.nodesCreated++;
            rExtrinsic += 0.6;
          }
          break;
        }
        case SpeciesType.Glider: {
          this.vx *= 1.8;
          this.vy *= 1.8;
          rTopological += 0.15;
          break;
        }
        case SpeciesType.Resonator: {
          env.depositHarmonicEnergy(this.x, this.y, 0.8, 60);
          rAcoustic += 0.3;
          break;
        }
      }
    }

    // 9. Self-Play Combat & Interspecies Dynamics
    for (const other of allAgents) {
      if (other.id === this.id) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.radius + other.radius + 2) {
        if (this.species === SpeciesType.Predator && other.species !== SpeciesType.Predator) {
          const siphon = Math.min(other.energy, 18);
          other.energy -= siphon;
          this.energy = Math.min(this.maxEnergy, this.energy + siphon * 0.9);
          rExtrinsic += 0.85;
          rCoevolution += 0.4;
          other.totalReward -= 0.6;
          this.kills++;

          this.updateElo(other, 1.0);

          if (enableAudio) {
            soundEngine.triggerAgentSound(SpeciesType.Predator, this.x / env.width, 0.15, 0.9, 0.8);
          }
        } else if (this.species === other.species) {
          // Flock synergy bonus
          rCoevolution += 0.05;
        }
      }
    }

    // Compute Intrinsic Curiosity Bonus (State prediction error)
    const nextState = this.perceive(env, allAgents, globalClock);
    const chosenActionIdx = actionProbs.indexOf(Math.max(...actionProbs));
    const rCuriosity = this.brain.computeCuriosityReward(state, chosenActionIdx >= 0 ? chosenActionIdx : 0, nextState);

    // Total Shaped Reward
    const totalStepReward = rExtrinsic + (rCuriosity * 0.35) + rTopological + rAcoustic + rCoevolution;

    this.lastRewardBreakdown = {
      extrinsic: Math.round(rExtrinsic * 1000) / 1000,
      curiosity: Math.round(rCuriosity * 1000) / 1000,
      topological: Math.round(rTopological * 1000) / 1000,
      acoustic: Math.round(rAcoustic * 1000) / 1000,
      coevolution: Math.round(rCoevolution * 1000) / 1000,
      total: Math.round(totalStepReward * 1000) / 1000,
    };

    // ==========================================
    // EVOLVING AUDIO SYNTHESIS CONTROLLER
    // Map agent RL internal states & actions to real-time WebAudio parameters
    // ==========================================
    const normalizedPitch = Math.max(0, Math.min(1,
      (this.y / env.height) * 0.6 +
      ((Math.sin(this.angle) + 1) * 0.2) +
      (localHarmonicField * 0.2)
    ));

    // Dynamic FM Modulation index: driven by brain TD error and action variance
    const fmModIndex = Math.max(0.1, Math.min(1.0,
      (this.lastTdError * 1.8) +
      (Math.abs(rawSteer) * 0.4) +
      (this.species === SpeciesType.Resonator ? 0.3 : 0.0)
    ));

    // Dynamic Timbre: shifts smoothly from sine/warm wave to complex harmonics as energy & speed rise
    const timbreMorph = Math.max(0, Math.min(1,
      (this.energy / this.maxEnergy) * 0.6 +
      (speedMagnitude / this.config.baseSpeed) * 0.4
    ));

    // Internal rhythm accumulator
    const rhythmRate = 1.0 + (speedMagnitude / this.config.baseSpeed) * 3.5;
    this.rhythmPhase += rhythmRate * 0.05;
    const rhythmTrigger = (pulseTriggeredThisStep || (Math.sin(this.rhythmPhase) > 0.94 && speedMagnitude > 0.8));

    // Dynamic VCF Cutoff: modulated by elevation and acoustic field
    const filterCutoff = Math.max(250, Math.min(9500,
      1200 + (tCurrent * 4500) + (soundPressure * 3000)
    ));

    const filterResonance = 1.5 + (localHarmonicField * 6.0) + (this.lastTdError * 4.0);
    const synthAmp = (this.energy > 0 ? (0.2 + (this.energy / this.maxEnergy) * 0.8) : 0.0);
    const pan = (this.x / env.width) * 2 - 1;

    const synthParams: SynthModulationParams = {
      agentId: this.id,
      species: this.species,
      pitchNormalized: normalizedPitch,
      fmModulationIndex: fmModIndex,
      timbreMorph,
      rhythmTrigger,
      rhythmRate,
      filterCutoff,
      filterResonance,
      amplitude: synthAmp,
      pan,
      reverbSend: 0.35,
      delaySend: 0.2,
    };

    this.currentAudioModulation = {
      pitchHz: Math.round(110 * Math.pow(2, normalizedPitch * 3)),
      fmIndex: Math.round(fmModIndex * 100) / 100,
      timbreMorph: Math.round(timbreMorph * 100) / 100,
      rhythmRateHz: Math.round(rhythmRate * 10) / 10,
      filterCutoffHz: Math.round(filterCutoff),
      amplitude: Math.round(synthAmp * 100) / 100,
    };

    if (enableAudio && (isPrimaryAudioAgent || Math.random() < 0.2)) {
      soundEngine.updateAgentContinuousSynth(synthParams);
    }

    // 10. Record Memory Transition for pure RL learning
    this.memory.push({
      state,
      action: chosenActionIdx >= 0 ? chosenActionIdx : 0,
      actionProbs,
      reward: totalStepReward,
      value: stateValue,
      nextState,
      done: this.energy <= 0,
    });

    if (this.memory.length > this.maxMemorySize) {
      this.memory.shift();
    }

    this.totalReward += totalStepReward;
    this.recentReward = this.recentReward * 0.95 + totalStepReward * 0.05;

    return totalStepReward;
  }

  /**
   * Elo Rating System for Self-Play dynamic balance
   */
  public updateElo(opponent: Agent, score: number) {
    const k = 24;
    const expectedScore = 1 / (1 + Math.pow(10, (opponent.eloRating - this.eloRating) / 400));
    const oppExpected = 1 - expectedScore;

    this.eloRating = Math.round(this.eloRating + k * (score - expectedScore));
    opponent.eloRating = Math.round(opponent.eloRating + k * ((1 - score) - oppExpected));
  }

  /**
   * Train brain using memory buffer
   */
  public train(learningRate: number = 0.005, gamma: number = 0.95, curiosityWeight: number = 0.1) {
    if (this.memory.length < 8) return;
    const result = this.brain.trainBatch(this.memory, learningRate, gamma, curiosityWeight);
    this.lastTdError = result.avgTdError;
  }

  /**
   * Get stats for UI inspection
   */
  public getStats(): AgentStats {
    return {
      id: this.id,
      species: this.species,
      generation: this.generation,
      totalReward: Math.round(this.totalReward * 10) / 10,
      recentReward: Math.round(this.recentReward * 100) / 100,
      eloRating: this.eloRating,
      energy: Math.round(this.energy),
      age: this.age,
      kills: this.kills,
      energyGathered: Math.round(this.energyGathered),
      nodesCreated: this.nodesCreated,
      pulsesEmitted: this.pulsesEmitted,
      tdError: Math.round(this.lastTdError * 1000) / 1000,
      rewardBreakdown: this.lastRewardBreakdown,
      audioModulation: this.currentAudioModulation,
    };
  }
}

