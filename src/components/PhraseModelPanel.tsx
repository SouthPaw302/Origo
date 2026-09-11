import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Check, Download, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { origoMusicSystem } from '../music/musicSystem';
import { phraseGuidance } from '../models/phraseGuidance';
import { phraseModel } from '../models/musicModelRegistry';
import { PhraseSuggestion } from '../models/types';

function noteName(midi: number) {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const rounded = Math.max(0, Math.min(127, Math.round(midi)));
  return `${names[rounded % 12]}${Math.floor(rounded / 12) - 1}`;
}

export function PhraseModelPanel() {
  const [, forceRefresh] = useState(0);
  const [suggestion, setSuggestion] = useState<PhraseSuggestion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [temperature, setTemperature] = useState(0.9);

  useEffect(() => {
    const refresh = () => forceRefresh((value) => value + 1);
    const unsubModel = phraseModel.subscribe(refresh);
    const unsubMusic = origoMusicSystem.subscribe(refresh);
    return () => {
      unsubModel();
      unsubMusic();
    };
  }, []);

  const modelStatus = phraseModel.getStatus();
  const session = origoMusicSystem.getSession();
  const activeSuggestion = phraseGuidance.getActiveSuggestion();
  const remaining = phraseGuidance.getRemainingEventCount();
  const canSuggest = Boolean(session && session.events.length >= 3 && modelStatus.state === 'ready');

  const preview = useMemo(() => {
    if (!suggestion) return '';
    return suggestion.notes.slice(0, 12).map((note) => noteName(note.pitch)).join(' · ');
  }, [suggestion]);

  const load = async () => {
    try { await phraseModel.load(); }
    catch { /* modelStatus surfaces the error */ }
  };

  const generate = async () => {
    if (!session) return;
    setGenerating(true);
    try {
      const next = await phraseModel.generateFromSession(session, 16, temperature);
      setSuggestion(next);
    } catch {
      // Adapter exposes failures through its status or thrown message; keep UI stable.
    } finally {
      setGenerating(false);
    }
  };

  const accept = () => {
    if (!suggestion) return;
    phraseGuidance.activate(suggestion);
    setSuggestion(null);
    forceRefresh((value) => value + 1);
  };

  const clearGuidance = () => {
    phraseGuidance.clear();
    forceRefresh((value) => value + 1);
  };

  return (
    <section className="border border-[#262626] bg-[#080808] p-3 font-mono">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-[#b283ff]">
            <BrainCircuit className="h-3 w-3" /> Phrase Lab
          </p>
          <p className="mt-1 text-xs font-sans font-medium text-white">Optional melody suggestion</p>
          <p className="mt-1 text-[10px] font-sans leading-relaxed text-[#777]">
            Nothing downloads until you enable it. The model can suggest pitch shapes for Resonators and Gliders; creatures still decide when notes happen, and Origo keeps control of tempo, world state and Aether sync.
          </p>
        </div>
        <span className={`border px-2 py-1 text-[8px] uppercase tracking-widest ${modelStatus.state === 'ready' ? 'border-[#b283ff] text-[#b283ff]' : modelStatus.state === 'error' ? 'border-[#ff3e00] text-[#ff6538]' : 'border-[#333] text-[#666]'}`}>
          {modelStatus.state}
        </span>
      </div>

      {modelStatus.state !== 'ready' ? (
        <div className="mt-3">
          <button
            onClick={load}
            disabled={modelStatus.state === 'loading'}
            className="flex w-full items-center justify-center gap-2 border border-[#b283ff]/70 px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[#b283ff] transition hover:bg-[#b283ff] hover:text-black disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            {modelStatus.state === 'loading' ? 'Loading Phrase Model…' : `Enable Phrase Model · ${modelStatus.downloadLabel}`}
          </button>
          {modelStatus.error && <p className="mt-2 text-[9px] leading-relaxed text-[#ff6538]">{modelStatus.error}</p>}
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-3 border border-[#202020] bg-[#0b0b0b] p-2.5">
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-[#666]">Variation</p>
              <p className="mt-0.5 text-[10px] font-sans text-[#999]">Lower is safer · higher is stranger</p>
            </div>
            <div className="flex items-center gap-2">
              <input aria-label="Phrase variation" type="range" min="0.45" max="1.35" step="0.05" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} className="w-24" />
              <span className="w-8 text-right text-[9px] text-[#b283ff]">{temperature.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={!canSuggest || generating}
            className="mt-2 flex w-full items-center justify-center gap-2 border border-[#b283ff]/70 bg-[#b283ff]/5 px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[#b283ff] transition hover:bg-[#b283ff] hover:text-black disabled:opacity-30"
          >
            {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? 'Thinking…' : 'Suggest Phrase Variation'}
          </button>
          {!canSuggest && !generating && <p className="mt-1.5 text-[9px] font-sans text-[#666]">Record at least three Resonator/Glider melody events first.</p>}
        </>
      )}

      {suggestion && (
        <div className="mt-3 border border-[#b283ff]/35 bg-[#120d18] p-2.5">
          <p className="text-[8px] uppercase tracking-widest text-[#b283ff]">Candidate contour</p>
          <p className="mt-2 break-words text-[10px] leading-relaxed text-[#ddd]">{preview}</p>
          <p className="mt-1 text-[8px] text-[#666]">Seeded from {suggestion.seedEventCount} ecosystem melody events · {suggestion.notes.length} suggested notes</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={accept} className="flex items-center justify-center gap-1.5 border border-[#00ff41]/70 px-2 py-2 text-[8px] font-bold uppercase tracking-wider text-[#00ff41] hover:bg-[#00ff41] hover:text-black"><Check className="h-3 w-3" /> Guide Next Phrase</button>
            <button onClick={() => setSuggestion(null)} className="flex items-center justify-center gap-1.5 border border-[#333] px-2 py-2 text-[8px] uppercase tracking-wider text-[#888] hover:text-white"><X className="h-3 w-3" /> Reject</button>
          </div>
        </div>
      )}

      {activeSuggestion && remaining > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 border border-[#00ff41]/30 bg-[#00ff41]/5 p-2.5">
          <div>
            <p className="text-[8px] uppercase tracking-widest text-[#00ff41]">Guidance armed</p>
            <p className="mt-0.5 text-[10px] font-sans text-[#888]">The next {remaining} Resonator/Glider events may inherit its pitch contour. Timing stays ecosystem-driven.</p>
          </div>
          <button onClick={clearGuidance} className="p-2 text-[#666] hover:text-[#ff6538]" title="Clear phrase guidance"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {modelStatus.state === 'ready' && (
        <button onClick={() => phraseModel.unload()} className="mt-2 text-[8px] uppercase tracking-widest text-[#555] hover:text-[#999]">Unload optional model</button>
      )}
    </section>
  );
}
