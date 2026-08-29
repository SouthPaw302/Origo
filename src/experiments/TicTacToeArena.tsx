import React, { useRef, useState } from 'react';

type Mark = 0 | 1 | 2;
type Board = Mark[];

const wins = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function result(board: Board) {
  for (const [a,b,c] of wins) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? 3 : 0;
}

function keyFor(board: Board, player: Mark) {
  return board.map((v) => v === 0 ? 0 : v === player ? 1 : 2).join('');
}

function argmax(values: Float64Array, legal: number[]) {
  let best = -Infinity;
  let choices: number[] = [];
  for (const i of legal) {
    if (values[i] > best + 1e-12) { best = values[i]; choices = [i]; }
    else if (Math.abs(values[i] - best) <= 1e-12) choices.push(i);
  }
  return choices[Math.floor(Math.random() * choices.length)] ?? legal[0] ?? 0;
}

export default function TicTacToeArena() {
  const q = useRef(new Map<string, Float64Array>());
  const [episodes, setEpisodes] = useState(0);
  const [stats, setStats] = useState({ x: 0, o: 0, draws: 0 });
  const [board, setBoard] = useState<Board>(Array(9).fill(0));
  const [message, setMessage] = useState('Shared-policy self-play begins tabula rasa.');

  const epsilonAt = (n: number) => Math.max(0.025, Math.exp(-n / 5500));
  const row = (k: string) => {
    let r = q.current.get(k);
    if (!r) { r = new Float64Array(9); q.current.set(k, r); }
    return r;
  };

  const oneGame = (learn = true, greedy = false) => {
    const b: Board = Array(9).fill(0);
    let p: Mark = 1;
    const trace: { key: string; action: number; player: Mark }[] = [];
    let terminal = 0;
    while (!terminal) {
      const legal = b.map((v, i) => v === 0 ? i : -1).filter((i) => i >= 0);
      const k = keyFor(b, p);
      const values = row(k);
      const eps = greedy ? 0 : epsilonAt(episodes);
      const action = Math.random() < eps ? legal[Math.floor(Math.random() * legal.length)] : argmax(values, legal);
      trace.push({ key: k, action, player: p });
      b[action] = p;
      terminal = result(b);
      p = p === 1 ? 2 : 1;
    }

    if (learn) {
      const alpha = 0.18;
      const gamma = 0.97;
      for (let i = trace.length - 1; i >= 0; i--) {
        const t = trace[i];
        const finalReward = terminal === 3 ? 0 : terminal === t.player ? 1 : -1;
        const discounted = finalReward * Math.pow(gamma, trace.length - 1 - i);
        const values = row(t.key);
        values[t.action] += alpha * (discounted - values[t.action]);
      }
    }
    return { board: b, terminal };
  };

  const train = (count: number) => {
    let s = { ...stats };
    for (let i = 0; i < count; i++) {
      const g = oneGame(true, false);
      if (g.terminal === 1) s.x++;
      else if (g.terminal === 2) s.o++;
      else s.draws++;
    }
    setEpisodes((n) => n + count);
    setStats(s);
    setMessage(`Completed ${count.toLocaleString()} self-play episodes.`);
  };

  const watch = () => {
    const g = oneGame(false, true);
    setBoard(g.board);
    setMessage(g.terminal === 3 ? 'Greedy policy played to a draw.' : `Greedy policy winner: ${g.terminal === 1 ? 'X' : 'O'}.`);
  };

  const total = stats.x + stats.o + stats.draws;
  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-[#050505] text-white">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="border border-[#222] bg-[#0b0b0b] p-4">
          <h2 className="text-xl font-black uppercase">Self-Play Arena</h2>
          <p className="text-xs text-[#777] font-mono mt-1">Shared tabular policy. Terminal rewards only. No human openings, game records, or demonstrations.</p>
        </div>
        <div className="grid md:grid-cols-[1fr_300px] gap-4">
          <div className="border border-[#222] p-5 bg-black">
            <div className="grid grid-cols-3 gap-2 max-w-md mx-auto aspect-square">
              {board.map((v, i) => <div key={i} className="border border-[#333] flex items-center justify-center text-6xl font-black">{v === 1 ? 'X' : v === 2 ? 'O' : ''}</div>)}
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              <button className="btn-core" onClick={watch}>Watch One</button>
              <button className="btn-core" onClick={() => train(1000)}>Train 1,000</button>
              <button className="btn-core" onClick={() => train(10000)}>Train 10,000</button>
              <button className="btn-core" onClick={() => { q.current.clear(); setEpisodes(0); setStats({x:0,o:0,draws:0}); setBoard(Array(9).fill(0)); setMessage('Learning erased.'); }}>Reset</button>
            </div>
            <div className="text-center text-xs font-mono text-[#888] mt-4">{message}</div>
          </div>
          <aside className="border border-[#222] bg-[#0b0b0b] p-4 grid grid-cols-2 gap-4 font-mono h-fit">
            <Metric label="Episodes" value={episodes.toLocaleString()} />
            <Metric label="Known states" value={q.current.size.toLocaleString()} />
            <Metric label="X wins" value={stats.x.toLocaleString()} />
            <Metric label="O wins" value={stats.o.toLocaleString()} />
            <Metric label="Draws" value={stats.draws.toLocaleString()} />
            <Metric label="Draw rate" value={`${total ? Math.round(stats.draws / total * 100) : 0}%`} />
            <Metric label="Exploration" value={epsilonAt(episodes).toFixed(3)} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase text-[#666]">{label}</div><div className="text-lg">{value}</div></div>;
}
