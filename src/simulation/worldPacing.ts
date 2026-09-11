import { Agent, SPECIES_CONFIGS } from './agent';
import { SimulationEngine } from './engine';
import { getAgentInteractionCue } from './interactionPacing';

const TARGET_TICK_HZ = 24;
const TICK_MS = 1000 / TARGET_TICK_HZ;
const MAX_CATCHUP_TICKS = 4;
const BASE_SPEED_SCALE = 0.68;

interface PaceState {
  lastFrameMs: number;
  accumulatorMs: number;
}

const paceState = new WeakMap<SimulationEngine, PaceState>();
let installed = false;

function effectiveSpeed(requested: number) {
  if (!Number.isFinite(requested)) return 1;
  return Math.max(0.25, Math.min(2.5, requested));
}

export function installWorldPacing() {
  if (installed) return;
  installed = true;

  for (const config of Object.values(SPECIES_CONFIGS)) {
    config.baseSpeed *= BASE_SPEED_SCALE;
  }

  const originalEngineStep = SimulationEngine.prototype.step;
  SimulationEngine.prototype.step = function pacedStep(this: SimulationEngine) {
    const now = performance.now();
    let state = paceState.get(this);
    if (!state) {
      state = { lastFrameMs: now, accumulatorMs: 0 };
      paceState.set(this, state);
      return;
    }

    if (!this.isRunning) {
      state.lastFrameMs = now;
      state.accumulatorMs = 0;
      return;
    }

    const elapsed = Math.max(0, Math.min(100, now - state.lastFrameMs));
    state.lastFrameMs = now;
    state.accumulatorMs += elapsed * effectiveSpeed(this.simulationSpeed);

    let ticks = 0;
    while (state.accumulatorMs >= TICK_MS && ticks < MAX_CATCHUP_TICKS) {
      const requestedSpeed = this.simulationSpeed;
      this.simulationSpeed = 1;
      originalEngineStep.call(this);
      this.simulationSpeed = requestedSpeed;
      state.accumulatorMs -= TICK_MS;
      ticks++;
    }

    if (ticks === MAX_CATCHUP_TICKS && state.accumulatorMs > TICK_MS * 2) {
      state.accumulatorMs = TICK_MS * 2;
    }
  };

  const originalAgentStep = Agent.prototype.step;
  Agent.prototype.step = function pacedAgentStep(this: Agent, ...args: Parameters<Agent['step']>) {
    const previousPulseCooldown = this.pulseCooldown;
    const previousAbilityCooldown = this.abilityCooldown;
    const reward = originalAgentStep.apply(this, args);

    if (previousPulseCooldown <= 0 && this.pulseCooldown > 0) {
      this.pulseCooldown = Math.max(this.pulseCooldown, 28);
    }
    if (previousAbilityCooldown <= 0 && this.abilityCooldown > 0) {
      this.abilityCooldown = Math.max(this.abilityCooldown, 96);
    }

    const speed = Math.hypot(this.vx, this.vy);
    const interaction = getAgentInteractionCue(this);
    const maxSpeedMultiplier = interaction.bursting ? 2.05 : 1.35;
    const maxSpeed = Math.max(0.5, this.config.baseSpeed * maxSpeedMultiplier);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    return reward;
  } as Agent['step'];
}

export const WORLD_PACING = {
  targetTickHz: TARGET_TICK_HZ,
  baseSpeedScale: BASE_SPEED_SCALE,
};
