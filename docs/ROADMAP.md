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

### 9.7 — World Pacing + Mix Polish — **IN VALIDATION**

- Decouple world updates from display refresh rate with a fixed 24 Hz logical simulation clock.
- Reduce species baseline movement and clamp extreme velocity spikes.
- Stretch pulse and special-ability cooldowns so actions read as events rather than continuous noise.
- Replace 5x/10x turbo controls with 0.5x / 1x / 1.5x / 2x world pace controls.
- Reduce live sound density to four discrete events per second and three continuous voices.
- Soften FM depth, resonance, filter brightness, delay/reverb and default layer levels.
- Snap discrete live events to a 125 ms musical grid for a more coherent rhythmic feel.
- Keep pacing and sound polish as wrapper layers so they remain independently tunable.

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

### 12 — Musical Analysis + Fitness — **DONE**

- Analyze Origo's deterministic event stream without adding a heavyweight DSP dependency.
- Track event density, musical space, rhythmic regularity, pitch spread and pitch-class diversity.
- Track motif recurrence/recall, species balance, dynamic range and recent section contrast.
- Keep survival fitness separate from a multi-axis musical fitness vector.
- Avoid one arbitrary aggregate 'good music' score.
- Persist Musical DNA in Origo session JSON and expose a compact analysis summary in Aether manifests.
- Surface the signals in a user-facing Musical DNA panel.

### 13 — Optional Embedded Model Adapters — **CURRENT**

- Keep models optional and outside the deterministic music/simulation core.
- Define worker-friendly input/output contracts for phrase, groove and macro-structure helpers.
- Never allow a model to own the musical clock or directly mutate authoritative simulation state.
- Prefer symbolic/small models over full audio generation for the core browser experience.
- Require capability checks, graceful fallback and explicit model loading.
- Evaluate Magenta.js symbolic models behind an adapter despite its older published npm runtime; do not hard-wire it into core.
- Keep larger audio generators such as Magenta RealTime or MusicGen as external/optional renderers, not baseline dependencies.

14. Replace or repair environmental generative learning.
15. Derive large-scale musical sections from ecological events.
16. Add deterministic seeds, replay, branching and world lineage.
17. Add optional embedded composer / observer intelligence.

## Libertas / AetherStream boundary

Origo is a generative source and composition system. Libertas Desktop remains the authoritative sample-accurate master for synchronized distributed performance.

Origo should provide versioned event/session contracts, rendered media and source lineage. It should not compete with the Libertas master clock. This keeps the existing master/slave synchronization and AetherStream architecture compatible with Origo as the composition/generation backend grows.
