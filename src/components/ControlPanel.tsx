/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SimulationEngine, SIMULATION_PRESETS } from '../simulation/engine';
import { EnvironmentPreset } from '../types';
import { Settings, Play, Pause, RotateCcw, Sparkles, Flame, Sliders } from 'lucide-react';
import { applyMusicWorldMix, MUSIC_WORLDS, musicWorldRegistry, MusicWorldId, PLANNED_MUSIC_WORLD_FAMILIES } from '../music/musicWorlds';
import { origoMusicSystem } from '../music/musicSystem';

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
  const [musicWorldId, setMusicWorldId] = useState<MusicWorldId>(musicWorldRegistry.getActive().id);

  const activeWorld = MUSIC_WORLDS.find((world) => world.id === musicWorldId) ?? MUSIC_WORLDS[0];
  const activePresets = activeWorld.id === 'origo' ? SIMULATION_PRESETS : activeWorld.presets;

  const syncPresetControls = (preset: EnvironmentPreset) => {
    setLearningRate(preset.learningRate);
    setCuriosityWeight(preset.curiosityWeight);
    setWaveSpeed(preset.acousticSpeed);
    setDecayRate(preset.harmonicDecayRate);
  };

  const choosePreset = (preset: EnvironmentPreset, world = activeWorld) => {
    if (origoMusicSystem.getStatus().recording) origoMusicSystem.stop();
    onPresetChange(preset);
    applyMusicWorldMix(world);
    syncPresetControls(preset);
  };

  const chooseMusicWorld = (id: MusicWorldId) => {
    const world = musicWorldRegistry.setActive(id);
    setMusicWorldId(world.id);
    const presets = world.id === 'origo' ? SIMULATION_PRESETS : world.presets;
    const preset = presets.find((item) => item.id === world.defaultPresetId) ?? presets[0];
    if (preset) choosePreset(preset, world);
  };

  const handlePlayPause = () => { engine.isRunning = !engine.isRunning; setIsRunning(engine.isRunning); };
  const handleSpeedChange = (newSpeed: number) => { engine.simulationSpeed = newSpeed; setSpeed(newSpeed); };
  const handleReset = () => engine.resetSimulation();
  const handleLRChange = (val: number) => { engine.learningRate = val; setLearningRate(val); };
  const handleCuriosityChange = (val: number) => { engine.curiosityWeight = val; setCuriosityWeight(val); };
  const handleMutationChange = (val: number) => { engine.mutationRate = val; setMutationRate(val); };
  const handleWaveSpeedChange = (val: number) => { engine.env.waveSpeed = val; setWaveSpeed(val); };
  const handleDecayChange = (val: number) => { engine.env.decayRate = val; setDecayRate(val); };
  const handleTriggerMutationStorm = () => engine.agents.forEach((a) => a.brain.mutate(0.35, 0.4));

  return (
    <div id="control-panel-container" className="flex h-full flex-col space-y-4 overflow-y-auto border border-[#222] bg-[#0a0a0a] p-4 font-mono">
      <div id="playback-controls" className="space-y-2 border-b border-[#222] pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button id="sim-play-pause-btn" onClick={handlePlayPause} className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${isRunning ? 'border-[#ff3e00] bg-[#ff3e00]/20 text-[#ff3e00] hover:bg-[#ff3e00]/30' : 'border-[#00ff41] bg-[#00ff41]/20 text-[#00ff41] hover:bg-[#00ff41]/30'}`}>
              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}<span>{isRunning ? 'Pause Sim' : 'Resume Sim'}</span>
            </button>
            <button id="sim-reset-btn" onClick={handleReset} className="flex items-center gap-1.5 border border-[#333] bg-[#050505] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#888] transition-all hover:bg-[#1a1a1a] hover:text-white" title="Reset Environment & Re-seed Agents"><RotateCcw className="h-3.5 w-3.5" /><span>Reset</span></button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] uppercase tracking-[0.16em] text-[#777]">World Pace</div><div className="text-[9px] text-[#555]">Normal is tuned for watching behavior, not benchmarking.</div></div><div id="sim-speed-selector" className="flex items-center border border-[#333] bg-[#050505] p-0.5">{[0.5, 1, 1.5, 2].map((s) => <button key={s} onClick={() => handleSpeedChange(s)} className={`px-2 py-0.5 text-[11px] font-mono font-bold transition-all ${speed === s ? 'bg-[#00ff41] text-black shadow-sm' : 'text-[#666] hover:text-white'}`}>{s}x</button>)}</div></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"><span className="flex items-center gap-1 text-[#00ff41]"><Sparkles className="h-3.5 w-3.5" /> Music World</span><span className="text-[9px] text-[#00ff41]">{activeWorld.name}</span></div>
        <p className="text-[9px] leading-relaxed text-[#666]">A Music World changes the ecology's musical grammar, pacing, register, mix and instrument roles. It does not play a canned genre template.</p>
        <div className="grid grid-cols-1 gap-1.5">{MUSIC_WORLDS.map((world) => {
          const isActive = world.id === activeWorld.id;
          return <button key={world.id} onClick={() => chooseMusicWorld(world.id)} className={`border p-2.5 text-left transition ${isActive ? 'border-[#b283ff] bg-[#b283ff]/10' : 'border-[#222] bg-[#050505] hover:border-[#444]'}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-white">{world.name}</span><span className={`text-[8px] uppercase tracking-wider ${isActive ? 'text-[#b283ff]' : 'text-[#555]'}`}>{world.family}</span></div>
            <p className="mt-1 text-[10px] leading-snug text-[#777]">{world.description}</p>
            <p className="mt-1.5 text-[8px] text-[#555]">Palette: {world.palette.name}</p>
          </button>;
        })}</div>
        <p className="text-[8px] leading-relaxed text-[#444]">Framework targets next: {PLANNED_MUSIC_WORLD_FAMILIES.join(' · ')}</p>
      </div>

      <div id="presets-section" className="space-y-2 border-t border-[#222] pt-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"><span className="flex items-center gap-1 text-[#ff3e00]"><Sparkles className="h-3.5 w-3.5" /> {activeWorld.name} Simulations</span><span className="text-[9px] text-[#00ff41]">{engine.activePreset.name}</span></div>
        <div className="grid grid-cols-1 gap-1.5">{activePresets.map((preset) => {
          const isActive = engine.activePreset.id === preset.id;
          return <button key={preset.id} onClick={() => choosePreset(preset)} className={`flex flex-col items-start border p-2.5 text-left transition-all ${isActive ? 'border-[#00ff41] bg-[#00ff41]/10 text-white' : 'border-[#222] bg-[#050505] text-[#888] hover:border-[#444] hover:text-white'}`}>
            <div className="flex w-full items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-white">{preset.name}</span><span className="text-[9px] text-[#00ff41]">{preset.soundPreset.name}</span></div><p className="mt-1 text-[10px] leading-snug text-[#666]">{preset.description}</p>
          </button>;
        })}</div>
      </div>

      <div id="hyperparameters-section" className="space-y-3 border-t border-[#222] pt-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider"><span className="flex items-center gap-1 text-[#00ff41]"><Sliders className="h-3.5 w-3.5" /> RL Hyperparameters</span><button onClick={handleTriggerMutationStorm} className="flex items-center gap-1 border border-[#ff3e00] bg-[#ff3e00]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#ff3e00] transition-all hover:bg-[#ff3e00]/30" title="Inject Sudden Neural Weight Mutation into Population"><Flame className="h-3 w-3" /><span>Mutate All</span></button></div>
        <Range label="Learning Rate (α)" value={learningRate} display={learningRate.toFixed(4)} min={0.001} max={0.03} step={0.001} onChange={handleLRChange} />
        <Range label="Curiosity Bonus (β)" value={curiosityWeight} display={curiosityWeight.toFixed(2)} min={0} max={0.5} step={0.02} onChange={handleCuriosityChange} />
        <Range label="Weight Mutation Rate" value={mutationRate} display={`${Math.round(mutationRate * 100)}%`} min={0.01} max={0.3} step={0.01} onChange={handleMutationChange} orange />
      </div>

      <div id="env-physics-section" className="space-y-3 border-t border-[#222] pt-2">
        <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-[#888]"><Settings className="h-3.5 w-3.5 text-[#ff3e00]" /><span>Acoustic Physics & Field</span></div>
        <Range label="Acoustic Wave Speed" value={waveSpeed} display={`${waveSpeed.toFixed(1)} px/f`} min={1.5} max={6} step={0.2} onChange={handleWaveSpeedChange} />
        <Range label="Harmonic Field Persistence" value={decayRate} display={`${Math.round(decayRate * 1000) / 10}%`} min={0.94} max={0.995} step={0.002} onChange={handleDecayChange} />
      </div>
    </div>
  );
};

function Range({ label, value, display, min, max, step, onChange, orange = false }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void; orange?: boolean }) {
  return <div className="space-y-1"><div className="flex justify-between text-[10px] text-[#888]"><span>{label}</span><span className={orange ? 'text-[#ff3e00]' : 'text-[#00ff41]'}>{display}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className={`w-full cursor-pointer ${orange ? 'accent-[#ff3e00]' : 'accent-[#00ff41]'}`} /></div>;
}
