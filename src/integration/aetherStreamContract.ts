import { OrigoMusicSession } from '../music/types';

/**
 * Deliberately transport-agnostic contract for Libertas/AetherStream.
 * Libertas Desktop remains the authoritative sample clock/master.
 * Origo supplies deterministic source/session material and musical intent.
 */
export interface OrigoAetherSourceManifest {
  schema: 'libertas.aether.origo-source.v1';
  sourceId: string;
  sourceKind: 'origo-evolution-session';
  clockAuthority: 'external-master';
  createdAt: string;
  tempoBpm: number;
  beatsPerBar: number;
  durationBeats: number;
  eventCount: number;
  motifCount: number;
  guidedEventCount: number;
  sectionCount: number;
  sectionTypes: string[];
  preset: {
    id: string;
    name: string;
    scaleName: string;
    rootMidi: number;
  };
  analysis?: {
    eventDensity: number;
    silenceRatio: number;
    rhythmicRegularity: number;
    motifRecurrence: number;
    speciesBalance: number;
    dynamicRange: number;
    sectionContrast: number;
  };
  capabilities: {
    renderedAudio: boolean;
    midi: boolean;
    deterministicEventTimeline: boolean;
    motifLineage: boolean;
    musicalAnalysis: boolean;
    symbolicModelGuidance: boolean;
    ecologicalSections: boolean;
    recordedSamplePlayback: boolean;
    acceptsRenderedReturnLoop: boolean;
    recursiveSongLayering: boolean;
    quantizedLaunch: boolean;
    resampleSource: boolean;
  };
}

/**
 * Future AetherStream/Desktop implementations can deliver audio using this metadata
 * and hand the decoded bytes/blob to SampleInstrumentEngine.loadAetherLoopBlob().
 */
export interface OrigoAetherReturnLoopDescriptor {
  schema: 'libertas.aether.origo-return-loop.v1';
  sourceSessionId: string;
  label: string;
  tempoBpm: number;
  bars: number;
  audioFormat: 'wav' | 'mp3' | 'ogg' | 'flac' | 'other';
  launch: 'immediate' | 'next-bar' | 'next-phrase';
}

export function buildAetherSourceManifest(session: OrigoMusicSession): OrigoAetherSourceManifest {
  const durationBeats = session.events.reduce(
    (max, event) => Math.max(max, event.position.beat + event.durationBeats),
    0
  );
  const guidedEventCount = session.events.reduce(
    (count, event) => count + (event.model?.guided ? 1 : 0),
    0
  );
  const sections = session.sections ?? [];

  return {
    schema: 'libertas.aether.origo-source.v1',
    sourceId: session.id,
    sourceKind: 'origo-evolution-session',
    clockAuthority: 'external-master',
    createdAt: session.createdAt,
    tempoBpm: session.tempoBpm,
    beatsPerBar: session.beatsPerBar,
    durationBeats,
    eventCount: session.events.length,
    motifCount: session.motifs?.length ?? 0,
    guidedEventCount,
    sectionCount: sections.length,
    sectionTypes: sections.map((section) => section.type),
    preset: {
      id: session.presetId,
      name: session.presetName,
      scaleName: session.scaleName,
      rootMidi: session.rootMidi,
    },
    analysis: session.analysis ? {
      eventDensity: session.analysis.eventDensity,
      silenceRatio: session.analysis.silenceRatio,
      rhythmicRegularity: session.analysis.rhythmicRegularity,
      motifRecurrence: session.analysis.motifRecurrence,
      speciesBalance: session.analysis.speciesBalance,
      dynamicRange: session.analysis.dynamicRange,
      sectionContrast: session.analysis.sectionContrast,
    } : undefined,
    capabilities: {
      renderedAudio: true,
      midi: true,
      deterministicEventTimeline: true,
      motifLineage: true,
      musicalAnalysis: true,
      symbolicModelGuidance: true,
      ecologicalSections: true,
      recordedSamplePlayback: true,
      acceptsRenderedReturnLoop: true,
      recursiveSongLayering: true,
      quantizedLaunch: true,
      resampleSource: true,
    },
  };
}
