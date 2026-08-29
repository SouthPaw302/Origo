/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SimulationEngine, SIMULATION_PRESETS } from '../simulation/engine';
import { EnvironmentPreset } from '../types';
import { Settings, Play, Pause, FastForward, RotateCcw, Sparkles, Flame, Sliders } from 'lucide-react';

interface ControlPanelProps {
  engine: SimulationEngine;
  onPresetChange: (preset: EnvironmentPreset) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ engine, onPresetChange }) => {
  const [isRunning, setIsRunning] = useState(engine.isRunning);
  const [speed, setSpeed] = useState(engine.simulationSpeed);
  const [learningRate, setLearningRate] = useState(engine.learningRate);
  const [curiosityWeight, setCuriosityWeight] = useState(engine.curiosityWeight);
  const [mutationRate, setMutationRate] = useState(engine.mutationRate);
  const [waveSpeed, setWaveSpeed] = useState(engine.env.waveSpeed);
  const [decayRate, setDecayRate] = useState(engine.env.decayRate);

  const handlePlayPause = () => {
    engine.isRunning = !engine.isRunning;
    setIsRunning(engine.isRunning);
  };

  const handleSpeedChange = (newSpeed: number) => {
    engine.simulationSpeed = newSpeed;
    setSpeed(newSpeed);
  };

  const handleReset = () => {
    engine.resetSimulation();
  };

  const handleLRChange = (val: number) => {
    engine.learningRate = val;
    setLearningRate(val);
  };

  const handleCuriosityChange = (val: number) => {
    engine.curiosityWeight = val;
    setCuriosityWeight(val);
  };

  const handleMutationChange = (val: number) => {
    engine.mutationRate = val;
    setMutationRate(val);
  };

  const handleWaveSpeedChange = (val: number) => {
    engine.env.waveSpeed = val;
    setWaveSpeed(val);
  };

  const handleDecayChange = (val: number) => {
    engine.env.decayRate = val;
    setDecayRate(val);
  };

  const handleTriggerMutationStorm = () => {
    engine.agents.forEach((a) => a.brain.mutate(0.35, 0.4));
  };

  return (
    <div
      id="control-panel-container"
      className="flex flex-col h-full bg-[#0a0a0a] border border-[#222] p-4 overflow-y-auto space-y-4 font-mono"
    >
      {/* Simulation Playback Bar */}
      <div id="playback-controls" className="flex items-center justify-between pb-3 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <button
            id="sim-play-pause-btn"
            onClick={handlePlayPause}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all border ${
              isRunning
                ? 'bg-[#ff3e00]/20 text-[#ff3e00] border-[#ff3e00] hover:bg-[#ff3e00]/30'
                : 'bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41] hover:bg-[#00ff41]/30'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause Sim' : 'Resume Sim'}</span>
          </button>

          <button
            id="sim-reset-btn"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#050505] hover:bg-[#1a1a1a] text-[#888] hover:text-white text-xs font-bold uppercase tracking-wider border border-[#333] transition-all"
            title="Reset Environment & Re-seed Agents"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Speed Selector (1x, 2x, 5x, 10x Turbo) */}
        <div id="sim-speed-selector" className="flex items-center bg-[#050505] p-0.5 border border-[#333]">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className={`px-2 py-0.5 text-[11px] font-mono font-bold transition-all ${
                speed === s
                  ? 'bg-[#00ff41] text-black shadow-sm'
                  : 'text-[#666] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Preset Scenarios */}
      <div id="presets-section" className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1 text-[#ff3e00]">
            <Sparkles className="w-3.5 h-3.5 text-[#ff3e00]" />
            Simulation Presets
          </span>
          <span className="text-[9px] text-[#00ff41]">{engine.activePreset.name}</span>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {SIMULATION_PRESETS.map((preset) => {
            const isActive = engine.activePreset.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onPresetChange(preset)}
                className={`flex flex-col items-start p-2.5 border text-left transition-all ${
                  isActive
                    ? 'bg-[#00ff41]/10 border-[#00ff41] text-white'
                    : 'bg-[#050505] border-[#222] text-[#888] hover:text-white hover:border-[#444]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{preset.name}</span>
                  <span className="text-[9px] text-[#00ff41]">{preset.soundPreset.name}</span>
                </div>
                <p className="text-[10px] text-[#666] mt-1 leading-snug">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pure Reinforcement Learning Hyperparameters */}
      <div id="hyperparameters-section" className="space-y-3 pt-2 border-t border-[#222]">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider">
          <span className="flex items-center gap-1 text-[#00ff41]">
            <Sliders className="w-3.5 h-3.5 text-[#00ff41]" />
            RL Hyperparameters
          </span>
          <button
            onClick={handleTriggerMutationStorm}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#ff3e00]/20 text-[#ff3e00] border border-[#ff3e00] text-[9px] hover:bg-[#ff3e00]/30 transition-all font-mono font-bold uppercase"
            title="Inject Sudden Neural Weight Mutation into Population"
          >
            <Flame className="w-3 h-3" />
            <span>Mutate All</span>
          </button>
        </div>

        {/* Learning Rate */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#888]">
            <span>Learning Rate (α)</span>
            <span className="text-[#00ff41]">{learningRate.toFixed(4)}</span>
          </div>
          <input
            type="range"
            min="0.001"
            max="0.03"
            step="0.001"
            value={learningRate}
            onChange={(e) => handleLRChange(parseFloat(e.target.value))}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>

        {/* Curiosity Exploration Weight */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#888]">
            <span>Curiosity Bonus (β)</span>
            <span className="text-[#00ff41]">{curiosityWeight.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.5"
            step="0.02"
            value={curiosityWeight}
            onChange={(e) => handleCuriosityChange(parseFloat(e.target.value))}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>

        {/* Mutation Rate */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#888]">
            <span>Weight Mutation Rate</span>
            <span className="text-[#ff3e00]">{Math.round(mutationRate * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.3"
            step="0.01"
            value={mutationRate}
            onChange={(e) => handleMutationChange(parseFloat(e.target.value))}
            className="w-full accent-[#ff3e00] cursor-pointer"
          />
        </div>
      </div>

      {/* Procedural Environment & Acoustic Physics */}
      <div id="env-physics-section" className="space-y-3 pt-2 border-t border-[#222]">
        <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-[#888]">
          <Settings className="w-3.5 h-3.5 text-[#ff3e00]" />
          <span>Acoustic Physics & Field</span>
        </div>

        {/* Acoustic Wave Speed */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#888]">
            <span>Acoustic Wave Speed</span>
            <span className="text-[#00ff41]">{waveSpeed.toFixed(1)} px/f</span>
          </div>
          <input
            type="range"
            min="1.5"
            max="6.0"
            step="0.2"
            value={waveSpeed}
            onChange={(e) => handleWaveSpeedChange(parseFloat(e.target.value))}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>

        {/* Harmonic Resonance Field Decay */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#888]">
            <span>Harmonic Field Persistence</span>
            <span className="text-[#00ff41]">{Math.round(decayRate * 1000) / 10}%</span>
          </div>
          <input
            type="range"
            min="0.94"
            max="0.995"
            step="0.002"
            value={decayRate}
            onChange={(e) => handleDecayChange(parseFloat(e.target.value))}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
