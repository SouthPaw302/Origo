import React, { useState } from 'react';
import { ORIGO_CORE_RULE, CORE_ALLOWED_PRIMITIVES, CORE_FORBIDDEN_PRIORS } from './core/doctrine';
import TicTacToeArena from './experiments/TicTacToeArena';
import LifeWars from './experiments/LifeWars';
import EchoLanguage from './experiments/EchoLanguage';
import MusicLab from './experiments/MusicLab';
import LegacyApp from './LegacyApp';

type Experiment = 'home' | 'arena' | 'life' | 'echo' | 'music' | 'legacy';

const experiments: { id: Experiment; title: string; subtitle: string; tag: string }[] = [
  { id: 'arena', title: 'Self-Play Arena', subtitle: 'Tabular RL discovers Tic-Tac-Toe from terminal reward alone.', tag: 'CORE' },
  { id: 'life', title: 'Life Wars', subtitle: 'Two policies learn competitive cellular-automaton seeding.', tag: 'CORE' },
  { id: 'echo', title: 'Echo Language', subtitle: 'Agents invent a private acoustic communication protocol.', tag: 'CORE + AUDIO' },
  { id: 'music', title: 'Raw Music Lab', subtitle: 'Self-play explores raw synthesis and Origo-only composition lineages.', tag: 'CORE + AUDIO' },
  { id: 'legacy', title: 'Neural Harmonics', subtitle: 'Original AI Studio simulation preserved with its human musical priors.', tag: 'SANDBOX / LEGACY' },
];

export default function App() {
  const [active, setActive] = useState<Experiment>('home');

  if (active === 'legacy') {
    return (
      <div className="w-screen h-screen overflow-hidden bg-black">
        <button
          onClick={() => setActive('home')}
          className="fixed top-3 left-3 z-[100] px-3 py-2 bg-black border border-[#ff3e00] text-[#ff3e00] font-mono text-xs font-bold uppercase shadow-xl"
        >
          ← Exit legacy sandbox
        </button>
        <div className="fixed top-3 right-3 z-[100] px-3 py-2 bg-black/90 border border-[#ff3e00] text-[#ff3e00] font-mono text-[10px] uppercase hidden md:block">
          Contains human scales / musical priors — excluded from Core
        </div>
        <LegacyApp />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#050505] text-[#f0f0f0] overflow-hidden flex flex-col">
      <header className="flex-shrink-0 border-b border-[#222] bg-[#090909] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <button onClick={() => setActive('home')} className="text-left group">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl md:text-3xl font-display font-black italic uppercase tracking-tighter group-hover:text-[#00ff41]">ORIGO</h1>
            <span className="border border-[#00ff41] text-[#00ff41] px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase">Core Clean</span>
          </div>
          <div className="hidden sm:block text-[9px] text-[#666] uppercase tracking-[0.22em] font-mono">Autonomous self-play laboratory</div>
        </button>
        <div className="flex items-center gap-2">
          {active !== 'home' && <button className="btn-core" onClick={() => setActive('home')}>Experiments</button>}
          <span className="hidden md:inline text-[10px] font-mono text-[#555]">NO HUMAN TRAINING DATA</span>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        {active === 'home' && <Home onOpen={setActive} />}
        {active === 'arena' && <TicTacToeArena />}
        {active === 'life' && <LifeWars />}
        {active === 'echo' && <EchoLanguage />}
        {active === 'music' && <MusicLab />}
      </main>

      <footer className="flex-shrink-0 h-7 border-t border-[#222] bg-[#080808] px-4 flex items-center justify-between text-[9px] text-[#555] uppercase tracking-widest font-mono">
        <span>ORIGO CORE RULE ACTIVE</span>
        <span className="hidden sm:inline">RL + SELF-PLAY · ZERO HUMAN EXAMPLES</span>
      </footer>
    </div>
  );
}

function Home({ onOpen }: { onOpen: (id: Experiment) => void }) {
  return (
    <div className="h-full overflow-auto p-4 md:p-7">
      <div className="max-w-7xl mx-auto space-y-7">
        <section className="grid lg:grid-cols-[1.2fr_.8fr] gap-4">
          <div className="border border-[#222] bg-black p-5 md:p-7">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#00ff41] font-mono mb-3">Foundational constraint</div>
            <blockquote className="text-xl md:text-3xl font-display font-black leading-tight uppercase tracking-tight">
              {ORIGO_CORE_RULE}
            </blockquote>
            <p className="text-sm text-[#777] mt-5 max-w-3xl">
              Origo may be given a body, controls, instruments, physics, opponents and rewards. It is not shown how humans solve the task. Anything it discovers inside Core can become material for later Core experiments because its ancestry remains internal to Origo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DoctrineList title="Allowed primitives" items={CORE_ALLOWED_PRIMITIVES.slice(0, 8)} good />
            <DoctrineList title="Forbidden priors" items={CORE_FORBIDDEN_PRIORS.slice(0, 8)} />
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-black uppercase">Experiments</h2>
              <p className="text-xs text-[#666] font-mono">Core experiments remain isolated from legacy or human-seeded material.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {experiments.map((exp) => (
              <button
                key={exp.id}
                onClick={() => onOpen(exp.id)}
                className={`text-left min-h-40 p-5 border bg-[#0a0a0a] hover:bg-[#101010] transition-colors ${exp.id === 'legacy' ? 'border-[#4b2419] hover:border-[#ff3e00]' : 'border-[#222] hover:border-[#00ff41]'}`}
              >
                <div className={`text-[9px] font-mono tracking-widest uppercase ${exp.id === 'legacy' ? 'text-[#ff3e00]' : 'text-[#00ff41]'}`}>{exp.tag}</div>
                <div className="text-xl font-black uppercase mt-3">{exp.title}</div>
                <p className="text-xs text-[#777] mt-2 leading-relaxed">{exp.subtitle}</p>
                <div className="mt-4 text-xs font-mono text-[#555]">OPEN →</div>
              </button>
            ))}
          </div>
        </section>

        <section className="border border-[#222] bg-[#090909] p-5">
          <div className="text-xs uppercase tracking-widest text-[#00ff41] font-mono">Composition lineage rule</div>
          <p className="text-sm text-[#888] mt-2 max-w-4xl">
            Whole sequences generated inside Origo Core may be saved, replayed and mutated as descendants. Their origin tag and parents are retained. Human songs or external MIDI are not accepted into Core; those belong in a separately labeled sandbox if we add import tools later.
          </p>
        </section>
      </div>
    </div>
  );
}

function DoctrineList({ title, items, good = false }: { title: string; items: readonly string[]; good?: boolean }) {
  return (
    <div className="border border-[#222] bg-[#0a0a0a] p-4 min-w-0">
      <div className={`text-[9px] uppercase tracking-widest font-mono mb-3 ${good ? 'text-[#00ff41]' : 'text-[#ff3e00]'}`}>{title}</div>
      <div className="space-y-2">
        {items.map((item) => <div key={item} className="text-[11px] text-[#777] font-mono break-words">{good ? '+' : '×'} {item}</div>)}
      </div>
    </div>
  );
}
