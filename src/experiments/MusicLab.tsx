import React, { useMemo, useRef, useState } from 'react';
import { coreAudio, CoreWaveform } from '../audio/coreAudio';
import { LineageRecord } from '../core/doctrine';

const FREQ_BINS = 12;
const DURATIONS = [0.09, 0.18, 0.34];
const SOURCES: { id: CoreWaveform; label: string }[] = [
  { id: 'sine', label: 'Sine' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'square', label: 'Square' },
  { id: 'noise', label: 'Noise' },
];
const TOKENS = SOURCES.length * FREQ_BINS * DURATIONS.length;
const START = TOKENS;
const SONG_LEN = 24;

type Genome = LineageRecord & { tokens: number[]; score: number };

function frequencyFor(bin: number) {
  const low = 70;
  const high = 1600;
  return low * Math.pow(high / low, bin / (FREQ_BINS - 1));
}

function decode(token: number) {
  const durationIndex = token % DURATIONS.length;
  const f = Math.floor(token / DURATIONS.length);
  const freqBin = f % FREQ_BINS;
  const sourceIndex = Math.floor(f / FREQ_BINS) % SOURCES.length;
  return { sourceIndex, freqBin, durationIndex };
}

function argmax(values: Float64Array, legal: number[]) {
  let best = -Infinity;
  let picks: number[] = [];
  for (const i of legal) {
    if (values[i] > best + 1e-12) { best = values[i]; picks = [i]; }
    else if (Math.abs(values[i] - best) <= 1e-12) picks.push(i);
  }
  return picks[Math.floor(Math.random() * picks.length)] ?? legal[0] ?? 0;
}

export default function MusicLab() {
  const composer = useRef(new Map<number, Float64Array>());
  const predictor = useRef(new Map<number, Float64Array>());
  const [episodes, setEpisodes] = useState(0);
  const [predictorWins, setPredictorWins] = useState(0);
  const [composerWins, setComposerWins] = useState(0);
  const [enabled, setEnabled] = useState([true, true, true, true]);
  const [audioStatus, setAudioStatus] = useState('Audio locked.');
  const [current, setCurrent] = useState<Genome | null>(null);
  const [library, setLibrary] = useState<Genome[]>([]);
  const [, rerender] = useState(0);

  const epsilon = Math.max(0.03, Math.exp(-episodes / 4500));
  const legalTokens = useMemo(() => Array.from({ length: TOKENS }, (_, t) => t).filter((t) => enabled[decode(t).sourceIndex]), [enabled]);

  const qrow = (map: Map<number, Float64Array>, state: number) => {
    let row = map.get(state);
    if (!row) { row = new Float64Array(TOKENS); map.set(state, row); }
    return row;
  };

  const episode = (learn: boolean, greedy = false) => {
    if (!legalTokens.length) return { tokens: [] as number[], cw: 0, pw: 0 };
    let prev = START;
    const tokens: number[] = [];
    let cw = 0, pw = 0;
    const e = greedy ? 0 : epsilon;
    for (let step = 0; step < SONG_LEN; step++) {
      const cRow = qrow(composer.current, prev);
      const pRow = qrow(predictor.current, prev);
      const actual = Math.random() < e ? legalTokens[Math.floor(Math.random() * legalTokens.length)] : argmax(cRow, legalTokens);
      const guess = Math.random() < e ? legalTokens[Math.floor(Math.random() * legalTokens.length)] : argmax(pRow, legalTokens);
      const predictorReward = guess === actual ? 1 : -1;
      const composerReward = -predictorReward;
      if (predictorReward > 0) pw++; else cw++;
      if (learn) {
        const alpha = 0.11;
        cRow[actual] += alpha * (composerReward - cRow[actual]);
        pRow[guess] += alpha * (predictorReward - pRow[guess]);
      }
      tokens.push(actual);
      prev = actual;
    }
    return { tokens, cw, pw };
  };

  const train = (count: number) => {
    let cw = composerWins, pw = predictorWins;
    for (let i = 0; i < count; i++) {
      const r = episode(true);
      cw += r.cw;
      pw += r.pw;
    }
    setComposerWins(cw);
    setPredictorWins(pw);
    setEpisodes((n) => n + count);
    rerender((n) => n + 1);
  };

  const generate = () => {
    const r = episode(false, true);
    const genome: Genome = {
      id: `origo-${Date.now().toString(36)}`,
      origin: 'ORIGO_CORE',
      generation: 1,
      parentIds: [],
      createdAt: Date.now(),
      tokens: r.tokens,
      score: r.cw - r.pw,
    };
    setCurrent(genome);
  };

  const mutate = () => {
    if (!current) return;
    const tokens = current.tokens.map((t) => Math.random() < 0.14 ? legalTokens[Math.floor(Math.random() * legalTokens.length)] : t);
    const child: Genome = {
      ...current,
      id: `origo-${Date.now().toString(36)}`,
      origin: 'ORIGO_DESCENDANT',
      generation: current.generation + 1,
      parentIds: [current.id],
      createdAt: Date.now(),
      tokens,
    };
    setCurrent(child);
  };

  const save = () => {
    if (!current) return;
    setLibrary((items) => [current, ...items.filter((x) => x.id !== current.id)].slice(0, 12));
  };

  const play = async (genome = current) => {
    if (!genome) return;
    if (!coreAudio.isReady()) {
      setAudioStatus('Tap Enable Audio + Test first.');
      return;
    }
    let offsetMs = 0;
    genome.tokens.forEach((token, index) => {
      const d = decode(token);
      const duration = DURATIONS[d.durationIndex];
      const freq = frequencyFor(d.freqBin);
      window.setTimeout(() => coreAudio.playTone(freq, SOURCES[d.sourceIndex].id, duration, 0.16, (index / Math.max(1, genome.tokens.length - 1)) * 1.4 - 0.7), offsetMs);
      offsetMs += Math.round(duration * 1000 + 35);
    });
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-[#050505] text-white">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="border border-[#222] bg-[#0b0b0b] p-4 flex flex-wrap justify-between gap-3 items-center">
          <div>
            <h2 className="text-xl font-black uppercase">Raw Music Lab</h2>
            <p className="text-xs text-[#777] font-mono mt-1">No scales, notes, chords, songs, genres, MIDI, or musical demonstrations. Only raw synthesis controls and self-play rewards.</p>
          </div>
          <button className="px-4 py-3 border border-[#00ff41] text-[#00ff41] font-mono text-xs font-bold uppercase" onClick={async () => { const r = await coreAudio.unlockAndTest(); setAudioStatus(r.message); }}>Enable Audio + Test</button>
        </div>
        <div className="text-xs font-mono text-[#888]">{audioStatus}</div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-4">
          <div className="space-y-4">
            <section className="border border-[#222] bg-black p-4">
              <div className="text-xs uppercase tracking-widest text-[#666] font-mono mb-3">Instrument primitives available to the agents</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SOURCES.map((source, i) => <button key={source.label} onClick={() => setEnabled((old) => old.map((v, j) => j === i ? !v : v))} className={`p-3 border font-mono text-sm ${enabled[i] ? 'border-[#00ff41] text-[#00ff41]' : 'border-[#333] text-[#555]'}`}>{source.label}</button>)}
              </div>
              <p className="text-[11px] text-[#666] font-mono mt-3">Frequency space is logarithmically divided from 70–1600 Hz. Those are raw frequency controls, not a tuning system or scale.</p>
            </section>

            <section className="border border-[#222] bg-black p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button className="btn-core" onClick={() => train(500)}>Train 500</button>
                <button className="btn-core" onClick={() => train(5000)}>Train 5,000</button>
                <button className="btn-core" onClick={generate}>Generate Whole Sequence</button>
                <button className="btn-core" disabled={!current} onClick={() => play()}>Play</button>
                <button className="btn-core" disabled={!current} onClick={mutate}>Mutate Origo Genome</button>
                <button className="btn-core" disabled={!current} onClick={save}>Save Lineage</button>
              </div>
              <div className="grid grid-cols-12 gap-1 min-h-28 items-end">
                {(current?.tokens ?? []).map((token, i) => {
                  const d = decode(token);
                  const height = 18 + (d.freqBin / (FREQ_BINS - 1)) * 85;
                  return <div key={`${token}-${i}`} title={`${SOURCES[d.sourceIndex].label} · ${Math.round(frequencyFor(d.freqBin))} Hz`} className="bg-[#00ff41] opacity-80" style={{ height }} />;
                })}
              </div>
              {current && <div className="text-xs font-mono text-[#888]">{current.id} · {current.origin} · generation {current.generation} · parent {current.parentIds[0] ?? 'none'}</div>}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="border border-[#222] bg-[#0b0b0b] p-4 grid grid-cols-2 gap-4 font-mono">
              <Metric label="Episodes" value={episodes.toLocaleString()} />
              <Metric label="Exploration" value={epsilon.toFixed(3)} />
              <Metric label="Composer points" value={composerWins.toLocaleString()} />
              <Metric label="Predictor points" value={predictorWins.toLocaleString()} />
              <Metric label="Action tokens" value={TOKENS.toString()} />
              <Metric label="Sequence length" value={SONG_LEN.toString()} />
            </div>
            <div className="border border-[#222] bg-[#0b0b0b] p-4 space-y-2">
              <div className="text-xs uppercase tracking-widest text-[#666] font-mono">Origo composition lineage</div>
              {library.length === 0 && <div className="text-xs text-[#555] font-mono">No saved descendants yet.</div>}
              {library.map((g) => <button key={g.id} onClick={() => { setCurrent(g); play(g); }} className="w-full text-left border border-[#222] p-2 hover:border-[#00ff41] font-mono text-xs"><div>{g.id}</div><div className="text-[#666]">gen {g.generation} · {g.origin}</div></button>)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase text-[#666]">{label}</div><div className="text-lg">{value}</div></div>;
}
