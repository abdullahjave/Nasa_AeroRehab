"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Panel, { Stat } from "@/components/ui/Panel";
import KneeAnatomy from "@/components/graphics/KneeAnatomy";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { fmt, fmtClock } from "@/lib/format";
import type { AstronautRecord, Session } from "@/lib/demo";

type RangeKey = "1m" | "5m" | "session";
const RANGES: { key: RangeKey; label: string; sec: number | null; aria: string }[] = [
  { key: "1m", label: "1 min", sec: 60, aria: "Last 1 minute" },
  { key: "5m", label: "5 min", sec: 300, aria: "Last 5 minutes" },
  { key: "session", label: "Session", sec: null, aria: "Whole session" },
];

function KneeTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: { t: number; flexionDeg: number | null } }> }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className={TIP_CLASS}>
      <p className="text-slate-300">Time <span className="font-semibold text-white">{fmtClock(p.t)}</span></p>
      <p className="text-slate-300">Knee flexion <span className="font-semibold text-cyan-300">{fmt(p.flexionDeg, "°", 1)}</span></p>
    </div>
  );
}

export default function KneeCard({ astronaut, session }: { astronaut: AstronautRecord; session: Session }) {
  const [range, setRange] = useState<RangeKey>("1m");
  const thigh = astronaut.sensors.find((s) => s.site === "thigh");
  const shank = astronaut.sensors.find((s) => s.site === "shank");
  const { knee } = session;

  const { data, lastT, avg } = useMemo(() => {
    const samples = session.kneeSamples;
    const end = samples[samples.length - 1].t;
    const sec = RANGES.find((r) => r.key === range)!.sec;
    const d = sec === null ? samples : samples.filter((s) => s.t >= end - sec);
    const vals = d.map((s) => s.flexionDeg).filter((v): v is number => v !== null);
    return { data: d, lastT: end, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  }, [session, range]);

  const controls = (
    <div role="group" aria-label="Knee chart range" className="flex overflow-hidden rounded-md border border-cyan-400/40">
      {RANGES.map((r) => (
        <button key={r.key} type="button" aria-pressed={range === r.key} aria-label={r.aria} onClick={() => setRange(r.key)}
          className={`px-2 py-0.5 text-[13px] ${range === r.key ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <Panel id="knee" title="Knee Kinematics" icon="pulse" href="/joint-analytics" linkLabel="Joint analytics" action={controls} className="h-full">
      <div className="grid flex-1 gap-3 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-2">
          <KneeAnatomy angle={knee.currentAngleDeg} thigh={thigh} shank={shank} className="mx-auto w-full max-w-[300px]" />
          <p className="text-center text-[12px] leading-tight text-slate-500">Static knee illustration (supplied artwork); arc and labels are live</p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Current flexion" value={knee.currentAngleDeg} digits={1} unit="°" big />
            <Stat label="Peak flexion" value={knee.peakFlexionDeg} unit="°" sub="Session maximum" big />
            <Stat label="Range of motion" value={knee.romDeg} unit="°" sub="Peak minus minimum" big />
          </div>
        </div>
        <figure className="flex min-h-[260px] min-w-0 flex-col rounded-md bg-black/35 p-2">
          <figcaption className="mb-1 text-[13px] text-slate-300">
            Knee flexion (°) vs session time (mm:ss) &middot; {RANGES.find((r) => r.key === range)!.aria.toLowerCase()}
          </figcaption>
          <div className="min-h-[200px] flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 520, height: 220 }}>
              <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtClock} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} tickCount={6} />
                <YAxis domain={[0, 130]} ticks={[0, 30, 60, 90, 120]} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} width={34} unit="°" />
                {knee.peakFlexionDeg !== null && (
                  <ReferenceLine y={knee.peakFlexionDeg} stroke={C.amber} strokeDasharray="4 4"
                    label={{ value: `Peak ${knee.peakFlexionDeg}°`, fill: "#fde68a", fontSize: 12, position: "insideTopRight" }} />
                )}
                <Tooltip content={({ active, payload }) => <KneeTooltip active={active} payload={payload as never} />} cursor={{ stroke: C.cyan, strokeOpacity: 0.5 }} />
                <Line type="monotone" dataKey="flexionDeg" stroke={C.cyan} strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#fff", stroke: C.cyan }} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[13px] text-slate-300">
            ROM: {fmt(knee.minAngleDeg, "°")} &ndash; {fmt(knee.peakFlexionDeg, "°")} &middot; Avg (plotted): {fmt(avg, "°")}
          </p>
          <p className="sr-only">
            Chart shows {data.length} samples ending at {fmtClock(lastT)}. Current angle {fmt(knee.currentAngleDeg, " degrees", 1)}.
          </p>
        </figure>
      </div>
    </Panel>
  );
}
