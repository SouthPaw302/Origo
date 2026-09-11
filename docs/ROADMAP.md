# Origo Implementation Roadmap

This roadmap tracks the functional music-system upgrade while preserving Origo's living-world identity.

## Current sequence

1. Preserve the simulation's visual identity and canvas-first experience. — **Done**
2. Stabilize broken learning math and prevent NaN contamination. — **Done / interim**
3. Prove one genuinely learnable agent task. — **Next learning milestone**
4. Replace the lightweight learner with proper browser ML / continuous-action RL. — **Planned**
5. Add a master musical transport. — **Foundation added**
6. Separate simulation behavior from musical events. — **Foundation added**
7. Add Origo's structured musical event language. — **Foundation added**
8. Record deterministic world/session timelines. — **Done**
9. Export real music/session artifacts: WAV, MIDI, Origo JSON, Aether manifest. — **Done**

### 9.5 — Usability + Sandbox QA — **DONE**

- Explore / Evolution / Sound / World navigation.
- Default Explore home instead of developer internals.
- One-click Calm Mix and always-visible master audio controls.
- First-class world recording and simplified exports.
- Collapsible/mobile-safe control deck and first-run guidance.
- Local sandbox server and deployment validation.

### 9.6 — Audio Traffic Control — **DONE**

- Cap simultaneous continuous neural synth voices.
- Limit burst events globally.
- Apply species-specific event cooldowns.
- Rate-limit reward/energy chimes.
- Keep the governor independent from the DSP engine.

### 10 — Composition / Motif Memory — **DONE**

- Detect repeating four-event musical contours independently for each species.
- Use transposition-invariant pitch-interval and quantized-rhythm signatures.
- Establish a motif only after it genuinely recurs.
- Track motif occurrence, intensity, first/last bar and strength.
- Annotate session events when motifs emerge or are deliberately recalled.
- Recall each species' strongest motif on a staggered four-bar cycle.
- Persist motifs in Origo session JSON and Aether lineage metadata.
- Surface live motif count in World Recorder.

### 11 — Real Instrument / SoundFont Layer — **DONE**

- Add Apache-2.0 SpessaSynth browser runtime.
- Support user-loaded SF2, SF3, SFOGG and DLS banks without uploading them to a server.
- Keep Origo's native synthesis available at all times.
- Add Native / Hybrid / Instruments listening modes.
- Map each species to an independent MIDI program/channel with user-editable programs.
- Route instrument events through the existing audio traffic governor.
- Mirror Origo master mute/volume into the SoundFont layer.
- Copy the AudioWorklet automatically for local development and Vercel builds.
- Do not bundle a sample bank; timbre licensing remains with the bank chosen by the user.

### 12 — Musical Analysis + Fitness — **CURRENT**

- Measure structure from Origo's deterministic event stream before adding heavier audio-analysis models.
- Track density, silence, rhythmic regularity, pitch spread, motif recurrence, species balance and section contrast.
- Keep survival fitness separate from musical fitness.
- Expose analysis as descriptive signals rather than one arbitrary 'good music' score.
- Use musical fitness later as one pressure in multi-objective evolution.

13. Add specialized embedded browser music models where they improve structure.
14. Replace or repair environmental generative learning.
15. Derive large-scale musical sections from ecological events.
16. Add deterministic seeds, replay, branching and world lineage.
17. Add optional embedded composer / observer intelligence.

## Libertas / AetherStream boundary

Origo is a generative source and composition system. Libertas Desktop remains the authoritative sample-accurate master for synchronized distributed performance.

Origo should provide versioned event/session contracts, rendered media and source lineage. It should not compete with the Libertas master clock. This keeps the existing master/slave synchronization and AetherStream architecture compatible with Origo as the composition/generation backend grows.
