"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Panel from "@/components/ui/Panel";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { fmt } from "@/lib/format";
import type { ProgressPoint } from "@/lib/demo/progress";

type TipPayload = ReadonlyArray<{ payload?: ProgressPoint }>;

function TrendTooltip({ active, payload }: { active?: boolean; payload?: TipPayload }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className={TIP_CLASS}>
      <p className="font-semibold text-white">{p.label}</p>
      <p className="text-slate-300">Knee ROM (of baseline) <span className="font-semibold text-cyan-300">{fmt(p.kneeRomPctOfBaseline, "%")}</span></p>
      <p className="text-slate-300">Gait symmetry <span className="font-semibold text-pink-300">{fmt(p.gaitSymmetryPct, "%")}</span></p>
      <p className="text-slate-300">Movement smoothness <span className="font-semibold text-lime-300">{fmt(p.movementSmoothnessPct, "%")}</span></p>
    </div>
  );
}

export default function TrendCard({ trend }: { trend: ProgressPoint[] }) {
  return (
    <Panel id="trend" title="Progress Trend" icon="chart" className="h-full">
      <figure className="flex min-h-[190px] flex-1 flex-col rounded-md bg-black/35 p-2">
        <p className="mb-1 text-[11px] text-slate-300">Last 8 sessions, from the saved session records. A gap = no measurement.</p>
        <figcaption className="sr-only">Knee ROM as a percentage of baseline, gait symmetry and movement smoothness by session, last 8 sessions</figcaption>
        <div className="min-h-[170px] flex-1">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 520, height: 180 }}>
            <LineChart data={trend} margin={{ top: 6, right: 14, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} />
              <YAxis domain={[50, 110]} ticks={[50, 60, 70, 80, 90, 100, 110]} tickFormatter={(v) => `${v}%`} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} width={38} />
              <Tooltip content={({ active, payload }) => <TrendTooltip active={active} payload={payload as never} />} cursor={{ stroke: C.cyan, strokeOpacity: 0.5 }} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: 11, color: AXIS }} />
              <Line name="Knee ROM (of baseline)" type="linear" connectNulls={false} dataKey="kneeRomPctOfBaseline" stroke={C.cyan} strokeWidth={2} dot={{ r: 3, fill: C.cyan }} isAnimationActive={false} />
              <Line name="Gait symmetry" type="linear" connectNulls={false} dataKey="gaitSymmetryPct" stroke={C.magenta} strokeWidth={2} dot={{ r: 3, fill: C.magenta }} isAnimationActive={false} />
              <Line name="Movement smoothness" type="linear" connectNulls={false} dataKey="movementSmoothnessPct" stroke={C.lime} strokeWidth={2} dot={{ r: 3, fill: C.lime }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </Panel>
  );
}
