import { CommunicationEngine, SeededRandom, TrainMetrics } from './communication';
import { CleanroomEnvironmentGAN, GanMetrics, GeneratedWorld } from './gan';

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export interface WorldAgent {
  id: 'sender' | 'receiver';
  x: number;
  y: number;
  angle: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
  rays: number[];
}

export interface WorldNode {
  id: string;
  x: number;
  y: number;
  active: boolean;
  energy: number;
  hue: number;
}

export interface WorldWave {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  frequencyHz: number;
}

export interface WorldMetrics {
  episode: number;
  worldSteps: number;
  recentWorldSuccess: number;
  activeTarget: -1 | 1;
  receiverChoice: -1 | 1;
  signalHz: number;
  signalAmplitude: number;
  signalDurationMs: number;
  channelEnabled: boolean;
  communication: TrainMetrics;
  gan: GanMetrics;
}

export class CleanroomWorld {
  readonly communication: CommunicationEngine;
  readonly rng: SeededRandom;
  readonly gan: CleanroomEnvironmentGAN;
  world: GeneratedWorld;
  agents: WorldAgent[] = [];
  nodes: WorldNode[] = [];
  waves: WorldWave[] = [];
  channelEnabled = true;
  speed = 1;

  private episode = 0;
  private worldSteps = 0;
  private episodeStep = 0;
  private activeTarget: -1 | 1 = -1;
  private receiverChoice: -1 | 1 = -1;
  private signalHz = 440;
  private signalAmplitude = 0;
  private signalDurationMs = 0;
  private outcomes: number[] = [];
  private lastCommMetrics: TrainMetrics;

  constructor(public readonly seed = 302) {
    this.rng = new SeededRandom((seed ^ 0xa341316c) >>> 0);
    this.communication = new CommunicationEngine(seed);
    this.gan = new CleanroomEnvironmentGAN(this.rng);
    this.world = this.gan.generate();
    this.lastCommMetrics = this.communication.metrics();
    this.resetGeometry();
    this.startEpisode();
  }

  private resetGeometry() {
    const spread = this.world.params[3];
    const upperY = 0.18 + spread * 0.16;
    const lowerY = 0.82 - spread * 0.16;
    this.nodes = [
      { id: 'target-a', x: 0.84, y: upperY, active: false, energy: 1, hue: 132 },
      { id: 'target-b', x: 0.84, y: lowerY, active: false, energy: 1, hue: 14 },
    ];
    for (let i = 0; i < 7; i++) {
      this.nodes.push({
        id: `crystal-${i}`,
        x: 0.12 + this.rng.next() * 0.72,
        y: 0.12 + this.rng.next() * 0.76,
        active: false,
        energy: 0.35 + this.rng.next() * 0.65,
        hue: Math.floor(this.rng.next() * 280),
      });
    }

    this.agents = [
      { id: 'sender', x: 0.20, y: 0.50, angle: 0, color: '#00ff41', trail: [], rays: [] },
      { id: 'receiver', x: 0.60, y: 0.50, angle: 0, color: '#ff3e00', trail: [], rays: [] },
    ];
    this.clearSafeZone(0.20, 0.50, 2);
    this.clearSafeZone(0.60, 0.50, 2);
    for (const node of this.nodes.slice(0, 2)) this.clearSafeZone(node.x, node.y, 2);
  }

  private clearSafeZone(nx: number, ny: number, radius: number) {
    const cx = Math.round(nx * (this.world.cols - 1));
    const cy = Math.round(ny * (this.world.rows - 1));
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < this.world.cols && y < this.world.rows) {
          this.world.terrain[y * this.world.cols + x] = Math.min(this.world.terrain[y * this.world.cols + x], 0.48);
        }
      }
    }
  }

  private blocked(x: number, y: number) {
    if (x < 0.02 || y < 0.02 || x > 0.98 || y > 0.98) return true;
    const c = Math.max(0, Math.min(this.world.cols - 1, Math.floor(x * this.world.cols)));
    const r = Math.max(0, Math.min(this.world.rows - 1, Math.floor(y * this.world.rows)));
    return this.world.terrain[r * this.world.cols + c] > 0.73;
  }

  private raycast(x: number, y: number, angle: number, max = 0.18) {
    for (let d = 0.015; d <= max; d += 0.015) {
      if (this.blocked(x + Math.cos(angle) * d, y + Math.sin(angle) * d)) return d / max;
    }
    return 1;
  }

  private startEpisode() {
    this.episode++;
    this.episodeStep = 0;

    const sender = this.agents[0];
    const receiver = this.agents[1];
    receiver.x = 0.60;
    receiver.y = 0.50;
    receiver.trail = [];

    const exchange = this.communication.demo(this.channelEnabled);
    this.activeTarget = exchange.hiddenState;
    this.nodes[0].active = this.activeTarget === -1;
    this.nodes[1].active = this.activeTarget === 1;
    this.receiverChoice = exchange.choice;
    this.signalHz = exchange.signalHz;
    this.signalAmplitude = exchange.amplitude;
    this.signalDurationMs = exchange.durationMs;
    this.waves.push({
      x: sender.x,
      y: sender.y,
      radius: 0.015,
      intensity: exchange.amplitude,
      frequencyHz: exchange.signalHz,
    });
  }

  private finishEpisode(success: boolean) {
    this.outcomes.push(success ? 1 : 0);
    if (this.outcomes.length > 60) this.outcomes.shift();
    this.lastCommMetrics = this.communication.trainBatch(384);

    if (this.episode % 6 === 0) {
      this.gan.learn(this.world, this.recentSuccess());
      this.world = this.gan.generate();
      this.resetGeometry();
    }
    this.startEpisode();
  }

  recentSuccess() {
    if (!this.outcomes.length) return 0.5;
    return this.outcomes.reduce((a, b) => a + b, 0) / this.outcomes.length;
  }

  private moveReceiver(dt: number) {
    const receiver = this.agents[1];
    const target = this.receiverChoice === -1 ? this.nodes[0] : this.nodes[1];
    const dx = target.x - receiver.x;
    const dy = target.y - receiver.y;
    const desired = Math.atan2(dy, dx);
    receiver.rays = [-0.8, -0.4, 0, 0.4, 0.8].map(offset => this.raycast(receiver.x, receiver.y, desired + offset));

    const candidates = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35];
    const step = 0.0045 * dt;
    let chosen = desired;
    let bestScore = Infinity;
    for (const offset of candidates) {
      const angle = desired + offset;
      const nx = receiver.x + Math.cos(angle) * step;
      const ny = receiver.y + Math.sin(angle) * step;
      if (this.blocked(nx, ny)) continue;
      const score = distance(nx, ny, target.x, target.y) + Math.abs(offset) * 0.015;
      if (score < bestScore) {
        bestScore = score;
        chosen = angle;
      }
    }

    receiver.angle = chosen;
    const nx = receiver.x + Math.cos(chosen) * step;
    const ny = receiver.y + Math.sin(chosen) * step;
    if (!this.blocked(nx, ny)) {
      receiver.x = clamp(nx, 0.02, 0.98);
      receiver.y = clamp(ny, 0.02, 0.98);
    }
    receiver.trail.push({ x: receiver.x, y: receiver.y });
    if (receiver.trail.length > 45) receiver.trail.shift();

    const aDist = distance(receiver.x, receiver.y, this.nodes[0].x, this.nodes[0].y);
    const bDist = distance(receiver.x, receiver.y, this.nodes[1].x, this.nodes[1].y);
    if (aDist < 0.035 || bDist < 0.035) {
      const reached: -1 | 1 = aDist < bDist ? -1 : 1;
      this.finishEpisode(reached === this.activeTarget);
    } else if (this.episodeStep > 360) {
      this.finishEpisode(false);
    }
  }

  step(multiplier = this.speed) {
    const loops = Math.max(1, Math.floor(multiplier));
    for (let i = 0; i < loops; i++) {
      this.worldSteps++;
      this.episodeStep++;
      this.moveReceiver(1);
      for (const wave of this.waves) {
        wave.radius += 0.006;
        wave.intensity *= 0.986;
      }
      this.waves = this.waves.filter(w => w.radius < 0.65 && w.intensity > 0.025);
      if (this.worldSteps % 120 === 0) this.lastCommMetrics = this.communication.trainBatch(128);
    }
  }

  fastTrain(updates = 24) {
    for (let i = 0; i < updates; i++) this.lastCommMetrics = this.communication.trainBatch(512);
    for (let i = 0; i < 3; i++) {
      this.gan.learn(this.world, this.lastCommMetrics.successOn);
      this.world = this.gan.generate();
    }
    this.resetGeometry();
    this.startEpisode();
  }

  setChannel(enabled: boolean) {
    this.channelEnabled = enabled;
    this.startEpisode();
  }

  metrics(): WorldMetrics {
    return {
      episode: this.episode,
      worldSteps: this.worldSteps,
      recentWorldSuccess: this.recentSuccess(),
      activeTarget: this.activeTarget,
      receiverChoice: this.receiverChoice,
      signalHz: this.signalHz,
      signalAmplitude: this.signalAmplitude,
      signalDurationMs: this.signalDurationMs,
      channelEnabled: this.channelEnabled,
      communication: this.lastCommMetrics,
      gan: this.gan.metrics(),
    };
  }
}
