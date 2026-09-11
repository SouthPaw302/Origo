import React, { useEffect, useRef, useState } from 'react';
import { Download, Layers3, Pause, Play, Repeat2, Upload, X } from 'lucide-react';
import { SpeciesType } from '../types';
import { loadOrigoCc0StarterBank } from '../audio/builtInSampleBank';
import { sampleInstrumentEngine } from '../audio/sampleInstrumentEngine';

const SPECIES_LABEL: Record<SpeciesType, string> = {
  [SpeciesType.Resonator]: 'Resonator',
  [SpeciesType.Predator]: 'Predator',
  [SpeciesType.Architect]: 'Architect',
  [SpeciesType.Glider]: 'Glider',
};

const SAMPLE_HINT: Record<SpeciesType, string> = {
  [SpeciesType.Resonator]: 'mallet, piano, pluck, bell',
  [SpeciesType.Predator]: 'bass note, kick, low drum',
  [SpeciesType.Architect]: 'cello, guitar, sustained string',
  [SpeciesType.Glider]: 'fiddle, flute, lead, bright pluck',
};

export function SampleRackPanel() {
  const [, refresh] = useState(0);
  const loopInput = useRef<HTMLInputElement | null>(null);
  const speciesInputs = useRef<Partial<Record<SpeciesType, HTMLInputElement | null>>>({});
  const [loopBpm, setLoopBpm] = useState(100);
  const [loopBars, setLoopBars] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [starterLoading, setStarterLoading] = useState(false);
  const [starterProgress, setStarterProgress] = useState('');

  useEffect(() => sampleInstrumentEngine.subscribe(() => refresh((value) => value + 1)), []);
  const status = sampleInstrumentEngine.getStatus();

  const loadSpecies = async (species: SpeciesType, file?: File) => {
    if (!file) return;
    setError(null);
    try {
      await sampleInstrumentEngine.loadSpeciesSample(species, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sample.');
    } finally {
      const input = speciesInputs.current[species];
      if (input) input.value = '';
    }
  };

  const loadStarter = async () => {
    setStarterLoading(true);
    setStarterProgress('0 / 4');
    setError(null);
    try {
      await loadOrigoCc0StarterBank((loaded, total) => setStarterProgress(`${loaded} / ${total}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the CC0 starter bank.');
    } finally {
      setStarterLoading(false);
    }
  };

  const loadLoop = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      await sampleInstrumentEngine.loadAetherLoop(file, loopBpm, loopBars);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load loop.');
    } finally {
      if (loopInput.current) loopInput.current.value = '';
    }
  };

  return (
    <section className="border border-[#262626] bg-[#080808] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#ffb24a]"><Layers3 className="h-3 w-3" /> Sample Rack</p>
          <p className="mt-1 text-xs font-medium text-white">Recorded instruments + recursive song loop</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#777]">Use actual recorded instrument WAVs. Origo pitch-shifts them from a root note, but event timing still comes from the ecosystem.</p>
        </div>
        <button onClick={() => sampleInstrumentEngine.setEnabled(!status.enabled)} className={`border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${status.enabled ? 'border-[#00ff41]/50 text-[#00ff41]' : 'border-[#333] text-[#666]'}`}>{status.enabled ? 'On' : 'Off'}</button>
      </div>

      <button disabled={starterLoading} onClick={loadStarter} className="mt-3 flex w-full items-center justify-center gap-2 border border-[#00ff41]/45 bg-[#00ff41]/5 px-3 py-2.5 font-mono text-[8px] font-bold uppercase tracking-wider text-[#70ff91] hover:bg-[#00ff41] hover:text-black disabled:opacity-40">
        <Download className="h-3.5 w-3.5" /> {starterLoading ? `Loading CC0 instruments ${starterProgress}` : 'Load Origo CC0 Starter Bank · ~4 MB'}
      </button>
      <p className="mt-1.5 text-[8px] leading-relaxed text-[#555]">Lazy-loads four public-domain VSCO 2 CE recordings: violin pizzicato, cello pizzicato, sustained cello and flute staccato. You can replace any slot with your own recording.</p>

      <div className="mt-3 space-y-1.5">
        {Object.values(SpeciesType).map((species) => {
          const slot = status.species[species];
          return (
            <div key={species} className="border border-[#202020] bg-[#0b0b0b] p-2">
              <input
                ref={(node) => { speciesInputs.current[species] = node; }}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac"
                className="hidden"
                onChange={(event) => void loadSpecies(species, event.target.files?.[0])}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] text-[#ddd]">{SPECIES_LABEL[species]}</p>
                  <p className="truncate text-[8px] text-[#555]">{slot.fileName || SAMPLE_HINT[species]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-1 text-[7px] text-[#555]">ROOT
                    <input type="number" min="0" max="127" value={slot.rootMidi} onChange={(event) => sampleInstrumentEngine.setRootMidi(species, Number(event.target.value))} className="w-11 border border-[#333] bg-black px-1 py-1 text-right font-mono text-[8px] text-white" />
                  </label>
                  <button onClick={() => speciesInputs.current[species]?.click()} className="p-1.5 text-[#888] hover:text-[#ffb24a]" title="Load recorded sample"><Upload className="h-3 w-3" /></button>
                  {slot.ready && <button onClick={() => sampleInstrumentEngine.clearSpeciesSample(species)} className="p-1.5 text-[#666] hover:text-[#ff6538]" title="Clear sample"><X className="h-3 w-3" /></button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-[#222] pt-3">
        <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-widest text-[#777]"><Repeat2 className="h-3 w-3" /> Aether Return Loop</div>
        <p className="mt-1 text-[9px] leading-relaxed text-[#666]">A previous Origo render or a future Libertas/Aether stem can come back here and loop underneath the next generation.</p>
        <input ref={loopInput} type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac" className="hidden" onChange={(event) => void loadLoop(event.target.files?.[0])} />
        <div className="mt-2 grid grid-cols-[1fr_54px_42px] gap-1.5">
          <button onClick={() => loopInput.current?.click()} className="truncate border border-[#333] px-2 py-2 text-left font-mono text-[8px] text-[#aaa] hover:border-[#ffb24a] hover:text-[#ffb24a]">{status.aetherLoop.fileName || 'Load external loop / stem'}</button>
          <input aria-label="Loop BPM" type="number" min="30" max="300" value={loopBpm} onChange={(event) => setLoopBpm(Number(event.target.value))} className="border border-[#333] bg-black px-1 text-center font-mono text-[8px] text-white" title="Source BPM" />
          <input aria-label="Loop bars" type="number" min="1" max="32" value={loopBars} onChange={(event) => setLoopBars(Number(event.target.value))} className="border border-[#333] bg-black px-1 text-center font-mono text-[8px] text-white" title="Bars" />
        </div>

        {status.aetherLoop.ready && (
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => status.aetherLoop.playing ? sampleInstrumentEngine.stopAetherLoop() : sampleInstrumentEngine.startAetherLoop()} className="flex flex-1 items-center justify-center gap-1.5 border border-[#ffb24a]/60 px-2 py-2 font-mono text-[8px] uppercase tracking-wider text-[#ffb24a] hover:bg-[#ffb24a] hover:text-black">
              {status.aetherLoop.playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {status.aetherLoop.playing ? 'Stop Return Loop' : 'Play Return Loop'}
            </button>
            <button onClick={() => sampleInstrumentEngine.clearAetherLoop()} className="border border-[#333] p-2 text-[#666] hover:text-[#ff6538]" title="Clear return loop"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 border border-[#ff3e00]/30 bg-[#1a0905] p-2 text-[9px] leading-relaxed text-[#ff7653]">{error}</p>}
    </section>
  );
}
