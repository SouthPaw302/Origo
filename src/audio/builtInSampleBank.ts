import { SpeciesType } from '../types';
import { sampleInstrumentEngine } from './sampleInstrumentEngine';

export interface BuiltInSampleDefinition {
  species: SpeciesType;
  label: string;
  instrument: string;
  rootMidi: number;
  url: string;
  source: string;
  license: 'CC0-1.0';
  pitchTracking?: boolean;
}

const VSCO_RAW = 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master';
const STARGATE_RAW = 'https://raw.githubusercontent.com/stargatedaw/stargate-sample-pack/main/stargate-sample-pack/fugue-state-audio/drums';

/**
 * Lazy-loaded compact multisample bank sourced from VSCO 2 Community Edition.
 * The VSCO CE recordings are CC0/public-domain. Nothing is fetched until the
 * user explicitly chooses to load this bank.
 */
export const ORIGO_CC0_STARTER_BANK: BuiltInSampleDefinition[] = [
  // Resonator — solo violin pizzicato across three octaves.
  { species: SpeciesType.Resonator, label: 'Violin Pizz A3', instrument: 'Solo violin pizzicato', rootMidi: 57, url: `${VSCO_RAW}/Strings/Solo%20Violin/Pizz/LLVln_Pizz_A3_p_RR1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Resonator, label: 'Violin Pizz A4', instrument: 'Solo violin pizzicato', rootMidi: 69, url: `${VSCO_RAW}/Strings/Solo%20Violin/Pizz/LLVln_Pizz_A4_p_RR1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Resonator, label: 'Violin Pizz A5', instrument: 'Solo violin pizzicato', rootMidi: 81, url: `${VSCO_RAW}/Strings/Solo%20Violin/Pizz/LLVln_Pizz_A5_p_RR1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },

  // Predator — low cello pizzicato zones.
  { species: SpeciesType.Predator, label: 'Cello Pizz B1', instrument: 'Cello section pizzicato', rootMidi: 35, url: `${VSCO_RAW}/Strings/Cello%20Section/pizzT/pizzT_B1_v1_RR1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Predator, label: 'Cello Pizz A2', instrument: 'Cello section pizzicato', rootMidi: 45, url: `${VSCO_RAW}/Strings/Cello%20Section/pizzT/pizzT_A2_v1_RR1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Predator, label: 'Cello Pizz B3', instrument: 'Cello section pizzicato', rootMidi: 59, url: `${VSCO_RAW}/Strings/Cello%20Section/pizzT/pizzT_B3_v1_RR1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },

  // Architect — sustained cello zones for harmonic beds.
  { species: SpeciesType.Architect, label: 'Cello Sustain B1', instrument: 'Cello section sustained vibrato', rootMidi: 35, url: `${VSCO_RAW}/Strings/Cello%20Section/susvib/susvib_B1_v1_1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Architect, label: 'Cello Sustain C3', instrument: 'Cello section sustained vibrato', rootMidi: 48, url: `${VSCO_RAW}/Strings/Cello%20Section/susvib/susvib_C3_v1_1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Architect, label: 'Cello Sustain B3', instrument: 'Cello section sustained vibrato', rootMidi: 59, url: `${VSCO_RAW}/Strings/Cello%20Section/susvib/susvib_B3_v1_1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },

  // Glider — flute staccato zones.
  { species: SpeciesType.Glider, label: 'Flute Staccato A3', instrument: 'Flute staccato', rootMidi: 57, url: `${VSCO_RAW}/Woodwinds/Flute/stac/LDFlute_stac_A3_v1_rr1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
  { species: SpeciesType.Glider, label: 'Flute Staccato A4', instrument: 'Flute staccato', rootMidi: 69, url: `${VSCO_RAW}/Woodwinds/Flute/stac/LDFlute_stac_A4_v1_rr1.wav`, source: 'VSCO 2 Community Edition / Versilian Studios', license: 'CC0-1.0' },
];

/**
 * Compact CC0 electronic-production palette from the Stargate sample pack.
 * Selector roots choose between one-shots; pitchTracking=false keeps kicks,
 * snares, claps and hats at their recorded pitch instead of transposing them.
 */
export const ORIGO_CC0_ELECTRONIC_BANK: BuiltInSampleDefinition[] = [
  { species: SpeciesType.Resonator, label: 'FM Percussion', instrument: 'Electronic FM percussion', rootMidi: 60, url: `${STARGATE_RAW}/percussion/sdbkit-fmperc.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
  { species: SpeciesType.Resonator, label: '8-bit Percussion', instrument: 'Electronic 8-bit percussion', rootMidi: 72, url: `${STARGATE_RAW}/percussion/synthkit-8bit.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
  { species: SpeciesType.Predator, label: 'Synth Kick', instrument: 'Electronic kick', rootMidi: 36, url: `${STARGATE_RAW}/kicks/synthkit-kick.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
  { species: SpeciesType.Architect, label: 'Synth Snare', instrument: 'Electronic snare', rootMidi: 48, url: `${STARGATE_RAW}/snares/synthkit-snare.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
  { species: SpeciesType.Architect, label: 'Synth Clap', instrument: 'Electronic clap', rootMidi: 60, url: `${STARGATE_RAW}/claps/synthkit-clap.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
  { species: SpeciesType.Glider, label: 'Closed Hat', instrument: 'Electronic closed hi-hat', rootMidi: 72, url: `${STARGATE_RAW}/hihats/synthkit-hatclsd.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
  { species: SpeciesType.Glider, label: 'Open Hat', instrument: 'Electronic open hi-hat', rootMidi: 84, url: `${STARGATE_RAW}/hihats/synthkit-hatopen.wav`, source: 'Stargate Sample Pack / Fugue State Audio', license: 'CC0-1.0', pitchTracking: false },
];

async function loadBank(
  bank: BuiltInSampleDefinition[],
  onProgress?: (loaded: number, total: number) => void
) {
  const species = Object.values(SpeciesType);
  for (const entry of species) sampleInstrumentEngine.clearSpeciesSample(entry, false);

  let loaded = 0;
  for (const definition of bank) {
    const response = await fetch(definition.url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Unable to fetch ${definition.label} (${response.status}).`);
    }
    const blob = await response.blob();
    await sampleInstrumentEngine.loadSpeciesBlobZone(
      definition.species,
      blob,
      `${definition.label}.wav`,
      definition.rootMidi,
      false,
      1,
      definition.pitchTracking ?? true
    );
    loaded++;
    onProgress?.(loaded, bank.length);
  }
  return bank.length;
}

export async function loadOrigoCc0StarterBank(onProgress?: (loaded: number, total: number) => void) {
  return loadBank(ORIGO_CC0_STARTER_BANK, onProgress);
}

export async function loadOrigoCc0ElectronicBank(onProgress?: (loaded: number, total: number) => void) {
  return loadBank(ORIGO_CC0_ELECTRONIC_BANK, onProgress);
}
