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

### 10 — Composition / Motif Memory — **CURRENT**

- Detect repeating four-event musical contours independently for each species.
- Use transposition-invariant pitch-interval and quantized-rhythm signatures.
- Establish a motif only after it genuinely recurs.
- Track motif occurrence, intensity, first/last bar and strength.
- Annotate session events when motifs emerge or are deliberately recalled.
- Recall each species' strongest motif on a staggered four-bar cycle so the world gains memory without becoming a loop.
- Persist the strongest motifs in Origo session JSON.
- Surface live motif count in World Recorder.
- Expose motif-lineage capability in the Libertas/AetherStream source manifest while retaining external-master clock authority.

11. Add real instrument and SoundFont layer while retaining Origo synthesis.
12. Add musical analysis and measurable musical fitness.
13. Add specialized embedded browser music models where they improve structure.
14. Replace or repair environmental generative learning.
15. Derive large-scale musical sections from ecological events.
16. Add deterministic seeds, replay, branching and world lineage.
17. Add optional embedded composer / observer intelligence.

## Libertas / AetherStream boundary

Origo is a generative source and composition system. Libertas Desktop remains the authoritative sample-accurate master for synchronized distributed performance.

Origo should provide versioned event/session contracts, rendered media and source lineage. It should not compete with the Libertas master clock. This keeps the existing master/slave synchronization and AetherStream architecture compatible with Origo as the composition/generation backend grows.
