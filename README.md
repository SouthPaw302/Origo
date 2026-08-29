# Origo

Origo is a browser-based laboratory for reinforcement learning, self-play, artificial life, emergent communication and raw sound.

## Core rule

> Learn through reinforcement learning and self-play without human gameplay, musical examples, demonstrations, or pretrained behavioral data.

Core may receive an environment, a body, controls, raw synthesis primitives, opponents and rewards. It is not shown how humans solve the task.

## Core experiments

- **Self-Play Arena** — shared tabular RL discovers Tic-Tac-Toe from terminal rewards.
- **Life Wars** — two reinforcement-learning policies compete over the initial conditions of a cellular automaton.
- **Echo Language** — sender and receiver agents invent a sonic communication protocol. Audio requires an explicit user gesture and includes a test tone for mobile/WebView compatibility.
- **Raw Music Lab** — self-play explores raw oscillator/noise controls without scales, notes, chords, songs, genres or MIDI examples. Origo-generated sequences may be saved and mutated with lineage retained.

## Lineage

Core artifacts are tagged as `ORIGO_CORE` or `ORIGO_DESCENDANT`. Descendants retain parent IDs and generation numbers. Only internal Origo ancestry is considered Core-safe.

Human songs, external MIDI, demonstrations or other human-seeded material must remain outside Core. If import tools are added later, they belong in a clearly separated sandbox.

## Legacy sandbox

The original **Neural Harmonics** AI Studio simulation is preserved as a legacy experiment because it includes explicit human musical priors such as named scales and tuned presets. It is intentionally excluded from Core claims.

## Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Web Audio API

No external AI model or inference API is required by Origo Core.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run lint
npm run build
```
