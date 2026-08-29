import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CircleStop, Play, Radio, RotateCcw } from 'lucide-react';

export interface GrooveTrigger {
  frequencyHz: number;
  amplitude: number;
  durationMs: number;
  waveform: OscillatorType;
}

interface Voice {
  id: string;
  name: string;
  frequencyHz: number;
  amplitude: number;
  durationMs: number;
  waveform: OscillatorType;
  steps: boolean[];
}

interface GrooveBoxProps {
  agentAHz: number;
  agentBHz: number;
  onTrigger: (trigger: GrooveTrigger, injectToWorld: boolean) => void;
}

const STEPS = 16;
const blankSteps = () => Array.from({ length: STEPS }, () => false);

const initialVoices = (): Voice[] => [
  { id: 'v1', name: 'VOICE 1', frequencyHz: 180, amplitude: 0.55, durationMs: 110, waveform: 'sine', steps: blankSteps() },
  { id: 'v2', name: 'VOICE 2', frequencyHz: 330, amplitude: 0.48, durationMs: 90, waveform: 'triangle', steps: blankSteps() },
  { id: 'v3', name: 'VOICE 3', frequencyHz: 620, amplitude: 0.40, durationMs: 75, waveform: 'square', steps: blankSteps() },
  { id: 'v4', name: 'VOICE 4', frequencyHz: 980, amplitude: 0.32, durationMs: 60, waveform: 'sawtooth', steps: blankSteps() },
];

export function GrooveBox({ agentAHz, agentBHz, onTrigger }: GrooveBoxProps) {
  const [voices, setVoices] = useState<Voice[]>(initialVoices);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [bpm, setBpm] = useState(110);
  const [injectToWorld, setInjectToWorld] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const stepRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const intervalMs = 60000 / Math.max(40, Math.min(240, bpm)) / 4;
    const tick = () => {
      const step = stepRef.current;
      for (const voice of voices) {
        if (voice.steps[step]) {
          onTrigger({
            frequencyHz: voice.frequencyHz,
            amplitude: voice.amplitude,
            durationMs: voice.durationMs,
            waveform: voice.waveform,
          }, injectToWorld);
        }
      }
      const next = (step + 1) % STEPS;
      stepRef.current = next;
      setStepIndex(next);
    };
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [playing, bpm, voices, injectToWorld, onTrigger]);

  const updateVoice = (patch: Partial<Voice>) => {
    setVoices(current => current.map((voice, index) => index === selected ? { ...voice, ...patch } : voice));
  };

  const toggleStep = (voiceIndex: number, step: number) => {
    setVoices(current => current.map((voice, index) => {
      if (index !== voiceIndex) return voice;
      const steps = [...voice.steps];
      steps[step] = !steps[step];
      return { ...voice, steps };
    }));
  };

  const clear = () => {
    setPlaying(false);
    stepRef.current = 0;
    setStepIndex(0);
    setVoices(current => current.map(voice => ({ ...voice, steps: blankSteps() })));
  };

  const selectedVoice = voices[selected];

  return (
    <section className="border-b border-[#222] bg-[#070707]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-tech text-xs uppercase tracking-[.18em] text-white">Groovebox / Composer</span>
          <span className="border border-[#6b4d12] bg-[#171105] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-[#d6a93a]">SANDBOX HUMAN INPUT</span>
          <span className="font-mono text-[9px] text-[#666]">excluded from PPO + GAN updates</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPlaying(v => !v)} className={`flex min-h-10 items-center gap-2 border px-3 font-mono text-[10px] uppercase ${playing ? 'border-[#ff3e00] text-[#ff3e00]' : 'border-[#00ff41] text-[#00ff41]'}`}>
            {playing ? <CircleStop className="h-3.5 w-3.5"/> : <Play className="h-3.5 w-3.5"/>}{playing ? 'Stop' : 'Play'}
          </button>
          <button type="button" onClick={clear} className="flex min-h-10 items-center gap-2 border border-[#333] px-3 font-mono text-[10px] uppercase text-[#aaa]"><RotateCcw className="h-3.5 w-3.5"/>Clear</button>
          <button type="button" onClick={() => setExpanded(v => !v)} className="flex min-h-10 items-center gap-2 border border-[#333] px-3 font-mono text-[10px] uppercase text-[#aaa]">{expanded ? <ChevronUp className="h-3.5 w-3.5"/> : <ChevronDown className="h-3.5 w-3.5"/>}{expanded ? 'Collapse' : 'Open'}</button>
        </div>
      </div>

      {expanded && <div className="border-t border-[#181818] px-4 pb-4 pt-3 md:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-mono text-[9px] uppercase text-[#777]">
            BPM
            <input aria-label="Groovebox tempo" type="range" min="40" max="240" value={bpm} onChange={e => setBpm(Number(e.target.value))} className="w-28"/>
            <span className="w-8 text-right text-white">{bpm}</span>
          </label>
          <label className="flex min-h-10 items-center gap-2 font-mono text-[9px] uppercase text-[#777]">
            <input type="checkbox" checked={injectToWorld} onChange={e => setInjectToWorld(e.target.checked)} className="h-4 w-4 accent-[#00ff41]"/>
            <Radio className="h-3.5 w-3.5"/> Inject to live world
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => updateVoice({ frequencyHz: Math.round(agentAHz) })} className="border border-[#174d27] px-2 py-1 font-mono text-[9px] uppercase text-[#00ff41]">Capture Origo A · {Math.round(agentAHz)} Hz</button>
            <button type="button" onClick={() => updateVoice({ frequencyHz: Math.round(agentBHz) })} className="border border-[#5b2517] px-2 py-1 font-mono text-[9px] uppercase text-[#ff6d3a]">Capture Origo B · {Math.round(agentBHz)} Hz</button>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[720px] space-y-1.5">
            {voices.map((voice, voiceIndex) => <div key={voice.id} className="grid grid-cols-[82px_repeat(16,minmax(28px,1fr))] gap-1">
              <button type="button" onClick={() => setSelected(voiceIndex)} className={`border px-2 text-left font-mono text-[9px] uppercase ${selected === voiceIndex ? 'border-[#00ff41] text-[#00ff41]' : 'border-[#292929] text-[#777]'}`}>{voice.name}</button>
              {voice.steps.map((active, step) => <button
                type="button"
                key={step}
                aria-label={`${voice.name} step ${step + 1}`}
                aria-pressed={active}
                onClick={() => toggleStep(voiceIndex, step)}
                className={`h-8 border font-mono text-[8px] ${active ? 'border-[#00ff41] bg-[#00ff41]/25 text-[#00ff41]' : stepIndex === step && playing ? 'border-[#777] bg-[#181818] text-white' : 'border-[#242424] bg-black text-[#444]'}`}
              >{step + 1}</button>)}
            </div>)}
          </div>
        </div>

        <div className="mt-3 grid gap-3 border border-[#222] bg-black p-3 md:grid-cols-4">
          <label className="font-mono text-[9px] uppercase text-[#666]">Frequency · <span className="text-white">{Math.round(selectedVoice.frequencyHz)} Hz</span><input type="range" min="80" max="1600" step="1" value={selectedVoice.frequencyHz} onChange={e => updateVoice({ frequencyHz: Number(e.target.value) })} className="mt-2 w-full"/></label>
          <label className="font-mono text-[9px] uppercase text-[#666]">Amplitude · <span className="text-white">{selectedVoice.amplitude.toFixed(2)}</span><input type="range" min="0.02" max="1" step="0.01" value={selectedVoice.amplitude} onChange={e => updateVoice({ amplitude: Number(e.target.value) })} className="mt-2 w-full"/></label>
          <label className="font-mono text-[9px] uppercase text-[#666]">Duration · <span className="text-white">{Math.round(selectedVoice.durationMs)} ms</span><input type="range" min="30" max="500" step="5" value={selectedVoice.durationMs} onChange={e => updateVoice({ durationMs: Number(e.target.value) })} className="mt-2 w-full"/></label>
          <label className="font-mono text-[9px] uppercase text-[#666]">Waveform<select value={selectedVoice.waveform} onChange={e => updateVoice({ waveform: e.target.value as OscillatorType })} className="mt-2 min-h-10 w-full border border-[#333] bg-[#080808] px-2 text-base text-white md:text-xs"><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option></select></label>
        </div>
      </div>}
    </section>
  );
}
