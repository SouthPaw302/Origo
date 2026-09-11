import { soundEngine } from '../audio/soundEngine';
import { SpeciesType } from '../types';
import { Agent } from './agent';
import { SimulationEnvironment } from './environment';

export type InteractionPhase = 'idle' | 'harvesting' | 'striking' | 'building' | 'boosting' | 'recovering';

interface RuntimeState {
  phase: InteractionPhase;
  phaseTicks: number;
  phaseTotal: number;
  recoveryTicks: number;
  attackCooldown: number;
  harvestCooldown: number;
  burstTicks: number;
  targetAgentId?: string;
  targetX?: number;
  targetY?: number;
}

export interface InteractionCue {
  phase: InteractionPhase;
  label: string;
  progress: number;
  bursting: boolean;
}

const runtimeByAgent = new WeakMap<Agent, RuntimeState>();
let installed = false;

const HARVEST_WINDUP = 8;
const HARVEST_COOLDOWN = 20;
const STRIKE_WINDUP = 6;
const STRIKE_COOLDOWN = 30;
const BUILD_WINDUP = 18;
const BOOST_WINDUP = 8;
const RECOVERY_TICKS = 10;
const BOOST_BURST_TICKS = 5;

function stateFor(agent: Agent): RuntimeState {
  let state = runtimeByAgent.get(agent);
  if (!state) {
    state = {
      phase: 'idle',
      phaseTicks: 0,
      phaseTotal: 1,
      recoveryTicks: 0,
      attackCooldown: 0,
      harvestCooldown: 0,
      burstTicks: 0,
    };
    runtimeByAgent.set(agent, state);
  }
  return state;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function addInteractionReward(agent: Agent, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return;
  const memory = agent.memory[agent.memory.length - 1];
  if (memory) memory.reward += amount;
  agent.totalReward += amount;
  agent.recentReward = agent.recentReward * 0.95 + amount * 0.05;
  agent.lastRewardBreakdown.extrinsic += amount;
  agent.lastRewardBreakdown.total += amount;
}

function setPhase(state: RuntimeState, phase: InteractionPhase, ticks: number) {
  state.phase = phase;
  state.phaseTicks = Math.max(0, ticks);
  state.phaseTotal = Math.max(1, ticks);
}

function startRecovery(state: RuntimeState, ticks = RECOVERY_TICKS) {
  state.phase = 'recovering';
  state.recoveryTicks = ticks;
  state.phaseTicks = ticks;
  state.phaseTotal = Math.max(1, ticks);
  state.targetAgentId = undefined;
  state.targetX = undefined;
  state.targetY = undefined;
}

function resolveHarvest(agent: Agent, env: SimulationEnvironment, state: RuntimeState) {
  const targetX = state.targetX ?? agent.x;
  const targetY = state.targetY ?? agent.y;
  let best = null as SimulationEnvironment['energyNodes'][number] | null;
  let bestDistance = Infinity;

  for (const node of env.energyNodes) {
    const nodeToTarget = Math.hypot(node.x - targetX, node.y - targetY);
    const agentDistance = Math.hypot(node.x - agent.x, node.y - agent.y);
    if (nodeToTarget < 22 && agentDistance < agent.radius + node.radius + 16 && node.energy > 0 && nodeToTarget < bestDistance) {
      best = node;
      bestDistance = nodeToTarget;
    }
  }

  if (best) {
    const harvest = Math.min(best.energy, 3);
    best.energy -= harvest;
    agent.energy = Math.min(agent.maxEnergy, agent.energy + harvest * 1.35);
    agent.energyGathered += harvest;
    addInteractionReward(agent, 0.35);
    soundEngine.triggerChime(best.harmonicFrequency);
  }

  state.harvestCooldown = HARVEST_COOLDOWN;
  startRecovery(state, 8);
}

function resolveStrike(agent: Agent, allAgents: Agent[], state: RuntimeState) {
  const target = allAgents.find((candidate) => candidate.id === state.targetAgentId);
  if (target && target.energy > 0) {
    const distance = Math.hypot(target.x - agent.x, target.y - agent.y);
    if (distance < agent.radius + target.radius + 22) {
      const siphon = Math.min(target.energy, 10);
      target.energy -= siphon;
      agent.energy = Math.min(agent.maxEnergy, agent.energy + siphon * 0.55);
      addInteractionReward(agent, 0.55);
      soundEngine.triggerAgentSound(SpeciesType.Predator, agent.x / 1000, agent.y / 700, 0.72, 0.2);
      if (target.energy <= 0) {
        agent.kills++;
        agent.updateElo(target, 1);
      }
    }
  }

  state.attackCooldown = STRIKE_COOLDOWN;
  startRecovery(state, 10);
}

function resolveBuild(agent: Agent, env: SimulationEnvironment, state: RuntimeState) {
  const x = state.targetX ?? agent.x;
  const y = state.targetY ?? agent.y;
  if (env.energyNodes.length < env.maxNodes + 4) {
    env.spawnEnergyNode(x, y);
    agent.nodesCreated++;
    addInteractionReward(agent, 0.45);
    soundEngine.triggerAgentSound(SpeciesType.Architect, clamp01(x / Math.max(1, env.width)), clamp01(y / Math.max(1, env.height)), 0.45, 0.05);
  }
  startRecovery(state, 12);
}

function resolveBoost(agent: Agent, state: RuntimeState) {
  const speed = Math.hypot(agent.vx, agent.vy);
  const headingX = speed > 0.08 ? agent.vx / speed : Math.cos(agent.angle);
  const headingY = speed > 0.08 ? agent.vy / speed : Math.sin(agent.angle);
  const burst = Math.max(agent.config.baseSpeed * 1.25, speed * 1.35);
  agent.vx = headingX * burst;
  agent.vy = headingY * burst;
  state.burstTicks = BOOST_BURST_TICKS;
  addInteractionReward(agent, 0.08);
  soundEngine.triggerAgentSound(SpeciesType.Glider, clamp01(agent.x / 1000), clamp01(agent.y / 700), 0.48, 0.04);
  startRecovery(state, 8);
}

function advanceInteraction(agent: Agent, env: SimulationEnvironment, allAgents: Agent[], state: RuntimeState) {
  if (state.attackCooldown > 0) state.attackCooldown--;
  if (state.harvestCooldown > 0) state.harvestCooldown--;
  if (state.burstTicks > 0) state.burstTicks--;

  if (state.phase === 'idle') return;

  if (state.phase === 'recovering') {
    state.recoveryTicks = Math.max(0, state.recoveryTicks - 1);
    state.phaseTicks = state.recoveryTicks;
    if (state.recoveryTicks === 0) setPhase(state, 'idle', 0);
    return;
  }

  state.phaseTicks = Math.max(0, state.phaseTicks - 1);
  if (state.phaseTicks > 0) return;

  switch (state.phase) {
    case 'harvesting':
      resolveHarvest(agent, env, state);
      break;
    case 'striking':
      resolveStrike(agent, allAgents, state);
      break;
    case 'building':
      resolveBuild(agent, env, state);
      break;
    case 'boosting':
      resolveBoost(agent, state);
      break;
  }
}

function maybeStartContactInteraction(agent: Agent, env: SimulationEnvironment, allAgents: Agent[], state: RuntimeState) {
  if (state.phase !== 'idle') return;

  if (agent.species === SpeciesType.Predator && state.attackCooldown === 0) {
    let nearest: Agent | null = null;
    let nearestDistance = Infinity;
    for (const other of allAgents) {
      if (other.id === agent.id || other.species === SpeciesType.Predator || other.energy <= 0) continue;
      const distance = Math.hypot(other.x - agent.x, other.y - agent.y);
      if (distance < agent.radius + other.radius + 10 && distance < nearestDistance) {
        nearest = other;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      state.targetAgentId = nearest.id;
      setPhase(state, 'striking', STRIKE_WINDUP);
      return;
    }
  }

  if (state.harvestCooldown > 0) return;
  let nearestNode = null as SimulationEnvironment['energyNodes'][number] | null;
  let nearestDistance = Infinity;
  for (const node of env.energyNodes) {
    if (node.energy <= 0) continue;
    const distance = Math.hypot(node.x - agent.x, node.y - agent.y);
    if (distance < agent.radius + node.radius + 6 && distance < nearestDistance) {
      nearestNode = node;
      nearestDistance = distance;
    }
  }

  if (nearestNode) {
    state.targetX = nearestNode.x;
    state.targetY = nearestNode.y;
    setPhase(state, 'harvesting', HARVEST_WINDUP);
  }
}

export function installInteractionPacing() {
  if (installed) return;
  installed = true;

  const originalStep = Agent.prototype.step;
  Agent.prototype.step = function interactionStep(this: Agent, ...args: Parameters<Agent['step']>) {
    const [env, allAgents] = args;
    const state = stateFor(this);
    advanceInteraction(this, env, allAgents, state);

    const previousAbilityCooldown = this.abilityCooldown;
    const previousRadius = this.radius;
    const previousMaxNodes = env.maxNodes;
    const nodeRadii = env.energyNodes.map((node) => node.radius);

    // Native interactions happen every contact tick. Disable those collision paths here;
    // the state machine below resolves them as readable actions instead.
    for (const node of env.energyNodes) node.radius = -1000;
    if (this.species === SpeciesType.Predator) this.radius = -1000;
    if (this.species === SpeciesType.Architect) env.maxNodes = -1000;

    let reward = 0;
    try {
      reward = originalStep.apply(this, args);
    } finally {
      this.radius = previousRadius;
      env.maxNodes = previousMaxNodes;
      for (let index = 0; index < env.energyNodes.length && index < nodeRadii.length; index++) {
        env.energyNodes[index].radius = nodeRadii[index];
      }
    }

    const abilityTriggered = previousAbilityCooldown <= 0 && this.abilityCooldown > 0;
    if (abilityTriggered && state.phase === 'idle') {
      if (this.species === SpeciesType.Architect) {
        state.targetX = this.x;
        state.targetY = this.y;
        setPhase(state, 'building', BUILD_WINDUP);
      } else if (this.species === SpeciesType.Glider) {
        // Native Glider boost is immediate. Remove it and replay it after a visible wind-up.
        this.vx /= 1.8;
        this.vy /= 1.8;
        setPhase(state, 'boosting', BOOST_WINDUP);
      }
    }

    maybeStartContactInteraction(this, env, allAgents, state);

    if (state.phase === 'harvesting' || state.phase === 'striking' || state.phase === 'building') {
      this.vx *= 0.68;
      this.vy *= 0.68;
    }

    return reward;
  } as Agent['step'];
}

export function getAgentInteractionCue(agent: Agent): InteractionCue {
  const state = stateFor(agent);
  const progress = state.phase === 'idle'
    ? 0
    : clamp01(1 - state.phaseTicks / Math.max(1, state.phaseTotal));

  const labels: Record<InteractionPhase, string> = {
    idle: '',
    harvesting: 'HARVEST',
    striking: 'STRIKE',
    building: 'BUILD',
    boosting: 'BOOST',
    recovering: 'RECOVER',
  };

  return {
    phase: state.phase,
    label: labels[state.phase],
    progress,
    bursting: state.burstTicks > 0,
  };
}

export const INTERACTION_PACING = {
  harvestWindupTicks: HARVEST_WINDUP,
  harvestCooldownTicks: HARVEST_COOLDOWN,
  strikeWindupTicks: STRIKE_WINDUP,
  strikeCooldownTicks: STRIKE_COOLDOWN,
  buildWindupTicks: BUILD_WINDUP,
  boostWindupTicks: BOOST_WINDUP,
};
