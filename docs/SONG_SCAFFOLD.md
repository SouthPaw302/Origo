# Origo Song Scaffold

Origo is evolving from a reactive sound ecosystem into a recursive song-building system.

## Core principle

The ecosystem remains the source of timing and musical decisions. Recorded instruments, SoundFonts, loops and future AetherStream returns are renderers/material layers; they do not become the authoritative clock.

## Current layers

1. Native procedural synth — always available fallback.
2. SoundFont instruments — SF2/SF3/SFOGG/DLS through SpessaSynth.
3. Recorded Sample Rack — WAV/MP3/OGG/M4A/AAC/FLAC one-shots mapped to the four species.
4. CC0 Starter Bank — four lazily loaded real VSCO 2 CE recordings so Origo can make recorded-instrument sound without an upload step.
5. Aether Return Loop — a rendered Origo take or external stem can loop underneath the next ecosystem pass.
6. Phrase guidance — optional browser model can shape melodic pitch contour only.
7. Ecological sections — sustained world states bias density, register and motif-return pressure.

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

The finished take can be rendered to WAV and loaded directly into the Aether Return Loop. Origo arms that return layer rather than immediately starting it.

### Pass 3 — ecosystem overdubs itself

Pressing Record New Take creates a fresh bar-zero clock origin and launches the armed Return Loop at the same boundary. The new ecosystem pass then plays recorded samples, SoundFonts and/or native synthesis over the previous take.

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
- launch intent

The runtime entry point for a future direct bridge is `SampleInstrumentEngine.loadAetherLoopBlob()`.

The declared return descriptor is `libertas.aether.origo-return-loop.v1`.

Current in-browser recursive takes launch at the next take's bar-zero boundary. A direct Libertas/Aether implementation should later support external next-bar / next-phrase launch messages against the Libertas master clock.

## Real sample-bank direction

Do not bundle random commercial/royalty-free packs whose redistribution terms are unclear.

The first optional Origo Starter Bank uses four CC0/public-domain VSCO 2 Community Edition recordings and is fetched only on user request. Users can replace every role with their own recordings.

Next, graduate each species from one root sample to a compact multisample map so pitch changes choose the nearest recorded zone instead of stretching a single recording too far.

## Known scaffold limitation

External loops with a different BPM currently use playback-rate matching. That changes pitch as well as tempo. Recursive Origo takes normally share the same BPM, so their playback rate is 1.0. Pitch-preserving time-stretch belongs in the direct Aether/Libertas return path rather than being hidden behind a fake promise here.

## Next implementation targets

1. Multisample zones per species with nearest-root selection.
2. Stem-aware return lanes: rhythm, bass, harmonic bed, lead/texture.
3. Pitch-preserving tempo adaptation for external Aether/Libertas returns.
4. Freeze/bounce a recursive layer and branch the song from that state.
5. Preserve loop/stem lineage in the Origo session and Aether manifest.
6. Let ecological sections choose which return lanes become audible while Libertas remains clock master.
