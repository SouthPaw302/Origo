import React, { useEffect, useState } from 'react';
import { Download, FileAudio, FileJson, Link2, Radio, Square, Trash2 } from 'lucide-react';
import { SimulationEngine } from '../simulation/engine';
import { origoMusicSystem } from '../music/musicSystem';
import { InstrumentPanel } from './InstrumentPanel';
import { MusicalAnalysisPanel } from './MusicalAnalysisPanel';

export function MusicCapturePanel({ engine }: { engine: SimulationEngine }) {
  const [, refresh] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => origoMusicSystem.subscribe(() => refresh((v) => v + 1)), []);

  const status = origoMusicSystem.getStatus();
  const hasEvents = status.eventCount > 0;

  const exportWav = async () => {
    setRendering(true);
    try { await origoMusicSystem.exportWav(); }
    finally { setRendering(false); }
  };

  return (
    <div className="space-y-3">
      <section className="border border-[#262626] bg-[#080808] p-3 font-mono">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#777]">World Recorder</p>
            <p className="mt-1 text-xs font-sans font-medium text-white">Capture this ecosystem as a real track</p>
            <p className="mt-1 text-[10px] font-sans leading-relaxed text-[#777]">Origo remembers the musical events and recurring motifs so the world can develop recognizable ideas instead of only producing isolated sounds.</p>
          </div>
          <div className={`flex items-center gap-1.5 border px-2 py-1 text-[8px] uppercase tracking-widest ${status.recording ? 'border-[#ff3e00] text-[#ff3e00]' : 'border-[#333] text-[#666]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.recording ? 'bg-[#ff3e00] animate-pulse' : 'bg-[#444]'}`} />
            {status.recording ? 'Recording' : hasEvents ? 'Captured' : 'Ready'}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <RecorderStat value={status.eventCount} label="Events" accent="text-[#00ff41]" />
          <RecorderStat value={status.barsCaptured} label="Bars" accent="text-white" />
          <RecorderStat value={status.motifCount} label="Motifs" accent="text-[#b283ff]" />
          <RecorderStat value={engine.activePreset.soundPreset.tempoBpm} label="BPM" accent="text-[#ff6538]" />
        </div>

        <div className="mt-3 flex gap-2">
          {!status.recording ? (
            <button onClick={() => origoMusicSystem.start(engine)} className="flex flex-1 items-center justify-center gap-1.5 border border-[#00ff41] bg-[#00ff41] px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-black transition hover:bg-[#62ff86]">
              <Radio className="h-3.5 w-3.5" /> {hasEvents ? 'Record New Take' : 'Start Recording'}
            </button>
          ) : (
            <button onClick={() => origoMusicSystem.stop()} className="flex flex-1 items-center justify-center gap-1.5 border border-[#ff3e00] bg-[#ff3e00]/10 px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[#ff3e00] transition hover:bg-[#ff3e00] hover:text-black">
              <Square className="h-3.5 w-3.5" /> Stop & Keep Take
            </button>
          )}
          <button onClick={() => origoMusicSystem.clear()} disabled={!hasEvents && !status.recording} className="border border-[#333] px-3 py-2 text-[#777] transition hover:text-white disabled:opacity-30" title="Clear captured session"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>

        {hasEvents && !status.recording && (
          <div className="mt-3 border-t border-[#222] pt-3">
            <p className="mb-2 text-[8px] uppercase tracking-[0.18em] text-[#666]">Export this take</p>
            <div className="grid grid-cols-3 gap-2">
              <ExportButton disabled={rendering} onClick={exportWav} icon={<FileAudio className="h-3 w-3" />} label={rendering ? 'Rendering' : 'WAV'} primary />
              <ExportButton onClick={() => origoMusicSystem.exportMidi()} icon={<Download className="h-3 w-3" />} label="MIDI" />
              <ExportButton onClick={() => origoMusicSystem.exportSessionJson()} icon={<FileJson className="h-3 w-3" />} label="Session" />
            </div>
          </div>
        )}

        <button onClick={() => setShowAdvanced((value) => !value)} className="mt-3 flex w-full items-center justify-between border-t border-[#202020] pt-2 text-left text-[8px] uppercase tracking-[0.16em] text-[#555] hover:text-[#999]">
          <span>Libertas / AetherStream</span><span>{showAdvanced ? '−' : '+'}</span>
        </button>
        {showAdvanced && (
          <div className="mt-2 border border-[#202020] bg-[#0b0b0b] p-2.5">
            <p className="font-sans text-[10px] leading-relaxed text-[#777]">For the LibertasDJ/Desktop pipeline. Desktop remains the authoritative musical clock; Origo provides deterministic source/session data and motif lineage.</p>
            <button disabled={!hasEvents} onClick={() => origoMusicSystem.exportAetherManifest()} className="mt-2 flex w-full items-center justify-center gap-1.5 border border-[#333] px-2 py-2 text-[8px] uppercase tracking-wider text-[#aaa] hover:border-[#ff3e00] hover:text-[#ff6538] disabled:opacity-30"><Link2 className="h-3 w-3" /> Export Aether Manifest</button>
          </div>
        )}
      </section>

      <InstrumentPanel />
      <MusicalAnalysisPanel />
    </div>
  );
}

function RecorderStat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return <div className="border border-[#1f1f1f] bg-[#0b0b0b] p-2"><div className={`text-sm ${accent}`}>{value}</div><div className="text-[7px] uppercase tracking-widest text-[#555]">{label}</div></div>;
}

function ExportButton({ onClick, icon, label, disabled = false, primary = false }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean; primary?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className={`flex items-center justify-center gap-1 border px-2 py-2 text-[8px] uppercase tracking-wider transition disabled:opacity-30 ${primary ? 'border-[#00ff41]/60 text-[#00ff41] hover:bg-[#00ff41] hover:text-black' : 'border-[#333] text-[#aaa] hover:border-[#00ff41] hover:text-[#00ff41]'}`}>{icon}{label}</button>;
}
