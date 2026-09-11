import { SpeciesType } from '../types';
import { OrigoMusicSession, OrigoMusicalAnalysis, OrigoMusicalEvent } from './types';

const SPECIES = Object.values(SpeciesType);

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizedSpeciesEntropy(counts: number[]) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  let entropy = 0;
  for (const count of counts) {
    if (!count) continue;
    const probability = count / total;
    entropy -= probability * Math.log(probability);
  }
  return clamp(entropy / Math.log(SPECIES.length));
}

function rhythmicRegularity(events: OrigoMusicalEvent[]) {
  if (events.length < 3) return 0;
  const sorted = [...events].sort((a, b) => a.position.beat - b.position.beat);
  const gapHistogram = new Map<number, number>();
  let gapCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].position.beat - sorted[i - 1].position.beat;
    if (gap <= 0.001) continue; // simultaneous/chord events are not rhythmic gaps
    const quarterBeatUnits = Math.max(1, Math.min(32, Math.round(gap * 4)));
    gapHistogram.set(quarterBeatUnits, (gapHistogram.get(quarterBeatUnits) ?? 0) + 1);
    gapCount++;
  }

  if (!gapCount) return 0;
  const dominantGapCount = Math.max(...gapHistogram.values());
  return clamp(dominantGapCount / gapCount);
}

function windowStats(events: OrigoMusicalEvent[], startBar: number, endBar: number) {
  const selected = events.filter((event) => event.position.bar >= startBar && event.position.bar < endBar);
  const bars = Math.max(1, endBar - startBar);
  return {
    density: clamp(selected.length / (bars * 8)),
    pitch: mean(selected.map((event) => event.midiNote)),
    intensity: mean(selected.map((event) => event.intensity)),
  };
}

function sectionContrast(events: OrigoMusicalEvent[], bars: number) {
  if (bars < 2 || events.length < 4) return 0;
  const windowBars = Math.max(1, Math.min(4, Math.floor(bars / 2)));
  const endBar = bars;
  const middleBar = endBar - windowBars;
  const startBar = Math.max(0, middleBar - windowBars);
  const previous = windowStats(events, startBar, middleBar);
  const current = windowStats(events, middleBar, endBar);

  const densityDelta = Math.abs(previous.density - current.density);
  const pitchDelta = clamp(Math.abs(previous.pitch - current.pitch) / 24);
  const intensityDelta = Math.abs(previous.intensity - current.intensity);
  return clamp(densityDelta * 0.5 + pitchDelta * 0.3 + intensityDelta * 0.2);
}

export function analyzeMusicSession(session: OrigoMusicSession): OrigoMusicalAnalysis {
  const events = session.events;
  const last = events[events.length - 1];
  const bars = Math.max(1, last ? last.position.bar + 1 : 1);
  const eventDensity = clamp(events.length / Math.max(1, bars * 8));

  const totalQuarterBeatSlots = Math.max(1, bars * session.beatsPerBar * 4);
  const occupiedSlots = new Set(events.map((event) => Math.round(event.position.beat * 4))).size;
  const silenceRatio = clamp(1 - occupiedSlots / totalQuarterBeatSlots);

  const pitches = events.map((event) => event.midiNote);
  const pitchSpread = pitches.length
    ? clamp((Math.max(...pitches) - Math.min(...pitches)) / 48)
    : 0;
  const pitchClassDiversity = pitches.length
    ? clamp(new Set(pitches.map((pitch) => ((pitch % 12) + 12) % 12)).size / 12)
    : 0;

  const motifEvents = events.filter((event) => event.motif);
  const recalledMotifEvents = motifEvents.filter((event) => event.motif?.recalled);
  const motifRecurrence = clamp(motifEvents.length / Math.max(1, events.length));
  const motifRecall = clamp(recalledMotifEvents.length / Math.max(1, events.length));

  const speciesCounts = SPECIES.map((species) => events.filter((event) => event.species === species).length);
  const speciesBalance = normalizedSpeciesEntropy(speciesCounts);
  const speciesEventShare = Object.fromEntries(
    SPECIES.map((species, index) => [species, speciesCounts[index] / Math.max(1, events.length)])
  ) as Record<SpeciesType, number>;

  const velocities = events.map((event) => event.velocity);
  const dynamicRange = velocities.length
    ? clamp(Math.max(...velocities) - Math.min(...velocities))
    : 0;
  const regularity = rhythmicRegularity(events);
  const contrast = sectionContrast(events, bars);

  return {
    schema: 'origo.music-analysis.v1',
    generatedAtEventCount: events.length,
    bars,
    eventDensity,
    silenceRatio,
    rhythmicRegularity: regularity,
    pitchSpread,
    pitchClassDiversity,
    motifRecurrence,
    motifRecall,
    speciesBalance,
    dynamicRange,
    sectionContrast: contrast,
    speciesEventShare,
    fitness: {
      space: silenceRatio,
      rhythmicIdentity: regularity,
      motifStability: motifRecurrence,
      speciesBalance,
      dynamicContrast: dynamicRange,
      structuralContrast: contrast,
    },
  };
}
