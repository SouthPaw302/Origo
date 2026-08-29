/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { SimulationMetrics, SpeciesType, GANMetrics, LatentSamplePreview } from '../types';
import { SPECIES_CONFIGS } from '../simulation/agent';
import { Trophy, TrendingUp, Layers, Sparkles, RefreshCw, Compass, CheckCircle2, Zap, Radio } from 'lucide-react';

interface SelfPlayMetricsProps {
  metrics: SimulationMetrics;
  ganMetrics?: GANMetrics;
  onSelectLatent?: (latent: number[]) => void;
  onResampleLatent?: () => void;
}

/**
 * Individual Latent Space Candidate Thumbnail Card
 */
const LatentThumbnailCard: React.FC<{
  sample: LatentSamplePreview;
  onSelect?: () => void;
}> = ({ sample, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !sample.terrainThumbnail) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = sample.cols || 20;
    const rows = sample.rows || 20;
    const imgData = ctx.createImageData(cols, rows);

    for (let i = 0; i < sample.terrainThumbnail.length; i++) {
      const val = sample.terrainThumbnail[i]; // 0..1
      let r = 0;
      let g = 0;
      let b = 0;

      if (val < 0.35) {
        const t = val / 0.35;
        r = Math.floor(6 + t * 4);
        g = Math.floor(10 + t * 190);
        b = Math.floor(25 + t * 50);
      } else if (val < 0.68) {
        const t = (val - 0.35) / 0.33;
        r = Math.floor(10 + t * 235);
        g = Math.floor(200 - t * 45);
        b = Math.floor(75 - t * 65);
      } else {
        const t = (val - 0.68) / 0.32;
        r = Math.floor(245 + t * 10);
        g = Math.floor(155 - t * 100);
        b = Math.floor(10 + t * 245);
      }

      imgData.data[i * 4 + 0] = r;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = b;
      imgData.data[i * 4 + 3] = 255;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cols;
    tempCanvas.height = rows;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }
  }, [sample.terrainThumbnail, sample.cols, sample.rows]);

  return (
    <div
      id={`latent-card-${sample.id}`}
      onClick={onSelect}
      className={`group relative flex flex-col p-2 bg-[#080808] border transition-all cursor-pointer select-none font-mono ${
        sample.isActive
          ? 'border-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.15)] bg-[#0a120b]'
          : 'border-[#222] hover:border-[#555] hover:bg-[#121212]'
      }`}
      title={sample.isActive ? 'Active Simulation Environment' : 'Click to apply this GAN latent vector to the environment'}
    >
      {/* Top Header with Active Badge / Archetype */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-white truncate max-w-[90px]">
          {sample.archetype}
        </span>
        {sample.isActive ? (
          <span className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-[#00ff41] bg-[#00ff41]/10 px-1 py-0.5 border border-[#00ff41]/30">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            ACTIVE
          </span>
        ) : (
          <span className="text-[8px] text-[#666] group-hover:text-[#00ff41] transition-colors">
            APPLY ↵
          </span>
        )}
      </div>

      {/* Center Heightmap Preview & Key Metrics */}
      <div className="flex gap-2 items-center mb-1.5">
        <div className="relative w-12 h-12 flex-shrink-0 bg-[#000] border border-[#333] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={48}
            height={48}
            className="w-full h-full block"
          />
          {sample.isActive && (
            <div className="absolute inset-0 border border-[#00ff41]/60 pointer-events-none" />
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between text-[8px] space-y-0.5">
          <div className="flex justify-between text-[#888]">
            <span>Disc Score:</span>
            <span className="text-[#00ff41] font-bold">{sample.discriminatorScore}</span>
          </div>
          <div className="flex justify-between text-[#888]">
            <span>Complexity:</span>
            <span className="text-[#f59e0b] font-bold">{sample.complexity}</span>
          </div>
          <div className="flex justify-between text-[#888]">
            <span>Pillars:</span>
            <span className="text-white">{sample.nodeCount}</span>
          </div>
        </div>
      </div>

      {/* Generator Priority Progress Bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[8px]">
          <span className="text-[#666]">GEN PRIORITY:</span>
          <span className={`font-bold ${sample.priorityScore > 0.6 ? 'text-[#00ff41]' : 'text-[#f59e0b]'}`}>
            {Math.round(sample.priorityScore * 100)}%
          </span>
        </div>
        <div className="w-full h-1 bg-[#1a1a1a]">
          <div
            className={`h-full transition-all duration-300 ${
              sample.priorityScore > 0.6
                ? 'bg-[#00ff41]'
                : sample.priorityScore > 0.3
                ? 'bg-[#f59e0b]'
                : 'bg-[#ff3e00]'
            }`}
            style={{ width: `${Math.max(8, sample.priorityScore * 100)}%` }}
          />
        </div>
      </div>

      {/* Subtitle tag */}
      <div className="mt-1 text-[7.5px] text-[#555] truncate">
        {sample.dominantFeature}
      </div>
    </div>
  );
};

export const SelfPlayMetrics: React.FC<SelfPlayMetricsProps> = ({
  metrics,
  ganMetrics,
  onSelectLatent,
  onResampleLatent,
}) => {
  const rewardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lossCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isResampling, setIsResampling] = useState(false);

  // Render Real-time Reward Dynamics Chart
  useEffect(() => {
    if (!rewardCanvasRef.current) return;
    const canvas = rewardCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const history = metrics.rewardHistory;
    if (history.length < 2) return;

    // Draw baseline zero grid line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    // Plot lines for each species
    const speciesList = [
      SpeciesType.Resonator,
      SpeciesType.Predator,
      SpeciesType.Architect,
      SpeciesType.Glider,
    ];

    speciesList.forEach((sp) => {
      ctx.beginPath();
      ctx.strokeStyle = SPECIES_CONFIGS[sp].color;
      ctx.lineWidth = 1.8;

      history.forEach((entry, idx) => {
        const x = (idx / (history.length - 1)) * width;
        const reward = entry.rewards[sp] ?? 0;
        const y = height * 0.5 - reward * 35;
        const clampedY = Math.max(4, Math.min(height - 4, y));

        if (idx === 0) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
      });

      ctx.stroke();
    });
  }, [metrics.rewardHistory]);

  // Render TD-Loss Convergence Curve
  useEffect(() => {
    if (!lossCanvasRef.current) return;
    const canvas = lossCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const history = metrics.lossHistory;
    if (history.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 1.6;

    history.forEach((entry, idx) => {
      const x = (idx / (history.length - 1)) * width;
      const loss = entry.loss;
      const y = height - Math.min(height - 4, loss * 120 + 6);

      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }, [metrics.lossHistory]);

  const handleResampleClick = () => {
    setIsResampling(true);
    if (onResampleLatent) {
      onResampleLatent();
    }
    setTimeout(() => setIsResampling(false), 400);
  };

  // Sorted Elo ratings for Leaderboard
  const eloEntries = (Object.entries(metrics.eloBySpecies) as [SpeciesType, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  const latentSamples = ganMetrics?.latentSamples || [];

  return (
    <div
      id="selfplay-metrics-container"
      className="flex flex-col h-full bg-[#0a0a0a] border border-[#222] p-3 overflow-y-auto space-y-3.5"
    >
      {/* Header with Elo Rankings */}
      <div id="metrics-header" className="flex items-center justify-between pb-2 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#ff3e00]" />
          <h3 className="text-xs font-bold text-white tracking-wide font-tech uppercase">Self-Play Elo Leaderboard</h3>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 bg-[#111] text-[#00ff41] border border-[#333]">
          ZERO-SUM RL
        </span>
      </div>

      {/* Species Elo Ratings Bar Chart */}
      <div id="elo-leaderboard" className="grid grid-cols-2 gap-1.5">
        {eloEntries.map(([spKey, elo]) => {
          const species = spKey as SpeciesType;
          const cfg = SPECIES_CONFIGS[species];
          const avgReward = metrics.avgRewardBySpecies[species] || 0;

          return (
            <div
              key={species}
              className="flex flex-col p-1.5 bg-[#050505] border border-[#222] space-y-0.5 font-mono"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2"
                    style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                  />
                  <span className="text-[10px] font-semibold text-white truncate max-w-[70px]">{cfg.name}</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#ff3e00]">{elo}</span>
              </div>

              <div className="flex items-center justify-between text-[8.5px] text-[#777]">
                <span>Reward</span>
                <span className={`font-bold ${avgReward >= 0 ? 'text-[#00ff41]' : 'text-[#ff3e00]'}`}>
                  {avgReward > 0 ? `+${avgReward}` : avgReward}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* GAN Latent Space Thumbnail Grid & Priority Telemetry */}
      {ganMetrics && (
        <div id="gan-latent-grid-section" className="bg-[#111] p-2.5 border border-[#333] space-y-2.5">
          {/* Panel Header with Resample Controls */}
          <div className="flex items-center justify-between pb-1 border-b border-[#222]">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#00ff41]" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#00ff41] font-bold">
                GAN Latent Space Manifold
              </span>
            </div>
            <button
              id="resample-latent-btn"
              onClick={handleResampleClick}
              className="flex items-center gap-1 text-[8.5px] font-mono px-2 py-0.5 bg-[#1a1a1a] text-white hover:text-[#00ff41] hover:bg-[#222] border border-[#333] transition-colors"
              title="Resample exploratory candidate vectors across the GAN latent manifold"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isResampling ? 'animate-spin' : ''}`} />
              <span>RESAMPLE</span>
            </button>
          </div>

          {/* Real-time Candidate Thumbnail Grid */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[8px] font-mono text-[#666]">
              <span>CANDIDATE TOPOLOGY PROBES</span>
              <span>GEN FOCUS & D(G(z))</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {latentSamples.map((sample) => (
                <LatentThumbnailCard
                  key={sample.id}
                  sample={sample}
                  onSelect={() => onSelectLatent?.(sample.latentVector)}
                />
              ))}
            </div>
          </div>

          {/* GAN Training Co-Evolution Telemetry */}
          <div className="pt-1.5 border-t border-[#222]">
            <div className="grid grid-cols-4 gap-1 text-[8.5px] font-mono text-center">
              <div className="bg-[#050505] p-1 border border-[#222]">
                <span className="text-[#666] block text-[7.5px]">EPOCH</span>
                <span className="text-white font-bold">{ganMetrics.epoch}</span>
              </div>
              <div className="bg-[#050505] p-1 border border-[#222]">
                <span className="text-[#666] block text-[7.5px]">G LOSS</span>
                <span className="text-[#00ff41] font-bold">{ganMetrics.generatorLoss}</span>
              </div>
              <div className="bg-[#050505] p-1 border border-[#222]">
                <span className="text-[#666] block text-[7.5px]">D LOSS</span>
                <span className="text-[#ff3e00] font-bold">{ganMetrics.discriminatorLoss}</span>
              </div>
              <div className="bg-[#050505] p-1 border border-[#222]">
                <span className="text-[#666] block text-[7.5px]">REGRET</span>
                <span className="text-[#f59e0b] font-bold">{ganMetrics.agentRegret ?? 0.5}</span>
              </div>
            </div>
          </div>

          {/* Active Latent Dimension Vectors Breakdown (z0..z11) */}
          {ganMetrics.activeLatentVector && (
            <div className="space-y-1 pt-1 border-t border-[#222]">
              <div className="flex justify-between text-[8px] font-mono text-[#666]">
                <span>ACTIVE LATENT EMBEDDING (Z0..Z11)</span>
                <span className="text-[#00ff41]">12-DIM MANIFOLD</span>
              </div>
              <div className="grid grid-cols-12 gap-0.5 h-3 bg-[#050505] p-0.5 border border-[#222]">
                {ganMetrics.activeLatentVector.map((val, idx) => {
                  const norm = Math.max(-1, Math.min(1, val));
                  const isPositive = norm >= 0;
                  return (
                    <div
                      key={idx}
                      className="relative h-full bg-[#111] overflow-hidden group"
                      title={`z[${idx}] = ${val.toFixed(2)}`}
                    >
                      <div
                        className={`absolute inset-x-0 ${isPositive ? 'bottom-0 bg-[#00ff41]' : 'top-0 bg-[#ff3e00]'}`}
                        style={{ height: `${Math.min(100, Math.abs(norm) * 100)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Emergent Species Reward Trajectory Graph */}
      <div id="reward-trajectory-wrapper" className="space-y-1">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-[#00ff41]">
            <TrendingUp className="w-3.5 h-3.5 text-[#00ff41]" />
            Emergent Reward Convergence
          </span>
          <span className="text-[8.5px] font-mono text-[#555]">RL Trajectory</span>
        </div>
        <div className="w-full h-16 bg-[#050505] border border-[#222] p-1 flex items-center justify-center">
          <canvas ref={rewardCanvasRef} width={420} height={60} className="w-full h-full block" />
        </div>
      </div>

      {/* TD-Error & Critic Loss Curve */}
      <div id="critic-loss-wrapper" className="space-y-1">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-[#ff3e00]">
            <Layers className="w-3.5 h-3.5 text-[#ff3e00]" />
            Critic TD-Loss Convergence
          </span>
          <span className="text-[9px] font-mono text-[#00ff41]">
            {metrics.averageTdError}
          </span>
        </div>
        <div className="w-full h-14 bg-[#050505] border border-[#222] p-1 flex items-center justify-center">
          <canvas ref={lossCanvasRef} width={420} height={52} className="w-full h-full block" />
        </div>
      </div>

      {/* System Stats Footnote */}
      <div id="metrics-footer" className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#222] text-center font-mono">
        <div className="bg-[#050505] p-1 border border-[#222]">
          <span className="text-[7.5px] text-[#666] block uppercase tracking-wider">RL Steps</span>
          <span className="text-[11px] font-bold text-[#00ff41]">{metrics.stepCount.toLocaleString()}</span>
        </div>
        <div className="bg-[#050505] p-1 border border-[#222]">
          <span className="text-[7.5px] text-[#666] block uppercase tracking-wider">Population</span>
          <span className="text-[11px] font-bold text-white">{metrics.totalPopulation} Agents</span>
        </div>
        <div className="bg-[#050505] p-1 border border-[#222]">
          <span className="text-[7.5px] text-[#666] block uppercase tracking-wider">Resonance Pillars</span>
          <span className="text-[11px] font-bold text-[#f59e0b]">{metrics.activeSoundNodes} Active</span>
        </div>
      </div>
    </div>
  );
};


