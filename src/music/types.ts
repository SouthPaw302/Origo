/**
 * Origo musical event/session contracts.
 * Kept independent from the renderer so sessions can cross into Libertas/AetherStream later.
 */
import { SpeciesType } from '../types';

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
}

export interface MusicSystemStatus {
  recording: boolean;
  eventCount: number;
  barsCaptured: number;
  lastEventAtStep: number;
}
