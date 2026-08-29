import React, { useEffect, useRef, useState } from 'react';
import { Activity, Beaker, Brain, Download, FastForward, Pause, Play, Radio, RotateCcw, Save, Upload, Volume2, VolumeX } from 'lucide-react';
import { AblationReport, CommunicationEngine, EngineCheckpoint, TrainMetrics } from './cleanroom/communication';

type AudioState = 'locked' | 'ready' | 'failed';
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const CHECKPOINT_KEY = 'origo-cleanroom-checkpoint-v2';

export default function App() {
  const [seed, setSeed] = useState(302);
  const engineRef = useRef(new CommunicationEngine(seed));
  const [metrics, setMetrics] = useState<TrainMetrics>(() => engineRef.current.metrics());
  const [running, setRunning] = useState(true);
  const [demoChannel, setDemoChannel] = useState(true);
  const [audioState, setAudioState] = useState<AudioState>('locked');
  const audioContextRef = useRef<AudioContext | null>(null);
  const [demo, setDemo] = useState(() => engineRef.current.demo(true));
  const [ablations, setAblations] = useState<AblationReport | null>(null);
  const [checkpointStatus, setCheckpointStatus] = useState('No checkpoint loaded');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setMetrics(engineRef.current.trainBatch(256)), 80);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = engineRef.current.demo(demoChannel);
      setDemo(next);
      if (audioState === 'ready' && demoChannel) playTone(next.signalHz, next.amplitude, next.durationMs);
    }, 650);
    return () => window.clearInterval(timer);
  }, [demoChannel, audioState]);

  const playTone = (frequency: number, amplitude = 0.5, durationMs = 180) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const duration = Math.max(0.05, Math.min(0.5, durationMs / 1000));
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.015, Math.min(0.14, amplitude * 0.14)), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
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
      playTone(demo.signalHz, demo.amplitude, demo.durationMs);
    } catch {
      setAudioState('failed');
    }
  };

  const fastTrain = () => {
    let next = metrics;
    for (let i = 0; i < 40; i++) next = engineRef.current.trainBatch(512);
    setMetrics(next);
    setDemo(engineRef.current.demo(demoChannel));
    setAblations(null);
  };

  const reset = () => {
    const nextSeed = Number.isFinite(seed) && seed !== 0 ? seed : 302;
    engineRef.current = new CommunicationEngine(nextSeed);
    setMetrics(engineRef.current.metrics());
    setDemo(engineRef.current.demo(demoChannel));
    setAblations(null);
    setCheckpointStatus('Fresh deterministic run');
  };

  const saveCheckpoint = () => {
    const checkpoint = engineRef.current.exportCheckpoint();
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
    setCheckpointStatus(`Saved @ update ${checkpoint.updateCount}`);
  };

  const loadCheckpoint = () => {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) throw new Error('No browser checkpoint');
      const checkpoint = JSON.parse(raw) as EngineCheckpoint;
      if (checkpoint.seed !== seed) setSeed(checkpoint.seed);
      const engine = new CommunicationEngine(checkpoint.seed);
      engine.importCheckpoint(checkpoint);
      engineRef.current = engine;
      setMetrics(engine.metrics());
      setDemo(engine.demo(demoChannel));
      setAblations(null);
      setCheckpointStatus(`Loaded update ${checkpoint.updateCount}`);
    } catch (error) {
      setCheckpointStatus(error instanceof Error ? error.message : 'Load failed');
    }
  };

  const downloadCheckpoint = () => {
    const checkpoint = engineRef.current.exportCheckpoint();
    const blob = new Blob([JSON.stringify(checkpoint, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `origo-seed-${checkpoint.seed}-u${checkpoint.updateCount}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importCheckpointFile = async (file: File) => {
    try {
      const checkpoint = JSON.parse(await file.text()) as EngineCheckpoint;
      const engine = new CommunicationEngine(checkpoint.seed);
      engine.importCheckpoint(checkpoint);
      engineRef.current = engine;
      setSeed(checkpoint.seed);
      setMetrics(engine.metrics());
      setDemo(engine.demo(demoChannel));
      setAblations(null);
      setCheckpointStatus(`Imported update ${checkpoint.updateCount}`);
    } catch (error) {
      setCheckpointStatus(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const runAblations = () => {
    setAblations(engineRef.current.runAblations(2500));
  };

  const passed = metrics.successOn > 0.85 && metrics.successOff < 0.6 && metrics.mutualInformationBits > 0.5;

  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] p-3 md:p-5">
      <div className="mx-auto max-w-7xl border border-[#222] bg-[#090909] min-h-[calc(100vh-24px)] flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222] px-5 py-4 bg-[#0c0c0c]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-black italic uppercase tracking-tight">Origo Core</h1>
              <span className="border border-[#00ff41] px-2 py-1 text-[9px] font-mono tracking-widest text-[#00ff41]">CLEAN ROOM</span>
              <span className="border border-[#444] px-2 py-1 text-[9px] font-mono tracking-widest text-[#aaa]">ZERO HUMAN DATA</span>
            </div>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.22em] text-[#666]">Continuous acoustic self-learning · physical feature channel · PPO</p>
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

        <main className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_390px]">
          <section className="relative min-h-[560px] overflow-hidden border-b border-[#222] bg-grid-pattern lg:border-b-0 lg:border-r">
            <div className="absolute left-5 top-5 flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-wider z-10">
              <span className="border border-[#333] bg-black/80 px-2 py-1">Clipped PPO</span>
              <span className="border border-[#333] bg-black/80 px-2 py-1">8 spectral bins</span>
              <span className="border border-[#333] bg-black/80 px-2 py-1">Seed {seed}</span>
            </div>

            <svg viewBox="0 0 900 560" className="h-full min-h-[520px] w-full">
              <defs><filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <rect x="55" y="55" width="790" height="450" fill="none" stroke="#222" strokeWidth="2" />
              <circle cx="720" cy="170" r="46" fill={demo.hiddenState === -1 ? '#00ff4122' : '#0b0b0b'} stroke={demo.hiddenState === -1 ? '#00ff41' : '#333'} strokeWidth="2" />
              <text x="720" y="176" textAnchor="middle" fill={demo.hiddenState === -1 ? '#00ff41' : '#666'} fontFamily="monospace" fontSize="16">TARGET A</text>
              <circle cx="720" cy="390" r="46" fill={demo.hiddenState === 1 ? '#ff3e0022' : '#0b0b0b'} stroke={demo.hiddenState === 1 ? '#ff3e00' : '#333'} strokeWidth="2" />
              <text x="720" y="396" textAnchor="middle" fill={demo.hiddenState === 1 ? '#ff3e00' : '#666'} fontFamily="monospace" fontSize="16">TARGET B</text>
              <circle cx="220" cy="280" r="40" fill="#06120a" stroke="#00ff41" strokeWidth="3" filter="url(#glow)" />
              <text x="220" y="275" textAnchor="middle" fill="#fff" fontFamily="monospace" fontSize="15">AGENT A</text><text x="220" y="295" textAnchor="middle" fill="#00ff41" fontFamily="monospace" fontSize="11">SEES TARGET</text>
              <circle cx="520" cy="280" r="40" fill="#140805" stroke="#ff3e00" strokeWidth="3" filter="url(#glow)" />
              <text x="520" y="275" textAnchor="middle" fill="#fff" fontFamily="monospace" fontSize="15">AGENT B</text><text x="520" y="295" textAnchor="middle" fill="#ff3e00" fontFamily="monospace" fontSize="11">HEARS FIELD</text>
              {demoChannel && <>{[0, 1, 2].map(i => <circle key={i} cx="220" cy="280" r={70 + i * 48} fill="none" stroke="#00ff41" strokeOpacity={0.5 - i * 0.12} strokeWidth="2" />)}<line x1="260" y1="280" x2="480" y2="280" stroke="#00ff41" strokeOpacity=".7" strokeDasharray="8 8" /></>}
              <path d={demo.choice === -1 ? 'M 555 265 Q 640 205 682 180' : 'M 555 295 Q 640 355 682 380'} fill="none" stroke={demo.correct ? '#00ff41' : '#ff3e00'} strokeWidth="4" />
              <text x="350" y="238" textAnchor="middle" fill={demoChannel ? '#00ff41' : '#555'} fontFamily="monospace" fontSize="14">{demoChannel ? `${Math.round(demo.signalHz)} Hz` : 'CHANNEL OFF'}</text>
              <text x="350" y="258" textAnchor="middle" fill="#777" fontFamily="monospace" fontSize="11">{demoChannel ? `AMP ${demo.amplitude.toFixed(2)} · ${Math.round(demo.durationMs)} ms` : 'NO ACOUSTIC FEATURES'}</text>
            </svg>

            <div className="absolute bottom-5 left-5 right-5 grid grid-cols-4 gap-2 text-center font-mono text-xs">
              <DemoCell label="Hidden state" value={demo.hiddenState === -1 ? 'TARGET A' : 'TARGET B'} />
              <DemoCell label="Frequency" value={`${Math.round(demo.signalHz)} Hz`} accent />
              <DemoCell label="Received amp" value={demoChannel ? demo.receivedAmplitude.toFixed(2) : '0.00'} />
              <DemoCell label="Receiver" value={demo.choice === -1 ? 'TARGET A' : 'TARGET B'} accent={demo.correct} bad={!demo.correct} />
            </div>
          </section>

          <aside className="bg-[#0a0a0a] p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-[#00ff41]"/><span className="font-tech text-sm uppercase">Learning Core</span></div>
              <span className={`text-[9px] font-mono px-2 py-1 border ${passed ? 'border-[#00ff41] text-[#00ff41]' : 'border-[#555] text-[#888]'}`}>{passed ? 'COMMUNICATION PASS' : 'LEARNING'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Acoustic ON" value={pct(metrics.successOn)} strong />
              <Metric label="Acoustic OFF" value={pct(metrics.successOff)} />
              <Metric label="Mutual info" value={`${metrics.mutualInformationBits.toFixed(3)} bit`} strong />
              <Metric label="Noise stress" value={pct(metrics.noiseStress)} />
              <Metric label="PPO updates" value={metrics.update.toLocaleString()} />
              <Metric label="Episodes" value={metrics.episodes.toLocaleString()} />
              <Metric label="Approx KL" value={metrics.approxKl.toFixed(4)} />
              <Metric label="Clip fraction" value={pct(metrics.clipFraction)} />
            </div>

            <div className="border border-[#222] bg-[#070707] p-3 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#888]"><Radio className="h-3.5 w-3.5 text-[#00ff41]"/> Protocol discovered</div>
              <ProtocolRow label="Target A" hz={metrics.leftHz} amp={metrics.leftAmplitude} ms={metrics.leftDurationMs} color="text-[#00ff41]" />
              <ProtocolRow label="Target B" hz={metrics.rightHz} amp={metrics.rightAmplitude} ms={metrics.rightDurationMs} color="text-[#ff3e00]" />
              <div className="h-1 bg-[#151515] overflow-hidden"><div className="h-full bg-[#00ff41]" style={{ width: `${Math.min(100, metrics.signalGapHz / 10.8)}%` }} /></div>
            </div>

            <button onClick={() => setDemoChannel(v => !v)} className={`w-full flex items-center justify-between border p-3 font-mono text-xs uppercase ${demoChannel ? 'border-[#00ff41] text-[#00ff41]' : 'border-[#ff3e00] text-[#ff3e00]'}`}><span>Demo acoustic channel</span><span>{demoChannel ? 'ON' : 'OFF'}</span></button>

            <div className="border border-[#222] p-3 space-y-2">
              <div className="flex items-center justify-between"><span className="text-[9px] font-mono uppercase text-[#666]">Deterministic run</span><span className="text-[9px] font-mono text-[#555]">{checkpointStatus}</span></div>
              <div className="flex gap-2"><input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} className="min-w-0 flex-1 border border-[#333] bg-black px-3 py-2 font-mono text-sm outline-none focus:border-[#00ff41]" /><button onClick={reset} title="Reset from seed" className="border border-[#333] px-3 hover:border-[#00ff41]"><RotateCcw className="h-4 w-4"/></button></div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={saveCheckpoint} className="flex items-center justify-center gap-2 border border-[#333] p-2 text-[10px] font-mono uppercase hover:border-[#00ff41]"><Save className="h-3.5 w-3.5"/> Save</button>
                <button onClick={loadCheckpoint} className="flex items-center justify-center gap-2 border border-[#333] p-2 text-[10px] font-mono uppercase hover:border-[#00ff41]"><Upload className="h-3.5 w-3.5"/> Load</button>
                <button onClick={downloadCheckpoint} className="flex items-center justify-center gap-2 border border-[#333] p-2 text-[10px] font-mono uppercase hover:border-[#00ff41]"><Download className="h-3.5 w-3.5"/> Export</button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 border border-[#333] p-2 text-[10px] font-mono uppercase hover:border-[#00ff41]"><Upload className="h-3.5 w-3.5"/> Import</button>
                <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void importCheckpointFile(file); e.currentTarget.value = ''; }} />
              </div>
            </div>

            <div className="border border-[#222] p-3">
              <button onClick={runAblations} className="w-full flex items-center justify-center gap-2 border border-[#555] p-2 text-[10px] font-mono uppercase hover:border-[#00ff41]"><Beaker className="h-3.5 w-3.5"/> Run 2,500-sample ablations</button>
              {ablations && <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-3 font-mono text-[10px]"><Ablation label="Channel ON" value={ablations.acousticOn} /><Ablation label="Channel OFF" value={ablations.acousticOff} /><Ablation label="35x noise" value={ablations.highNoise} /><Ablation label="Frequency only" value={ablations.frequencyOnly} /></div>}
            </div>

            <div className="border border-[#222] bg-black p-3 text-[10px] font-mono leading-relaxed text-[#777]">
              <div className="mb-2 flex items-center gap-2 text-[#aaa]"><Activity className="h-3.5 w-3.5"/> EXPERIMENT</div>
              A sees one hidden bit. Its policy emits continuous frequency, amplitude and duration. The world attenuates/noises the signal and converts it into 8 spectral bins plus energy, duration and propagation delay. B never sees the hidden state. The only training signal is shared task reward minus a small acoustic energy cost.
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="border border-[#222] bg-black p-3"><div className="text-[9px] font-mono uppercase tracking-wider text-[#666]">{label}</div><div className={`mt-1 font-mono text-lg ${strong ? 'text-[#00ff41]' : 'text-white'}`}>{value}</div></div>; }
function DemoCell({ label, value, accent = false, bad = false }: { label: string; value: string; accent?: boolean; bad?: boolean }) { return <div className="border border-[#222] bg-black/80 p-3"><div className="text-[#666] text-[9px] uppercase">{label}</div><div className={`mt-1 ${bad ? 'text-[#ff3e00]' : accent ? 'text-[#00ff41]' : ''}`}>{value}</div></div>; }
function ProtocolRow({ label, hz, amp, ms, color }: { label: string; hz: number; amp: number; ms: number; color: string }) { return <div className="grid grid-cols-[62px_1fr] gap-2 font-mono text-xs"><span className="text-[#777]">{label}</span><span className={color}>{Math.round(hz)} Hz · amp {amp.toFixed(2)} · {Math.round(ms)} ms</span></div>; }
function Ablation({ label, value }: { label: string; value: number }) { return <div className="flex justify-between"><span className="text-[#666]">{label}</span><span className="text-white">{pct(value)}</span></div>; }
