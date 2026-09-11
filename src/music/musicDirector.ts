import { SpeciesType } from '../types';
import { SimulationEngine } from '../simulation/engine';
import { OrigoMusicClock } from './musicClock';
import { OrigoMusicalEvent } from './types';
import { OrigoMotifMemory } from './motifMemory';

const SPECIES_OCTAVE: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 12,
  [SpeciesType.Predator]: -12,
  [SpeciesType.Architect]: 0,
  [SpeciesType.Glider]: 24,
};

const SPECIES_DURATION: Record<SpeciesType, number> = {
  [SpeciesType.Resonator]: 0.75,
  [SpeciesType.Predator]: 0.25,
  [SpeciesType.Architect]: 2,
  [SpeciesType.Glider]: 0.5,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function eventKind(species: SpeciesType, pulse: number, terraform: number, ability: number) {
  if (species === SpeciesType.Predator && (pulse > 0.35 || ability > 0.5)) return 'impact' as const;
  if (species === SpeciesType.Architect && Math.abs(terraform) > 0.3) return 'drone' as const;
  if (pulse > 0.35) return 'pulse' as const;
  if (species === SpeciesType.Glider) return 'transition' as const;
  if (species === SpeciesType.Resonator) return 'note' as const;
  return 'texture' as const;
}

export class OrigoMusicDirector {
  private lastQuantizedSlot = new Map<string, number>();
  private motifMemory = new OrigoMotifMemory();

  public collect(engine: SimulationEngine, clock: OrigoMusicClock): OrigoMusicalEvent[] {
    const preset = engine.activePreset.soundPreset;
    const events: OrigoMusicalEvent[] = [];
    const slotStep = clock.quantizedStep(engine.stepCount);

    for (const agent of engine.agents) {
      const actions: number[] = agent.lastActionOutputs || [];
      if (actions.length < 5) continue;

      const [thrust, steer, pulse, terraform, ability] = actions.map((v: number) => clamp(v, -1, 1));
      const species = agent.species as SpeciesType;
      const speed = Math.hypot(agent.vx, agent.vy);
      const energyNorm = clamp(agent.energy / Math.max(1, agent.maxEnergy), 0, 1);

      const behavioralIntensity = clamp(
        Math.max(Math.abs(pulse), Math.abs(terraform), Math.abs(ability), speed / Math.max(1, agent.config.baseSpeed * 1.4)),
        0,
        1
      );
      if (behavioralIntensity < 0.34) continue;

      const kind = eventKind(species, pulse, terraform, ability);
      const key = `${agent.id}:${kind}`;
      if (this.lastQuantizedSlot.get(key) === slotStep) continue;
      this.lastQuantizedSlot.set(key, slotStep);

      const scale = preset.scale.length ? preset.scale : [0, 2, 4, 7, 9, 12];
      const yNorm = clamp(agent.y / Math.max(1, engine.env.height), 0, 1);
      const xNorm = clamp(agent.x / Math.max(1, engine.env.width), 0, 1);
      const scaleIndex = Math.min(scale.length - 1, Math.floor((1 - yNorm) * scale.length));
      const proposedMidi = clamp(
        Math.round(preset.rootNote + scale[scaleIndex] + SPECIES_OCTAVE[species]),
        24,
        108
      );

      const position = clock.positionForStep(engine.stepCount);
      const shaped = this.motifMemory.shapePitch(species, proposedMidi, position.bar);
      const harmonicField = engine.env.sampleHarmonicField(agent.x, agent.y);
      const terrain = engine.env.sampleTerrain(agent.x, agent.y);
      const acousticPressure = engine.env.sampleAcousticPressure(agent.x, agent.y);

      events.push({
        id: `evt_${engine.stepCount}_${agent.id}_${events.length}`,
        type: kind,
        agentId: agent.id,
        species,
        generation: agent.generation,
        step: engine.stepCount,
        position,
        midiNote: shaped.midiNote,
        velocity: clamp(0.25 + behavioralIntensity * 0.6 + energyNorm * 0.15, 0.05, 1),
        durationBeats: SPECIES_DURATION[species],
        pan: clamp(xNorm * 2 - 1, -1, 1),
        intensity: behavioralIntensity,
        energy: energyNorm,
        xNorm,
        yNorm,
        motif: shaped.motif,
        action: { thrust, steer, pulse, terraform, ability },
        environment: { harmonicField, terrain, acousticPressure },
      });
    }

    this.motifMemory.observe(events);
    return events;
  }

  public getMotifs() {
    return this.motifMemory.getMotifs();
  }

  public reset() {
    this.lastQuantizedSlot.clear();
    this.motifMemory.reset();
  }
}
