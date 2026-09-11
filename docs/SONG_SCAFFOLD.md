# Origo Song Scaffold

Origo is evolving from a reactive sound ecosystem into a recursive song-building system.

## Core principle

The ecosystem remains the source of timing and musical decisions. Recorded instruments, SoundFonts, loops and future AetherStream returns are renderers/material layers; they do not become the authoritative clock.

## Current layers

1. Native procedural synth — always available fallback.
2. SoundFont instruments — SF2/SF3/SFOGG/DLS through SpessaSynth.
3. Recorded Sample Rack — WAV/MP3/OGG/M4A/AAC/FLAC one-shots mapped to the four species.
4. Aether Return Loop — a rendered Origo take or external stem can loop underneath the next ecosystem pass.
5. Phrase guidance — optional browser model can shape melodic pitch contour only.
6. Ecological sections — sustained world states bias density, register and motif-return pressure.

## Species sample roles

- Resonator: mallet, piano, bell, pluck, resonant tuned percussion.
- Predator: bass note, kick, low drum, low brass/percussive attack.
- Architect: cello, guitar, sustained string, harmonium/pad-like recorded tone.
- Glider: fiddle, flute, lead, bright pluck or other mobile melodic instrument.

Each recorded one-shot has a MIDI root note. Origo pitch-shifts playback relative to that root while the event timing remains creature-driven.

## Recursive song workflow

### Pass 1 — world creates material

World → ecological sections → creature musical events → instruments/samples → recorded Origo take.

### Pass 2 — take becomes musical memory

The finished take can be rendered to WAV and loaded directly into the Aether Return Loop.

### Pass 3 — ecosystem overdubs itself

Return Loop + next ecological generation → new instrument/sample events → new take.

This can repeat, creating increasingly structured layers without replacing Origo with a conventional linear sequencer.

## AetherStream / Libertas boundary

Libertas Desktop remains the authoritative synchronized clock.

Origo exports:
- deterministic event/session timeline
- motifs
- ecological section boundaries
- MIDI
- rendered audio
- Aether source manifest

Origo can accept:
- rendered loop/stem audio
- source BPM
- bar count
- future quantized launch instruction

The runtime entry point for a future direct bridge is `SampleInstrumentEngine.loadAetherLoopBlob()`.

The declared return descriptor is `libertas.aether.origo-return-loop.v1`.

## Real sample-bank direction

Do not bundle random commercial/royalty-free packs whose redistribution terms are unclear.

Preferred baseline: curate a compact CC0/public-domain Origo bank from VSCO 2 Community Edition recordings. Start with a deliberately small set so browser download/cache cost stays reasonable:

- 6–10 bass/cello zones
- 6–10 violin/fiddle zones
- 6–10 flute/woodwind zones
- 6–10 mallet/percussion/pluck zones
- a small percussion subset

Keep the full user-loaded Sample Rack available so creators can replace every role with their own recordings.

## Next implementation targets

1. Curated CC0 built-in starter bank with a manifest and lazy loading.
2. Multisample zones per species instead of a single pitch-shifted recording.
3. Bar-quantized Aether loop launch rather than immediate launch.
4. Stem-aware return lanes: rhythm, bass, harmonic bed, lead/texture.
5. Freeze/bounce a recursive layer and branch the song from that state.
6. Preserve loop/stem lineage in the Origo session and Aether manifest.
7. Let ecological sections choose which return lanes become audible while Libertas remains clock master.
