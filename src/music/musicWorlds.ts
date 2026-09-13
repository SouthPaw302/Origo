import { soundEngine } from '../audio/soundEngine';
import { EnvironmentPreset, SpeciesType } from '../types';

export type MusicWorldId = 'origo' | 'classical' | 'electronic' | 'jazz' | 'blues' | 'rock' | 'folk' | 'latin' | 'reggae_dub' | 'ambient' | 'hiphop';
export type BuiltInPaletteRecommendation = 'acoustic' | 'electronic' | 'hybrid';

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
  palette: { name: string; description: string; bank: BuiltInPaletteRecommendation };
  clock: { beatsPerBar: number; subdivisionsPerBeat: number };
  director: {
    intensityThresholdOffset: number;
    registerSemitones: number;
    motifRecallOffset: number;
    species: Record<SpeciesType, MusicWorldSpeciesRule>;
  };
  mix: {
    reverbMix: number; delayMix: number; filterCutoff: number; droneVolume: number;
    neuralSynthVolume: number; fmDepthMacro: number; timbreMacro: number;
  };
}

type Pop = [number, number, number, number];
type SoundDef = [string, string, string, number, number[], number, number, number, number, number, boolean];

function preset(
  id: string, name: string, description: string, population: Pop,
  terrain: number, decay: number, acousticSpeed: number, energySpawnRate: number,
  learningRate: number, curiosityWeight: number, sound: SoundDef
): EnvironmentPreset {
  const [resonator, predator, architect, glider] = population;
  const [soundId, soundName, scaleName, rootNote, scale, tempoBpm, fmModulation, reverbDecay, delayFeedback, filterCutoff, bassBoost] = sound;
  return {
    id, name, description,
    speciesDistribution: {
      [SpeciesType.Resonator]: resonator,
      [SpeciesType.Predator]: predator,
      [SpeciesType.Architect]: architect,
      [SpeciesType.Glider]: glider,
    },
    terrainRoughness: terrain,
    harmonicDecayRate: decay,
    acousticSpeed,
    energySpawnRate,
    learningRate,
    curiosityWeight,
    soundPreset: { id: soundId, name: soundName, scaleName, rootNote, scale, tempoBpm, fmModulation, reverbDecay, delayFeedback, filterCutoff, bassBoost },
  };
}

function species(
  resonator: MusicWorldSpeciesRule,
  predator: MusicWorldSpeciesRule,
  architect: MusicWorldSpeciesRule,
  glider: MusicWorldSpeciesRule
): Record<SpeciesType, MusicWorldSpeciesRule> {
  return {
    [SpeciesType.Resonator]: resonator,
    [SpeciesType.Predator]: predator,
    [SpeciesType.Architect]: architect,
    [SpeciesType.Glider]: glider,
  };
}

const R = (role: string, octaveSemitones: number, durationBeats: number, velocityScale: number, preferredSubdivisions?: number[], rhythmBias?: number): MusicWorldSpeciesRule =>
  ({ role, octaveSemitones, durationBeats, velocityScale, preferredSubdivisions, rhythmBias });

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10, 12];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11, 12];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10, 12];
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12];
const BLUES = [0, 3, 5, 6, 7, 10, 12];
const PENTATONIC_MAJOR = [0, 2, 4, 7, 9, 12];
const PENTATONIC_MINOR = [0, 3, 5, 7, 10, 12];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11, 12];

const classical = [
  preset('classical_chamber', 'Chamber Counterpoint', 'Slower ecology biased toward sustained harmony, melodic exchange and recurring themes.', [6, 2, 5, 3], .42, .992, 2.6, 11, .007, .11, ['classical_major', 'Chamber Major', 'major', 48, MAJOR, 84, .2, .46, .08, 6500, false]),
  preset('classical_nocturne', 'Nocturne Garden', 'Minor-key movement with longer phrases, quieter density and stronger motif return.', [5, 2, 6, 3], .5, .994, 2.4, 10, .006, .13, ['classical_harmonic_minor', 'Harmonic Minor Nocturne', 'harmonic_minor', 45, HARMONIC_MINOR, 72, .18, .52, .06, 6000, false]),
];
const electronic = [
  preset('electronic_pulse', 'Electronic Pulse Network', 'Rhythmic pressure favors repeating low pulses, syncopated high activity and short synthetic gestures.', [4, 5, 3, 5], .58, .975, 3.8, 13, .01, .2, ['electronic_dorian', 'Dorian Pulse', 'dorian', 48, DORIAN, 126, .8, .22, .28, 5600, true]),
  preset('electronic_drift', 'Electronic Drift Field', 'Less dance-bound electronic ecology for evolving pads, bass movement, plucks and high texture.', [5, 3, 5, 5], .72, .985, 3.3, 14, .011, .3, ['electronic_minor_drift', 'Minor Drift', 'pentatonic_minor', 50, PENTATONIC_MINOR, 110, .72, .38, .34, 5000, true]),
];
const jazz = [
  preset('jazz_after_hours', 'After Hours Combo', 'Triplet-grid conversation with space for bass movement, chordal answers and melodic improvisation.', [5, 3, 4, 5], .46, .99, 2.9, 12, .008, .19, ['jazz_dorian', 'Dorian Changes', 'dorian', 50, DORIAN, 104, .28, .3, .08, 6200, false]),
  preset('jazz_swing_exchange', 'Swing Exchange', 'Animated call-and-response with a faster triplet pulse and brighter dominant harmony.', [5, 4, 3, 5], .52, .987, 3.1, 13, .009, .2, ['jazz_mixolydian', 'Mixolydian Swing', 'mixolydian', 53, MIXOLYDIAN, 132, .3, .28, .06, 6500, false]),
];
const blues = [preset('blues_delta_current', 'Delta Current', 'Blues tension, repetition and response without imposing a canned twelve-bar form.', [5, 4, 4, 3], .56, .986, 2.8, 11, .008, .16, ['blues_e', 'E Blues', 'blues', 52, BLUES, 92, .32, .25, .1, 5200, true])];
const rock = [preset('rock_live_circuit', 'Live Circuit', 'High-energy ecology with low impacts, chordal mass and short lead bursts rather than fixed verse/chorus.', [4, 5, 5, 4], .62, .974, 3.5, 14, .011, .18, ['rock_minor', 'Minor Drive', 'natural_minor', 52, NATURAL_MINOR, 116, .48, .2, .12, 5000, true])];
const folk = [preset('folk_traveling_strings', 'Traveling Strings', 'Open melodic intervals, repeated phrases and acoustic spacing from a calmer cooperative ecology.', [6, 2, 5, 4], .44, .991, 2.7, 13, .007, .15, ['folk_d_major', 'Open D Major', 'pentatonic_major', 50, PENTATONIC_MAJOR, 96, .16, .32, .07, 6400, false])];
const latin = [preset('latin_clave_garden', 'Clave Garden', 'Interlocking movement biases bass anchors, chord punctuations, percussion-like answers and agile lead motion.', [4, 4, 4, 6], .5, .98, 3.5, 15, .01, .23, ['latin_mixolydian', 'Mixolydian Clave', 'mixolydian', 48, MIXOLYDIAN, 108, .38, .23, .12, 6000, true])];
const reggae = [preset('reggae_dub_tide', 'Dub Tidal Field', 'Relaxed low-end pressure, off-beat harmonic gestures and long echo space emerge from a slower ecology.', [4, 5, 4, 4], .48, .992, 2.5, 11, .008, .16, ['dub_minor', 'Dub Minor', 'natural_minor', 45, NATURAL_MINOR, 76, .3, .48, .62, 3900, true])];
const ambient = [preset('ambient_long_horizon', 'Long Horizon', 'Sparse events, long decays and slow environmental change turn the ecosystem into an evolving textural field.', [5, 1, 6, 4], .36, .996, 2.1, 10, .006, .24, ['ambient_lydian', 'Lydian Horizon', 'lydian', 48, LYDIAN, 62, .24, .68, .42, 4800, false])];
const hiphop = [preset('hiphop_broken_beats', 'Broken Beat Block', 'Low-end anchors, sparse melodic fragments and restless high activity bias the ecology toward hip-hop and trip-hop language.', [4, 5, 4, 5], .64, .982, 3, 13, .01, .24, ['hiphop_blues_minor', 'Blues Minor Beat', 'blues', 45, BLUES, 84, .5, .3, .24, 4300, true])];

export const MUSIC_WORLDS: MusicWorldDefinition[] = [
  {
    id: 'origo', name: 'Living Harmonics', family: 'Origo',
    description: 'The original living ecosystem: acoustic-hybrid, exploratory and deliberately genre-agnostic.',
    defaultPresetId: 'harmonic_territory', presets: [],
    palette: { name: 'Origo Acoustic Hybrid', description: 'Native synthesis, SoundFonts and either built-in sample bank.', bank: 'hybrid' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: 0, registerSemitones: 0, motifRecallOffset: 0, species: species(
      R('Resonant melody / pluck', 12, .75, 1), R('Bass / impact', -12, .25, 1), R('Harmonic bed / drone', 0, 2, 1), R('Upper melody / transition', 24, .5, 1)
    ) },
    mix: { reverbMix: .5, delayMix: .3, filterCutoff: 4200, droneVolume: .14, neuralSynthVolume: .22, fmDepthMacro: 1, timbreMacro: 1 },
  },
  {
    id: 'classical', name: 'Classical', family: 'Acoustic / Orchestral',
    description: 'Longer phrases, stronger thematic return and orchestral register spacing; creatures still compose the performance.',
    defaultPresetId: 'classical_chamber', presets: classical,
    palette: { name: 'Chamber / Orchestra', description: 'CC0 acoustic multisamples plus optional SoundFonts for fuller orchestration.', bank: 'acoustic' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: .07, registerSemitones: 0, motifRecallOffset: .14, species: species(
      R('Violin / woodwind melody', 12, 1.5, .86), R('Cello / bass / timpani weight', -12, .75, .9), R('Viola / cello harmonic foundation', 0, 3.25, .78), R('Flute / violin ornament', 24, .9, .82)
    ) },
    mix: { reverbMix: .46, delayMix: .08, filterCutoff: 6500, droneVolume: .18, neuralSynthVolume: .12, fmDepthMacro: .32, timbreMacro: .72 },
  },
  {
    id: 'electronic', name: 'Electronic', family: 'Electronic',
    description: 'Broad electronic ecology with pulse, bass and syncopation biases without locking Origo to one dance genre.',
    defaultPresetId: 'electronic_pulse', presets: electronic,
    palette: { name: 'Electronic Production', description: 'CC0 production one-shots plus Origo native bass, pads, plucks and leads.', bank: 'electronic' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: -.04, registerSemitones: 0, motifRecallOffset: .04, species: species(
      R('Chord / pluck / arp', 12, .45, 1.03, [0,2], .08), R('Kick / sub / bass pulse', -12, .18, 1.1, [0,2], .14), R('Pad / chord stab', 0, 1.4, .9, [0], .05), R('Hat / lead / texture', 24, .22, .96, [1,3], .12)
    ) },
    mix: { reverbMix: .22, delayMix: .28, filterCutoff: 5600, droneVolume: .1, neuralSynthVolume: .36, fmDepthMacro: 1.4, timbreMacro: 1.5 },
  },
  {
    id: 'jazz', name: 'Jazz', family: 'Jazz / Improvised',
    description: 'Triplet-grid conversation, call-and-response and freer melodic motion with bass and harmonic support.',
    defaultPresetId: 'jazz_after_hours', presets: jazz,
    palette: { name: 'Small Combo', description: 'Acoustic multisamples or a piano, bass and horn SoundFont fit naturally.', bank: 'acoustic' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 3 },
    director: { intensityThresholdOffset: .02, registerSemitones: 0, motifRecallOffset: .04, species: species(
      R('Piano / horn phrase', 12, .8, .92, [0,2], .07), R('Walking bass / kick weight', -12, .55, .92, [0,1,2], .04), R('Comping chord / sustained harmony', 0, 1.45, .8, [0,2], .05), R('Horn / cymbal reply', 12, .55, .88, [1,2], .08)
    ) },
    mix: { reverbMix: .3, delayMix: .08, filterCutoff: 6200, droneVolume: .08, neuralSynthVolume: .16, fmDepthMacro: .45, timbreMacro: .8 },
  },
  {
    id: 'blues', name: 'Blues', family: 'Blues',
    description: 'Repetition, response and blues-scale tension emerge without forcing a canned twelve-bar sequence.',
    defaultPresetId: 'blues_delta_current', presets: blues,
    palette: { name: 'Roots / Electric', description: 'Acoustic samples, guitar/piano SoundFonts or hybrid synthesis all work.', bank: 'acoustic' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 3 },
    director: { intensityThresholdOffset: .01, registerSemitones: 0, motifRecallOffset: .12, species: species(
      R('Guitar / vocal-like lead', 12, .85, .96, [0,2], .08), R('Bass / kick', -12, .45, 1.05, [0], .08), R('Piano / organ response', 0, 1.4, .86, [0,2], .05), R('Fill / turnaround answer', 12, .55, .9, [1,2], .08)
    ) },
    mix: { reverbMix: .25, delayMix: .1, filterCutoff: 5200, droneVolume: .1, neuralSynthVolume: .2, fmDepthMacro: .6, timbreMacro: .9 },
  },
  {
    id: 'rock', name: 'Rock', family: 'Rock',
    description: 'Denser impact energy, bass weight and chordal mass with short lead activity; form still comes from ecology.',
    defaultPresetId: 'rock_live_circuit', presets: rock,
    palette: { name: 'Band Hybrid', description: 'Electronic drums plus SoundFont/native bass, guitar-like chords and leads.', bank: 'hybrid' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: -.06, registerSemitones: 0, motifRecallOffset: .05, species: species(
      R('Lead / riff', 12, .45, 1.05, [0,2], .08), R('Kick / bass', -12, .22, 1.14, [0,2], .13), R('Rhythm chord / power-bed', 0, .9, 1.02, [0,2], .08), R('Cymbal / fill / upper lead', 24, .25, 1, [1,3], .1)
    ) },
    mix: { reverbMix: .2, delayMix: .12, filterCutoff: 5000, droneVolume: .08, neuralSynthVolume: .3, fmDepthMacro: 1.05, timbreMacro: 1.25 },
  },
  {
    id: 'folk', name: 'Folk', family: 'Folk / Acoustic',
    description: 'Open intervals, repeated melodic shapes and breathable acoustic spacing from a more cooperative ecology.',
    defaultPresetId: 'folk_traveling_strings', presets: folk,
    palette: { name: 'Acoustic Ensemble', description: 'CC0 acoustic bank first; fiddle, guitar or accordion SoundFonts can extend it.', bank: 'acoustic' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: .05, registerSemitones: 0, motifRecallOffset: .13, species: species(
      R('Fiddle / plucked melody', 12, .9, .9), R('Acoustic bass / stomp', -12, .55, .92, [0,2], .05), R('Guitar / drone harmony', 0, 1.8, .8), R('Fiddle ornament / flute', 24, .55, .84)
    ) },
    mix: { reverbMix: .32, delayMix: .07, filterCutoff: 6400, droneVolume: .12, neuralSynthVolume: .12, fmDepthMacro: .35, timbreMacro: .75 },
  },
  {
    id: 'latin', name: 'Latin', family: 'Latin / Afro-Latin',
    description: 'Interlocking syncopation, bass anchors and punctuated harmony create a broad Latin-oriented ecology.',
    defaultPresetId: 'latin_clave_garden', presets: latin,
    palette: { name: 'Rhythm Ensemble', description: 'Hybrid pulse plus user percussion, piano, guitar or brass SoundFonts.', bank: 'hybrid' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: -.05, registerSemitones: 0, motifRecallOffset: .05, species: species(
      R('Piano / guitar figure', 12, .4, 1, [0,3], .11), R('Bass / low drum anchor', -12, .28, 1.08, [0,2], .1), R('Chord stab / hand percussion', 0, .65, .96, [1,3], .12), R('Lead / shaker / brass answer', 24, .3, .98, [1,2,3], .1)
    ) },
    mix: { reverbMix: .23, delayMix: .12, filterCutoff: 6000, droneVolume: .06, neuralSynthVolume: .24, fmDepthMacro: .75, timbreMacro: 1 },
  },
  {
    id: 'reggae_dub', name: 'Reggae / Dub', family: 'Reggae / Dub',
    description: 'Slow low-end movement, off-beat harmonic gestures and generous echo space without a fixed riddim.',
    defaultPresetId: 'reggae_dub_tide', presets: reggae,
    palette: { name: 'Dub Hybrid', description: 'Electronic drums plus native/SoundFont bass and chord voices.', bank: 'hybrid' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: .02, registerSemitones: -2, motifRecallOffset: .08, species: species(
      R('Organ / guitar skank', 12, .4, .82, [2], .14), R('Deep bass / kick', -12, .7, 1.08, [0,2], .08), R('Chord bubble / dub bed', 0, 1.25, .78, [2], .12), R('Hat / echo throw / melodic answer', 24, .3, .82, [1,3], .08)
    ) },
    mix: { reverbMix: .48, delayMix: .62, filterCutoff: 3900, droneVolume: .12, neuralSynthVolume: .18, fmDepthMacro: .55, timbreMacro: .85 },
  },
  {
    id: 'ambient', name: 'Ambient', family: 'Ambient / Drone',
    description: 'Sparse triggers, long envelopes and slow harmonic movement turn the ecosystem into an evolving field.',
    defaultPresetId: 'ambient_long_horizon', presets: ambient,
    palette: { name: 'Textural Hybrid', description: 'Acoustic sustains, native synthesis and user pad SoundFonts can coexist.', bank: 'hybrid' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: .15, registerSemitones: 0, motifRecallOffset: .08, species: species(
      R('Sparse bell / tone', 12, 2.2, .64), R('Low swell / distant impact', -12, 2.8, .58), R('Long pad / drone', 0, 5, .56), R('Air / upper texture', 24, 1.8, .58)
    ) },
    mix: { reverbMix: .68, delayMix: .42, filterCutoff: 4800, droneVolume: .24, neuralSynthVolume: .14, fmDepthMacro: .42, timbreMacro: .82 },
  },
  {
    id: 'hiphop', name: 'Hip-Hop / Trip-Hop', family: 'Hip-Hop / Trip-Hop',
    description: 'Low-end anchors, broken percussion bias and sparse melodic fragments with room for darker trip-hop space.',
    defaultPresetId: 'hiphop_broken_beats', presets: hiphop,
    palette: { name: 'Beat Production', description: 'CC0 electronic one-shots plus native/SoundFont bass, keys and texture.', bank: 'electronic' },
    clock: { beatsPerBar: 4, subdivisionsPerBeat: 4 },
    director: { intensityThresholdOffset: -.03, registerSemitones: -2, motifRecallOffset: .09, species: species(
      R('Keys / sample-like phrase', 12, .65, .9, [0,2], .06), R('Kick / sub bass', -12, .3, 1.12, [0,2], .14), R('Snare / chord chop / bed', 0, .8, .94, [2], .13), R('Hat / texture / lead fragment', 24, .2, .88, [1,3], .13)
    ) },
    mix: { reverbMix: .3, delayMix: .24, filterCutoff: 4300, droneVolume: .08, neuralSynthVolume: .28, fmDepthMacro: .92, timbreMacro: 1.15 },
  },
];

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
