import React, { useRef, useState } from 'react';

const W = 12;
const H = 12;
const CELLS = W * H;
const SEEDS = 8;
const GENERATIONS = 24;
type Cell = 0 | 1 | 2;

function argmax(values: Float64Array, legal: number[]) {
  let best = -Infinity;
  let picks: number[] = [];
  for (const i of legal) {
    if (values[i] > best + 1e-12) { best = values[i]; picks = [i]; }
    else if (Math.abs(values[i] - best) <= 1e-12) picks.push(i);
  }
  return picks[Math.floor(Math.random() * picks.length)] ?? legal[0] ?? 0;
}

function neighbors(board: Cell[], idx: number) {
  const x = idx % W, y = Math.floor(idx / W);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push(ny * W + nx);
  }
  return out;
}

function evolve(input: Cell[]) {
  let board = [...input];
  for (let g = 0; g < GENERATIONS; g++) {
    const next: Cell[] = Array(CELLS).fill(0);
    for (let i = 0; i < CELLS; i++) {
      const ns = neighbors(board, i);
      let alive = 0, a = 0, b = 0;
      for (const n of ns) {
        if (board[n]) alive++;
        if (board[n] === 1) a++;
        if (board[n] === 2) b++;
      }
      if (board[i] && (alive === 2 || alive === 3)) next[i] = board[i];
      else if (!board[i] && alive === 3) next[i] = a === b ? (Math.random() < 0.5 ? 1 : 2) : a > b ? 1 : 2;
    }
    board = next;
  }
  return board;
}

export default function LifeWars() {
  const qA = useRef(Array.from({ length: SEEDS }, () => new Float64Array(CELLS)));
  const qB = useRef(Array.from({ length: SEEDS }, () => new Float64Array(CELLS)));
  const [episodes, setEpisodes] = useState(0);
  const [wins, setWins] = useState({ a: 0, b: 0, d: 0 });
  const [board, setBoard] = useState<Cell[]>(Array(CELLS).fill(0));
  const [summary, setSummary] = useState('Two policies learn where to seed competing Life populations.');

  const epsilonAt = (n: number) => Math.max(0.03, Math.exp(-n / 5000));

  const battle = (learn: boolean, greedy = false) => {
    const start: Cell[] = Array(CELLS).fill(0);
    const traceA: number[] = [], traceB: number[] = [];
    const eps = greedy ? 0 : epsilonAt(episodes);
    for (let s = 0; s < SEEDS; s++) {
      for (const species of [1, 2] as const) {
        const legal = start.map((v, i) => v === 0 ? i : -1).filter((i) => i >= 0);
        const values = species === 1 ? qA.current[s] : qB.current[s];
        const action = Math.random() < eps ? legal[Math.floor(Math.random() * legal.length)] : argmax(values, legal);
        start[action] = species;
        (species === 1 ? traceA : traceB).push(action);
      }
    }
    const final = evolve(start);
    const aCount = final.filter((x) => x === 1).length;
    const bCount = final.filter((x) => x === 2).length;
    const raw = (aCount - bCount) / Math.max(1, aCount + bCount);
    const rA = raw > 0 ? 1 : raw < 0 ? -1 : 0;
    const rB = -rA;
    if (learn) {
      const alpha = 0.12;
      for (let s = 0; s < SEEDS; s++) {
        qA.current[s][traceA[s]] += alpha * (rA - qA.current[s][traceA[s]]);
        qB.current[s][traceB[s]] += alpha * (rB - qB.current[s][traceB[s]]);
      }
    }
    return { final, aCount, bCount, rA };
  };

  const train = (count: number) => {
    const next = { ...wins };
    for (let i = 0; i < count; i++) {
      const r = battle(true);
      if (r.rA > 0) next.a++; else if (r.rA < 0) next.b++; else next.d++;
    }
    setEpisodes((n) => n + count);
    setWins(next);
    setSummary(`Completed ${count.toLocaleString()} self-play ecology battles.`);
  };

  const watch = () => {
    const r = battle(false, true);
    setBoard(r.final);
    setSummary(`After ${GENERATIONS} Life generations: A ${r.aCount} cells · B ${r.bCount} cells.`);
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-[#050505] text-white">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="border border-[#222] bg-[#0b0b0b] p-4">
          <h2 className="text-xl font-black uppercase">Life Wars</h2>
          <p className="text-xs text-[#777] font-mono mt-1">Self-play chooses initial cells; the cellular automaton supplies the consequences. No human patterns, gliders, openings, or demonstrations.</p>
        </div>
        <div className="grid md:grid-cols-[1fr_300px] gap-4">
          <div className="border border-[#222] bg-black p-4">
            <div className="grid gap-[2px] max-w-xl mx-auto aspect-square" style={{ gridTemplateColumns: `repeat(${W}, minmax(0,1fr))` }}>
              {board.map((v, i) => <div key={i} className={`border border-[#161616] ${v === 1 ? 'bg-[#00ff41]' : v === 2 ? 'bg-[#ff3e00]' : 'bg-[#080808]'}`} />)}
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              <button className="btn-core" onClick={watch}>Watch Battle</button>
              <button className="btn-core" onClick={() => train(500)}>Train 500</button>
              <button className="btn-core" onClick={() => train(5000)}>Train 5,000</button>
              <button className="btn-core" onClick={() => { qA.current.forEach(q => q.fill(0)); qB.current.forEach(q => q.fill(0)); setEpisodes(0); setWins({a:0,b:0,d:0}); setBoard(Array(CELLS).fill(0)); }}>Reset</button>
            </div>
            <div className="text-xs font-mono text-[#888] text-center mt-4">{summary}</div>
          </div>
          <aside className="border border-[#222] bg-[#0b0b0b] p-4 grid grid-cols-2 gap-4 h-fit font-mono">
            <Metric label="Episodes" value={episodes.toLocaleString()} />
            <Metric label="Exploration" value={epsilonAt(episodes).toFixed(3)} />
            <Metric label="A wins" value={wins.a.toLocaleString()} />
            <Metric label="B wins" value={wins.b.toLocaleString()} />
            <Metric label="Draws" value={wins.d.toLocaleString()} />
            <Metric label="Seed actions" value={`${SEEDS * 2}`} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase text-[#666]">{label}</div><div className="text-lg">{value}</div></div>;
}
