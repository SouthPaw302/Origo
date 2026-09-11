import { SpeciesType } from '../types';
import { OrigoEventMotifRef, OrigoMotifRecord, OrigoMusicalEvent } from './types';

const MOTIF_LENGTH = 4;
const MAX_RECENT_EVENTS = 8;
const MAX_EXPORTED_MOTIFS = 16;
const RECALL_CYCLE_BARS = 4;
const SPECIES_RECALL_OFFSET: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 0,
  [SpeciesType.Predator]: 1,
  [SpeciesType.Architect]: 2,
  [SpeciesType.Glider]: 3,
};

function mod12(value: number) { return ((value % 12) + 12) % 12; }

function signedPitchClassDelta(from: number, to: number) {
  let delta = mod12(to - from);
  if (delta > 6) delta -= 12;
  return delta;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function quantizeGap(beats: number) {
  return Math.max(1, Math.min(16, Math.round(Math.max(0.25, beats) * 4)));
}

export class OrigoMotifMemory {
  private recentBySpecies = new Map<SpeciesType, OrigoMusicalEvent[]>();
  private records = new Map<string, OrigoMotifRecord>();
  private recallBar = new Map<SpeciesType, number>();
  private recallCursor = new Map<SpeciesType, number>();

  public observe(events: OrigoMusicalEvent[]) {
    for (const event of events) {
      const recent = this.recentBySpecies.get(event.species) ?? [];
      recent.push(event);
      if (recent.length > MAX_RECENT_EVENTS) recent.shift();
      this.recentBySpecies.set(event.species, recent);
      if (recent.length < MOTIF_LENGTH) continue;

      const window = recent.slice(-MOTIF_LENGTH);
      const baseNote = window[0].midiNote;
      const pitchClasses = window.map((item) => mod12(item.midiNote));
      const relativePitchClasses = window.map((item) => mod12(item.midiNote - baseNote));
      const rhythmUnits = window.slice(1).map(
        (item, index) => quantizeGap(item.position.beat - window[index].position.beat)
      );
      const signature = `${event.species}|p:${relativePitchClasses.join('.')}|r:${rhythmUnits.join('.')}`;
      const averageWindowIntensity =
        window.reduce((sum, item) => sum + item.intensity, 0) / window.length;
      const existing = this.records.get(signature);

      if (existing) {
        const occurrences = existing.occurrences + 1;
        existing.averageIntensity =
          ((existing.averageIntensity * existing.occurrences) + averageWindowIntensity) / occurrences;
        existing.occurrences = occurrences;
        existing.lastBar = event.position.bar;
        existing.strength = this.strength(existing);
        if (existing.occurrences >= 2) {
          event.motif = { id: existing.id, recalled: false, strength: existing.strength };
        }
      } else {
        const record: OrigoMotifRecord = {
          id: `motif_${event.species.toLowerCase()}_${hashString(signature)}`,
          species: event.species,
          signature,
          pitchClasses,
          relativePitchClasses,
          rhythmUnits,
          occurrences: 1,
          averageIntensity: averageWindowIntensity,
          firstBar: window[0].position.bar,
          lastBar: event.position.bar,
          strength: 0,
        };
        record.strength = this.strength(record);
        this.records.set(signature, record);
      }
    }
  }

  public shapePitch(
    species: SpeciesType,
    proposedMidi: number,
    bar: number
  ): { midiNote: number; motif?: OrigoEventMotifRef } {
    if (
      bar < RECALL_CYCLE_BARS ||
      bar % RECALL_CYCLE_BARS !== SPECIES_RECALL_OFFSET[species]
    ) {
      return { midiNote: proposedMidi };
    }

    const motif = this.bestMotifForSpecies(species);
    if (!motif) return { midiNote: proposedMidi };

    if (this.recallBar.get(species) !== bar) {
      this.recallBar.set(species, bar);
      this.recallCursor.set(species, 0);
    }

    const cursor = this.recallCursor.get(species) ?? 0;
    const targetPitchClass = motif.pitchClasses[cursor % motif.pitchClasses.length];
    this.recallCursor.set(species, cursor + 1);
    const currentPitchClass = mod12(proposedMidi);
    const shaped = Math.max(
      24,
      Math.min(
        108,
        proposedMidi + signedPitchClassDelta(currentPitchClass, targetPitchClass)
      )
    );

    return {
      midiNote: shaped,
      motif: { id: motif.id, recalled: true, strength: motif.strength },
    };
  }

  public getMotifs(): OrigoMotifRecord[] {
    return Array.from(this.records.values())
      .filter((record) => record.occurrences >= 2)
      .sort((a, b) => b.strength - a.strength || b.lastBar - a.lastBar)
      .slice(0, MAX_EXPORTED_MOTIFS)
      .map((record) => ({
        ...record,
        pitchClasses: [...record.pitchClasses],
        relativePitchClasses: [...record.relativePitchClasses],
        rhythmUnits: [...record.rhythmUnits],
      }));
  }

  public getEstablishedCount() { return this.getMotifs().length; }

  public reset() {
    this.recentBySpecies.clear();
    this.records.clear();
    this.recallBar.clear();
    this.recallCursor.clear();
  }

  private bestMotifForSpecies(species: SpeciesType) {
    return this.getMotifs().filter((record) => record.species === species)[0];
  }

  private strength(record: OrigoMotifRecord) {
    const recurrence = Math.min(1, record.occurrences / 4);
    return Math.round(
      Math.min(1, recurrence * 0.7 + record.averageIntensity * 0.3) * 1000
    ) / 1000;
  }
}
