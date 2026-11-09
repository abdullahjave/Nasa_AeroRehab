"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Panel from "@/components/ui/Panel";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { fmt } from "@/lib/format";
import type { TrendPoint } from "@/lib/demo";

type TipPayload = ReadonlyArray<{ payload?: TrendPoint }>;

function TrendTooltip({ active, payload }: { active?: boolean; payload?: TipPayload }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className={TIP_CLASS}>
      <p className="font-semibold text-white">{p.label}</p>
      <p className="text-slate-300">Knee ROM <span className="font-semibold text-cyan-300">{fmt(p.kneeRomPct, "%")}</span></p>
      <p className="text-slate-300">Gait symmetry <span className="font-semibold text-pink-300">{fmt(p.gaitSymmetryPct, "%")}</span></p>
      <p className="text-slate-300">Movement score <span className="font-semibold text-lime-300">{fmt(p.movementScorePct, "%")}</span></p>
    </div>
  );
}

export default function TrendCard({ trend }: { trend: TrendPoint[] }) {
  return (
    <Panel id="trend" title="Progress Trend" icon="chart" className="h-full">
      <figure className="flex min-h-[190px] flex-1 flex-col rounded-md bg-black/35 p-2">
        <figcaption className="sr-only">Knee ROM, gait symmetry and movement score (percent) by mission day</figcaption>
        <div className="min-h-[170px] flex-1">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 520, height: 180 }}>
            <LineChart data={trend} margin={{ top: 6, right: 14, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} />
              <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} width={38} />
              <Tooltip content={({ active, payload }) => <TrendTooltip active={active} payload={payload as never} />} cursor={{ stroke: C.cyan, strokeOpacity: 0.5 }} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: 11, color: AXIS }} />
              <Line name="Knee ROM" type="monotone" dataKey="kneeRomPct" stroke={C.cyan} strokeWidth={2} dot={{ r: 3, fill: C.cyan }} isAnimationActive={false} />
              <Line name="Gait Symmetry" type="monotone" dataKey="gaitSymmetryPct" stroke={C.magenta} strokeWidth={2} dot={{ r: 3, fill: C.magenta }} isAnimationActive={false} />
              <Line name="Movement Score" type="monotone" dataKey="movementScorePct" stroke={C.lime} strokeWidth={2} dot={{ r: 3, fill: C.lime }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </Panel>
  );
}
