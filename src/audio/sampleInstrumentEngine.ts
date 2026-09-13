import { SpeciesType } from '../types';
import { soundEngine } from './soundEngine';

export interface SampleZoneStatus {
  id: string;
  fileName: string;
  rootMidi: number;
  gain: number;
}

export interface SampleSlotStatus {
  ready: boolean;
  fileName: string | null;
  rootMidi: number;
  gain: number;
  zoneCount: number;
  zones: SampleZoneStatus[];
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

interface SampleZoneRuntime extends SampleZoneStatus {
  buffer: AudioBuffer;
}

interface SampleSlotRuntime {
  ready: boolean;
  fileName: string | null;
  rootMidi: number;
  gain: number;
  zones: SampleZoneRuntime[];
}

export interface SampleZoneInput {
  fileName: string;
  rootMidi: number;
  buffer: AudioBuffer;
  gain?: number;
  id?: string;
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

function createEmptySlot(species: SpeciesType, gain: number): SampleSlotRuntime {
  return {
    ready: false,
    fileName: null,
    rootMidi: DEFAULT_ROOT[species],
    gain,
    zones: [],
  };
}

export class SampleInstrumentEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private listeners = new Set<() => void>();
  private enabled = true;
  private tempoBpm = 100;
  private zoneCounter = 0;
  private species: Record<SpeciesType, SampleSlotRuntime> = {
    [SpeciesType.Resonator]: createEmptySlot(SpeciesType.Resonator, 0.72),
    [SpeciesType.Predator]: createEmptySlot(SpeciesType.Predator, 0.78),
    [SpeciesType.Architect]: createEmptySlot(SpeciesType.Architect, 0.62),
    [SpeciesType.Glider]: createEmptySlot(SpeciesType.Glider, 0.7),
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
    const next = Math.round(clamp(midi, 0, 127));
    const slot = this.species[species];
    slot.rootMidi = next;
    if (slot.zones.length === 1) slot.zones[0].rootMidi = next;
    this.emit();
  }

  public setSpeciesGain(species: SpeciesType, gain: number) {
    this.species[species].gain = clamp(gain, 0, 1.5);
    this.emit();
  }

  /** User uploads intentionally replace the mapped bank for that species with one editable-root sample. */
  public async loadSpeciesSample(species: SpeciesType, file: File) {
    const buffer = await this.decodeFile(file);
    const slot = this.species[species];
    slot.zones = [this.createZone(file.name, slot.rootMidi, buffer)];
    this.refreshSlotSummary(species);
    this.emit();
  }

  public async loadSpeciesSampleZone(species: SpeciesType, file: File, rootMidi: number, replaceExisting = false) {
    const buffer = await this.decodeFile(file);
    this.addDecodedZone(species, file.name, rootMidi, buffer, replaceExisting);
  }

  /** Allows built-in/licensed banks to add decoded zones without pretending they are user files. */
  public async loadSpeciesBlobZone(
    species: SpeciesType,
    blob: Blob,
    fileName: string,
    rootMidi: number,
    replaceExisting = false,
    gain = 1
  ) {
    const context = this.ensureContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    this.addDecodedZone(species, fileName, rootMidi, buffer, replaceExisting, gain);
  }

  public clearSpeciesSample(species: SpeciesType, emit = true) {
    const slot = this.species[species];
    slot.zones = [];
    slot.ready = false;
    slot.fileName = null;
    if (emit) this.emit();
  }

  public hasSpeciesSample(species: SpeciesType) {
    return this.enabled && this.species[species].zones.length > 0;
  }

  public playSpeciesSample(species: SpeciesType, midiNote: number, intensity: number) {
    if (!this.enabled) return false;
    const slot = this.species[species];
    if (!slot.zones.length) return false;

    const targetMidi = Math.round(clamp(midiNote, 0, 127));
    const zone = slot.zones.reduce((best, candidate) =>
      Math.abs(candidate.rootMidi - targetMidi) < Math.abs(best.rootMidi - targetMidi) ? candidate : best
    );

    const context = this.ensureContext();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = zone.buffer;
    const semitones = clamp(targetMidi - zone.rootMidi, -18, 18);
    source.playbackRate.value = Math.pow(2, semitones / 12);
    const native = soundEngine.getConfig();
    gain.gain.value =
      (native.isMuted ? 0 : native.masterVolume) *
      slot.gain *
      zone.gain *
      clamp(0.2 + intensity * 0.8, 0, 1);
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

  private addDecodedZone(
    species: SpeciesType,
    fileName: string,
    rootMidi: number,
    buffer: AudioBuffer,
    replaceExisting = false,
    gain = 1
  ) {
    const slot = this.species[species];
    if (replaceExisting) slot.zones = [];
    const root = Math.round(clamp(rootMidi, 0, 127));
    slot.zones = slot.zones.filter((zone) => zone.rootMidi !== root);
    slot.zones.push(this.createZone(fileName, root, buffer, gain));
    slot.zones.sort((a, b) => a.rootMidi - b.rootMidi);
    if (slot.zones.length === 1) slot.rootMidi = root;
    this.refreshSlotSummary(species);
    this.emit();
  }

  private createZone(fileName: string, rootMidi: number, buffer: AudioBuffer, gain = 1): SampleZoneRuntime {
    return {
      id: `zone_${++this.zoneCounter}`,
      fileName,
      rootMidi: Math.round(clamp(rootMidi, 0, 127)),
      gain: clamp(gain, 0, 1.5),
      buffer,
    };
  }

  private refreshSlotSummary(species: SpeciesType) {
    const slot = this.species[species];
    slot.ready = slot.zones.length > 0;
    slot.fileName = slot.zones.length === 0
      ? null
      : slot.zones.length === 1
        ? slot.zones[0].fileName
        : `${slot.zones.length} mapped recordings`;
  }

  private publicSlot(species: SpeciesType): SampleSlotStatus {
    const slot = this.species[species];
    return {
      ready: slot.ready,
      fileName: slot.fileName,
      rootMidi: slot.rootMidi,
      gain: slot.gain,
      zoneCount: slot.zones.length,
      zones: slot.zones.map(({ id, fileName, rootMidi, gain }) => ({ id, fileName, rootMidi, gain })),
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
