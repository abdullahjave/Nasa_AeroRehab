"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { useChartAnim } from "@/components/ui/motion";
import { REDUCED_ROM_DEMO } from "@/lib/insights/config";

type Point = { id: string; day: number; label: string; rom: number | null };

/**
 * Knee ROM across the mission against the personal baseline, with a mission-day slider.
 * Moving the slider (or pressing Replay) selects that session everywhere, so the Your Status card below updates with it.
 */
export default function MissionReplay() {
  const { astronaut, session, selectSession } = useAstronaut();
  const sessions = useMemo(() => [...astronaut.sessions].sort((a, b) => a.missionDay - b.missionDay), [astronaut.sessions]);
  const points: Point[] = sessions.map((s) => ({ id: s.id, day: s.missionDay, label: s.label, rom: s.knee.romDeg }));
  const idx = Math.max(0, sessions.findIndex((s) => s.id === session.id));
  const [playing, setPlaying] = useState(false);
  const anim = useChartAnim(1100);

  // Replay steps through the sessions in order and stops on the last one.
  useEffect(() => {
    if (!playing) return;
    const last = idx >= sessions.length - 1;
    const t = setTimeout(() => (last ? setPlaying(false) : selectSession(sessions[idx + 1].id)), last ? 0 : 700);
    return () => clearTimeout(t);
  }, [playing, idx, sessions, selectSession]);

  if (sessions.length === 0) return null;
  const baseline = session.joint.baseline?.romDeg ?? sessions.find((s) => s.joint.baseline)?.joint.baseline?.romDeg ?? null;
  const limit = baseline !== null ? Math.round(baseline * (1 + REDUCED_ROM_DEMO.thresholdPct / 100) * 10) / 10 : null;
  const roms = points.map((p) => p.rom).filter((v): v is number => v !== null);
  const lo = Math.floor((Math.min(...roms, limit ?? Infinity) - 5) / 5) * 5;
  const hi = Math.ceil((Math.max(...roms, baseline ?? -Infinity) + 5) / 5) * 5;
  const cur = points[idx];

  const replay = () => {
    if (idx >= sessions.length - 1) selectSession(sessions[0].id);
    setPlaying(true);
  };

  return (
    <Panel
      id="mission-replay"
      title="Knee range of motion across the mission"
      icon="chart"
      action={
        <button type="button" onClick={() => (playing ? setPlaying(false) : replay())}
          className="rounded-md border border-cyan-300/70 bg-cyan-400/15 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-400/25">
          {playing ? "Pause" : "▶ Replay mission"}
        </button>
      }
    >
      <div className="h-[220px] rounded-md bg-black/35 p-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 210 }}>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="day" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(d) => `D${d}`} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} />
            <YAxis domain={[lo, hi]} tickFormatter={(v) => `${v}°`} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} width={40} />
            {limit !== null && <ReferenceArea y1={lo} y2={limit} fill={C.amber} fillOpacity={0.08} />}
            {baseline !== null && <ReferenceLine y={baseline} stroke={C.green} strokeDasharray="5 4" label={{ value: `Baseline ${baseline}°`, fill: C.green, fontSize: 11, position: "insideTopLeft" }} />}
            {limit !== null && <ReferenceLine y={limit} stroke={C.amber} strokeDasharray="2 4" label={{ value: `Flag below ${limit}° (${REDUCED_ROM_DEMO.thresholdPct}%)`, fill: C.amber, fontSize: 11, position: "insideBottomRight" }} />}
            <ReferenceLine x={cur.day} stroke={C.cyan} strokeOpacity={0.5} className="glide" />
            <Tooltip content={({ active, payload }) => {
              const p = (payload?.[0] as { payload?: Point } | undefined)?.payload;
              if (!active || !p) return null;
              return <div className={TIP_CLASS}><p className="font-semibold text-white">{p.label}</p><p className="text-slate-300">ROM <span className="font-semibold text-cyan-300">{p.rom ?? "–"}°</span></p></div>;
            }} />
            <Line type="linear" dataKey="rom" stroke={C.cyan} strokeWidth={2} dot={{ r: 2.5, fill: C.cyan }} connectNulls={false} {...anim} />
            {cur.rom !== null && <ReferenceDot x={cur.day} y={cur.rom} r={6} fill={C.cyan} stroke="#fff" strokeWidth={2} className="glide" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <label className="mt-3 block text-sm text-slate-200">
        <span className="flex items-center justify-between">
          <span>Mission day <strong className="text-white">{cur.day}</strong> &middot; {cur.label.replace(/^Day \d+ · /, "")}</span>
          <span className="text-slate-300">ROM {cur.rom ?? "–"}°{baseline !== null && cur.rom !== null ? ` vs ${baseline}° baseline` : ""}</span>
        </span>
        <input type="range" min={0} max={sessions.length - 1} step={1} value={idx}
          onChange={(e) => { setPlaying(false); selectSession(sessions[Number(e.target.value)].id); }}
          aria-valuetext={`Mission day ${cur.day}`} className="mt-2 w-full accent-cyan-400" />
      </label>
    </Panel>
  );
}
