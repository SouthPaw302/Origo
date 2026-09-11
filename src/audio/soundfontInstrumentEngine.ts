import { WorkletSynthesizer } from 'spessasynth_lib';
import { SpeciesType } from '../types';

export type InstrumentMode = 'native' | 'hybrid' | 'instruments';

export interface SoundFontStatus {
  ready: boolean;
  loading: boolean;
  fileName: string | null;
  error: string | null;
  mode: InstrumentMode;
  masterVolume: number;
  muted: boolean;
  programs: Record<SpeciesType, number>;
}

const SPECIES_CHANNEL: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 0,
  [SpeciesType.Predator]: 1,
  [SpeciesType.Architect]: 2,
  [SpeciesType.Glider]: 3,
};

const DEFAULT_PROGRAMS: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 11, // vibraphone-like role
  [SpeciesType.Predator]: 38,  // synth bass role
  [SpeciesType.Architect]: 48, // string ensemble role
  [SpeciesType.Glider]: 73,    // flute-like lead role
};

const SPECIES_DURATION_MS: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 420,
  [SpeciesType.Predator]: 220,
  [SpeciesType.Architect]: 900,
  [SpeciesType.Glider]: 280,
};

export class SoundFontInstrumentEngine {
  private context: AudioContext | null = null;
  private outputGain: GainNode | null = null;
  private synth: WorkletSynthesizer | null = null;
  private listeners = new Set<() => void>();
  private status: SoundFontStatus = {
    ready: false,
    loading: false,
    fileName: null,
    error: null,
    mode: 'native',
    masterVolume: 0.7,
    muted: false,
    programs: { ...DEFAULT_PROGRAMS },
  };

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStatus(): SoundFontStatus {
    return {
      ...this.status,
      programs: { ...this.status.programs },
    };
  }

  public async loadFile(file: File) {
    const valid = /\.(sf2|sf3|sfogg|dls)$/i.test(file.name);
    if (!valid) throw new Error('Choose an SF2, SF3, SFOGG or DLS sound bank.');

    this.setStatus({ loading: true, error: null });
    try {
      await this.disposeSynth();
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioCtx();
      await this.context.audioWorklet.addModule('/spessasynth_processor.min.js');

      this.outputGain = this.context.createGain();
      this.applyGain();
      this.outputGain.connect(this.context.destination);

      const synth = new WorkletSynthesizer(this.context, { oneOutput: true });
      synth.connect(this.outputGain);
      const buffer = await file.arrayBuffer();
      await synth.soundBankManager.addSoundBank(buffer, 'origo-user-bank');
      await synth.isReady;
      await this.context.resume();

      this.synth = synth;
      for (const species of Object.values(SpeciesType)) {
        synth.programChange(SPECIES_CHANNEL[species], this.status.programs[species]);
      }

      this.setStatus({
        ready: true,
        loading: false,
        fileName: file.name,
        error: null,
        mode: this.status.mode === 'native' ? 'hybrid' : this.status.mode,
      });
    } catch (error) {
      await this.disposeSynth();
      const message = error instanceof Error ? error.message : 'Unable to load this sound bank.';
      this.setStatus({ ready: false, loading: false, fileName: null, error: message });
      throw error;
    }
  }

  public setMode(mode: InstrumentMode) {
    this.setStatus({ mode });
  }

  public setMasterVolume(volume: number) {
    this.status.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyGain();
    this.emit();
  }

  public setMuted(muted: boolean) {
    this.status.muted = muted;
    this.applyGain();
    this.emit();
  }

  public setProgram(species: SpeciesType, program: number) {
    const next = Math.max(0, Math.min(127, Math.round(program)));
    this.status.programs[species] = next;
    if (this.synth && this.status.ready) {
      this.synth.programChange(SPECIES_CHANNEL[species], next);
    }
    this.emit();
  }

  public shouldPlayNative() {
    return this.status.mode !== 'instruments' || !this.status.ready;
  }

  public shouldPlayInstrument() {
    return this.status.ready && this.status.mode !== 'native';
  }

  public playSpeciesNote(species: SpeciesType, midiNote: number, intensity: number) {
    if (!this.synth || !this.context || !this.shouldPlayInstrument()) return;
    const channel = SPECIES_CHANNEL[species];
    const note = Math.max(0, Math.min(127, Math.round(midiNote)));
    const velocity = Math.max(1, Math.min(127, Math.round((0.25 + intensity * 0.75) * 127)));

    if (this.context.state === 'suspended') void this.context.resume();
    this.synth.noteOn(channel, note, velocity);
    window.setTimeout(() => {
      try { this.synth?.noteOff(channel, note); } catch {}
    }, SPECIES_DURATION_MS[species]);
  }

  public async unload() {
    await this.disposeSynth();
    this.setStatus({ ready: false, loading: false, fileName: null, error: null, mode: 'native' });
  }

  private async disposeSynth() {
    if (this.synth) {
      try { this.synth.stopAll(true); } catch {}
      try { this.synth.destroy(); } catch {}
      this.synth = null;
    }
    if (this.context) {
      try { await this.context.close(); } catch {}
      this.context = null;
    }
    this.outputGain = null;
  }

  private applyGain() {
    if (!this.outputGain || !this.context) return;
    const gain = this.status.muted ? 0 : this.status.masterVolume * 0.6;
    this.outputGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.03);
  }

  private setStatus(patch: Partial<SoundFontStatus>) {
    this.status = { ...this.status, ...patch };
    this.applyGain();
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export const soundFontInstrumentEngine = new SoundFontInstrumentEngine();
