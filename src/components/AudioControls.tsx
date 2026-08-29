/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { SCALES } from '../audio/scales';
import { Volume2, VolumeX, Music, Sliders, Radio, Activity } from 'lucide-react';

export const AudioControls: React.FC = () => {
  const [config, setConfig] = useState(soundEngine.getConfig());
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Oscilloscope & Audio Spectrum FFT Visualizer
  useEffect(() => {
    let animId: number;
    const freqData = new Uint8Array(128);
    const timeData = new Uint8Array(128);

    const renderSpectrum = () => {
      if (!spectrumCanvasRef.current) {
        animId = requestAnimationFrame(renderSpectrum);
        return;
      }
      const canvas = spectrumCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderSpectrum);
        return;
      }

      soundEngine.getFrequencyData(freqData);
      soundEngine.getTimeDomainData(timeData);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw FFT Frequency Bars (Electric Green & Orange)
      const barWidth = width / freqData.length;
      for (let i = 0; i < freqData.length; i++) {
        const val = freqData[i] / 255;
        const barHeight = val * (height * 0.8);

        ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 255, 65, 0.7)' : 'rgba(255, 62, 0, 0.5)';
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }

      // 2. Overlay Oscilloscope Waveform Line
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      const sliceWidth = width / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0; // 0..2
        const y = (v * height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }
      ctx.stroke();

      animId = requestAnimationFrame(renderSpectrum);
    };

    animId = requestAnimationFrame(renderSpectrum);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMuteToggle = () => {
    soundEngine.init(); // Ensure user gesture unlocked AudioContext
    const newMuted = !config.isMuted;
    soundEngine.setMuted(newMuted);
    setConfig(soundEngine.getConfig());
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    soundEngine.init();
    const val = parseFloat(e.target.value);
    soundEngine.setMasterVolume(val);
    setConfig(soundEngine.getConfig());
  };

  const handleScaleChange = (scaleKey: string) => {
    soundEngine.init();
    soundEngine.setScale(scaleKey);
    setConfig(soundEngine.getConfig());
  };

  const handleReverbChange = (val: number) => {
    soundEngine.init();
    soundEngine.setReverbMix(val);
    setConfig(soundEngine.getConfig());
  };

  const handleDelayChange = (val: number) => {
    soundEngine.init();
    soundEngine.setDelayMix(val);
    setConfig(soundEngine.getConfig());
  };

  const handleFilterChange = (val: number) => {
    soundEngine.init();
    soundEngine.setFilterCutoff(val);
    setConfig(soundEngine.getConfig());
  };

  const handleDroneVolChange = (val: number) => {
    soundEngine.init();
    soundEngine.setDroneVolume(val);
    setConfig(soundEngine.getConfig());
  };

  return (
    <div
      id="audio-controls-container"
      className="flex flex-col h-full bg-[#0a0a0a] border border-[#222] p-4 overflow-y-auto space-y-4"
    >
      {/* Header with Master Audio Switch & Volume */}
      <div id="audio-header" className="flex items-center justify-between pb-3 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-[#00ff41]" />
          <h3 className="text-sm font-bold text-white tracking-wide uppercase font-tech">Acoustic Synthesizer</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="audio-mute-toggle-btn"
            onClick={handleMuteToggle}
            className={`p-2 border transition-all ${
              config.isMuted
                ? 'bg-[#ff3e00]/20 border-[#ff3e00] text-[#ff3e00]'
                : 'bg-[#00ff41]/20 border-[#00ff41] text-[#00ff41]'
            }`}
            title={config.isMuted ? 'Unmute WebAudio' : 'Mute WebAudio'}
          >
            {config.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Live Real-time Oscilloscope & Frequency Spectrum */}
      <div id="spectrum-visualizer-box" className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#888] font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-[#00ff41]">
            <Activity className="w-3.5 h-3.5 text-[#00ff41]" />
            FFT Spectral Oscilloscope
          </span>
          <span className="text-[9px] font-mono text-[#555]">256-BAND WEBAUDIO DSP</span>
        </div>
        <div className="w-full h-24 bg-[#050505] border border-[#222] p-1 flex items-center justify-center">
          <canvas ref={spectrumCanvasRef} width={420} height={90} className="w-full h-full block" />
        </div>
      </div>

      {/* Musical Scale Selection */}
      <div id="musical-scale-box" className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-[#ff3e00]">
            <Radio className="w-3.5 h-3.5 text-[#ff3e00]" />
            Quantization Tuning
          </span>
          <span className="text-[9px] font-mono text-[#888] uppercase">{SCALES[config.scaleKey]?.category}</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(SCALES).map(([key, def]) => {
            const isSelected = config.scaleKey === key;
            return (
              <button
                key={key}
                onClick={() => handleScaleChange(key)}
                className={`flex flex-col items-start p-2 border text-left transition-all font-mono ${
                  isSelected
                    ? 'bg-[#00ff41] border-[#00ff41] text-black'
                    : 'bg-[#050505] border-[#222] text-[#888] hover:text-white hover:border-[#444]'
                }`}
              >
                <span className="text-xs font-bold">{def.name}</span>
                <span className={`text-[9px] truncate w-full ${isSelected ? 'text-black/70' : 'text-[#555]'}`}>
                  {def.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DSP Synthesizer Sliders */}
      <div id="dsp-controls-box" className="space-y-3 pt-2 border-t border-[#222]">
        <div className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-[#888]">
          <Sliders className="w-3.5 h-3.5 text-[#ff3e00]" />
          <span>Soundscape & FX DSP</span>
        </div>

        {/* Master Volume */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#888]">
            <span>Master Volume</span>
            <span className="text-[#00ff41]">{Math.round(config.masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.masterVolume}
            onChange={handleVolumeChange}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>

        {/* Ambient Drone Resonance Volume */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#888]">
            <span>Harmonic Drone Bed</span>
            <span className="text-[#00ff41]">{Math.round(config.droneVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.droneVolume}
            onChange={(e) => handleDroneVolChange(parseFloat(e.target.value))}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>

        {/* Master Filter Cutoff */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#888]">
            <span>Low-Pass Filter Cutoff</span>
            <span className="text-[#ff3e00]">{Math.round(config.filterCutoff)} Hz</span>
          </div>
          <input
            type="range"
            min="400"
            max="10000"
            step="50"
            value={config.filterCutoff}
            onChange={(e) => handleFilterChange(parseFloat(e.target.value))}
            className="w-full accent-[#ff3e00] cursor-pointer"
          />
        </div>

        {/* Algorithmic Reverb Space */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#888]">
            <span>Convolution Reverb</span>
            <span className="text-[#00ff41]">{Math.round(config.reverbMix * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.8"
            step="0.02"
            value={config.reverbMix}
            onChange={(e) => handleReverbChange(parseFloat(e.target.value))}
            className="w-full accent-[#00ff41] cursor-pointer"
          />
        </div>

        {/* Ping-Pong Delay Feedback */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-[#888]">
            <span>Echo / Delay Feedback</span>
            <span className="text-[#ff3e00]">{Math.round(config.delayMix * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.7"
            step="0.02"
            value={config.delayMix}
            onChange={(e) => handleDelayChange(parseFloat(e.target.value))}
            className="w-full accent-[#ff3e00] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
