import { soundEngine } from '../audio/soundEngine';
import { EnvironmentPreset, SpeciesType } from '../types';

export type MusicWorldId = 'origo' | 'classical' | 'electronic';

export interface MusicWorldSpeciesRule {
  role: string;
  octaveSemitones: number;
  durationBeats: number;
  velocityScale: number;
  preferredSubdivisions?: number[];
  rhythmBias?: number;
}

export interface MusicWorldDefinition {
  id: MusicWorldId;
  name: string;
  family: string;
  description: string;
  defaultPresetId: string;
  presets: EnvironmentPreset[];
  palette: {
    name: string;
    description: string;
  };
  clock: {
    beatsPerBar: number;
    subdivisionsPerBeat: number;
  };
  director: {
    intensityThresholdOffset: number;
    registerSemitones: number;
    motifRecallOffset: number;
    species: Record<SpeciesType, MusicWorldSpeciesRule>;
  };
  mix: {
    reverbMix: number;
    delayMix: number;
    filterCutoff: number;
    droneVolume: number;
    neuralSynthVolume: number;
    fmDepthMacro: number;
    timbreMacro: number;
  };
}

const CLASSICAL_PRESETS: EnvironmentPreset[] = [
  {
    id: 'classical_chamber',
    name: 'Chamber Counterpoint',
    description: 'A slower, more spacious ecology biased toward sustained harmony, melodic exchange and recurring themes.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 6,
      [SpeciesType.Predator]: 2,
      [SpeciesType.Architect]: 5,
      [SpeciesType.Glider]: 3,
    },
    terrainRoughness: 0.42,
    harmonicDecayRate: 0.992,
    acousticSpeed: 2.6,
    energySpawnRate: 11,
    learningRate: 0.007,
    curiosityWeight: 0.11,
    soundPreset: {
      id: 'classical_major',
      name: 'Chamber Major',
      scaleName: 'major',
      rootNote: 48,
      scale: [0, 2, 4, 5, 7, 9, 11, 12],
      tempoBpm: 84,
      fmModulation: 0.2,
      reverbDecay: 0.46,
      delayFeedback: 0.08,
      filterCutoff: 6500,
      bassBoost: false,
    },
  },
  {
    id: 'classical_nocturne',
    name: 'Nocturne Garden',
    description: 'Minor-key movement with longer phrases, quieter ecological density and stronger motif return.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 5,
      [SpeciesType.Predator]: 2,
      [SpeciesType.Architect]: 6,
      [SpeciesType.Glider]: 3,
    },
    terrainRoughness: 0.5,
    harmonicDecayRate: 0.994,
    acousticSpeed: 2.4,
    energySpawnRate: 10,
    learningRate: 0.006,
    curiosityWeight: 0.13,
    soundPreset: {
      id: 'classical_harmonic_minor',
      name: 'Harmonic Minor Nocturne',
      scaleName: 'harmonic_minor',
      rootNote: 45,
      scale: [0, 2, 3, 5, 7, 8, 11, 12],
      tempoBpm: 72,
      fmModulation: 0.18,
      reverbDecay: 0.52,
      delayFeedback: 0.06,
      filterCutoff: 6000,
      bassBoost: false,
    },
  },
];

const ELECTRONIC_PRESETS: EnvironmentPreset[] = [
  {
    id: 'electronic_pulse',
    name: 'Electronic Pulse Network',
    description: 'Rhythmic ecological pressure favors repeating low pulses, syncopated high activity and short synthetic gestures.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 4,
      [SpeciesType.Predator]: 5,
      [SpeciesType.Architect]: 3,
      [SpeciesType.Glider]: 5,
    },
    terrainRoughness: 0.58,
    harmonicDecayRate: 0.975,
    acousticSpeed: 3.8,
    energySpawnRate: 13,
    learningRate: 0.01,
    curiosityWeight: 0.2,
    soundPreset: {
      id: 'electronic_dorian',
      name: 'Dorian Pulse',
      scaleName: 'dorian',
      rootNote: 48,
      scale: [0, 2, 3, 5, 7, 9, 10, 12],
      tempoBpm: 126,
      fmModulation: 0.8,
      reverbDecay: 0.22,
      delayFeedback: 0.28,
      filterCutoff: 5600,
      bassBoost: true,
    },
  },
  {
    id: 'electronic_drift',
    name: 'Electronic Drift Field',
    description: 'A less dance-bound electronic ecology for evolving pads, bass movement, plucks and high-frequency texture.',
    speciesDistribution: {
      [SpeciesType.Resonator]: 5,
      [SpeciesType.Predator]: 3,
      [SpeciesType.Architect]: 5,
      [SpeciesType.Glider]: 5,
    },
    terrainRoughness: 0.72,
    harmonicDecayRate: 0.985,
    acousticSpeed: 3.3,
    energySpawnRate: 14,
    learningRate: 0.011,
    curiosityWeight: 0.3,
    soundPreset: {
      id: 'electronic_minor_drift',
      name: 'Minor Drift',
      scaleName: 'pentatonic_minor',
      rootNote: 50,
      scale: [0, 3, 5, 7, 10, 12],
      tempoBpm: 110,
      fmModulation: 0.72,
      reverbDecay: 0.38,
      delayFeedback: 0.34,
      filterCutoff: 5000,
      bassBoost: true,
    },
  },
];

export const MUSIC_WORLDS: MusicWorldDefinition[] = [
  {
    id: 'origo',
    name: 'Living Harmonics',
    family: 'Origo',
    description: 'The original living ecosystem: acoustic-hybrid, exploratory and deliberately genre-agnostic.',
    defaultPresetId: 'harmonic_territory',
    presets: [],
    palette: { name: 'Origo Acoustic Hybrid', description: 'Native synthesis, SoundFonts and the CC0 orchestral multisample bank.' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: {
      intensityThresholdOffset: 0,
      registerSemitones: 0,
      motifRecallOffset: 0,
      species: {
        [SpeciesType.Resonator]: { role: 'Resonant melody / pluck', octaveSemitones: 12, durationBeats: 0.75, velocityScale: 1 },
        [SpeciesType.Predator]: { role: 'Bass / impact', octaveSemitones: -12, durationBeats: 0.25, velocityScale: 1 },
        [SpeciesType.Architect]: { role: 'Harmonic bed / drone', octaveSemitones: 0, durationBeats: 2, velocityScale: 1 },
        [SpeciesType.Glider]: { role: 'Upper melody / transition', octaveSemitones: 24, durationBeats: 0.5, velocityScale: 1 },
      },
    },
    mix: { reverbMix: 0.5, delayMix: 0.3, filterCutoff: 4200, droneVolume: 0.14, neuralSynthVolume: 0.22, fmDepthMacro: 1, timbreMacro: 1 },
  },
  {
    id: 'classical',
    name: 'Classical',
    family: 'Acoustic / Orchestral',
    description: 'Longer phrases, stronger thematic return and orchestral register spacing. The ecosystem still composes the performance.',
    defaultPresetId: 'classical_chamber',
    presets: CLASSICAL_PRESETS,
    palette: { name: 'Chamber / Orchestra', description: 'CC0 multisampled strings and winds, plus user SoundFonts for fuller orchestration.' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: {
      intensityThresholdOffset: 0.07,
      registerSemitones: 0,
      motifRecallOffset: 0.14,
      species: {
        [SpeciesType.Resonator]: { role: 'Violin / woodwind melody', octaveSemitones: 12, durationBeats: 1.5, velocityScale: 0.86 },
        [SpeciesType.Predator]: { role: 'Cello / bass / timpani weight', octaveSemitones: -12, durationBeats: 0.75, velocityScale: 0.9 },
        [SpeciesType.Architect]: { role: 'Viola / cello harmonic foundation', octaveSemitones: 0, durationBeats: 3.25, velocityScale: 0.78 },
        [SpeciesType.Glider]: { role: 'Flute / violin ornament', octaveSemitones: 24, durationBeats: 0.9, velocityScale: 0.82 },
      },
    },
    mix: { reverbMix: 0.46, delayMix: 0.08, filterCutoff: 6500, droneVolume: 0.18, neuralSynthVolume: 0.12, fmDepthMacro: 0.32, timbreMacro: 0.72 },
  },
  {
    id: 'electronic',
    name: 'Electronic',
    family: 'Electronic',
    description: 'A broad electronic ecology with stronger pulse, bass and syncopation biases without locking Origo to a single dance genre.',
    defaultPresetId: 'electronic_pulse',
    presets: ELECTRONIC_PRESETS,
    palette: { name: 'Electronic Production', description: 'Electronic drums, sub/bass, pads, plucks and leads layered with Origo native synthesis.' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: {
      intensityThresholdOffset: -0.04,
      registerSemitones: 0,
      motifRecallOffset: 0.04,
      species: {
        [SpeciesType.Resonator]: { role: 'Chord / pluck / arp', octaveSemitones: 12, durationBeats: 0.45, velocityScale: 1.03, preferredSubdivisions: [0, 2], rhythmBias: 0.08 },
        [SpeciesType.Predator]: { role: 'Kick / sub / bass pulse', octaveSemitones: -12, durationBeats: 0.18, velocityScale: 1.1, preferredSubdivisions: [0, 2], rhythmBias: 0.14 },
        [SpeciesType.Architect]: { role: 'Pad / chord stab', octaveSemitones: 0, durationBeats: 1.4, velocityScale: 0.9, preferredSubdivisions: [0], rhythmBias: 0.05 },
        [SpeciesType.Glider]: { role: 'Hat / lead / texture', octaveSemitones: 24, durationBeats: 0.22, velocityScale: 0.96, preferredSubdivisions: [1, 3], rhythmBias: 0.12 },
      },
    },
    mix: { reverbMix: 0.22, delayMix: 0.28, filterCutoff: 5600, droneVolume: 0.1, neuralSynthVolume: 0.36, fmDepthMacro: 1.4, timbreMacro: 1.5 },
  },
];

export const PLANNED_MUSIC_WORLD_FAMILIES = ['Jazz', 'Blues', 'Rock', 'Folk', 'Latin', 'Reggae / Dub', 'Ambient', 'Hip-Hop / Trip-Hop'] as const;

function findWorld(id: MusicWorldId) {
  return MUSIC_WORLDS.find((world) => world.id === id) ?? MUSIC_WORLDS[0];
}

class MusicWorldRegistry {
  private activeId: MusicWorldId = 'origo';
  private listeners = new Set<() => void>();

  public getActive() { return findWorld(this.activeId); }
  public setActive(id: MusicWorldId) {
    if (id === this.activeId) return this.getActive();
    this.activeId = findWorld(id).id;
    for (const listener of this.listeners) listener();
    return this.getActive();
  }
  public subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

export const musicWorldRegistry = new MusicWorldRegistry();

export function applyMusicWorldMix(world: MusicWorldDefinition) {
  soundEngine.setReverbMix(world.mix.reverbMix);
  soundEngine.setDelayMix(world.mix.delayMix);
  soundEngine.setFilterCutoff(world.mix.filterCutoff);
  soundEngine.setDroneVolume(world.mix.droneVolume);
  soundEngine.setNeuralSynthVolume(world.mix.neuralSynthVolume);
  soundEngine.setFmDepthMacro(world.mix.fmDepthMacro);
  soundEngine.setTimbreMacro(world.mix.timbreMacro);
}
