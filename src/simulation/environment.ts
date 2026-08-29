/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AcousticWave, EnergyNode, Particle, SpeciesType, GANMetrics } from '../types';
import { EnvironmentGAN } from './gan';

export class SimulationEnvironment {
  public width: number;
  public height: number;
  public gridResolution: number = 40; // 40x40 simulation grid
  public cols: number;
  public rows: number;

  // Layer 1: Harmonic Resonance Field (-1.0 to 1.0)
  public harmonicGrid: Float32Array;
  public nextHarmonicGrid: Float32Array;

  // Layer 2: Terrain Elevation / Density Grid (0.0 to 1.0)
  public terrainGrid: Float32Array;

  // Dynamic Entities
  public energyNodes: EnergyNode[] = [];
  public acousticWaves: AcousticWave[] = [];
  public particles: Particle[] = [];

  // Procedural Environment GAN
  public gan: EnvironmentGAN;
  public ganActive: boolean = true;

  // Environmental Physics Constants
  public waveSpeed: number = 3.2;
  public diffusionRate: number = 0.12;
  public decayRate: number = 0.985;
  public maxNodes: number = 18;

  constructor(width: number = 1000, height: number = 700) {
    this.width = width;
    this.height = height;
    this.cols = Math.floor(width / this.gridResolution);
    this.rows = Math.floor(height / this.gridResolution);

    const totalCells = this.cols * this.rows;
    this.harmonicGrid = new Float32Array(totalCells);
    this.nextHarmonicGrid = new Float32Array(totalCells);
    this.terrainGrid = new Float32Array(totalCells);

    this.gan = new EnvironmentGAN(12);
    this.generateGANEnvironment();
  }

  public resize(newWidth: number, newHeight: number) {
    this.width = Math.max(400, newWidth);
    this.height = Math.max(300, newHeight);
    const newCols = Math.floor(this.width / this.gridResolution);
    const newRows = Math.floor(this.height / this.gridResolution);

    if (newCols !== this.cols || newRows !== this.rows) {
      this.cols = newCols;
      this.rows = newRows;
      const totalCells = this.cols * this.rows;
      this.harmonicGrid = new Float32Array(totalCells);
      this.nextHarmonicGrid = new Float32Array(totalCells);
      this.terrainGrid = new Float32Array(totalCells);
      this.generateGANEnvironment();
    }
  }

  /**
   * Procedural terrain generator powered by GAN (Generator Network)
   */
  public generateGANEnvironment(latent?: number[], difficulty?: number) {
    const envData = this.gan.generateEnvironment(
      this.cols,
      this.rows,
      this.width,
      this.height,
      latent,
      difficulty
    );

    this.terrainGrid.set(envData.terrainMap);
    this.harmonicGrid.set(envData.harmonicSeedMap);

    // Populate energy nodes from GAN procedural distributions
    this.energyNodes = [];
    for (const nodeData of envData.nodePlacements) {
      this.energyNodes.push({
        id: 'node_' + Math.random().toString(36).substring(2, 9),
        x: nodeData.x,
        y: nodeData.y,
        radius: 10 + Math.random() * 6,
        energy: nodeData.energy,
        maxEnergy: 140,
        harmonicFrequency: nodeData.frequency,
        hue: Math.floor(nodeData.frequency * 280),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Train the Generative Adversarial Network in self-play loop
   */
  public stepGANTraining(agentRegretSignal: number = 0.5, lr: number = 0.006): GANMetrics {
    const features = this.gan.extractEnvironmentFeatures(
      this.terrainGrid,
      this.cols,
      this.rows,
      this.energyNodes.length
    );
    this.gan.trainStep(features, agentRegretSignal, lr);
    return this.gan.getMetrics();
  }

  /**
   * Fallback / classical procedural terrain generator
   */
  public generateProceduralTerrain(roughness: number = 0.5) {
    this.generateGANEnvironment(undefined, roughness);
  }

  public seedEnergyNodes(count: number = 12) {
    this.energyNodes = [];
    for (let i = 0; i < count; i++) {
      this.spawnEnergyNode();
    }
  }

  public spawnEnergyNode(x?: number, y?: number): EnergyNode {
    const posX = x ?? (50 + Math.random() * (this.width - 100));
    const posY = y ?? (50 + Math.random() * (this.height - 100));
    const node: EnergyNode = {
      id: 'node_' + Math.random().toString(36).substring(2, 9),
      x: posX,
      y: posY,
      radius: 10 + Math.random() * 8,
      energy: 80 + Math.random() * 40,
      maxEnergy: 120,
      harmonicFrequency: 0.2 + Math.random() * 0.8,
      hue: Math.floor(Math.random() * 360),
      pulsePhase: Math.random() * Math.PI * 2,
    };
    this.energyNodes.push(node);
    return node;
  }

  /**
   * Add an expanding acoustic pressure wave
   */
  public addAcousticWave(
    x: number,
    y: number,
    species: SpeciesType,
    color: string,
    intensity: number = 1.0,
    frequency: number = 0.5
  ) {
    this.acousticWaves.push({
      x,
      y,
      radius: 4,
      maxRadius: 180 + intensity * 140,
      intensity,
      frequency,
      color,
      speed: this.waveSpeed + intensity * 1.5,
      sourceSpecies: species,
    });

    // Spawn visual spark particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 1.0 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1.0,
        maxLife: 25 + Math.floor(Math.random() * 15),
        color,
        size: 2.5 + Math.random() * 2,
        glow: true,
      });
    }

    // Deposit harmonic field energy into the local grid
    this.depositHarmonicEnergy(x, y, intensity * (species === SpeciesType.Predator ? -0.8 : 0.8), 60);
  }

  /**
   * Deposit energy into continuous grid
   */
  public depositHarmonicEnergy(worldX: number, worldY: number, amount: number, radiusWorld: number = 40) {
    const centerC = Math.floor(worldX / this.gridResolution);
    const centerR = Math.floor(worldY / this.gridResolution);
    const gridRadius = Math.ceil(radiusWorld / this.gridResolution);

    for (let dr = -gridRadius; dr <= gridRadius; dr++) {
      for (let dc = -gridRadius; dc <= gridRadius; dc++) {
        const c = centerC + dc;
        const r = centerR + dr;
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
          const distSq = dc * dc + dr * dr;
          if (distSq <= gridRadius * gridRadius) {
            const falloff = 1 - Math.sqrt(distSq) / (gridRadius + 0.1);
            const idx = r * this.cols + c;
            this.harmonicGrid[idx] = Math.max(-1, Math.min(1, this.harmonicGrid[idx] + amount * falloff));
          }
        }
      }
    }
  }

  /**
   * Terraforming: raise or carve terrain
   */
  public deformTerrain(worldX: number, worldY: number, delta: number, radiusWorld: number = 35) {
    const centerC = Math.floor(worldX / this.gridResolution);
    const centerR = Math.floor(worldY / this.gridResolution);
    const gridRadius = Math.ceil(radiusWorld / this.gridResolution);

    for (let dr = -gridRadius; dr <= gridRadius; dr++) {
      for (let dc = -gridRadius; dc <= gridRadius; dc++) {
        const c = centerC + dc;
        const r = centerR + dr;
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
          const distSq = dc * dc + dr * dr;
          if (distSq <= gridRadius * gridRadius) {
            const falloff = 1 - Math.sqrt(distSq) / (gridRadius + 0.1);
            const idx = r * this.cols + c;
            this.terrainGrid[idx] = Math.max(0.0, Math.min(1.0, this.terrainGrid[idx] + delta * falloff));
          }
        }
      }
    }
  }

  /**
   * Step physical and wavefield simulation
   */
  public update(deltaTime: number = 1.0) {
    // 1. Update Continuous Harmonic Reaction-Diffusion Grid
    const { cols, rows, harmonicGrid, nextHarmonicGrid, terrainGrid, diffusionRate, decayRate } = this;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const currentVal = harmonicGrid[idx];

        // 4-neighbor Laplace operator
        const left = c > 0 ? harmonicGrid[idx - 1] : currentVal;
        const right = c < cols - 1 ? harmonicGrid[idx + 1] : currentVal;
        const top = r > 0 ? harmonicGrid[idx - cols] : currentVal;
        const bottom = r < rows - 1 ? harmonicGrid[idx + cols] : currentVal;

        const laplacian = (left + right + top + bottom) - 4 * currentVal;
        const terrainMod = (terrainGrid[idx] - 0.5) * 0.05;

        let nextVal = (currentVal + laplacian * diffusionRate + terrainMod) * decayRate;
        nextHarmonicGrid[idx] = Math.max(-1.0, Math.min(1.0, nextVal));
      }
    }

    // Swap buffers
    this.harmonicGrid.set(nextHarmonicGrid);

    // 2. Step Acoustic Waves
    for (let i = this.acousticWaves.length - 1; i >= 0; i--) {
      const wave = this.acousticWaves[i];
      wave.radius += wave.speed * deltaTime;
      wave.intensity *= 0.97;

      if (wave.radius >= wave.maxRadius || wave.intensity < 0.05) {
        this.acousticWaves.splice(i, 1);
      }
    }

    // 3. Step Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 1 / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 4. Update Energy Nodes & Respawn if depleted
    for (let i = this.energyNodes.length - 1; i >= 0; i--) {
      const node = this.energyNodes[i];
      node.pulsePhase += 0.05;

      // Natural slow regeneration
      if (node.energy < node.maxEnergy) {
        node.energy += 0.08 * deltaTime;
      }

      if (node.energy <= 2) {
        this.particles.push({
          x: node.x,
          y: node.y,
          vx: 0,
          vy: 0,
          life: 1,
          maxLife: 20,
          color: `hsl(${node.hue}, 90%, 65%)`,
          size: node.radius * 1.5,
          glow: true,
        });
        this.energyNodes.splice(i, 1);
      }
    }

    // Spawn new nodes if count drops below threshold
    if (this.energyNodes.length < this.maxNodes && Math.random() < 0.03) {
      this.spawnEnergyNode();
    }
  }

  /**
   * Sample local harmonic value at continuous world coordinates (x, y)
   */
  public sampleHarmonicField(worldX: number, worldY: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor(worldX / this.gridResolution)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor(worldY / this.gridResolution)));
    return this.harmonicGrid[r * this.cols + c] || 0;
  }

  /**
   * Sample terrain height at continuous world coordinates (x, y)
   */
  public sampleTerrain(worldX: number, worldY: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor(worldX / this.gridResolution)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor(worldY / this.gridResolution)));
    return this.terrainGrid[r * this.cols + c] || 0.5;
  }

  /**
   * Sample acoustic sound pressure at coordinates
   */
  public sampleAcousticPressure(worldX: number, worldY: number): number {
    let pressure = 0;
    for (const wave of this.acousticWaves) {
      const dx = worldX - wave.x;
      const dy = worldY - wave.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ringDist = Math.abs(dist - wave.radius);
      if (ringDist < 20) {
        pressure += wave.intensity * (1 - ringDist / 20);
      }
    }
    return Math.min(1.0, pressure);
  }

  /**
   * Raycast distance from an origin point in a given angle towards boundaries or high terrain walls
   */
  public raycast(originX: number, originY: number, angle: number, maxDist: number = 220): number {
    const step = 10;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let d = step; d <= maxDist; d += step) {
      const px = originX + cos * d;
      const py = originY + sin * d;

      // Boundary collision
      if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
        return d / maxDist;
      }

      // High terrain obstacle collision
      if (this.sampleTerrain(px, py) > 0.88) {
        return d / maxDist;
      }
    }

    return 1.0; // Clear path
  }
}
