import { SpeciesType, SynthModulationParams } from '../types';
import { quantizeToMidi } from './scales';
import { soundEngine } from './soundEngine';
import { soundFontInstrumentEngine } from './soundfontInstrumentEngine';

export interface AudioTrafficConfig {
  maxEventsPerSecond: number;
  maxContinuousVoices: number;
  continuousUpdateIntervalMs: number;
  chimeIntervalMs: number;
  eventGridMs: number;
  speciesCooldownMs: Record<SpeciesType, number>;
}

export const DEFAULT_AUDIO_TRAFFIC_CONFIG: AudioTrafficConfig = {
  maxEventsPerSecond: 4,
  maxContinuousVoices: 3,
  continuousUpdateIntervalMs: 180,
  chimeIntervalMs: 420,
  eventGridMs: 125,
  speciesCooldownMs: {
    [SpeciesType.Resonator]: 260,
    [SpeciesType.Predator]: 360,
    [SpeciesType.Architect]: 420,
    [SpeciesType.Glider]: 220,
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

  public quantizedDelay(nowMs: number): number {
    const grid = Math.max(1, this.config.eventGridMs);
    const next = Math.ceil(nowMs / grid) * grid;
    return Math.max(0, next - nowMs);
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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function installAudioGovernor() {
  if (installed) return limiter;
  installed = true;

  // Start from a quieter, darker mix. Users can still raise any layer manually.
  soundEngine.setMasterVolume(0.52);
  soundEngine.setNeuralSynthVolume(0.22);
  soundEngine.setDroneVolume(0.14);
  soundEngine.setReverbMix(0.26);
  soundEngine.setDelayMix(0.1);
  soundEngine.setFilterCutoff(3600);

  const originalAgentSound = soundEngine.triggerAgentSound.bind(soundEngine);
  const originalContinuous = soundEngine.updateAgentContinuousSynth.bind(soundEngine);
  const originalChime = soundEngine.triggerChime.bind(soundEngine);
  const originalRelease = soundEngine.releaseAgentSynth.bind(soundEngine);

  soundEngine.triggerAgentSound = (...args: Parameters<typeof originalAgentSound>) => {
    const [species, normalizedX, normalizedPitch, intensity = 0.5, tdError = 0] = args;
    const now = performance.now();
    if (!limiter.allowAgentEvent(species, now)) return;

    const softenedPitch = 0.12 + clamp01(normalizedPitch) * 0.72;
    const softenedIntensity = Math.max(0.16, Math.min(0.72, clamp01(intensity) * 0.68));
    const softenedTdError = Math.max(0, Math.min(0.35, Math.abs(tdError) * 0.35));
    const delay = limiter.quantizedDelay(now);

    window.setTimeout(() => {
      if (soundFontInstrumentEngine.shouldPlayInstrument()) {
        const config = soundEngine.getConfig();
        const midi = quantizeToMidi(softenedPitch, config.rootMidi, config.scaleKey);
        soundFontInstrumentEngine.playSpeciesNote(species, midi, softenedIntensity);
      }

      if (soundFontInstrumentEngine.shouldPlayNative()) {
        originalAgentSound(species, normalizedX, softenedPitch, softenedIntensity, softenedTdError);
      }
    }, delay);
  };

  soundEngine.updateAgentContinuousSynth = (params: SynthModulationParams) => {
    if (!soundFontInstrumentEngine.shouldPlayNative()) return;
    if (!limiter.allowContinuous(params, performance.now())) return;

    const softened: SynthModulationParams = {
      ...params,
      amplitude: clamp01(params.amplitude) * 0.45,
      fmModulationIndex: clamp01(params.fmModulationIndex) * 0.45,
      timbreMorph: clamp01(params.timbreMorph) * 0.7,
      rhythmRate: Math.max(0.6, Math.min(3.2, params.rhythmRate * 0.65)),
      filterCutoff: Math.max(450, Math.min(4200, params.filterCutoff * 0.8)),
      filterResonance: Math.max(0.5, Math.min(3.8, params.filterResonance)),
      reverbSend: Math.min(0.24, params.reverbSend),
      delaySend: Math.min(0.1, params.delaySend),
    };

    originalContinuous(softened);
  };

  soundEngine.triggerChime = (...args: Parameters<typeof originalChime>) => {
    const now = performance.now();
    if (!limiter.allowChime(now)) return;
    window.setTimeout(() => originalChime(...args), limiter.quantizedDelay(now));
  };

  soundEngine.releaseAgentSynth = (agentId: string) => {
    limiter.releaseContinuous(agentId);
    originalRelease(agentId);
  };

  return limiter;
}

export const audioTrafficLimiter = limiter;
