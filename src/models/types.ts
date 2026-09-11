export type MusicModelCapability =
  | 'phrase-continuation'
  | 'groove-variation'
  | 'macro-structure';

export interface PhraseSeedNote {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

export interface PhraseModelRequest {
  tempoBpm: number;
  seedNotes: PhraseSeedNote[];
  continuationSteps: number;
  temperature: number;
}

export interface PhraseSuggestionNote {
  pitch: number;
  step: number;
  durationSteps: number;
}

export interface PhraseSuggestion {
  id: string;
  modelId: string;
  createdAt: string;
  seedEventCount: number;
  notes: PhraseSuggestionNote[];
}

export interface MusicModelStatus {
  id: string;
  name: string;
  capability: MusicModelCapability;
  state: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  downloadLabel: string;
  optional: true;
}

export interface ModelGuidanceRef {
  modelId: string;
  suggestionId: string;
  guided: boolean;
}
