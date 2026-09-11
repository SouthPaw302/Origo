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

### 9.7 — World Pacing + Mix Polish — **DONE**

- Decouple world updates from display refresh rate with a fixed 24 Hz logical simulation clock.
- Reduce species baseline movement and clamp extreme velocity spikes.
- Stretch pulse and special-ability cooldowns so actions read as events rather than continuous noise.
- Replace 5x/10x turbo controls with 0.5x / 1x / 1.5x / 2x world pace controls.
- Reduce live sound density to four discrete events per second and three continuous voices.
- Soften FM depth, resonance, filter brightness, delay/reverb and default layer levels.
- Snap discrete live events to a 125 ms musical grid for a more coherent rhythmic feel.
- Calibrate recorder timing from the actual world tick rate and selected BPM.

### 9.8 — Readable Interactions — **DONE**

- Replace continuous contact harvesting with a harvest wind-up, discrete energy transfer and recovery/cooldown.
- Replace Predator contact drain with a visible strike wind-up, discrete hit and recovery cycle.
- Delay Architect crystal creation behind a construction wind-up.
- Replace instantaneous Glider boost with a wind-up and short readable burst window.
- Add per-agent interaction phases: Harvest, Strike, Build, Boost and Recover.
- Render interaction progress arcs and selected-agent action labels directly on the simulation canvas.
- Tie interaction sounds to completed actions instead of continuous collision ticks.
- Preserve the wrappers as independently tunable gameplay systems rather than baking pacing into core RL math.

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

### 13 — Optional Embedded Model Adapters — **DONE (initial phrase adapter)**

- Keep models optional and outside the deterministic music/simulation core.
- Load the browser phrase model only after explicit user opt-in and isolate it in a Web Worker.
- Seed the monophonic phrase model only from Resonator/Glider melody events, collapsed to one sixteenth-note slot.
- Preview and reject suggestions before they affect the ecosystem.
- Accepted guidance changes pitch contour only; creatures still determine event timing and Origo retains world/BPM/transport authority.
- Annotate guided events in session JSON and expose guided-event metadata to Aether without changing `clockAuthority: external-master`.
- Preserve normal Origo operation when the model is unloaded or unavailable.
- Keep larger audio generators such as Magenta RealTime or MusicGen outside the baseline browser core.

### 14 — Environmental Generative Learning — **DONE (adaptive curriculum)**

- Replace cosmetic adversarial weight updates with explicit environment mutation, evaluation and selection.
- Evaluate candidates in the same terrain representation used by the world renderer/simulation.
- Score challenge fit, terrain usability and novelty separately, then promote only candidates that beat the active environment by a measurable margin.
- Adapt curriculum difficulty from agent absolute TD-error/regret: easier when agents struggle, harder when they master the current regime.
- Use reproducible seeded candidate mutation around the active environment seed, plus an exploratory random candidate.
- Keep the existing terrain synthesis mapping and preview contracts while stopping fake generator/discriminator training.
- Relabel Evolution telemetry as Challenge Fit, Curriculum Fit, Curriculum Gap and Regret Gap so the GUI matches the real mechanism.

### 15 — Ecological Musical Sections — **CURRENT**

- Detect multi-bar ecological states such as equilibrium, migration, predation pressure, construction growth, scarcity and recovery.
- Convert sustained ecological changes into musical sections without scripting Verse/Chorus labels into the agents.
- Persist section boundaries and causes in Origo session JSON and Aether metadata.
- Use section state to influence density, register and motif-return pressure without taking timing authority away from the event system.

16. Add deterministic seeds, replay, branching and world lineage.
17. Add optional embedded composer / observer intelligence.

## Libertas / AetherStream boundary

Origo is a generative source and composition system. Libertas Desktop remains the authoritative sample-accurate master for synchronized distributed performance.

Origo should provide versioned event/session contracts, rendered media and source lineage. It should not compete with the Libertas master clock. This keeps the existing master/slave synchronization and AetherStream architecture compatible with Origo as the composition/generation backend grows.
