export type CoreWaveform = OscillatorType | 'noise';

export interface AudioUnlockResult {
  ready: boolean;
  state: string;
  message: string;
}

class CoreAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;

  public async unlockAndTest(): Promise<AudioUnlockResult> {
    try {
      const AudioCtor = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        return { ready: false, state: 'unsupported', message: 'Web Audio is unavailable in this browser view.' };
      }

      if (!this.ctx) {
        this.ctx = new AudioCtor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.65;
        this.master.connect(this.ctx.destination);
      }

      await this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
      if (!this.unlocked) {
        return {
          ready: false,
          state: this.ctx.state,
          message: `Audio context exists but playback is ${this.ctx.state}.`,
        };
      }

      this.playTone(330, 'sine', 0.18, 0.32);
      window.setTimeout(() => this.playTone(520, 'triangle', 0.22, 0.28), 190);
      return { ready: true, state: this.ctx.state, message: 'Audio ready. Test tones played.' };
    } catch (error) {
      return {
        ready: false,
        state: 'blocked',
        message: error instanceof Error ? error.message : 'Audio initialization was blocked.',
      };
    }
  }

  public isReady() {
    return this.unlocked && this.ctx?.state === 'running';
  }

  public playTone(
    frequency: number,
    waveform: CoreWaveform = 'sine',
    duration = 0.2,
    amplitude = 0.2,
    pan = 0,
  ) {
    if (!this.ctx || !this.master || !this.isReady()) return false;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, amplitude), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (waveform === 'noise') {
      const frames = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.max(80, Math.min(8000, frequency)), now);
      filter.Q.setValueAtTime(2.5, now);
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.master);
      source.start(now);
      return true;
    }

    const osc = this.ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(Math.max(20, Math.min(12000, frequency)), now);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    return true;
  }
}

export const coreAudio = new CoreAudioEngine();
