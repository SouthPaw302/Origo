import { SpeciesType } from '../types';
import { OrigoMusicSession } from './types';

function midiToFrequency(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function waveformForSpecies(species: SpeciesType): OscillatorType {
  switch (species) {
    case SpeciesType.Predator: return 'square';
    case SpeciesType.Architect: return 'triangle';
    case SpeciesType.Glider: return 'sawtooth';
    default: return 'sine';
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  let offset = 0;
  const writeText = (text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset++, text.charCodeAt(i)); };
  const write16 = (n: number) => { view.setUint16(offset, n, true); offset += 2; };
  const write32 = (n: number) => { view.setUint32(offset, n, true); offset += 4; };

  writeText('RIFF'); write32(36 + dataSize); writeText('WAVE');
  writeText('fmt '); write32(16); write16(1); write16(channels); write32(sampleRate);
  write32(sampleRate * blockAlign); write16(blockAlign); write16(16);
  writeText('data'); write32(dataSize);

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return out;
}

export async function renderSessionToWav(session: OrigoMusicSession): Promise<Blob> {
  const lastBeat = session.events.reduce((max, e) => Math.max(max, e.position.beat + e.durationBeats), 0);
  const durationSeconds = Math.max(1, lastBeat * 60 / Math.max(1, session.tempoBpm) + 2.5);
  const sampleRate = 44100;
  const OfflineCtx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OfflineCtx(2, Math.ceil(durationSeconds * sampleRate), sampleRate);

  const master = ctx.createGain();
  master.gain.value = 0.72;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 3;
  master.connect(compressor);
  compressor.connect(ctx.destination);

  for (const event of session.events) {
    const start = event.position.beat * 60 / session.tempoBpm;
    const duration = Math.max(0.04, event.durationBeats * 60 / session.tempoBpm);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();

    osc.type = waveformForSpecies(event.species);
    osc.frequency.setValueAtTime(midiToFrequency(event.midiNote), start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900 + event.intensity * 6200, start);
    filter.Q.setValueAtTime(0.7 + Math.abs(event.environment.harmonicField) * 4, start);
    pan.pan.setValueAtTime(Math.max(-1, Math.min(1, event.pan)), start);

    const peak = Math.max(0.01, Math.min(0.22, event.velocity * 0.18));
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  const rendered = await ctx.startRendering();
  return new Blob([audioBufferToWav(rendered)], { type: 'audio/wav' });
}
