import { SpeciesType } from '../types';
import { soundEngine } from './soundEngine';

export interface SampleSlotStatus {
  ready: boolean;
  fileName: string | null;
  rootMidi: number;
  gain: number;
}

export interface AetherLoopStatus {
  ready: boolean;
  fileName: string | null;
  sourceBpm: number;
  bars: number;
  playing: boolean;
  armed: boolean;
  gain: number;
}

export interface SampleRackStatus {
  enabled: boolean;
  species: Record<SpeciesType, SampleSlotStatus>;
  aetherLoop: AetherLoopStatus;
}

interface SampleSlotRuntime extends SampleSlotStatus {
  buffer: AudioBuffer | null;
}

const DEFAULT_ROOT: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 60,
  [SpeciesType.Predator]: 36,
  [SpeciesType.Architect]: 48,
  [SpeciesType.Glider]: 72,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export class SampleInstrumentEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private listeners = new Set<() => void>();
  private enabled = true;
  private tempoBpm = 100;
  private species: Record<SpeciesType, SampleSlotRuntime> = {
    [SpeciesType.Resonator]: { ready: false, fileName: null, rootMidi: DEFAULT_ROOT[SpeciesType.Resonator], gain: 0.72, buffer: null },
    [SpeciesType.Predator]: { ready: false, fileName: null, rootMidi: DEFAULT_ROOT[SpeciesType.Predator], gain: 0.78, buffer: null },
    [SpeciesType.Architect]: { ready: false, fileName: null, rootMidi: DEFAULT_ROOT[SpeciesType.Architect], gain: 0.62, buffer: null },
    [SpeciesType.Glider]: { ready: false, fileName: null, rootMidi: DEFAULT_ROOT[SpeciesType.Glider], gain: 0.7, buffer: null },
  };
  private aetherLoop = {
    ready: false,
    fileName: null as string | null,
    sourceBpm: 100,
    bars: 4,
    playing: false,
    armed: false,
    gain: 0.42,
    buffer: null as AudioBuffer | null,
  };
  private loopSource: AudioBufferSourceNode | null = null;

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStatus(): SampleRackStatus {
    return {
      enabled: this.enabled,
      species: {
        [SpeciesType.Resonator]: this.publicSlot(SpeciesType.Resonator),
        [SpeciesType.Predator]: this.publicSlot(SpeciesType.Predator),
        [SpeciesType.Architect]: this.publicSlot(SpeciesType.Architect),
        [SpeciesType.Glider]: this.publicSlot(SpeciesType.Glider),
      },
      aetherLoop: {
        ready: this.aetherLoop.ready,
        fileName: this.aetherLoop.fileName,
        sourceBpm: this.aetherLoop.sourceBpm,
        bars: this.aetherLoop.bars,
        playing: this.aetherLoop.playing,
        armed: this.aetherLoop.armed,
        gain: this.aetherLoop.gain,
      },
    };
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopAetherLoop();
    this.emit();
  }

  public setTempo(bpm: number) {
    this.tempoBpm = clamp(bpm, 30, 300);
    if (this.loopSource && this.aetherLoop.ready) {
      this.loopSource.playbackRate.setTargetAtTime(
        this.tempoBpm / Math.max(30, this.aetherLoop.sourceBpm),
        this.ensureContext().currentTime,
        0.03
      );
    }
  }

  public setRootMidi(species: SpeciesType, midi: number) {
    this.species[species].rootMidi = Math.round(clamp(midi, 0, 127));
    this.emit();
  }

  public setSpeciesGain(species: SpeciesType, gain: number) {
    this.species[species].gain = clamp(gain, 0, 1.5);
    this.emit();
  }

  public async loadSpeciesSample(species: SpeciesType, file: File) {
    const buffer = await this.decodeFile(file);
    const slot = this.species[species];
    slot.buffer = buffer;
    slot.ready = true;
    slot.fileName = file.name;
    this.emit();
  }

  public clearSpeciesSample(species: SpeciesType) {
    const slot = this.species[species];
    slot.buffer = null;
    slot.ready = false;
    slot.fileName = null;
    this.emit();
  }

  public hasSpeciesSample(species: SpeciesType) {
    return this.enabled && this.species[species].ready && Boolean(this.species[species].buffer);
  }

  public playSpeciesSample(species: SpeciesType, midiNote: number, intensity: number) {
    if (!this.enabled) return false;
    const slot = this.species[species];
    if (!slot.buffer) return false;

    const context = this.ensureContext();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = slot.buffer;
    const semitones = clamp(Math.round(midiNote) - slot.rootMidi, -24, 24);
    source.playbackRate.value = Math.pow(2, semitones / 12);
    const native = soundEngine.getConfig();
    gain.gain.value = (native.isMuted ? 0 : native.masterVolume) * slot.gain * clamp(0.2 + intensity * 0.8, 0, 1);
    source.connect(gain);
    gain.connect(this.ensureMaster());
    if (context.state === 'suspended') void context.resume();
    source.start();
    return true;
  }

  public async loadAetherLoop(file: File, sourceBpm: number, bars: number) {
    this.stopAetherLoop();
    this.aetherLoop.buffer = await this.decodeFile(file);
    this.aetherLoop.ready = true;
    this.aetherLoop.armed = false;
    this.aetherLoop.fileName = file.name;
    this.aetherLoop.sourceBpm = clamp(sourceBpm, 30, 300);
    this.aetherLoop.bars = Math.max(1, Math.min(32, Math.round(bars)));
    this.emit();
  }

  /** Allows a future AetherStream/Libertas bridge to hand Origo a rendered loop without UI upload. */
  public async loadAetherLoopBlob(blob: Blob, label: string, sourceBpm: number, bars: number) {
    this.stopAetherLoop();
    const context = this.ensureContext();
    this.aetherLoop.buffer = await context.decodeAudioData(await blob.arrayBuffer());
    this.aetherLoop.ready = true;
    this.aetherLoop.armed = false;
    this.aetherLoop.fileName = label;
    this.aetherLoop.sourceBpm = clamp(sourceBpm, 30, 300);
    this.aetherLoop.bars = Math.max(1, Math.min(32, Math.round(bars)));
    this.emit();
  }

  public armAetherLoopForNextTake() {
    if (!this.aetherLoop.ready || !this.aetherLoop.buffer) return false;
    this.stopAetherLoop();
    this.aetherLoop.armed = true;
    this.emit();
    return true;
  }

  public setAetherLoopGain(gain: number) {
    this.aetherLoop.gain = clamp(gain, 0, 1.5);
    this.emit();
  }

  /** Starts exactly when called; OrigoMusicSystem calls this at the new-take bar-zero boundary when armed. */
  public startAetherLoop() {
    if (!this.enabled || !this.aetherLoop.buffer) return false;
    this.stopAetherLoop();
    const context = this.ensureContext();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.aetherLoop.buffer;
    source.loop = true;
    source.playbackRate.value = this.tempoBpm / Math.max(30, this.aetherLoop.sourceBpm);
    const native = soundEngine.getConfig();
    gain.gain.value = (native.isMuted ? 0 : native.masterVolume) * this.aetherLoop.gain;
    source.connect(gain);
    gain.connect(this.ensureMaster());
    if (context.state === 'suspended') void context.resume();
    source.start();
    this.loopSource = source;
    this.aetherLoop.playing = true;
    this.aetherLoop.armed = false;
    source.onended = () => {
      if (this.loopSource === source) {
        this.loopSource = null;
        this.aetherLoop.playing = false;
        this.emit();
      }
    };
    this.emit();
    return true;
  }

  public stopAetherLoop() {
    if (this.loopSource) {
      try { this.loopSource.stop(); } catch {}
      try { this.loopSource.disconnect(); } catch {}
      this.loopSource = null;
    }
    if (this.aetherLoop.playing) {
      this.aetherLoop.playing = false;
      this.emit();
    }
  }

  public clearAetherLoop() {
    this.stopAetherLoop();
    this.aetherLoop.buffer = null;
    this.aetherLoop.ready = false;
    this.aetherLoop.armed = false;
    this.aetherLoop.fileName = null;
    this.emit();
  }

  private publicSlot(species: SpeciesType): SampleSlotStatus {
    const slot = this.species[species];
    return {
      ready: slot.ready,
      fileName: slot.fileName,
      rootMidi: slot.rootMidi,
      gain: slot.gain,
    };
  }

  private ensureContext() {
    if (!this.context) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioCtx();
    }
    return this.context;
  }

  private ensureMaster() {
    const context = this.ensureContext();
    if (!this.masterGain) {
      this.masterGain = context.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(context.destination);
    }
    return this.masterGain;
  }

  private async decodeFile(file: File) {
    const valid = /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(file.name) || file.type.startsWith('audio/');
    if (!valid) throw new Error('Choose an audio sample or loop file.');
    const context = this.ensureContext();
    return context.decodeAudioData(await file.arrayBuffer());
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export const sampleInstrumentEngine = new SampleInstrumentEngine();
