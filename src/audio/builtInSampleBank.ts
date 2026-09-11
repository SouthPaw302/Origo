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
}

const VSCO_RAW = 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master';

/**
 * Tiny lazy-loaded real-instrument bank sourced from VSCO 2 Community Edition.
 * The underlying VSCO CE recordings are CC0/public-domain. Nothing is fetched
 * until the user explicitly chooses to load this starter bank.
 */
export const ORIGO_CC0_STARTER_BANK: BuiltInSampleDefinition[] = [
  {
    species: SpeciesType.Resonator,
    label: 'VSCO Violin Pizz A4',
    instrument: 'Solo violin pizzicato',
    rootMidi: 69,
    url: `${VSCO_RAW}/Strings/Solo%20Violin/Pizz/LLVln_Pizz_A4_p_RR1.wav`,
    source: 'VSCO 2 Community Edition / Versilian Studios',
    license: 'CC0-1.0',
  },
  {
    species: SpeciesType.Predator,
    label: 'VSCO Cello Pizz A2',
    instrument: 'Cello section pizzicato',
    rootMidi: 45,
    url: `${VSCO_RAW}/Strings/Cello%20Section/pizzT/pizzT_A2_v1_RR1.wav`,
    source: 'VSCO 2 Community Edition / Versilian Studios',
    license: 'CC0-1.0',
  },
  {
    species: SpeciesType.Architect,
    label: 'VSCO Cello Sustain C3',
    instrument: 'Cello section sustained vibrato',
    rootMidi: 48,
    url: `${VSCO_RAW}/Strings/Cello%20Section/susvib/susvib_C3_v1_1.wav`,
    source: 'VSCO 2 Community Edition / Versilian Studios',
    license: 'CC0-1.0',
  },
  {
    species: SpeciesType.Glider,
    label: 'VSCO Flute Staccato A4',
    instrument: 'Flute staccato',
    rootMidi: 69,
    url: `${VSCO_RAW}/Woodwinds/Flute/stac/LDFlute_stac_A4_v1_rr1.wav`,
    source: 'VSCO 2 Community Edition / Versilian Studios',
    license: 'CC0-1.0',
  },
];

export async function loadOrigoCc0StarterBank(onProgress?: (loaded: number, total: number) => void) {
  let loaded = 0;
  for (const definition of ORIGO_CC0_STARTER_BANK) {
    const response = await fetch(definition.url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Unable to fetch ${definition.instrument} (${response.status}).`);
    }
    const blob = await response.blob();
    const file = new File([blob], `${definition.label}.wav`, { type: blob.type || 'audio/wav' });
    await sampleInstrumentEngine.loadSpeciesSample(definition.species, file);
    sampleInstrumentEngine.setRootMidi(definition.species, definition.rootMidi);
    loaded++;
    onProgress?.(loaded, ORIGO_CC0_STARTER_BANK.length);
  }
  return ORIGO_CC0_STARTER_BANK.length;
}
