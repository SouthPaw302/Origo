export const ORIGO_CORE_RULE =
  'Learn through reinforcement learning and self-play without human gameplay, musical examples, demonstrations, or pretrained behavioral data.';

export type OriginTag =
  | 'ORIGO_CORE'
  | 'ORIGO_DESCENDANT'
  | 'HUMAN_SEEDED_SANDBOX'
  | 'LEGACY_HUMAN_PRIORS';

export interface LineageRecord {
  id: string;
  origin: OriginTag;
  generation: number;
  parentIds: string[];
  createdAt: number;
}

export const isCoreSafeOrigin = (origin: OriginTag) =>
  origin === 'ORIGO_CORE' || origin === 'ORIGO_DESCENDANT';

export const CORE_FORBIDDEN_PRIORS = [
  'human gameplay',
  'human songs',
  'MIDI corpora',
  'melodies',
  'chord progressions',
  'musical scales',
  'genre labels',
  'demonstrations',
  'pretrained behavior policies',
] as const;

export const CORE_ALLOWED_PRIMITIVES = [
  'environment state',
  'self-play opponents',
  'reward signals',
  'raw oscillator frequency',
  'waveform shape',
  'amplitude',
  'phase',
  'duration',
  'filter parameters',
  'modulation parameters',
  'spatial position',
] as const;
