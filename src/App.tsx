import React, { useEffect, useRef, useState } from 'react';
import { Activity, Brain, FastForward, Pause, Play, Radio, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { CommunicationEngine, TrainMetrics } from './cleanroom/communication';

type AudioState = 'locked' | 'ready' | 'failed';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function App() {
  const [seed, setSeed] = useState(302);
  const engineRef = useRef(new CommunicationEngine(seed));
  const [metrics, setMetrics] = useState<TrainMetrics>(() => engineRef.current.metrics());
  const [running, setRunning] = useState(true);
  const [demoChannel, setDemoChannel] = useState(true);
  const [audioState, setAudioState] = useState<AudioState>('locked');
  const audioContextRef = useRef<AudioContext | null>(null);
  const [demo, setDemo] = useState(() => engineRef.current.demo(true));

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setMetrics(engineRef.current.trainBatch(256));
    }, 80);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = engineRef.current.demo(demoChannel);
      setDemo(next);
      if (audioState === 'ready' && demoChannel) playTone(next.signalHz);
    }, 650);
    return () => window.clearInterval(timer);
  }, [demoChannel, audioState]);

  const playTone = (frequency: number) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  };

  const enableAudio = async () => {
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error('WebAudio unavailable');
      const ctx = audioContextRef.current ?? new AudioCtor();
      audioContextRef.current = ctx;
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error(`AudioContext ${ctx.state}`);
      setAudioState('ready');
      playTone(demo.signalHz);
    } catch {
      setAudioState('failed');
    }
  };

  const fastTrain = () => {
    let next = metrics;
    for (let i = 0; i < 40; i++) next = engineRef.current.trainBatch(512);
    setMetrics(next);
    setDemo(engineRef.current.demo(demoChannel));
  };

  const reset = () => {
    const nextSeed = seed || 302;
    engineRef.current = new CommunicationEngine(nextSeed);
    setMetrics(engineRef.current.metrics());
    setDemo(engineRef.current.demo(demoChannel));
  };

  const passed = metrics.successOn > 0.85 && metrics.successOff < 0.6;

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] p-3 md:p-5">
      <div className="mx-auto max-w-7xl border border-[#222] bg-[#090909] min-h-[calc(100vh-24px)] flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222] px-5 py-4 bg-[#0c0c0c]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-black italic uppercase tracking-tight">Origo Core</h1>
              <span className="border border-[#00ff41] px-2 py-1 text-[9px] font-mono tracking-widest text-[#00ff41]">CLEAN ROOM</span>
            </div>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-[#666]">Zero human behavior data · continuous acoustic self-learning</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRunning(v => !v)} className="flex items-center gap-2 border border-[#333] bg-black px-3 py-2 text-xs font-mono uppercase hover:border-[#00ff41]">
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {running ? 'Pause' : 'Auto Learn'}
            </button>
            <button onClick={fastTrain} className="flex items-center gap-2 border border-[#00ff41] bg-[#00ff41]/10 px-3 py-2 text-xs font-mono uppercase text-[#00ff41]">
              <FastForward className="h-4 w-4" /> Fast Train
            </button>
            <button onClick={enableAudio} className={`flex items-center gap-2 border px-3 py-2 text-xs font-mono uppercase ${audioState === 'ready' ? 'border-[#00ff41] text-[#00ff41]' : audioState === 'failed' ? 'border-[#ff3e00] text-[#ff3e00]' : 'border-[#555] text-[#aaa]'}`}>
              {audioState === 'ready' ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {audioState === 'ready' ? 'Audio Ready' : audioState === 'failed' ? 'Audio Failed' : 'Enable Audio'}
            </button>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
          <section className="relative min-h-[520px] overflow-hidden border-b border-[#222] bg-grid-pattern lg:border-b-0 lg:border-r">
            <div className="absolute left-5 top-5 flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-wider z-10">
              <span className="border border-[#333] bg-black/80 px-2 py-1">Real PPO</span>
              <span className="border border-[#333] bg-black/80 px-2 py-1">No signal IDs</span>
              <span className="border border-[#333] bg-black/80 px-2 py-1">Seed {seed}</span>
            </div>

            <svg viewBox="0 0 900 560" className="h-full min-h-[520px] w-full">
              <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <rect x="55" y="55" width="790" height="450" fill="none" stroke="#222" strokeWidth="2" />

              <circle cx="720" cy="170" r="46" fill={demo.hiddenState === -1 ? '#00ff4122' : '#0b0b0b'} stroke={demo.hiddenState === -1 ? '#00ff41' : '#333'} strokeWidth="2" />
              <text x="720" y="176" textAnchor="middle" fill={demo.hiddenState === -1 ? '#00ff41' : '#666'} fontFamily="monospace" fontSize="16">TARGET A</text>
              <circle cx="720" cy="390" r="46" fill={demo.hiddenState === 1 ? '#ff3e0022' : '#0b0b0b'} stroke={demo.hiddenState === 1 ? '#ff3e00' : '#333'} strokeWidth="2" />
              <text x="720" y="396" textAnchor="middle" fill={demo.hiddenState === 1 ? '#ff3e00' : '#666'} fontFamily="monospace" fontSize="16">TARGET B</text>

              <circle cx="220" cy="280" r="40" fill="#06120a" stroke="#00ff41" strokeWidth="3" filter="url(#glow)" />
              <text x="220" y="275" textAnchor="middle" fill="#fff" fontFamily="monospace" fontSize="15">AGENT A</text>
              <text x="220" y="295" textAnchor="middle" fill="#00ff41" fontFamily="monospace" fontSize="11">SEES TARGET</text>

              <circle cx="520" cy="280" r="40" fill="#140805" stroke="#ff3e00" strokeWidth="3" filter="url(#glow)" />
              <text x="520" y="275" textAnchor="middle" fill="#fff" fontFamily="monospace" fontSize="15">AGENT B</text>
              <text x="520" y="295" textAnchor="middle" fill="#ff3e00" fontFamily="monospace" fontSize="11">HEARS ONLY</text>

              {demoChannel && <>
                {[0, 1, 2].map(i => <circle key={i} cx="220" cy="280" r={70 + i * 48} fill="none" stroke="#00ff41" strokeOpacity={0.5 - i * 0.12} strokeWidth="2" />)}
                <line x1="260" y1="280" x2="480" y2="280" stroke="#00ff41" strokeOpacity=".7" strokeDasharray="8 8" />
              </>}

              <path d={demo.choice === -1 ? 'M 555 265 Q 640 205 682 180' : 'M 555 295 Q 640 355 682 380'} fill="none" stroke={demo.correct ? '#00ff41' : '#ff3e00'} strokeWidth="4" />
              <text x="350" y="250" textAnchor="middle" fill={demoChannel ? '#00ff41' : '#555'} fontFamily="monospace" fontSize="14">{demoChannel ? `${Math.round(demo.signalHz)} Hz` : 'CHANNEL OFF'}</text>
            </svg>

            <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="border border-[#222] bg-black/80 p-3"><div className="text-[#666] text-[9px] uppercase">Hidden state</div><div className="mt-1">{demo.hiddenState === -1 ? 'TARGET A' : 'TARGET B'}</div></div>
              <div className="border border-[#222] bg-black/80 p-3"><div className="text-[#666] text-[9px] uppercase">Invented signal</div><div className="mt-1 text-[#00ff41]">{Math.round(demo.signalHz)} Hz</div></div>
              <div className="border border-[#222] bg-black/80 p-3"><div className="text-[#666] text-[9px] uppercase">Receiver choice</div><div className={`mt-1 ${demo.correct ? 'text-[#00ff41]' : 'text-[#ff3e00]'}`}>{demo.choice === -1 ? 'TARGET A' : 'TARGET B'}</div></div>
            </div>
          </section>

          <aside className="bg-[#0a0a0a] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-[#00ff41]"/><span className="font-tech text-sm uppercase">Learning Core</span></div>
              <span className={`text-[9px] font-mono px-2 py-1 border ${passed ? 'border-[#00ff41] text-[#00ff41]' : 'border-[#555] text-[#888]'}`}>{passed ? 'COMMUNICATION PASS' : 'LEARNING'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Acoustic ON" value={pct(metrics.successOn)} strong />
              <Metric label="Acoustic OFF" value={pct(metrics.successOff)} />
              <Metric label="PPO updates" value={metrics.update.toLocaleString()} />
              <Metric label="Episodes" value={metrics.episodes.toLocaleString()} />
              <Metric label="Batch success" value={pct(metrics.batchSuccess)} />
              <Metric label="Signal gap" value={`${Math.round(metrics.signalGapHz)} Hz`} />
            </div>

            <div className="border border-[#222] bg-[#070707] p-3 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#888]"><Radio className="h-3.5 w-3.5 text-[#00ff41]"/> Protocol discovered</div>
              <div className="flex items-center justify-between font-mono text-xs"><span className="text-[#777]">Target A</span><span className="text-[#00ff41]">{Math.round(metrics.leftHz)} Hz</span></div>
              <div className="flex items-center justify-between font-mono text-xs"><span className="text-[#777]">Target B</span><span className="text-[#ff3e00]">{Math.round(metrics.rightHz)} Hz</span></div>
              <div className="h-1 bg-[#151515] overflow-hidden"><div className="h-full bg-[#00ff41]" style={{ width: `${Math.min(100, metrics.signalGapHz / 10.8)}%` }} /></div>
            </div>

            <button onClick={() => setDemoChannel(v => !v)} className={`w-full flex items-center justify-between border p-3 font-mono text-xs uppercase ${demoChannel ? 'border-[#00ff41] text-[#00ff41]' : 'border-[#ff3e00] text-[#ff3e00]'}`}>
              <span>Demo acoustic channel</span><span>{demoChannel ? 'ON' : 'OFF'}</span>
            </button>

            <div className="border border-[#222] p-3 space-y-2">
              <label className="text-[9px] font-mono uppercase text-[#666]">Deterministic seed</label>
              <div className="flex gap-2">
                <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} className="min-w-0 flex-1 border border-[#333] bg-black px-3 py-2 font-mono text-sm outline-none focus:border-[#00ff41]" />
                <button onClick={reset} title="Reset from seed" className="border border-[#333] px-3 hover:border-[#00ff41]"><RotateCcw className="h-4 w-4"/></button>
              </div>
            </div>

            <div className="border border-[#222] bg-black p-3 text-[10px] font-mono leading-relaxed text-[#777]">
              <div className="mb-2 flex items-center gap-2 text-[#aaa]"><Activity className="h-3.5 w-3.5"/> TEST</div>
              A sees one hidden bit. B never sees it. A may emit only a continuous frequency. B receives that physical value plus noise. Both get +1/-1 from task success. No frequency mapping is supplied.
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="border border-[#222] bg-black p-3"><div className="text-[9px] font-mono uppercase tracking-wider text-[#666]">{label}</div><div className={`mt-1 font-mono text-lg ${strong ? 'text-[#00ff41]' : 'text-white'}`}>{value}</div></div>;
}
