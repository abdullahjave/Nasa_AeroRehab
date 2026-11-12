"use client";

import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { romTrend } from "@/lib/recorded/build";

/**
 * Session-to-session range of motion from saved sessions only (same knee side and protocol as the selected session).
 * Needs at least two sessions with a ROM; otherwise it says so instead of drawing a line.
 */
export default function RecordedTrend({ id = "rec-trend" }: { id?: string }) {
  const { astronaut, session } = useAstronaut();
  const ctx = session.joint.measurement;
  const rows = romTrend(astronaut, ctx.side, ctx.protocol).filter((r) => r.romDeg !== null) as { sessionId: string; label: string; missionDay: number; romDeg: number; isBaseline: boolean }[];
  const title = `ROM across saved sessions · ${ctx.side === "left" ? "Left" : "Right"} knee`;

  if (session.recorded?.empty) {
    return <Panel id={id} title="Range of motion trend" icon="chart"><p className="text-sm text-amber-200">Unavailable</p><p className="text-xs text-slate-300">No sessions are saved yet.</p></Panel>;
  }
  if (rows.length < 2) {
    return (
      <Panel id={id} title={title} icon="chart">
        <p className="text-sm text-amber-200">Trend unavailable</p>
        <p className="text-xs text-slate-300">A trend needs at least two saved sessions with both angles for the same knee side and protocol. {rows.length === 1 ? "Only one is saved so far." : "None have both angles yet."}</p>
      </Panel>
    );
  }
  const W = 320, H = 110, pad = { l: 34, r: 10, t: 10, b: 20 };
  const lo = Math.min(...rows.map((r) => r.romDeg)), hi = Math.max(...rows.map((r) => r.romDeg));
  const y0 = Math.floor((lo - 5) / 5) * 5, y1 = Math.ceil((hi + 5) / 5) * 5;
  const x = (i: number) => pad.l + (rows.length === 1 ? 0 : (i / (rows.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);
  const path = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r.romDeg).toFixed(1)}`).join(" ");
  return (
    <Panel id={id} title={title} icon="chart">
      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={`Range of motion by saved session: ${rows.map((r) => `${r.label} ${r.romDeg} degrees`).join("; ")}`}>
          {[y0, (y0 + y1) / 2, y1].map((v) => (<g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#1e3a5f" strokeDasharray="3 3" /><text x={pad.l - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(v)}°</text></g>))}
          <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
          {rows.map((r, i) => (
            <g key={r.sessionId}>
              <circle cx={x(i)} cy={y(r.romDeg)} r={r.isBaseline ? 5 : 3.5} fill={r.isBaseline ? "#34d399" : "#22d3ee"} stroke="#fff" strokeWidth={r.isBaseline ? 1.5 : 0} />
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">D{r.missionDay}</text>
            </g>
          ))}
        </svg>
        <figcaption className="text-[10px] text-slate-400">Green ring = saved baseline. Entered values only; no sensor trace.</figcaption>
      </figure>
      <ul className="mt-1 space-y-0.5 text-xs text-slate-200">
        {rows.map((r) => <li key={r.sessionId} className="tabular-nums">{r.label}: <span className="font-semibold text-white">{r.romDeg}°</span>{r.isBaseline && <span className="text-emerald-300"> &middot; baseline</span>}</li>)}
      </ul>
    </Panel>
  );
}
