import React, { useEffect, useRef, useState } from 'react';
import { FileMusic, Piano, Upload, X } from 'lucide-react';
import { SpeciesType } from '../types';
import { InstrumentMode, soundFontInstrumentEngine } from '../audio/soundfontInstrumentEngine';

const SPECIES_LABEL: Record<SpeciesType, string> = {
  [SpeciesType.Resonator]: 'Resonator',
  [SpeciesType.Predator]: 'Predator',
  [SpeciesType.Architect]: 'Architect',
  [SpeciesType.Glider]: 'Glider',
};

const ROLE_LABEL: Record<SpeciesType, string> = {
  [SpeciesType.Resonator]: 'Bell / mallet role',
  [SpeciesType.Predator]: 'Bass role',
  [SpeciesType.Architect]: 'Strings / pad role',
  [SpeciesType.Glider]: 'Lead / flute role',
};

export function InstrumentPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [, refresh] = useState(0);
  const [showPrograms, setShowPrograms] = useState(false);
  const status = soundFontInstrumentEngine.getStatus();

  useEffect(() => soundFontInstrumentEngine.subscribe(() => refresh((value) => value + 1)), []);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      await soundFontInstrumentEngine.loadFile(file);
    } catch {
      // Error state is exposed by the engine and rendered below.
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="border border-[#262626] bg-[#080808] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#777]">Real Instruments</p>
          <p className="mt-1 text-xs font-medium text-white">Add a SoundFont to the ecosystem</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#777]">Load your own SF2/SF3/DLS bank locally. The file stays in this browser session and Origo keeps its native synth as a fallback.</p>
        </div>
        <Piano className={`h-4 w-4 flex-shrink-0 ${status.ready ? 'text-[#b283ff]' : 'text-[#444]'}`} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".sf2,.sf3,.sfogg,.dls"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />

      {!status.ready ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status.loading}
          className="mt-3 flex w-full items-center justify-center gap-2 border border-[#b283ff]/60 bg-[#120d18] px-3 py-2.5 font-mono text-[9px] uppercase tracking-wider text-[#c9a6ff] transition hover:border-[#b283ff] hover:bg-[#1b1225] disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" /> {status.loading ? 'Loading SoundFont…' : 'Load SoundFont'}
        </button>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2 border border-[#2b2235] bg-[#100d14] px-3 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[10px] text-[#ddd]"><FileMusic className="h-3 w-3 flex-shrink-0 text-[#b283ff]" /> {status.fileName}</p>
            <p className="mt-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6f5a7e]">Loaded locally · ready</p>
          </div>
          <button onClick={() => void soundFontInstrumentEngine.unload()} className="p-1.5 text-[#666] hover:text-white" title="Unload SoundFont"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {status.error && <p className="mt-2 border border-[#ff3e00]/30 bg-[#1a0905] p-2 text-[9px] leading-relaxed text-[#ff7653]">{status.error}</p>}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <ModeButton label="Native" mode="native" active={status.mode === 'native'} onClick={() => soundFontInstrumentEngine.setMode('native')} />
        <ModeButton label="Hybrid" mode="hybrid" active={status.mode === 'hybrid'} disabled={!status.ready} onClick={() => soundFontInstrumentEngine.setMode('hybrid')} />
        <ModeButton label="Instruments" mode="instruments" active={status.mode === 'instruments'} disabled={!status.ready} onClick={() => soundFontInstrumentEngine.setMode('instruments')} />
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-[#666]">
        {status.mode === 'native' && 'Native keeps Origo’s procedural ecosystem synth only.'}
        {status.mode === 'hybrid' && 'Hybrid layers the SoundFont instruments over Origo’s procedural synth.'}
        {status.mode === 'instruments' && 'Instruments uses the loaded SoundFont for governed creature events while keeping utility chimes available.'}
      </p>

      {status.ready && (
        <>
          <button onClick={() => setShowPrograms((value) => !value)} className="mt-3 flex w-full items-center justify-between border-t border-[#202020] pt-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#555] hover:text-[#999]">
            <span>Species instrument programs</span><span>{showPrograms ? '−' : '+'}</span>
          </button>
          {showPrograms && (
            <div className="mt-2 space-y-1.5">
              {Object.values(SpeciesType).map((species) => (
                <label key={species} className="flex items-center justify-between gap-2 border border-[#202020] bg-[#0b0b0b] px-2.5 py-2">
                  <span className="min-w-0"><span className="block text-[9px] text-[#ccc]">{SPECIES_LABEL[species]}</span><span className="block text-[8px] text-[#555]">{ROLE_LABEL[species]}</span></span>
                  <input
                    aria-label={`${SPECIES_LABEL[species]} MIDI program`}
                    type="number"
                    min="0"
                    max="127"
                    value={status.programs[species]}
                    onChange={(event) => soundFontInstrumentEngine.setProgram(species, Number(event.target.value))}
                    className="w-16 border border-[#333] bg-black px-2 py-1 text-right font-mono text-[9px] text-white outline-none focus:border-[#b283ff]"
                  />
                </label>
              ))}
              <p className="px-1 text-[8px] leading-relaxed text-[#555]">Programs use MIDI values 0–127. Available timbres depend on the SoundFont you loaded.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ModeButton({ label, mode, active, disabled, onClick }: { label: string; mode: InstrumentMode; active: boolean; disabled?: boolean; onClick: () => void }) {
  void mode;
  return <button disabled={disabled} onClick={onClick} className={`border px-1.5 py-2 font-mono text-[8px] uppercase tracking-wider transition disabled:opacity-25 ${active ? 'border-[#b283ff] bg-[#b283ff]/10 text-[#c9a6ff]' : 'border-[#2a2a2a] text-[#777] hover:text-white'}`}>{label}</button>;
}
