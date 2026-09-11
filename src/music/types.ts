/**
 * Origo musical event/session contracts.
 * Kept independent from the renderer so sessions can cross into Libertas/AetherStream later.
 */
import { SpeciesType } from '../types';
import type { ModelGuidanceRef } from '../models/types';

export type OrigoMusicalEventType =
  | 'note'
  | 'pulse'
  | 'texture'
  | 'impact'
  | 'drone'
  | 'transition';

export interface MusicalPosition {
  beat: number;
  bar: number;
  beatInBar: number;
  subdivision: number;
  seconds: number;
}

export interface OrigoEventMotifRef {
  id: string;
  recalled: boolean;
  strength: number;
}

export interface OrigoMotifRecord {
  id: string;
  species: SpeciesType;
  signature: string;
  pitchClasses: number[];
  relativePitchClasses: number[];
  rhythmUnits: number[];
  occurrences: number;
  averageIntensity: number;
  firstBar: number;
  lastBar: number;
  strength: number;
}

export interface MusicalFitnessVector {
  space: number;
  rhythmicIdentity: number;
  motifStability: number;
  speciesBalance: number;
  dynamicContrast: number;
  structuralContrast: number;
}

export interface OrigoMusicalAnalysis {
  schema: 'origo.music-analysis.v1';
  generatedAtEventCount: number;
  bars: number;
  eventDensity: number;
  silenceRatio: number;
  rhythmicRegularity: number;
  pitchSpread: number;
  pitchClassDiversity: number;
  motifRecurrence: number;
  motifRecall: number;
  speciesBalance: number;
  dynamicRange: number;
  sectionContrast: number;
  speciesEventShare: Record<SpeciesType, number>;
  fitness: MusicalFitnessVector;
}

export interface OrigoMusicalEvent {
  id: string;
  type: OrigoMusicalEventType;
  agentId: string;
  species: SpeciesType;
  generation: number;
  step: number;
  position: MusicalPosition;
  midiNote: number;
  velocity: number;
  durationBeats: number;
  pan: number;
  intensity: number;
  energy: number;
  xNorm: number;
  yNorm: number;
  motif?: OrigoEventMotifRef;
  model?: ModelGuidanceRef;
  action: {
    thrust: number;
    steer: number;
    pulse: number;
    terraform: number;
    ability: number;
  };
  environment: {
    harmonicField: number;
    terrain: number;
    acousticPressure: number;
  };
}

export interface OrigoMusicSession {
  schema: 'origo.music-session.v1';
  id: string;
  createdAt: string;
  stoppedAt?: string;
  presetId: string;
  presetName: string;
  tempoBpm: number;
  rootMidi: number;
  scaleName: string;
  scale: number[];
  stepsPerBeat: number;
  beatsPerBar: number;
  events: OrigoMusicalEvent[];
  motifs?: OrigoMotifRecord[];
  analysis?: OrigoMusicalAnalysis;
}

export interface MusicSystemStatus {
  recording: boolean;
  eventCount: number;
  barsCaptured: number;
  lastEventAtStep: number;
  motifCount: number;
}
