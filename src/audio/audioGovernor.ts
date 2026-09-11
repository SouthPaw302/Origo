import { SpeciesType, SynthModulationParams } from '../types';
import { soundEngine } from './soundEngine';

export interface AudioTrafficConfig {
  maxEventsPerSecond: number;
  maxContinuousVoices: number;
  continuousUpdateIntervalMs: number;
  chimeIntervalMs: number;
  speciesCooldownMs: Record<SpeciesType, number>;
}

export const DEFAULT_AUDIO_TRAFFIC_CONFIG: AudioTrafficConfig = {
  maxEventsPerSecond: 8,
  maxContinuousVoices: 5,
  continuousUpdateIntervalMs: 100,
  chimeIntervalMs: 180,
  speciesCooldownMs: {
    [SpeciesType.Resonator]: 110,
    [SpeciesType.Predator]: 140,
    [SpeciesType.Architect]: 170,
    [SpeciesType.Glider]: 90,
  },
};

export class AudioTrafficLimiter {
  private recentEvents: number[] = [];
  private lastSpeciesEvent = new Map<SpeciesType, number>();
  private continuousAgents = new Set<string>();
  private lastContinuousUpdate = new Map<string, number>();
  private lastChime = Number.NEGATIVE_INFINITY;

  constructor(private config: AudioTrafficConfig = DEFAULT_AUDIO_TRAFFIC_CONFIG) {}

  public allowAgentEvent(species: SpeciesType, nowMs: number): boolean {
    this.recentEvents = this.recentEvents.filter((time) => nowMs - time < 1000);
    if (this.recentEvents.length >= this.config.maxEventsPerSecond) return false;

    const last = this.lastSpeciesEvent.get(species) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - last < this.config.speciesCooldownMs[species]) return false;

    this.lastSpeciesEvent.set(species, nowMs);
    this.recentEvents.push(nowMs);
    return true;
  }

  public allowContinuous(params: SynthModulationParams, nowMs: number): boolean {
    const known = this.continuousAgents.has(params.agentId);
    if (!known) {
      if (this.continuousAgents.size >= this.config.maxContinuousVoices) return false;
      this.continuousAgents.add(params.agentId);
    }

    const last = this.lastContinuousUpdate.get(params.agentId) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - last < this.config.continuousUpdateIntervalMs) return false;
    this.lastContinuousUpdate.set(params.agentId, nowMs);
    return true;
  }

  public releaseContinuous(agentId: string) {
    this.continuousAgents.delete(agentId);
    this.lastContinuousUpdate.delete(agentId);
  }

  public allowChime(nowMs: number): boolean {
    if (nowMs - this.lastChime < this.config.chimeIntervalMs) return false;
    this.lastChime = nowMs;
    return true;
  }

  public reset() {
    this.recentEvents = [];
    this.lastSpeciesEvent.clear();
    this.continuousAgents.clear();
    this.lastContinuousUpdate.clear();
    this.lastChime = Number.NEGATIVE_INFINITY;
  }

  public getStats() {
    return {
      activeContinuousVoices: this.continuousAgents.size,
      recentEventCount: this.recentEvents.length,
    };
  }
}

const limiter = new AudioTrafficLimiter();
let installed = false;

export function installAudioGovernor() {
  if (installed) return limiter;
  installed = true;

  const originalAgentSound = soundEngine.triggerAgentSound.bind(soundEngine);
  const originalContinuous = soundEngine.updateAgentContinuousSynth.bind(soundEngine);
  const originalChime = soundEngine.triggerChime.bind(soundEngine);
  const originalRelease = soundEngine.releaseAgentSynth.bind(soundEngine);

  soundEngine.triggerAgentSound = (...args: Parameters<typeof originalAgentSound>) => {
    const species = args[0];
    if (!limiter.allowAgentEvent(species, performance.now())) return;
    originalAgentSound(...args);
  };

  soundEngine.updateAgentContinuousSynth = (params: SynthModulationParams) => {
    if (!limiter.allowContinuous(params, performance.now())) return;
    originalContinuous(params);
  };

  soundEngine.triggerChime = (...args: Parameters<typeof originalChime>) => {
    if (!limiter.allowChime(performance.now())) return;
    originalChime(...args);
  };

  soundEngine.releaseAgentSynth = (agentId: string) => {
    limiter.releaseContinuous(agentId);
    originalRelease(agentId);
  };

  return limiter;
}

export const audioTrafficLimiter = limiter;
