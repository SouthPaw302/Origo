import React, { useEffect, useRef } from 'react';
import { CleanroomWorld } from './world';

export function WorldCanvas({ world }: { world: CleanroomWorld }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(360, Math.floor(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      const env = world.world;
      const cw = w / env.cols;
      const ch = h / env.rows;
      for (let r = 0; r < env.rows; r++) {
        for (let c = 0; c < env.cols; c++) {
          const v = env.terrain[r * env.cols + c] || 0;
          if (v > 0.73) {
            const bright = Math.floor(15 + (v - 0.73) * 95);
            ctx.fillStyle = `rgb(${bright},${bright + 3},${bright + 8})`;
          } else {
            const base = Math.floor(5 + v * 13);
            ctx.fillStyle = `rgb(${base},${base + 2},${base + 4})`;
          }
          ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
        }
      }

      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#7dff9a';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= env.cols; c += 3) {
        ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, h); ctx.stroke();
      }
      for (let r = 0; r <= env.rows; r += 3) {
        ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(w, r * ch); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const wave of world.waves) {
        ctx.beginPath();
        ctx.arc(wave.x * w, wave.y * h, wave.radius * Math.min(w, h), 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff41';
        ctx.globalAlpha = Math.min(0.75, wave.intensity);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const node of world.nodes) {
        const x = node.x * w;
        const y = node.y * h;
        const r = node.id.startsWith('target') ? 16 : 5 + node.energy * 5;
        const pulse = node.active ? 5 + Math.sin(performance.now() * 0.008) * 3 : 0;
        const hue = node.hue;
        const grad = ctx.createRadialGradient(x, y, 1, x, y, r * 2.6 + pulse);
        grad.addColorStop(0, `hsla(${hue},100%,72%,${node.active ? 0.95 : 0.65})`);
        grad.addColorStop(1, `hsla(${hue},100%,50%,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, r * 2.6 + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue},100%,${node.active ? 66 : 54}%)`; ctx.fill();
        if (node.id.startsWith('target')) {
          ctx.strokeStyle = node.active ? '#fff' : '#444'; ctx.lineWidth = node.active ? 2 : 1; ctx.stroke();
          ctx.fillStyle = node.active ? '#fff' : '#666';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(node.id === 'target-a' ? 'TARGET A' : 'TARGET B', x, y - 26);
        }
      }

      for (const agent of world.agents) {
        if (agent.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(agent.trail[0].x * w, agent.trail[0].y * h);
          for (const p of agent.trail.slice(1)) ctx.lineTo(p.x * w, p.y * h);
          ctx.strokeStyle = agent.color; ctx.globalAlpha = 0.32; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
        }

        const x = agent.x * w;
        const y = agent.y * h;
        if (agent.id === 'receiver') {
          ctx.strokeStyle = '#56c7ff'; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
          [-0.8, -0.4, 0, 0.4, 0.8].forEach((off, i) => {
            const dist = (agent.rays[i] ?? 1) * Math.min(w, h) * 0.18;
            const a = agent.angle + off;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * dist, y + Math.sin(a) * dist); ctx.stroke();
          });
          ctx.globalAlpha = 1;
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(agent.angle);
        ctx.shadowColor = agent.color; ctx.shadowBlur = 15;
        ctx.fillStyle = agent.color;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-10, -9); ctx.lineTo(-5, 0); ctx.lineTo(-10, 9); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ddd'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(agent.id === 'sender' ? 'AGENT A · SEES' : 'AGENT B · HEARS', x, y + 28);
      }

      const m = world.metrics();
      ctx.fillStyle = 'rgba(0,0,0,.82)';
      ctx.fillRect(12, h - 56, Math.min(430, w - 24), 42);
      ctx.strokeStyle = '#252525'; ctx.strokeRect(12, h - 56, Math.min(430, w - 24), 42);
      ctx.fillStyle = '#8a8a8a'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`EP ${m.episode}  WORLD ${Math.round(m.recentWorldSuccess * 100)}%  GAN ${m.gan.generation}`, 24, h - 35);
      ctx.fillStyle = world.channelEnabled ? '#00ff41' : '#ff3e00';
      ctx.fillText(world.channelEnabled ? `${Math.round(m.signalHz)} Hz · acoustic channel active` : 'ACOUSTIC CHANNEL DISABLED', 24, h - 20);

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [world]);

  return <canvas ref={ref} className="block h-full min-h-[540px] w-full" />;
}
