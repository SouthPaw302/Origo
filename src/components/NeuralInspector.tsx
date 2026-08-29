/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Agent } from '../simulation/agent';
import { Brain, Zap, Activity, Cpu, Gauge, Compass } from 'lucide-react';

interface NeuralInspectorProps {
  agent: Agent | null;
}

export const NeuralInspector: React.FC<NeuralInspectorProps> = ({ agent }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Live Neural Network Synaptic Weights & Neurons
  useEffect(() => {
    if (!agent || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Neural layout: 4 columns (Inputs, Hidden 1, Hidden 2, Outputs)
    const layers = [
      { name: 'Sensory', count: 12, label: 'Inputs (25)' }, // Show top 12 representative inputs
      { name: 'Hidden 1', count: 16, label: 'Dense (32)' },
      { name: 'Hidden 2', count: 12, label: 'Dense (24)' },
      { name: 'Policy Head', count: 5, label: 'Actions (5)' },
    ];

    const colX = [
      width * 0.12,
      width * 0.38,
      width * 0.64,
      width * 0.88,
    ];

    // Calculate node coordinates
    const nodeCoords: { x: number; y: number }[][] = [];
    layers.forEach((layer, lIdx) => {
      const coords: { x: number; y: number }[] = [];
      const total = layer.count;
      const spacing = (height - 40) / (total + 1);

      for (let i = 0; i < total; i++) {
        coords.push({
          x: colX[lIdx],
          y: 20 + spacing * (i + 1),
        });
      }
      nodeCoords.push(coords);
    });

    // 1. Draw Synaptic Connections (Weights)
    const brain = agent.brain;
    for (let l = 0; l < nodeCoords.length - 1; l++) {
      const fromNodes = nodeCoords[l];
      const toNodes = nodeCoords[l + 1];

      for (let i = 0; i < fromNodes.length; i++) {
        for (let j = 0; j < toNodes.length; j++) {
          const from = fromNodes[i];
          const to = toNodes[j];

          // Sample weight from brain layer
          const layerWeights = brain.layers[Math.min(l, brain.layers.length - 1)]?.weights;
          const weight = (layerWeights && layerWeights[j % layerWeights.length]?.[i % (layerWeights[0]?.length || 1)]) || 0;

          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);

          if (weight > 0) {
            ctx.strokeStyle = `rgba(0, 255, 65, ${Math.min(0.7, Math.abs(weight) * 0.5)})`;
          } else {
            ctx.strokeStyle = `rgba(255, 62, 0, ${Math.min(0.7, Math.abs(weight) * 0.5)})`;
          }
          ctx.lineWidth = Math.max(0.5, Math.min(2.0, Math.abs(weight) * 1.5));
          ctx.stroke();
        }
      }
    }

    // 2. Draw Firing Neurons (Activations)
    const inputs = agent.lastSensoryInput || [];
    const actions = agent.lastActionOutputs || [0, 0, 0, 0, 0];

    nodeCoords.forEach((layerNodes, lIdx) => {
      layerNodes.forEach((node, nIdx) => {
        let activation = 0.5;
        if (lIdx === 0) {
          activation = (inputs[nIdx] ?? 0.5);
        } else if (lIdx === nodeCoords.length - 1) {
          activation = (actions[nIdx] + 1) / 2; // -1..1 to 0..1
        } else {
          // Semi-random deterministic modulation from internal state
          activation = 0.4 + Math.sin(agent.age * 0.1 + lIdx * 2 + nIdx) * 0.35;
        }

        const r = lIdx === 0 || lIdx === nodeCoords.length - 1 ? 5.5 : 4.5;

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = activation > 0.5 ? 'rgba(0, 255, 65, 0.25)' : 'rgba(255, 62, 0, 0.25)';
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = activation > 0.5 ? '#00ff41' : '#ff3e00';
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  }, [agent]);

  if (!agent) {
    return (
      <div
        id="neural-inspector-empty"
        className="flex flex-col items-center justify-center h-full p-6 text-center text-[#666] bg-[#0a0a0a] border border-[#222] font-mono space-y-3"
      >
        <div className="w-12 h-12 border border-[#333] flex items-center justify-center">
          <Brain className="w-6 h-6 text-[#555]" />
        </div>
        <p className="text-xs uppercase tracking-widest text-[#888] font-bold">No Agent Selected</p>
        <p className="text-[11px] text-[#555] max-w-xs leading-relaxed">
          Click any agent in the canvas with the <span className="text-[#00ff41]">Inspect Tool</span> to observe its real-time neural network and policy distributions.
        </p>
      </div>
    );
  }

  const actionLabels = ['Thrust Propulsion', 'Angular Steering', 'Sonic Pulse', 'Terraform Mod', 'Evolution Spark'];
  const sensoryLabels = [
    'Raycast Forward-Left',
    'Raycast Forward',
    'Raycast Forward-Right',
    'Rival Proximity',
    'Ally Proximity',
    'Energy Node Proximity',
    'Harmonic Field Value',
    'Terrain Height',
    'Kinetic Velocity',
    'Energy Level',
    'Acoustic Pressure',
    'Internal Clock Phase',
  ];

  return (
    <div
      id="neural-inspector-container"
      className="flex flex-col h-full bg-[#0a0a0a] border border-[#222] p-4 overflow-y-auto space-y-4"
    >
      {/* Header with Species & Generation */}
      <div id="inspector-header" className="flex items-center justify-between pb-3 border-b border-[#222]">
        <div className="flex items-center gap-3">
          <div
            className="w-3.5 h-3.5"
            style={{ backgroundColor: agent.config.color, boxShadow: `0 0 10px ${agent.config.color}` }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide font-tech uppercase">{agent.config.name}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-black text-[#00ff41] border border-[#00ff41]">
                GEN {agent.generation}
              </span>
            </div>
            <p className="text-[10px] text-[#666] font-mono">{agent.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-widest text-[#666] font-mono block">Elo Rating</span>
            <span className="text-sm font-light text-[#ff3e00] font-mono">{agent.eloRating}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-widest text-[#666] font-mono block">TD Advantage</span>
            <span className="text-sm font-light text-[#00ff41] font-mono">
              {agent.lastTdError > 0 ? `+${agent.lastTdError.toFixed(2)}` : agent.lastTdError.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Active Policy Highlight Card (Artistic Flair Archetype) */}
      <div className="bg-[#111] p-3 border border-[#333]">
        <div className="flex justify-between items-center mb-1">
          <h4 className="text-[9px] uppercase tracking-[0.2em] text-[#888] font-mono">Active Policy</h4>
          <span className="text-[9px] font-mono text-[#00ff41]">PPO + REWARD SHAPING</span>
        </div>
        <p className="text-base font-serif italic text-white">Actor-Critic Neural Policy</p>
        <div className="mt-2.5 h-1 w-full bg-[#222]">
          <div className="h-full bg-[#00ff41] w-[75%]"></div>
        </div>
      </div>

      {/* Reward Shaping Breakdown Telemetry */}
      <div id="reward-shaping-wrapper" className="space-y-2 pt-2 border-t border-[#222]">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-[#00ff41]">
            <Zap className="w-3.5 h-3.5 text-[#00ff41]" />
            Reward Shaping Decomposition
          </span>
          <span className="text-[10px] font-mono text-[#00ff41]">
            Total: <strong>{agent.lastRewardBreakdown?.total > 0 ? `+${agent.lastRewardBreakdown.total.toFixed(3)}` : agent.lastRewardBreakdown?.total.toFixed(3)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <div className="flex justify-between text-[#888]">
              <span>Extrinsic:</span>
              <span className={agent.lastRewardBreakdown?.extrinsic >= 0 ? 'text-[#00ff41]' : 'text-[#ff3e00]'}>
                {agent.lastRewardBreakdown?.extrinsic?.toFixed(3) || '0.000'}
              </span>
            </div>
            <div className="w-full h-1 bg-[#1a1a1a] mt-1">
              <div
                className="h-full bg-[#00ff41]"
                style={{ width: `${Math.min(100, Math.max(0, (agent.lastRewardBreakdown?.extrinsic || 0) * 100))}%` }}
              />
            </div>
          </div>

          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <div className="flex justify-between text-[#888]">
              <span>Curiosity (ICM):</span>
              <span className="text-[#a855f7]">+{agent.lastRewardBreakdown?.curiosity?.toFixed(3) || '0.000'}</span>
            </div>
            <div className="w-full h-1 bg-[#1a1a1a] mt-1">
              <div
                className="h-full bg-[#a855f7]"
                style={{ width: `${Math.min(100, (agent.lastRewardBreakdown?.curiosity || 0) * 250)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <div className="flex justify-between text-[#888]">
              <span>Topological (GAN):</span>
              <span className="text-[#f59e0b]">+{agent.lastRewardBreakdown?.topological?.toFixed(3) || '0.000'}</span>
            </div>
            <div className="w-full h-1 bg-[#1a1a1a] mt-1">
              <div
                className="h-full bg-[#f59e0b]"
                style={{ width: `${Math.min(100, (agent.lastRewardBreakdown?.topological || 0) * 300)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <div className="flex justify-between text-[#888]">
              <span>Acoustic / Wave:</span>
              <span className="text-[#06b6d4]">+{agent.lastRewardBreakdown?.acoustic?.toFixed(3) || '0.000'}</span>
            </div>
            <div className="w-full h-1 bg-[#1a1a1a] mt-1">
              <div
                className="h-full bg-[#06b6d4]"
                style={{ width: `${Math.min(100, (agent.lastRewardBreakdown?.acoustic || 0) * 300)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Evolving Audio Synthesis Real-Time Parameters */}
      <div id="audio-synthesis-telemetry" className="space-y-2 pt-2 border-t border-[#222]">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-[#ff3e00]">
            <Activity className="w-3.5 h-3.5 text-[#ff3e00]" />
            Evolving Neural Synthesizer
          </span>
          <span className="text-[9px] font-mono text-[#ff3e00]">REAL-TIME FM</span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <span className="text-[#666] block">PITCH</span>
            <span className="text-white font-bold">{agent.currentAudioModulation?.pitchHz || 440} Hz</span>
          </div>
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <span className="text-[#666] block">FM INDEX</span>
            <span className="text-[#00ff41] font-bold">{agent.currentAudioModulation?.fmIndex || 0.5}</span>
          </div>
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <span className="text-[#666] block">TIMBRE</span>
            <span className="text-[#f59e0b] font-bold">{agent.currentAudioModulation?.timbreMorph || 0.5}</span>
          </div>
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <span className="text-[#666] block">RHYTHM</span>
            <span className="text-[#a855f7] font-bold">{agent.currentAudioModulation?.rhythmRateHz || 2.0} Hz</span>
          </div>
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <span className="text-[#666] block">VCF CUTOFF</span>
            <span className="text-[#06b6d4] font-bold">{agent.currentAudioModulation?.filterCutoffHz || 2500} Hz</span>
          </div>
          <div className="bg-[#050505] p-1.5 border border-[#222]">
            <span className="text-[#666] block">AMP</span>
            <span className="text-white font-bold">{agent.currentAudioModulation?.amplitude || 0.5}</span>
          </div>
        </div>
      </div>

      {/* Live Synaptic Architecture Visualizer */}
      <div id="synapse-canvas-wrapper" className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#888]">
          <span className="flex items-center gap-1 font-mono uppercase tracking-wider text-[10px] text-[#00ff41]">
            <Cpu className="w-3.5 h-3.5 text-[#00ff41]" />
            Synaptic Architecture
          </span>
          <span className="text-[9px] font-mono text-[#666]">25 In → 32 Dense → 24 Dense → 5 Out</span>
        </div>
        <div className="w-full h-36 bg-[#050505] border border-[#222] overflow-hidden flex items-center justify-center">
          <canvas ref={canvasRef} width={420} height={144} className="w-full h-full block" />
        </div>
      </div>

      {/* Action Probability Distribution & Critic V(s) */}
      <div id="action-policy-wrapper" className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-[#ff3e00]">
            <Activity className="w-3.5 h-3.5 text-[#ff3e00]" />
            Policy Distribution π(a|s)
          </span>
          <span className="text-[10px] font-mono text-white">
            Critic V(s) = <strong className="text-[#00ff41] font-light">{agent.lastStateValue.toFixed(3)}</strong>
          </span>
        </div>

        <div className="space-y-1.5">
          {actionLabels.map((label, idx) => {
            const rawVal = agent.lastActionOutputs[idx] ?? 0;
            const prob = agent.lastActionProbs[idx] ?? 0.2;
            const percentage = Math.round(prob * 100);

            return (
              <div key={label} className="flex flex-col space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#888]">{label}</span>
                  <span>
                    <span className="text-[#666] mr-2">val: {rawVal.toFixed(2)}</span>
                    <span className="text-white font-bold">{percentage}%</span>
                  </span>
                </div>
                <div className="w-full h-1 bg-[#1a1a1a] flex">
                  <div
                    className="h-full bg-[#00ff41] transition-all duration-75"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Sensory Input Breakdown */}
      <div id="sensory-inputs-wrapper" className="space-y-2 pt-2 border-t border-[#222]">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-[#888]">
            <Compass className="w-3.5 h-3.5 text-[#888]" />
            Sensory Feature Vector
          </span>
          <span className="text-[9px] font-mono text-[#555]">Continuous Input Space</span>
        </div>

        <div className="grid grid-cols-2 gap-1">
          {sensoryLabels.map((label, idx) => {
            const val = agent.lastSensoryInput[idx] ?? 0.5;

            return (
              <div
                key={label}
                className="flex items-center justify-between px-2 py-1 bg-[#050505] border border-[#222] text-[9px] font-mono"
              >
                <span className="text-[#777] truncate max-w-[100px]">{label}</span>
                <span className="font-bold text-[#00ff41]">{val.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Summary Footnote */}
      <div id="inspector-footer" className="flex items-center justify-between pt-2 border-t border-[#222] text-[10px] font-mono text-[#666]">
        <span>Kills: <strong className="text-[#ff3e00] font-mono">{agent.kills}</strong></span>
        <span>Gathered: <strong className="text-white font-mono">{Math.round(agent.energyGathered)}</strong></span>
        <span>Pulses: <strong className="text-[#00ff41] font-mono">{agent.pulsesEmitted}</strong></span>
        <span>Age: <strong className="text-[#888] font-mono">{agent.age}</strong></span>
      </div>
    </div>
  );
};
