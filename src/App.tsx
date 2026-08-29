import React, { useEffect, useRef, useState } from 'react';
import { Activity, Brain, FastForward, Pause, Play, Radio, RefreshCcw, Save, Upload, Volume2, VolumeX, Waves } from 'lucide-react';
import { WorldCanvas } from './cleanroom/WorldCanvas';
import { CleanroomWorld, WorldMetrics } from './cleanroom/world';
import type { AblationReport, EngineCheckpoint } from './cleanroom/communication';

type AudioState = 'locked' | 'ready' | 'failed';
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function App() {
  const [seed, setSeed] = useState(302);
  const worldRef = useRef(new CleanroomWorld(seed));
  const [worldVersion, setWorldVersion] = useState(0);
  const [metrics, setMetrics] = useState<WorldMetrics>(() => worldRef.current.metrics());
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [audioState, setAudioState] = useState<AudioState>('locked');
  const [ablations, setAblations] = useState<AblationReport | null>(null);
  const [notice, setNotice] = useState('');
  const audioRef = useRef<AudioContext | null>(null);
  const lastEpisodeRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const world = worldRef.current;
      if (running) world.step(speed);
      const next = world.metrics();
      if (next.episode !== lastEpisodeRef.current) {
        lastEpisodeRef.current = next.episode;
        setMetrics(next);
        if (audioState === 'ready' && next.channelEnabled) playSignal(next.signalHz, next.signalAmplitude, next.signalDurationMs);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const meter = window.setInterval(() => setMetrics(worldRef.current.metrics()), 350);
    return () => { cancelAnimationFrame(raf); window.clearInterval(meter); };
  }, [running, speed, audioState]);

  const playSignal = (frequency: number, amplitude: number, durationMs: number) => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(80, Math.min(1600, frequency)), now);
    const peak = 0.025 + Math.min(0.13, amplitude * 0.11);
    const dur = Math.max(0.05, Math.min(0.45, durationMs / 1000));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + dur + 0.02);
  };

  const enableAudio = async () => {
    try {
      const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('No WebAudio');
      const ctx = audioRef.current ?? new Ctor();
      audioRef.current = ctx;
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error(ctx.state);
      setAudioState('ready');
      const m = worldRef.current.metrics();
      playSignal(m.signalHz, m.signalAmplitude, m.signalDurationMs);
    } catch { setAudioState('failed'); }
  };

  const rebuild = () => {
    worldRef.current = new CleanroomWorld(seed || 302);
    worldRef.current.speed = speed;
    setMetrics(worldRef.current.metrics());
    setAblations(null);
    setWorldVersion(v => v + 1);
    setNotice(`New deterministic run: seed ${seed || 302}`);
  };

  const fastTrain = () => {
    worldRef.current.fastTrain(36);
    setMetrics(worldRef.current.metrics());
    setWorldVersion(v => v + 1);
    setNotice('Fast training + GAN curriculum pass complete');
  };

  const toggleChannel = () => {
    worldRef.current.setChannel(!worldRef.current.channelEnabled);
    setMetrics(worldRef.current.metrics());
  };

  const saveCheckpoint = () => {
    const cp = worldRef.current.communication.exportCheckpoint();
    localStorage.setItem(`origo-cleanroom-${seed}`, JSON.stringify(cp));
    setNotice('PPO checkpoint saved in this browser');
  };

  const loadCheckpoint = () => {
    try {
      const raw = localStorage.getItem(`origo-cleanroom-${seed}`);
      if (!raw) throw new Error('No checkpoint for this seed');
      worldRef.current.communication.importCheckpoint(JSON.parse(raw) as EngineCheckpoint);
      setMetrics(worldRef.current.metrics());
      setNotice('Checkpoint restored');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Checkpoint load failed'); }
  };

  const runAblations = () => {
    setAblations(worldRef.current.communication.runAblations(2000));
    setNotice('2,000-sample ablation suite complete');
  };

  const c = metrics.communication;
  const g = metrics.gan;
  const pass = c.successOn > 0.85 && c.successOff < 0.60;

  return (
    <div className="min-h-screen bg-[#050505] text-[#efefef] p-2 md:p-4">
      <div className="mx-auto max-w-[1500px] border border-[#222] bg-[#080808] min-h-[calc(100vh-16px)]">
        <header className="border-b border-[#222] bg-[#0b0b0b] px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-black italic tracking-tight md:text-4xl">ORIGO CORE</h1>
                <Badge green>CLEAN ROOM</Badge><Badge>ZERO HUMAN DATA</Badge><Badge green={pass}>{pass ? 'COMM PASS' : 'LEARNING'}</Badge>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[.22em] text-[#666]">Autonomous world · continuous acoustic PPO · self-generated GAN curriculum</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setRunning(v => !v)}>{running ? <Pause/> : <Play/>}{running ? 'Pause' : 'Auto Learn'}</Button>
              <Button green onClick={fastTrain}><FastForward/>Fast Train</Button>
              <Button onClick={enableAudio} green={audioState === 'ready'}>{audioState === 'ready' ? <Volume2/> : <VolumeX/>}{audioState === 'ready' ? 'Audio Ready' : 'Enable Audio'}</Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase">
            <Badge>CLIPPED PPO</Badge><Badge>8 SPECTRAL BINS</Badge><Badge>GAN GEN {g.generation}</Badge><Badge>SEED {seed}</Badge>
            {[1,4,16,64].map(s => <button key={s} onClick={() => setSpeed(s)} className={`border px-2 py-1 ${speed===s?'border-[#00ff41] text-[#00ff41]':'border-[#333] text-[#777]'}`}>{s}X</button>)}
          </div>
        </header>

        <main className="grid grid-cols-1 xl:grid-cols-[1fr_390px]">
          <section className="relative min-h-[590px] border-b border-[#222] xl:border-b-0 xl:border-r">
            <WorldCanvas key={worldVersion} world={worldRef.current}/>
            <div className="pointer-events-none absolute left-4 top-4 flex gap-2"><Badge green>LIVE WORLD</Badge><Badge>{metrics.channelEnabled ? 'ACOUSTIC ON' : 'ACOUSTIC OFF'}</Badge></div>
          </section>

          <aside className="space-y-4 bg-[#090909] p-4">
            <Panel title="WORLD" icon={<Activity/>}>
              <Grid>
                <Metric label="World success" value={pct(metrics.recentWorldSuccess)} strong/>
                <Metric label="Episode" value={metrics.episode.toLocaleString()}/>
                <Metric label="World steps" value={metrics.worldSteps.toLocaleString()}/>
                <Metric label="Signal" value={`${Math.round(metrics.signalHz)} Hz`}/>
              </Grid>
            </Panel>

            <Panel title="LEARNING CORE" icon={<Brain/>}>
              <Grid>
                <Metric label="Acoustic ON" value={pct(c.successOn)} strong/>
                <Metric label="Acoustic OFF" value={pct(c.successOff)}/>
                <Metric label="Mutual info" value={`${c.mutualInformationBits.toFixed(3)} bit`}/>
                <Metric label="Noise stress" value={pct(c.noiseStress)}/>
                <Metric label="PPO updates" value={c.update.toLocaleString()}/>
                <Metric label="Episodes" value={c.episodes.toLocaleString()}/>
                <Metric label="Approx KL" value={c.approxKl.toFixed(4)}/>
                <Metric label="Clip fraction" value={pct(c.clipFraction)}/>
              </Grid>
              <div className="mt-3 border border-[#222] bg-black p-3 font-mono text-[11px]">
                <div className="mb-2 text-[#666]">INVENTED PROTOCOL</div>
                <div className="flex justify-between"><span>Target A</span><span className="text-[#00ff41]">{Math.round(c.leftHz)} Hz · {c.leftAmplitude.toFixed(2)} amp · {Math.round(c.leftDurationMs)} ms</span></div>
                <div className="mt-1 flex justify-between"><span>Target B</span><span className="text-[#ff3e00]">{Math.round(c.rightHz)} Hz · {c.rightAmplitude.toFixed(2)} amp · {Math.round(c.rightDurationMs)} ms</span></div>
              </div>
            </Panel>

            <Panel title="ENVIRONMENT GAN" icon={<Waves/>}>
              <Grid>
                <Metric label="Generation" value={g.generation.toLocaleString()} strong/>
                <Metric label="Discriminator" value={g.discriminatorScore.toFixed(3)}/>
                <Metric label="Archive" value={g.archiveSize.toString()}/>
                <Metric label="Novelty" value={g.novelty.toFixed(3)}/>
                <Metric label="Obstacle bias" value={g.obstacleDensity.toFixed(3)}/>
                <Metric label="Roughness" value={g.roughness.toFixed(3)}/>
              </Grid>
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#666]">GAN positives are challenging worlds generated by Origo itself. No external terrain corpus enters Core.</p>
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={toggleChannel}><Radio/>{metrics.channelEnabled ? 'Disable Channel' : 'Enable Channel'}</Button>
              <Button onClick={runAblations}><Activity/>Ablations</Button>
              <Button onClick={saveCheckpoint}><Save/>Save PPO</Button>
              <Button onClick={loadCheckpoint}><Upload/>Load PPO</Button>
            </div>

            {ablations && <div className="border border-[#222] bg-black p-3 font-mono text-[10px] text-[#aaa]">
              <div className="mb-2 text-[#fff]">ABLATION · {ablations.samples} SAMPLES</div>
              <div>channel on: <b className="text-[#00ff41]">{pct(ablations.acousticOn)}</b></div>
              <div>channel off: {pct(ablations.acousticOff)}</div>
              <div>35× noise: {pct(ablations.highNoise)}</div>
              <div>frequency only: {pct(ablations.frequencyOnly)}</div>
            </div>}

            <div className="border border-[#222] p-3">
              <label className="font-mono text-[9px] uppercase text-[#666]">Deterministic seed</label>
              <div className="mt-2 flex gap-2"><input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value))} className="min-w-0 flex-1 border border-[#333] bg-black px-3 py-2 font-mono outline-none focus:border-[#00ff41]"/><Button onClick={rebuild}><RefreshCcw/>Reset</Button></div>
            </div>
            {notice && <div className="border border-[#233] bg-[#07100a] p-2 font-mono text-[10px] text-[#8da]">{notice}</div>}
          </aside>
        </main>
      </div>
    </div>
  );
}

function Badge({children,green=false}:{children:React.ReactNode;green?:boolean}){return <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${green?'border-[#00ff41] text-[#00ff41]':'border-[#333] text-[#888]'}`}>{children}</span>}
function Button({children,onClick,green=false}:{children:React.ReactNode;onClick:()=>void;green?:boolean}){return <button onClick={onClick} className={`flex items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase transition-colors ${green?'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41]':'border-[#333] bg-black text-[#aaa] hover:border-[#777]'}`}>{React.Children.map(children,c=>React.isValidElement(c)?React.cloneElement(c as React.ReactElement<{className?:string}>,{className:'h-3.5 w-3.5'}):c)}</button>}
function Panel({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="border border-[#222] bg-[#070707] p-3"><div className="mb-3 flex items-center gap-2 border-b border-[#222] pb-2 font-tech text-xs uppercase">{React.isValidElement(icon)?React.cloneElement(icon as React.ReactElement<{className?:string}>,{className:'h-4 w-4 text-[#00ff41]'}):icon}{title}</div>{children}</section>}
function Grid({children}:{children:React.ReactNode}){return <div className="grid grid-cols-2 gap-2">{children}</div>}
function Metric({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className="border border-[#1f1f1f] bg-black p-2"><div className="font-mono text-[8px] uppercase tracking-wider text-[#666]">{label}</div><div className={`mt-1 font-mono text-sm ${strong?'text-[#00ff41]':'text-white'}`}>{value}</div></div>}
