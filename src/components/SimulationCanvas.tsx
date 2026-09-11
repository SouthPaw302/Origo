/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { SimulationEngine } from '../simulation/engine';
import { SpeciesType } from '../types';
import { SPECIES_CONFIGS } from '../simulation/agent';
import { getAgentInteractionCue, InteractionPhase } from '../simulation/interactionPacing';
import { Crosshair, Waves, Sparkles, Mountain, Volume2 } from 'lucide-react';

interface SimulationCanvasProps {
  engine: SimulationEngine;
  onSelectAgent: (id: string | null) => void;
  selectedAgentId: string | null;
}

export type CanvasTool = 'inspect' | 'terraform_up' | 'terraform_down' | 'pulse' | 'crystal';

const INTERACTION_COLORS: Record<InteractionPhase, string> = {
  idle: '#666666',
  harvesting: '#22d3ee',
  striking: '#fb7185',
  building: '#fbbf24',
  boosting: '#c084fc',
  recovering: '#737373',
};

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  engine,
  onSelectAgent,
  selectedAgentId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>('inspect');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Resize canvas to container
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      canvasRef.current.width = w * dpr;
      canvasRef.current.height = h * dpr;
      canvasRef.current.style.width = `${w}px`;
      canvasRef.current.style.height = `${h}px`;

      engine.env.resize(w, h);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    handleResize();

    return () => observer.disconnect();
  }, [engine]);

  // Main Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      // Step the simulation engine
      engine.step();

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Clear background (Jet black obsidian)
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      // 2. Render Procedural Terrain & Harmonic Grid
      const env = engine.env;
      const { cols, rows, gridResolution, terrainGrid, harmonicGrid } = env;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const terrain = terrainGrid[idx] || 0.5;
          const harmonic = harmonicGrid[idx] || 0;

          const px = c * gridResolution;
          const py = r * gridResolution;

          let rVal = 5 + terrain * 12;
          let gVal = 5 + terrain * 16;
          let bVal = 8 + terrain * 20;

          if (harmonic > 0.05) {
            gVal += harmonic * 140;
            bVal += harmonic * 40;
          } else if (harmonic < -0.05) {
            rVal += Math.abs(harmonic) * 160;
            gVal += Math.abs(harmonic) * 30;
          }

          ctx.fillStyle = `rgb(${Math.min(255, Math.floor(rVal))}, ${Math.min(255, Math.floor(gVal))}, ${Math.min(255, Math.floor(bVal))})`;
          ctx.fillRect(px, py, gridResolution, gridResolution);

          if (c % 3 === 0 && r % 3 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fillRect(px + gridResolution / 2, py + gridResolution / 2, 1, 1);
          }
        }
      }

      // 3. Render Acoustic Wave Pressure Rings
      ctx.lineWidth = 2.0;
      for (const wave of env.acousticWaves) {
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = wave.color;
        ctx.globalAlpha = Math.min(1.0, wave.intensity * 0.75);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(wave.x, wave.y, Math.max(0, wave.radius - 6), 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = Math.min(0.4, wave.intensity * 0.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 4. Render Particles
      for (const p of env.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 5. Render Energy Nodes (Harmonic Sound Pillars)
      for (const node of env.energyNodes) {
        const pulse = Math.sin(node.pulsePhase) * 2;
        const currentR = node.radius + pulse;

        const gradient = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, currentR * 2.2);
        gradient.addColorStop(0, `hsla(${node.hue}, 95%, 70%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${node.hue}, 85%, 55%, 0.3)`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentR * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsl(${node.hue}, 100%, 75%)`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 6. Render RL Self-Play Agents
      for (const agent of engine.agents) {
        const isSelected = agent.id === selectedAgentId;
        const cfg = agent.config;
        const interaction = getAgentInteractionCue(agent);

        if (agent.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(agent.trail[0].x, agent.trail[0].y);
          for (let i = 1; i < agent.trail.length; i++) {
            ctx.lineTo(agent.trail[i].x, agent.trail[i].y);
          }
          ctx.strokeStyle = cfg.color;
          ctx.globalAlpha = interaction.bursting ? 0.65 : 0.35;
          ctx.lineWidth = interaction.bursting ? 4 : 2.5;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        if (isSelected) {
          ctx.lineWidth = 1.0;
          const rayAngles = [-1.57, -0.78, -0.26, 0.26, 0.78, 1.57];
          rayAngles.forEach((dTheta, idx) => {
            const angle = agent.angle + dTheta;
            const distNorm = agent.lastSensoryInput[idx] ?? 1.0;
            const dist = distNorm * 180;

            const rx = agent.x + Math.cos(angle) * dist;
            const ry = agent.y + Math.sin(angle) * dist;

            ctx.beginPath();
            ctx.moveTo(agent.x, agent.y);
            ctx.lineTo(rx, ry);
            ctx.strokeStyle = distNorm < 0.4 ? '#f43f5e' : 'rgba(34, 211, 238, 0.45)';
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          });

          ctx.beginPath();
          ctx.arc(agent.x, agent.y, agent.radius * 2.8, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          for (let a = 0; a < 4; a++) {
            const rot = (a * Math.PI) / 2 + performance.now() * 0.002;
            const tx1 = agent.x + Math.cos(rot) * (agent.radius * 3.2);
            const ty1 = agent.y + Math.sin(rot) * (agent.radius * 3.2);
            const tx2 = agent.x + Math.cos(rot) * (agent.radius * 3.8);
            const ty2 = agent.y + Math.sin(rot) * (agent.radius * 3.8);
            ctx.beginPath();
            ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();
          }
        }

        // Interaction wind-up/recovery ring. This turns contact spam into readable actions.
        if (interaction.phase !== 'idle') {
          const cueColor = INTERACTION_COLORS[interaction.phase];
          ctx.save();
          ctx.beginPath();
          ctx.arc(
            agent.x,
            agent.y,
            agent.radius * 2.05,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * Math.max(0.06, interaction.progress)
          );
          ctx.strokeStyle = cueColor;
          ctx.globalAlpha = interaction.phase === 'recovering' ? 0.45 : 0.92;
          ctx.lineWidth = interaction.bursting ? 3.2 : 2.1;
          ctx.stroke();
          ctx.globalAlpha = 1;

          if (isSelected && interaction.label) {
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = cueColor;
            ctx.fillText(interaction.label, agent.x, agent.y - agent.radius * 2.7);
          }
          ctx.restore();
        }

        if (interaction.bursting) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(agent.x, agent.y, agent.radius * 2.6, 0, Math.PI * 2);
          ctx.strokeStyle = cfg.secondaryColor;
          ctx.globalAlpha = 0.38;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(agent.x, agent.y);
        ctx.rotate(agent.angle);

        ctx.shadowColor = cfg.color;
        ctx.shadowBlur = interaction.bursting ? 22 : isSelected ? 18 : 8;

        const energyRatio = agent.energy / agent.maxEnergy;
        ctx.beginPath();
        ctx.arc(0, 0, agent.radius + 3, -Math.PI * 0.6, -Math.PI * 0.6 + Math.PI * 1.2 * energyRatio);
        ctx.strokeStyle = energyRatio > 0.3 ? cfg.secondaryColor : '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(agent.radius * 1.4, 0);
        ctx.lineTo(-agent.radius * 0.9, -agent.radius * 0.85);
        ctx.lineTo(-agent.radius * 0.4, 0);
        ctx.lineTo(-agent.radius * 0.9, agent.radius * 0.85);
        ctx.closePath();

        ctx.fillStyle = cfg.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (interaction.bursting || agent.lastActionOutputs[0] > 0.2) {
          const flameScale = interaction.bursting ? 2.1 : 1.2 + Math.random() * 0.6;
          ctx.beginPath();
          ctx.moveTo(-agent.radius * 0.4, -agent.radius * 0.3);
          ctx.lineTo(-agent.radius * flameScale, 0);
          ctx.lineTo(-agent.radius * 0.4, agent.radius * 0.3);
          ctx.fillStyle = interaction.bursting ? '#c084fc' : '#f59e0b';
          ctx.fill();
        }

        ctx.restore();
      }

      // 7. Interactive Tool Cursor Indicator
      if (mousePos) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, activeTool === 'pulse' ? 50 : 25, 0, Math.PI * 2);
        ctx.strokeStyle =
          activeTool === 'terraform_up'
            ? '#22c55e'
            : activeTool === 'terraform_down'
            ? '#ef4444'
            : activeTool === 'crystal'
            ? '#eab308'
            : activeTool === 'pulse'
            ? '#06b6d4'
            : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [engine, selectedAgentId, activeTool, mousePos]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsMouseDown(true);
    applyToolAction(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    if (isMouseDown) {
      applyToolAction(x, y);
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
    setMousePos(null);
  };

  const applyToolAction = (x: number, y: number) => {
    if (activeTool === 'inspect') {
      let nearestAgent: string | null = null;
      let minDist = 35;

      for (const agent of engine.agents) {
        const dx = agent.x - x;
        const dy = agent.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearestAgent = agent.id;
        }
      }

      onSelectAgent(nearestAgent);
      engine.selectedAgentId = nearestAgent;
    } else if (activeTool === 'terraform_up') {
      engine.env.deformTerrain(x, y, 0.15, 40);
      engine.env.depositHarmonicEnergy(x, y, 0.4, 40);
    } else if (activeTool === 'terraform_down') {
      engine.env.deformTerrain(x, y, -0.15, 40);
      engine.env.depositHarmonicEnergy(x, y, -0.4, 40);
    } else if (activeTool === 'pulse') {
      engine.env.addAcousticWave(x, y, SpeciesType.Resonator, '#06b6d4', 1.2, y / engine.env.height);
    } else if (activeTool === 'crystal') {
      engine.env.spawnEnergyNode(x, y);
    }
  };

  return (
    <div
      id="simulation-canvas-container"
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] bg-[#050505] overflow-hidden flex flex-col items-center justify-center cursor-crosshair select-none"
    >
      <div className="absolute bottom-6 left-6 pointer-events-none select-none z-0">
        <span className="font-display text-7xl md:text-9xl font-black italic tracking-tighter text-white opacity-[0.03] uppercase">
          SIMULATION
        </span>
      </div>

      <canvas
        id="main-simulation-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full block relative z-10"
      />

      <div
        id="canvas-live-badge"
        className="absolute top-4 left-4 z-20 bg-black/90 px-3 py-1 border border-[#00ff41] text-[10px] text-[#00ff41] uppercase tracking-[0.2em] font-mono font-bold shadow-lg"
      >
        <span className="inline-block w-1.5 h-1.5 bg-[#00ff41] mr-1.5 animate-pulse"></span>
        Live Environment Render
      </div>

      <div
        id="canvas-tools-bar"
        className="absolute top-14 left-4 z-20 flex flex-wrap items-center gap-1 p-1 bg-[#0a0a0a]/95 border border-[#222] shadow-2xl backdrop-blur-sm"
      >
        <button
          id="tool-inspect-btn"
          onClick={() => setActiveTool('inspect')}
          title="Inspect / Select RL Agent"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-all ${
            activeTool === 'inspect'
              ? 'bg-[#00ff41] text-black'
              : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Inspect</span>
        </button>

        <div className="w-[1px] h-4 bg-[#222] mx-0.5" />

        <button
          id="tool-pulse-btn"
          onClick={() => setActiveTool('pulse')}
          title="Emit Acoustic Shockwave"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-all ${
            activeTool === 'pulse'
              ? 'bg-[#ff3e00] text-white'
              : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>Pulse</span>
        </button>

        <button
          id="tool-terraform-up-btn"
          onClick={() => setActiveTool('terraform_up')}
          title="Raise Harmonic Ridge"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-all ${
            activeTool === 'terraform_up'
              ? 'bg-white text-black'
              : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>Terraform +</span>
        </button>

        <button
          id="tool-terraform-down-btn"
          onClick={() => setActiveTool('terraform_down')}
          title="Carve Harmonic Abyss"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-all ${
            activeTool === 'terraform_down'
              ? 'bg-[#ff3e00] text-white'
              : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <Mountain className="w-3.5 h-3.5 rotate-180" />
          <span>Carve -</span>
        </button>

        <button
          id="tool-crystal-btn"
          onClick={() => setActiveTool('crystal')}
          title="Plant Sound Crystal Node"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider font-bold transition-all ${
            activeTool === 'crystal'
              ? 'bg-[#00ff41] text-black'
              : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plant Crystal</span>
        </button>
      </div>

      <div
        id="canvas-legend"
        className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 px-3 py-1.5 bg-[#0a0a0a]/90 border border-[#222] text-[10px] font-mono uppercase tracking-wider"
      >
        {Object.values(SPECIES_CONFIGS).map((cfg) => (
          <div key={cfg.type} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 inline-block"
              style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
            />
            <span className="text-[#888]">{cfg.name}</span>
          </div>
        ))}
      </div>

      <div
        id="canvas-audio-status"
        className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1 bg-black/80 border border-[#222] text-[10px] font-mono uppercase tracking-widest text-[#00ff41]"
      >
        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
        <span>Acoustic Grid Active</span>
      </div>
    </div>
  );
};