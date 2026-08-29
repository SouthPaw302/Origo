/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Agent } from '../simulation/agent';
import { soundEngine } from '../audio/soundEngine';
import { Eye, Zap, Volume2, Sparkles, X } from 'lucide-react';

interface AgentDetailCardProps {
  agent: Agent | null;
  onDeselect: () => void;
}

export const AgentDetailCard: React.FC<AgentDetailCardProps> = ({ agent, onDeselect }) => {
  if (!agent) return null;

  const handleSoloAudio = () => {
    soundEngine.triggerAgentSound(
      agent.species,
      agent.x / 1000,
      agent.y / 700,
      1.0,
      agent.lastTdError
    );
  };

  const handleBoostEnergy = () => {
    agent.energy = Math.min(agent.maxEnergy, agent.energy + 40);
  };

  return (
    <div
      id="agent-detail-card"
      className="absolute bottom-4 right-4 z-30 flex items-center gap-4 px-4 py-3 bg-neutral-900/90 backdrop-blur-lg rounded-2xl border border-neutral-700 shadow-2xl animate-fade-in"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: agent.config.color, boxShadow: `0 0 12px ${agent.config.color}` }}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{agent.config.name}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
              Gen {agent.generation}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 font-mono">
            Elo: <strong className="text-amber-400">{agent.eloRating}</strong> | Reward:{' '}
            <strong className="text-cyan-400">{agent.recentReward.toFixed(2)}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
        <button
          onClick={handleSoloAudio}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-400 rounded-xl text-xs font-semibold border border-neutral-700 transition-all"
          title="Listen to isolated agent sonic pulse timbre"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Solo Voice</span>
        </button>

        <button
          onClick={handleBoostEnergy}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-500/30 transition-all"
          title="Feed Energy to Agent"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Feed Energy</span>
        </button>

        <button
          onClick={onDeselect}
          className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-all"
          title="Deselect"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
