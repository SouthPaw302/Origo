/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SimulationEngine, SIMULATION_PRESETS } from './simulation/engine';
import { SimulationCanvas } from './components/SimulationCanvas';
import { NeuralInspector } from './components/NeuralInspector';
import { SelfPlayMetrics } from './components/SelfPlayMetrics';
import { AudioControls } from './components/AudioControls';
import { MusicCapturePanel } from './components/MusicCapturePanel';
import { ControlPanel } from './components/ControlPanel';
import { AgentDetailCard } from './components/AgentDetailCard';
import { soundEngine } from './audio/soundEngine';
import { origoMusicSystem } from './music/musicSystem';
import { EnvironmentPreset, SpeciesType } from './types';
import {
  Brain,
  TrendingUp,
  Music,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  Maximize2,
  Minimize2,
  Activity,
  Layers,
} from 'lucide-react';

type ActiveTab = 'neural' | 'metrics' | 'audio' | 'controls';

export default function App() {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(1000, 700);
  }
  const engine = engineRef.current;

  const [activeTab, setActiveTab] = useState<ActiveTab>('neural');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(engine.selectedAgentId);
  const [metrics, setMetrics] = useState(engine.getMetrics());
  const [isAudioMuted, setIsAudioMuted] = useState(soundEngine.getConfig().isMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Periodic metrics sync for UI state (every 100ms).
  // Music capture observes the engine here and never owns simulation timing.
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(engine.getMetrics());
      setSelectedAgentId(engine.selectedAgentId);
      setIsAudioMuted(soundEngine.getConfig().isMuted);
      origoMusicSystem.tick(engine);
    }, 100);

    return () => clearInterval(interval);
  }, [engine]);

  // Initial user gesture to unlock WebAudio
  const handleUserInteract = () => {
    soundEngine.init();
  };

  const handlePresetSelect = (preset: EnvironmentPreset) => {
    soundEngine.init();
    engine.applyPreset(preset);
  };

  const toggleAudio = () => {
    soundEngine.init();
    const newMuted = !isAudioMuted;
    soundEngine.setMuted(newMuted);
    setIsAudioMuted(newMuted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const selectedAgent = engine.getSelectedAgent();

  return (
    <div
      id="app-root"
      onClick={handleUserInteract}
      className="flex flex-col w-screen h-screen bg-[#050505] text-[#f0f0f0] overflow-hidden font-sans border-[8px] md:border-[12px] border-[#111]"
    >
      {/* Top Artistic Flair Header */}
      <header
        id="app-header"
        className="flex flex-wrap items-center justify-between px-6 py-3 bg-[#0a0a0a] border-b border-[#222] z-30 flex-shrink-0 gap-3"
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-[#050505] border border-[#333] flex items-center justify-center relative">
            <div className="absolute inset-0 border border-[#00ff41] opacity-60 -rotate-12 scale-90"></div>
            <Sparkles className="w-4 h-4 text-[#00ff41] relative z-10" />
          </div>
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl md:text-2xl font-display font-black tracking-tighter leading-none italic uppercase text-white">
                Neural Harmonics
              </h1>
              <span className="text-[9px] font-mono tracking-widest px-2 py-0.5 border border-[#00ff41] text-[#00ff41] bg-black uppercase">
                RL Self-Play v4.0
              </span>
            </div>
            <p className="text-[10px] text-[#666] mt-1 tracking-[0.25em] uppercase font-mono font-semibold">
              Procedural Wavefield & Autonomous Sonic Synthesis
            </p>
          </div>
        </div>

        {/* Global Live Artistic Stats & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-6 pr-4 border-r border-[#222]">
            <div className="text-right">
              <p className="text-[9px] text-[#666] uppercase tracking-widest font-mono">Steps Processed</p>
              <p className="text-lg font-light tracking-tight font-mono text-white">
                {metrics.stepCount.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-[#666] uppercase tracking-widest font-mono">Sim FPS</p>
              <p className="text-lg font-light tracking-tight font-mono text-[#00ff41]">
                {metrics.fps}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-[#666] uppercase tracking-widest font-mono">Active Scale</p>
              <p className="text-lg font-light tracking-tight font-mono text-[#ff3e00]">
                {engine.activePreset.soundPreset.scaleName}
              </p>
            </div>
          </div>

          {/* Master Audio Button */}
          <button
            id="header-audio-btn"
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-[0.15em] font-mono font-bold transition-all border ${
              isAudioMuted
                ? 'bg-black border-[#ff3e00] text-[#ff3e00] hover:bg-[#ff3e00] hover:text-black'
                : 'bg-black border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black'
            }`}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 animate-pulse" />}
            <span>{isAudioMuted ? 'Audio Muted' : 'DSP Synth Live'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            id="header-fullscreen-btn"
            onClick={toggleFullscreen}
            className="p-2 text-[#888] hover:text-white bg-[#111] hover:bg-[#222] border border-[#333] transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main id="app-workspace" className="flex flex-1 w-full h-[calc(100vh-100px)] overflow-hidden">
        {/* Left / Center Viewport: Interactive Simulation Canvas */}
        <section id="canvas-section" className="relative flex-1 h-full min-w-0 bg-[#050505]">
          <SimulationCanvas
            engine={engine}
            selectedAgentId={selectedAgentId}
            onSelectAgent={(id) => setSelectedAgentId(id)}
          />

          {/* Floating Selected Agent Card */}
          <AgentDetailCard
            agent={selectedAgent}
            onDeselect={() => {
              setSelectedAgentId(null);
              engine.selectedAgentId = null;
            }}
          />
        </section>

        {/* Right Sidebar: Multi-Tab Intelligence & Sound Console */}
        <aside
          id="inspector-sidebar"
          className="w-96 xl:w-[420px] h-full bg-[#0a0a0a] border-l border-[#222] flex flex-col flex-shrink-0 z-20"
        >
          {/* Tab Navigation Header */}
          <nav
            id="sidebar-tabs"
            className="flex items-center justify-between bg-[#111] border-b border-[#222] flex-shrink-0"
          >
            <button
              id="tab-neural-btn"
              onClick={() => setActiveTab('neural')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-[11px] font-mono uppercase tracking-wider font-bold transition-all border-b-2 ${
                activeTab === 'neural'
                  ? 'bg-[#050505] text-[#00ff41] border-[#00ff41]'
                  : 'text-[#888] hover:text-white border-transparent hover:bg-[#161616]'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Neural Net</span>
            </button>

            <button
              id="tab-metrics-btn"
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-[11px] font-mono uppercase tracking-wider font-bold transition-all border-b-2 ${
                activeTab === 'metrics'
                  ? 'bg-[#050505] text-[#ff3e00] border-[#ff3e00]'
                  : 'text-[#888] hover:text-white border-transparent hover:bg-[#161616]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Self-Play</span>
            </button>

            <button
              id="tab-audio-btn"
              onClick={() => setActiveTab('audio')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-[11px] font-mono uppercase tracking-wider font-bold transition-all border-b-2 ${
                activeTab === 'audio'
                  ? 'bg-[#050505] text-[#00ff41] border-[#00ff41]'
                  : 'text-[#888] hover:text-white border-transparent hover:bg-[#161616]'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Synth DSP</span>
            </button>

            <button
              id="tab-controls-btn"
              onClick={() => setActiveTab('controls')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-[11px] font-mono uppercase tracking-wider font-bold transition-all border-b-2 ${
                activeTab === 'controls'
                  ? 'bg-[#050505] text-[#ff3e00] border-[#ff3e00]'
                  : 'text-[#888] hover:text-white border-transparent hover:bg-[#161616]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>
          </nav>

          {/* Active Tab Body */}
          <div id="sidebar-content" className="flex-1 p-3 overflow-hidden bg-[#0a0a0a]">
            {activeTab === 'neural' && <NeuralInspector agent={selectedAgent} />}
            {activeTab === 'metrics' && (
              <SelfPlayMetrics
                metrics={metrics}
                ganMetrics={engine.getGANMetrics()}
                onSelectLatent={(latent) => engine.applyLatentSample(latent)}
                onResampleLatent={() => engine.resampleLatentSpace()}
              />
            )}
            {activeTab === 'audio' && (
              <div className="h-full overflow-y-auto pr-1">
                <AudioControls />
                <MusicCapturePanel engine={engine} />
              </div>
            )}
            {activeTab === 'controls' && (
              <ControlPanel engine={engine} onPresetChange={handlePresetSelect} />
            )}
          </div>
        </aside>
      </main>

      {/* Bottom Technical Status Bar (Artistic Flair Footer) */}
      <footer
        id="app-footer"
        className="h-8 flex items-center justify-between px-6 bg-[#0c0c0c] border-t border-[#222] text-[10px] uppercase tracking-widest text-[#555] font-mono flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#00ff41] inline-block animate-pulse"></span>
          <span>Kernel: RL-PPO-CORE-092</span>
        </div>
        <div className="hidden sm:block">Status: Stable Continuous Evolution</div>
        <div>Scale: {engine.activePreset.soundPreset.scaleName} | Mode: Self-Play</div>
      </footer>
    </div>
  );
}
