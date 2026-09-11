import { SpeciesType } from '../types';
import { OrigoMusicSession, OrigoMusicalEvent } from './types';

const PPQ = 480;
const CHANNEL_BY_SPECIES: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 0,
  [SpeciesType.Predator]: 1,
  [SpeciesType.Architect]: 2,
  [SpeciesType.Glider]: 3,
};

const PROGRAM_BY_SPECIES: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 10,
  [SpeciesType.Predator]: 38,
  [SpeciesType.Architect]: 89,
  [SpeciesType.Glider]: 81,
};

function u16(value: number) { return [(value >> 8) & 0xff, value & 0xff]; }
function u32(value: number) { return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]; }
function ascii(text: string) { return Array.from(text).map((c) => c.charCodeAt(0) & 0xff); }
function varLen(value: number) {
  let buffer = value & 0x7f;
  const out: number[] = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }
  while (true) {
    out.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return out;
}

interface MidiAtom { tick: number; order: number; bytes: number[]; }

function noteAtoms(event: OrigoMusicalEvent): MidiAtom[] {
  const channel = CHANNEL_BY_SPECIES[event.species];
  const tick = Math.max(0, Math.round(event.position.beat * PPQ));
  const duration = Math.max(30, Math.round(event.durationBeats * PPQ));
  const velocity = Math.max(1, Math.min(127, Math.round(event.velocity * 127)));
  return [
    { tick, order: 1, bytes: [0x90 | channel, event.midiNote & 0x7f, velocity] },
    { tick: tick + duration, order: 0, bytes: [0x80 | channel, event.midiNote & 0x7f, 0] },
  ];
}

export function sessionToMidi(session: OrigoMusicSession): Uint8Array {
  const atoms: MidiAtom[] = [];
  const microsecondsPerQuarter = Math.round(60_000_000 / Math.max(1, session.tempoBpm));
  atoms.push({
    tick: 0,
    order: -3,
    bytes: [0xff, 0x51, 0x03, (microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff],
  });
  atoms.push({ tick: 0, order: -2, bytes: [0xff, 0x58, 0x04, session.beatsPerBar & 0xff, 0x02, 0x18, 0x08] });

  for (const species of Object.values(SpeciesType)) {
    const channel = CHANNEL_BY_SPECIES[species];
    atoms.push({ tick: 0, order: -1, bytes: [0xc0 | channel, PROGRAM_BY_SPECIES[species] & 0x7f] });
  }

  for (const event of session.events) atoms.push(...noteAtoms(event));
  atoms.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [];
  let lastTick = 0;
  for (const atom of atoms) {
    track.push(...varLen(Math.max(0, atom.tick - lastTick)), ...atom.bytes);
    lastTick = atom.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  const header = [...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(PPQ)];
  const trackChunk = [...ascii('MTrk'), ...u32(track.length), ...track];
  return new Uint8Array([...header, ...trackChunk]);
}
