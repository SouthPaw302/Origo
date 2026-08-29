import React, { useMemo, useRef, useState } from 'react';
import { coreAudio } from '../audio/coreAudio';

const TARGETS = ['▲', '●', '■', '◆'];
const SIGNALS = 8;
const SIGNAL_FREQS = [170, 233, 319, 437, 598, 819, 1122, 1537];

type Q = Float64Array[];

function argmax(values: Float64Array) {
  let best = -Infinity;
  let choices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > best + 1e-12) {
      best = values[i];
      choices = [i];
    } else if (Math.abs(values[i] - best) <= 1e-12) choices.push(i);
  }
  return choices[Math.floor(Math.random() * choices.length)] ?? 0;
}

function choose(values: Float64Array, epsilon: number) {
  return Math.random() < epsilon ? Math.floor(Math.random() * values.length) : argmax(values);
}

export default function EchoLanguage() {
  const sender = useRef<Q>(Array.from({ length: 4 }, () => new Float64Array(SIGNALS)));
  const receiver = useRef<Q>(Array.from({ length: SIGNALS }, () => new Float64Array(4)));
  const [episodes, setEpisodes] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [audioStatus, setAudioStatus] = useState('Audio locked. Tap Enable Audio before listening.');
  const [last, setLast] = useState<{ target: number; signal: number; guess: number } | null>(null);
  const [, forceRender] = useState(0);

  const epsilon = Math.max(0.02, Math.exp(-episodes / 3500));
  const accuracy = episodes ? correct / episodes : 0.25;

  const train = (count: number) => {
    let nextCorrect = correct;
    let localEpisodes = episodes;
    for (let n = 0; n < count; n++) {
      const e = Math.max(0.02, Math.exp(-localEpisodes / 3500));
      const target = Math.floor(Math.random() * 4);
      const signal = choose(sender.current[target], e);
      const guess = choose(receiver.current[signal], e);
      const reward = guess === target ? 1 : -1;
      const alpha = 0.16;
      sender.current[target][signal] += alpha * (reward - sender.current[target][signal]);
      receiver.current[signal][guess] += alpha * (reward - receiver.current[signal][guess]);
      localEpisodes++;
      if (reward > 0) nextCorrect++;
    }
    setEpisodes(localEpisodes);
    setCorrect(nextCorrect);
    forceRender((v) => v + 1);
  };

  const watch = () => {
    const target = Math.floor(Math.random() * 4);
    const signal = argmax(sender.current[target]);
    const guess = argmax(receiver.current[signal]);
    setLast({ target, signal, guess });
    if (!coreAudio.playTone(SIGNAL_FREQS[signal], signal % 3 === 0 ? 'sine' : signal % 3 === 1 ? 'triangle' : 'square', 0.3, 0.28)) {
      setAudioStatus('Audio is still locked. Tap Enable Audio + Test.');
    }
  };

  const lexicon = useMemo(
    () => TARGETS.map((target, i) => ({ target, signal: argmax(sender.current[i]) })),
    [episodes],
  );

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-[#050505] text-white">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="border border-[#222] bg-[#0b0b0b] p-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Echo Language</h2>
              <p className="text-xs text-[#777] font-mono mt-1">Two RL agents invent a sonic code. No words, melodies, scales, songs, or demonstrations.</p>
            </div>
            <button
              className="px-4 py-3 border border-[#00ff41] text-[#00ff41] font-mono text-xs font-bold uppercase"
              onClick={async () => {
                const result = await coreAudio.unlockAndTest();
                setAudioStatus(result.message);
              }}
            >
              Enable Audio + Test
            </button>
          </div>
          <p className="text-xs text-[#aaa] mt-3 font-mono">{audioStatus}</p>
        </div>

        <div className="grid md:grid-cols-[1fr_320px] gap-4">
          <div className="border border-[#222] bg-black p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 aspect-square max-w-xl mx-auto">
              {TARGETS.map((g, i) => (
                <div key={g} className={`border flex items-center justify-center text-6xl ${last?.target === i ? 'border-[#00ff41]' : 'border-[#222]'}`}>
                  {g}
                  {last?.guess === i && <span className="absolute text-xs mt-20 text-[#ff3e00]">receiver</span>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <button className="btn-core" onClick={watch}>Watch Communication</button>
              <button className="btn-core" onClick={() => train(1000)}>Train 1,000</button>
              <button className="btn-core" onClick={() => train(10000)}>Train 10,000</button>
            </div>
            {last && (
              <div className="text-center font-mono text-sm text-[#aaa]">
                Sender sees {TARGETS[last.target]} → S{last.signal + 1} ({SIGNAL_FREQS[last.signal]} Hz) → receiver chooses {TARGETS[last.guess]}
                <span className={last.target === last.guess ? ' text-[#00ff41]' : ' text-[#ff3e00]'}> {last.target === last.guess ? 'SUCCESS' : 'FAIL'}</span>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="border border-[#222] bg-[#0b0b0b] p-4 grid grid-cols-2 gap-4 font-mono">
              <Metric label="Episodes" value={episodes.toLocaleString()} />
              <Metric label="Accuracy" value={`${Math.round(accuracy * 100)}%`} />
              <Metric label="Exploration" value={epsilon.toFixed(3)} />
              <Metric label="Signals" value={`${SIGNALS}`} />
            </div>
            <div className="border border-[#222] bg-[#0b0b0b] p-4 space-y-2">
              <div className="text-xs uppercase tracking-widest text-[#777] font-mono">Current invented lexicon</div>
              {lexicon.map((row) => (
                <button
                  key={row.target}
                  onClick={() => coreAudio.playTone(SIGNAL_FREQS[row.signal], row.signal % 2 ? 'triangle' : 'sine', 0.28, 0.25)}
                  className="w-full flex justify-between border border-[#222] px-3 py-2 font-mono text-sm hover:border-[#00ff41]"
                >
                  <span>{row.target}</span><span>S{row.signal + 1}</span><span>{SIGNAL_FREQS[row.signal]} Hz</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase text-[#666]">{label}</div><div className="text-xl text-white">{value}</div></div>;
}
