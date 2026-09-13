import React, { useState } from 'react';
import { Flame, Pause, Play, RotateCcw, Settings, Sliders, Sparkles } from 'lucide-react';
import { SimulationEngine, SIMULATION_PRESETS } from '../simulation/engine';
import { EnvironmentPreset } from '../types';
import { applyMusicWorldMix, MUSIC_WORLDS, musicWorldRegistry, MusicWorldId } from '../music/musicWorlds';
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
    const next = presets.find((item) => item.id === world.defaultPresetId) ?? presets[0];
    if (next) choosePreset(next, world);
  };

  const toggleRunning = () => {
    engine.isRunning = !engine.isRunning;
    setIsRunning(engine.isRunning);
  };
  const changeSpeed = (value: number) => { engine.simulationSpeed = value; setSpeed(value); };
  const changeLearning = (value: number) => { engine.learningRate = value; setLearningRate(value); };
  const changeCuriosity = (value: number) => { engine.curiosityWeight = value; setCuriosityWeight(value); };
  const changeMutation = (value: number) => { engine.mutationRate = value; setMutationRate(value); };
  const changeWaveSpeed = (value: number) => { engine.env.waveSpeed = value; setWaveSpeed(value); };
  const changeDecay = (value: number) => { engine.env.decayRate = value; setDecayRate(value); };

  return (
    <div id="control-panel-container" className="flex h-full flex-col space-y-4 overflow-y-auto border border-[#222] bg-[#0a0a0a] p-4 font-mono">
      <div className="space-y-2 border-b border-[#222] pb-3">
        <div className="flex items-center gap-2">
          <button onClick={toggleRunning} className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${isRunning ? 'border-[#ff3e00] bg-[#ff3e00]/20 text-[#ff3e00]' : 'border-[#00ff41] bg-[#00ff41]/20 text-[#00ff41]'}`}>
            {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{isRunning ? 'Pause Sim' : 'Resume Sim'}
          </button>
          <button onClick={() => engine.resetSimulation()} className="flex items-center gap-1.5 border border-[#333] bg-[#050505] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#888] hover:text-white"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[9px] uppercase tracking-[0.16em] text-[#777]">World Pace</p><p className="text-[9px] text-[#555]">Normal is tuned for watching behavior.</p></div>
          <div className="flex border border-[#333] bg-[#050505] p-0.5">{[0.5, 1, 1.5, 2].map((value) => <button key={value} onClick={() => changeSpeed(value)} className={`px-2 py-0.5 text-[11px] font-bold ${speed === value ? 'bg-[#00ff41] text-black' : 'text-[#666] hover:text-white'}`}>{value}x</button>)}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"><span className="flex items-center gap-1 text-[#00ff41]"><Sparkles className="h-3.5 w-3.5" />Music World</span><span className="text-[9px] text-[#00ff41]">{activeWorld.family}</span></div>
        <p className="text-[9px] leading-relaxed text-[#666]">Choose a musical ecology. It changes behavior, rhythm, register, motif pressure and mix; it never starts a canned song.</p>
        <select aria-label="Music World" value={activeWorld.id} onChange={(event) => chooseMusicWorld(event.target.value as MusicWorldId)} className="w-full border border-[#3a3a3a] bg-[#050505] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white outline-none focus:border-[#b283ff]">
          {MUSIC_WORLDS.map((world) => <option key={world.id} value={world.id}>{world.name} — {world.family}</option>)}
        </select>
        <div className="border border-[#2b2440] bg-[#0c0912] p-2.5">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-[#d2b8ff]">{activeWorld.name}</span><span className="text-[8px] uppercase tracking-wider text-[#7d6b99]">{activeWorld.palette.bank} palette</span></div>
          <p className="mt-1 text-[10px] leading-snug text-[#888]">{activeWorld.description}</p>
          <p className="mt-1.5 text-[8px] leading-relaxed text-[#5f5670]">Suggested sound: {activeWorld.palette.name} · {activeWorld.palette.description}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#222] pt-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"><span className="flex items-center gap-1 text-[#ff3e00]"><Sparkles className="h-3.5 w-3.5" />{activeWorld.name} Simulations</span><span className="text-[9px] text-[#00ff41]">{engine.activePreset.name}</span></div>
        <div className="grid gap-1.5">{activePresets.map((preset) => {
          const selected = engine.activePreset.id === preset.id;
          return <button key={preset.id} onClick={() => choosePreset(preset)} className={`border p-2.5 text-left ${selected ? 'border-[#00ff41] bg-[#00ff41]/10' : 'border-[#222] bg-[#050505] hover:border-[#444]'}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-white">{preset.name}</span><span className="text-[9px] text-[#00ff41]">{preset.soundPreset.name}</span></div>
            <p className="mt-1 text-[10px] leading-snug text-[#666]">{preset.description}</p>
          </button>;
        })}</div>
      </div>

      <div className="space-y-3 border-t border-[#222] pt-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider"><span className="flex items-center gap-1 text-[#00ff41]"><Sliders className="h-3.5 w-3.5" />RL Hyperparameters</span><button onClick={() => engine.agents.forEach((agent) => agent.brain.mutate(.35, .4))} className="flex items-center gap-1 border border-[#ff3e00] bg-[#ff3e00]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#ff3e00]"><Flame className="h-3 w-3" />Mutate All</button></div>
        <Range label="Learning Rate (α)" value={learningRate} display={learningRate.toFixed(4)} min={.001} max={.03} step={.001} onChange={changeLearning} />
        <Range label="Curiosity Bonus (β)" value={curiosityWeight} display={curiosityWeight.toFixed(2)} min={0} max={.5} step={.02} onChange={changeCuriosity} />
        <Range label="Weight Mutation Rate" value={mutationRate} display={`${Math.round(mutationRate * 100)}%`} min={.01} max={.3} step={.01} onChange={changeMutation} orange />
      </div>

      <div className="space-y-3 border-t border-[#222] pt-2">
        <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-[#888]"><Settings className="h-3.5 w-3.5 text-[#ff3e00]" />Acoustic Physics & Field</div>
        <Range label="Acoustic Wave Speed" value={waveSpeed} display={`${waveSpeed.toFixed(1)} px/f`} min={1.5} max={6} step={.2} onChange={changeWaveSpeed} />
        <Range label="Harmonic Field Persistence" value={decayRate} display={`${Math.round(decayRate * 1000) / 10}%`} min={.94} max={.995} step={.002} onChange={changeDecay} />
      </div>
    </div>
  );
};

function Range({ label, value, display, min, max, step, onChange, orange = false }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void; orange?: boolean }) {
  return <div className="space-y-1"><div className="flex justify-between text-[10px] text-[#888]"><span>{label}</span><span className={orange ? 'text-[#ff3e00]' : 'text-[#00ff41]'}>{display}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(parseFloat(event.target.value))} className={`w-full cursor-pointer ${orange ? 'accent-[#ff3e00]' : 'accent-[#00ff41]'}`} /></div>;
}
