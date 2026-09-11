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

### 9.5 — Usability + Sandbox QA — **CURRENT**

- Replace developer-first navigation labels with Explore / Evolution / Sound / World.
- Add a default Explore home instead of dropping users directly into neural-network internals.
- Add one-click **Calm Mix** and always-visible master audio controls.
- Make world recording a first-class action from the header and simplify the recorder workflow.
- Keep Libertas/AetherStream export under an advanced section rather than normal-user controls.
- Make the inspector/control deck collapsible and mobile-safe.
- Add first-run guidance and keyboard/focus accessibility.
- Validate GUI changes in a local sandbox server before GitHub/Vercel deployment.
- Keep the simulation canvas visually dominant.

10. Add composition / motif memory.
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
