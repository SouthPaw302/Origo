import { SpeciesType } from '../types';
import type { SampleRenderSnapshot, SampleRenderZone } from '../audio/sampleInstrumentEngine';
import { OrigoMusicSession } from './types';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

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

function nearestZone(zones: SampleRenderZone[], midiNote: number) {
  if (!zones.length) return null;
  const target = Math.round(clamp(midiNote, 0, 127));
  return zones.reduce((best, candidate) =>
    Math.abs(candidate.rootMidi - target) < Math.abs(best.rootMidi - target) ? candidate : best
  );
}

function playbackRateFor(zone: SampleRenderZone, midiNote: number) {
  if (!zone.pitchTracking) return 1;
  const semitones = clamp(Math.round(midiNote) - zone.rootMidi, -18, 18);
  return Math.pow(2, semitones / 12);
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

function renderDuration(session: OrigoMusicSession, samples?: SampleRenderSnapshot | null) {
  const beatSeconds = 60 / Math.max(1, session.tempoBpm);
  let end = session.events.reduce(
    (max, event) => Math.max(max, (event.position.beat + event.durationBeats) * beatSeconds),
    0
  ) + 2.5;

  if (samples?.enabled) {
    for (const event of session.events) {
      const zone = nearestZone(samples.species[event.species].zones, event.midiNote);
      if (!zone) continue;
      const start = event.position.beat * beatSeconds;
      const sampleEnd = start + zone.buffer.duration / playbackRateFor(zone, event.midiNote) + 0.25;
      end = Math.max(end, sampleEnd);
    }
  }
  return Math.max(1, end);
}

function scheduleSampleLayer(
  ctx: OfflineAudioContext,
  master: AudioNode,
  session: OrigoMusicSession,
  samples: SampleRenderSnapshot | null | undefined
) {
  if (!samples?.enabled) return new Set<string>();
  const renderedEvents = new Set<string>();
  const beatSeconds = 60 / Math.max(1, session.tempoBpm);

  for (const event of session.events) {
    const slot = samples.species[event.species];
    const zone = nearestZone(slot.zones, event.midiNote);
    if (!zone) continue;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const start = event.position.beat * beatSeconds;
    const rate = playbackRateFor(zone, event.midiNote);
    const duration = zone.buffer.duration / rate;
    const level = clamp(slot.gain * zone.gain * (0.2 + event.intensity * 0.8), 0.01, 1.25) * 0.48;

    source.buffer = zone.buffer;
    source.playbackRate.setValueAtTime(rate, start);
    pan.pan.setValueAtTime(clamp(event.pan, -1, 1), start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level, start + Math.min(0.006, duration * 0.08));
    if (duration > 0.025) {
      const releaseStart = Math.max(start + 0.012, start + duration - Math.min(0.018, duration * 0.15));
      gain.gain.setValueAtTime(level, releaseStart);
      gain.gain.linearRampToValueAtTime(0.0001, start + duration);
    }

    source.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    source.start(start);
    renderedEvents.add(event.id);
  }
  return renderedEvents;
}

/**
 * Render a take artifact from its event timeline plus the sample palette that
 * was active when recording began. The procedural layer stays underneath as
 * Origo's synthetic voice; real recorded zones are no longer replaced by a
 * generic oscillator during export.
 */
export async function renderSessionToWav(
  session: OrigoMusicSession,
  samples?: SampleRenderSnapshot | null
): Promise<Blob> {
  const durationSeconds = renderDuration(session, samples);
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

  const sampledEvents = scheduleSampleLayer(ctx, master, session, samples);

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
    pan.pan.setValueAtTime(clamp(event.pan, -1, 1), start);

    // When a real recording is present this remains a quieter synthetic bed,
    // matching Origo's hybrid live engine instead of replacing the sample.
    const synthScale = sampledEvents.has(event.id) ? 0.42 : 1;
    const peak = Math.max(0.006, Math.min(0.22, event.velocity * 0.18 * synthScale));
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
