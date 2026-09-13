/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ScaleDefinition {
  name: string;
  category: string;
  intervals: number[];
  description: string;
}

export const SCALES: Record<string, ScaleDefinition> = {
  major: {
    name: 'Major',
    category: 'Classical / Universal',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24],
    description: 'Diatonic major for tonal, classical, folk and popular harmony'
  },
  natural_minor: {
    name: 'Natural Minor',
    category: 'Classical / Universal',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
    description: 'Diatonic minor with a broad expressive range'
  },
  harmonic_minor: {
    name: 'Harmonic Minor',
    category: 'Classical / Dramatic',
    intervals: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19, 20, 23, 24],
    description: 'Minor mode with a raised leading tone for stronger tonal pull'
  },
  mixolydian: {
    name: 'Mixolydian',
    category: 'Rock / Folk / Groove',
    intervals: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24],
    description: 'Major color with a flattened seventh for folk, rock and groove music'
  },
  blues: {
    name: 'Blues Hexatonic',
    category: 'Blues / Jazz / Rock',
    intervals: [0, 3, 5, 6, 7, 10, 12, 15, 17, 18, 19, 22, 24],
    description: 'Minor blues vocabulary with the characteristic blue fifth'
  },
  pentatonic_major: {
    name: 'Pentatonic Major', category: 'Harmonic / Ambient',
    intervals: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
    description: 'Bright, consonant, floating celestial harmonics'
  },
  pentatonic_minor: {
    name: 'Pentatonic Minor', category: 'Evolving Grooves',
    intervals: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    description: 'Deep bluesy ambient warmth and moody undertones'
  },
  lydian: {
    name: 'Lydian Dream', category: 'Ethereal Sci-Fi',
    intervals: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 24],
    description: 'Raised fourth creates mysterious, otherworldly floating atmospheres'
  },
  dorian: {
    name: 'Dorian Cyber', category: 'Cinematic Techno',
    intervals: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24],
    description: 'Sophisticated minor mode with uplifting major 6th accents'
  },
  phrygian_dominant: {
    name: 'Phrygian Dominant', category: 'Dark Tension',
    intervals: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19, 20, 22, 24],
    description: 'Exotic tension, predatory hunting pulses and sharp acoustic transients'
  },
  hirajoshi: {
    name: 'Hirajoshi (Japanese Pentatonic)', category: 'Meditative Minimalist',
    intervals: [0, 2, 3, 7, 8, 12, 14, 15, 19, 20, 24],
    description: 'Traditional meditative Japanese scale, tranquil yet dramatic'
  },
  harmonic_series: {
    name: 'Overtone Harmonic Series', category: 'Pure Mathematical',
    intervals: [0, 4, 7, 10, 14, 18, 21, 24],
    description: 'Rooted in natural physics resonances and crystalline ratios'
  }
};

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function quantizeToMidi(normalizedVal: number, rootMidi: number = 48, scaleKey: string = 'lydian'): number {
  const scale = SCALES[scaleKey] || SCALES.lydian;
  const intervals = scale.intervals;
  const clamped = Math.max(0, Math.min(0.999, normalizedVal));
  const noteIndex = Math.floor(clamped * intervals.length);
  return Math.max(0, Math.min(127, Math.round(rootMidi + intervals[noteIndex])));
}

export function quantizeToScale(normalizedVal: number, rootMidi: number = 48, scaleKey: string = 'lydian', octaveSpread: number = 2): number {
  void octaveSpread;
  return midiToFreq(quantizeToMidi(normalizedVal, rootMidi, scaleKey));
}
