import React, { useEffect, useState } from 'react';
import { Download, FileAudio, FileJson, Radio, Square, Trash2 } from 'lucide-react';
import { SimulationEngine } from '../simulation/engine';
import { origoMusicSystem } from '../music/musicSystem';

export function MusicCapturePanel({ engine }: { engine: SimulationEngine }) {
  const [, refresh] = useState(0);
  const [rendering, setRendering] = useState(false);

  useEffect(() => origoMusicSystem.subscribe(() => refresh((v) => v + 1)), []);

  const status = origoMusicSystem.getStatus();
  const hasEvents = status.eventCount > 0;

  const exportWav = async () => {
    setRendering(true);
    try {
      await origoMusicSystem.exportWav();
    } finally {
      setRendering(false);
    }
  };

  return (
    <section className="mt-3 border border-[#222] bg-[#080808] p-3 font-mono">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#777]">World Recorder</p>
          <p className="mt-1 text-xs text-[#bbb]">Behavior → quantized events → real file</p>
        </div>
        <div className={`px-2 py-1 text-[9px] uppercase tracking-widest border ${status.recording ? 'border-[#ff3e00] text-[#ff3e00]' : 'border-[#333] text-[#666]'}`}>
          {status.recording ? 'Recording' : 'Idle'}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="border border-[#1f1f1f] p-2"><div className="text-[#00ff41] text-sm">{status.eventCount}</div><div className="text-[8px] uppercase text-[#555]">Events</div></div>
        <div className="border border-[#1f1f1f] p-2"><div className="text-white text-sm">{status.barsCaptured}</div><div className="text-[8px] uppercase text-[#555]">Bars</div></div>
        <div className="border border-[#1f1f1f] p-2"><div className="text-[#ff3e00] text-sm">{engine.activePreset.soundPreset.tempoBpm}</div><div className="text-[8px] uppercase text-[#555]">BPM</div></div>
      </div>

      <div className="mt-3 flex gap-2">
        {!status.recording ? (
          <button onClick={() => origoMusicSystem.start(engine)} className="flex-1 border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black px-2 py-2 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Radio className="w-3 h-3" /> Capture World
          </button>
        ) : (
          <button onClick={() => origoMusicSystem.stop()} className="flex-1 border border-[#ff3e00] text-[#ff3e00] hover:bg-[#ff3e00] hover:text-black px-2 py-2 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Square className="w-3 h-3" /> Stop Capture
          </button>
        )}
        <button onClick={() => origoMusicSystem.clear()} className="border border-[#333] text-[#777] hover:text-white px-3 py-2" title="Clear captured session"><Trash2 className="w-3 h-3" /></button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button disabled={!hasEvents || rendering} onClick={exportWav} className="disabled:opacity-30 border border-[#333] hover:border-[#00ff41] px-2 py-2 text-[9px] uppercase tracking-wider flex items-center justify-center gap-1"><FileAudio className="w-3 h-3" /> {rendering ? 'Rendering' : 'WAV'}</button>
        <button disabled={!hasEvents} onClick={() => origoMusicSystem.exportMidi()} className="disabled:opacity-30 border border-[#333] hover:border-[#00ff41] px-2 py-2 text-[9px] uppercase tracking-wider flex items-center justify-center gap-1"><Download className="w-3 h-3" /> MIDI</button>
        <button disabled={!hasEvents} onClick={() => origoMusicSystem.exportSessionJson()} className="disabled:opacity-30 border border-[#333] hover:border-[#00ff41] px-2 py-2 text-[9px] uppercase tracking-wider flex items-center justify-center gap-1"><FileJson className="w-3 h-3" /> Session</button>
        <button disabled={!hasEvents} onClick={() => origoMusicSystem.exportAetherManifest()} className="disabled:opacity-30 border border-[#333] hover:border-[#ff3e00] px-2 py-2 text-[9px] uppercase tracking-wider flex items-center justify-center gap-1"><FileJson className="w-3 h-3" /> Aether</button>
      </div>

      <p className="mt-3 text-[9px] leading-relaxed text-[#555]">
        Aether export declares external clock authority: Libertas Desktop/AetherStream stays master while Origo supplies deterministic source material.
      </p>
    </section>
  );
}
