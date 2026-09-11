import { SpeciesType } from '../types';
import { SimulationEngine } from '../simulation/engine';
import {
  EcologicalSectionBias,
  EcologicalSectionMetrics,
  EcologicalSectionType,
  OrigoEcologicalSection,
} from './types';

const SUSTAIN_BARS = 2;

const BIASES: Record<EcologicalSectionType, EcologicalSectionBias> = {
  equilibrium: { density: 0.62, registerSemitones: 0, motifRecallPressure: 0.78 },
  scarcity: { density: 0.3, registerSemitones: -5, motifRecallPressure: 0.92 },
  predation: { density: 0.84, registerSemitones: -7, motifRecallPressure: 0.5 },
  construction: { density: 0.52, registerSemitones: -2, motifRecallPressure: 0.72 },
  migration: { density: 0.72, registerSemitones: 5, motifRecallPressure: 0.58 },
  recovery: { density: 0.48, registerSemitones: 2, motifRecallPressure: 1.0 },
  flux: { density: 0.58, registerSemitones: 0, motifRecallPressure: 0.65 },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizedEntropy(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return 0;
  let entropy = 0;
  let occupied = 0;
  for (const count of counts) {
    if (count <= 0) continue;
    occupied++;
    const p = count / total;
    entropy -= p * Math.log(p);
  }
  if (occupied <= 1) return 0;
  return clamp01(entropy / Math.log(counts.length));
}

interface EcologySnapshot {
  bar: number;
  metrics: EcologicalSectionMetrics;
  totalKills: number;
  totalBuilds: number;
  population: number;
}

function collectSnapshot(engine: SimulationEngine, bar: number, previous?: EcologySnapshot): EcologySnapshot {
  const counts: Record<SpeciesType, number> = {
    [SpeciesType.Resonator]: 0,
    [SpeciesType.Predator]: 0,
    [SpeciesType.Architect]: 0,
    [SpeciesType.Glider]: 0,
  };

  let energySum = 0;
  let mobilitySum = 0;
  let totalKills = 0;
  let totalBuilds = 0;

  for (const agent of engine.agents) {
    counts[agent.species]++;
    energySum += clamp01(agent.energy / Math.max(1, agent.maxEnergy));
    mobilitySum += clamp01(Math.hypot(agent.vx, agent.vy) / Math.max(0.1, agent.config.baseSpeed));
    totalKills += Math.max(0, agent.kills || 0);
    totalBuilds += Math.max(0, agent.nodesCreated || 0);
  }

  const population = Math.max(1, engine.agents.length);
  const averageEnergy = energySum / population;
  const averageMobility = mobilitySum / population;
  const speciesBalance = normalizedEntropy(Object.values(counts));
  const predatorShare = counts[SpeciesType.Predator] / population;
  const architectShare = counts[SpeciesType.Architect] / population;
  const gliderShare = counts[SpeciesType.Glider] / population;

  let nodeEnergy = 0;
  if (engine.env.energyNodes.length) {
    nodeEnergy = engine.env.energyNodes.reduce(
      (sum, node) => sum + clamp01(node.energy / Math.max(1, node.maxEnergy)),
      0
    ) / engine.env.energyNodes.length;
  }

  const killDelta = Math.max(0, totalKills - (previous?.totalKills ?? totalKills));
  const buildDelta = Math.max(0, totalBuilds - (previous?.totalBuilds ?? totalBuilds));
  const killRate = clamp01(killDelta / Math.max(1, population * 0.08));
  const buildRate = clamp01(buildDelta / Math.max(1, population * 0.1));

  return {
    bar,
    population,
    totalKills,
    totalBuilds,
    metrics: {
      averageEnergy: round3(averageEnergy),
      nodeEnergy: round3(nodeEnergy),
      speciesBalance: round3(speciesBalance),
      predatorPressure: round3(clamp01(killRate * 0.75 + predatorShare * 0.25)),
      constructionActivity: round3(clamp01(buildRate * 0.8 + architectShare * 0.2)),
      mobility: round3(clamp01(averageMobility * 0.72 + gliderShare * 0.28)),
    },
  };
}

function classify(snapshot: EcologySnapshot, previous?: EcologySnapshot, previousType?: EcologicalSectionType) {
  const m = snapshot.metrics;
  const energyRise = previous ? m.averageEnergy - previous.metrics.averageEnergy : 0;
  const nodeRise = previous ? m.nodeEnergy - previous.metrics.nodeEnergy : 0;

  if (
    previousType === 'scarcity' &&
    (energyRise > 0.055 || nodeRise > 0.08) &&
    m.averageEnergy > 0.34
  ) {
    return {
      type: 'recovery' as const,
      cause: 'Energy availability is rebounding after a sustained scarcity phase.',
    };
  }

  if (m.averageEnergy < 0.34 || m.nodeEnergy < 0.2) {
    return {
      type: 'scarcity' as const,
      cause: 'Agent or resource energy has fallen below the sustainable operating range.',
    };
  }

  if (m.predatorPressure > 0.42) {
    return {
      type: 'predation' as const,
      cause: 'New predator strikes and predator population pressure are dominating interactions.',
    };
  }

  if (m.constructionActivity > 0.38) {
    return {
      type: 'construction' as const,
      cause: 'Architect building activity is materially reshaping the resource field.',
    };
  }

  if (m.mobility > 0.7) {
    return {
      type: 'migration' as const,
      cause: 'Population movement and Glider mobility are elevated across the world.',
    };
  }

  if (m.speciesBalance > 0.88 && m.averageEnergy > 0.46 && m.nodeEnergy > 0.3) {
    return {
      type: 'equilibrium' as const,
      cause: 'Species balance and resource energy are simultaneously stable.',
    };
  }

  return {
    type: 'flux' as const,
    cause: 'No single ecological pressure is dominant; the world is in a mixed transition state.',
  };
}

function sectionId(type: EcologicalSectionType, startBar: number) {
  return `section_${type}_${startBar}`;
}

export class EcologicalSectionTracker {
  private sections: OrigoEcologicalSection[] = [];
  private currentType: EcologicalSectionType | null = null;
  private candidateType: EcologicalSectionType | null = null;
  private candidateCause = '';
  private candidateBars = 0;
  private lastSnapshot: EcologySnapshot | undefined;
  private lastProcessedBar = -1;

  public update(engine: SimulationEngine, bar: number): EcologicalSectionBias {
    if (bar === this.lastProcessedBar && this.currentType) {
      return BIASES[this.currentType];
    }
    if (bar < this.lastProcessedBar) return this.getCurrentBias();
    this.lastProcessedBar = bar;

    const snapshot = collectSnapshot(engine, bar, this.lastSnapshot);
    const classification = classify(snapshot, this.lastSnapshot, this.currentType ?? undefined);

    if (!this.currentType) {
      this.currentType = classification.type;
      this.sections.push({
        id: sectionId(classification.type, bar),
        type: classification.type,
        startBar: bar,
        cause: classification.cause,
        metrics: { ...snapshot.metrics },
        bias: { ...BIASES[classification.type] },
      });
      this.lastSnapshot = snapshot;
      return BIASES[this.currentType];
    }

    const current = this.sections[this.sections.length - 1];
    if (current) current.metrics = { ...snapshot.metrics };

    if (classification.type === this.currentType) {
      this.candidateType = null;
      this.candidateCause = '';
      this.candidateBars = 0;
    } else if (classification.type === this.candidateType) {
      this.candidateBars++;
      if (this.candidateBars >= SUSTAIN_BARS) {
        if (current) current.endBar = Math.max(current.startBar, bar - 1);
        this.currentType = classification.type;
        this.sections.push({
          id: sectionId(classification.type, bar),
          type: classification.type,
          startBar: bar,
          cause: this.candidateCause || classification.cause,
          metrics: { ...snapshot.metrics },
          bias: { ...BIASES[classification.type] },
        });
        this.candidateType = null;
        this.candidateCause = '';
        this.candidateBars = 0;
      }
    } else {
      this.candidateType = classification.type;
      this.candidateCause = classification.cause;
      this.candidateBars = 1;
    }

    this.lastSnapshot = snapshot;
    return this.getCurrentBias();
  }

  public getCurrentType(): EcologicalSectionType | null {
    return this.currentType;
  }

  public getCurrentBias(): EcologicalSectionBias {
    return this.currentType ? { ...BIASES[this.currentType] } : { ...BIASES.flux };
  }

  public getSections(): OrigoEcologicalSection[] {
    return this.sections.map((section) => ({
      ...section,
      metrics: { ...section.metrics },
      bias: { ...section.bias },
    }));
  }

  public finalize(lastBar: number) {
    const current = this.sections[this.sections.length - 1];
    if (current && current.endBar === undefined) current.endBar = Math.max(current.startBar, lastBar);
  }

  public reset() {
    this.sections = [];
    this.currentType = null;
    this.candidateType = null;
    this.candidateCause = '';
    this.candidateBars = 0;
    this.lastSnapshot = undefined;
    this.lastProcessedBar = -1;
  }
}

export const ECOLOGICAL_SECTION_BIASES = BIASES;
