"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import RecordedGait from "@/components/recorded/RecordedGait";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip, Stat } from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import GaugeRing from "@/components/ui/GaugeRing";
import WalkingFigure from "@/components/graphics/WalkingFigure";
import PhotoPose from "@/components/graphics/PhotoPose";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { fmt, fmtSigned } from "@/lib/format";
import { GAIT_PHASES, gaitCurveRows, getLatestSession, jointAnglesAt, phaseAt } from "@/lib/demo";

function EmptyState({ onLatest, label, canSwitch }: { onLatest: () => void; label: string; canSwitch: boolean }) {
  return (
    <Panel id="empty" title="Gait Analysis" icon="walk" className="min-h-[320px]">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-cyan-400/30 p-6 text-center">
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-amber-200" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 20l2-6-3-3 2-5 4 3 3 1M12 14l4 6" /><path d="M3 3l18 18" />
        </svg>
        <p className="text-lg font-semibold text-white">No gait data for this session</p>
        <p className="max-w-md text-sm text-slate-300">{label} has no walking recording (for example a seated range-of-motion session), so speed, cadence, stride length and the gait cycle are Unavailable.</p>
        {canSwitch && <button type="button" onClick={onLatest} className="rounded-md border border-cyan-400/50 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-400/20">Switch to the latest session</button>}
      </div>
    </Panel>
  );
}

function StepTimeline({ left, right }: { left: number[]; right: number[] }) {
  const x = (t: number) => 38 + (t / 10) * 300;
  return (
    <svg viewBox="0 0 360 96" className="h-28 w-full" role="img" aria-label={`Step timeline over 10 seconds, ${left.length} left steps and ${right.length} right steps`}>
      <text x="4" y="30" fontSize="9" fill={C.cyan}>Left Step</text>
      <text x="4" y="58" fontSize="9" fill={C.magenta}>Right Step</text>
      <line x1="38" x2="338" y1="38" y2="38" stroke={GRID} />
      <line x1="38" x2="338" y1="66" y2="66" stroke={GRID} />
      {left.map((t) => <line key={`l${t}`} x1={x(t)} x2={x(t)} y1="18" y2="38" stroke={C.cyan} strokeWidth="3" strokeLinecap="round" />)}
      {right.map((t) => <line key={`r${t}`} x1={x(t)} x2={x(t)} y1="46" y2="66" stroke={C.magenta} strokeWidth="3" strokeLinecap="round" />)}
      {Array.from({ length: 11 }).map((_, i) => (
        <g key={i}>
          <line x1={x(i)} x2={x(i)} y1="72" y2="76" stroke={AXIS} />
          <text x={x(i)} y="88" textAnchor="middle" fontSize="9" fill={AXIS}>{i}s</text>
        </g>
      ))}
    </svg>
  );
}

function Donut({ stance, swing }: { stance: number; swing: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label={`Stance ${stance} percent, swing ${swing} percent`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e879f9" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={C.cyan} strokeWidth="12" strokeDasharray={`${(c * stance) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="49" textAnchor="middle" fontSize="17" fontWeight="600" fill="#fff">{stance}%</text>
      <text x="50" y="63" textAnchor="middle" fontSize="9" fill="#cbd5e1">Stance</text>
    </svg>
  );
}

/** Axis that fits the data: whole `step` multiples around min and max, so it never clips the series. */
function axisFor(values: number[], step: number) {
  const lo = Math.floor(Math.min(...values) / step + 1e-9) * step;
  let hi = Math.ceil(Math.max(...values) / step - 1e-9) * step;
  if (hi - lo < step * 2) hi = lo + step * 2;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { domain: [ticks[0], ticks[ticks.length - 1]] as [number, number], ticks };
}

export default function GaitAnalysis() {
  const { dataMode } = useAstronaut();
  return dataMode === "recorded" ? <RecordedGait /> : <DemoGaitAnalysis />;
}

function DemoGaitAnalysis() {
  const { astronaut, session, selectSession } = useAstronaut();
  const g = session.gait;
  const [p, setP] = useState(0);
  const phase = phaseAt(p);
  const rows = useMemo(() => (g ? gaitCurveRows(g.curveScale) : []), [g]);
  const angles = g ? jointAnglesAt(p, g.curveScale) : null;

  const header = (
    <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Gait Analysis</h1>
        <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Simulated Data</p>
      </div>
      <SessionPicker />
    </header>
  );

  if (g === null) {
    const latest = getLatestSession(astronaut);
    return (
      <div className="space-y-3">
        {header}
        <EmptyState label={session.label} canSwitch={latest.id !== session.id && latest.gait !== null} onLatest={() => selectSession(latest.id)} />
      </div>
    );
  }

  const symLabel = g.symmetryPct === null ? null : g.symmetryPct >= 95 ? "Excellent" : g.symmetryPct >= 90 ? "Good" : "Fair";
  const regLabel = g.regularity === null ? null : g.regularity >= 0.9 ? "Stable" : g.regularity >= 0.8 ? "Moderate" : "Irregular";

  return (
    <div className="space-y-3">
      {header}

      <div className="grid gap-3 xl:grid-cols-12">
        {/* Figure + phase details */}
        <div className="xl:col-span-3">
          <Panel id="figure" title="Walking Model" icon="walk" className="h-full">
            <div className="flex flex-1 flex-col gap-2">
              <WalkingFigure p={p} scale={g.curveScale} className="mx-auto h-[22rem] w-full max-w-[220px]" ariaLabel={`Walking figure, ${phase.label} at ${p} percent of the cycle`} />
              <div className="rounded-md border border-cyan-400/30 bg-black/30 p-2" aria-live="polite">
                <p className="flex items-center justify-between text-sm font-semibold text-white">
                  {phase.label}
                  <Chip tone={phase.support === "Stance" ? "cyan" : "amber"}>{phase.support}</Chip>
                </p>
                <p className="text-[11px] text-slate-400">Cycle {p}% &middot; range {phase.range[0]}&ndash;{phase.range[1]}%</p>
                <p className="mt-1 text-xs text-slate-200">{phase.detail}</p>
                <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                  {angles && ([["Hip", angles.hip, C.cyan], ["Knee", angles.knee, C.magenta], ["Ankle", angles.ankle, C.lime]] as const).map(([n, v, col]) => (
                    <div key={n}><dt style={{ color: col }}>{n}</dt><dd className="tabular-nums text-white">{fmtSigned(v, "°", 1)}</dd></div>
                  ))}
                </dl>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 xl:col-span-9">
          {/* Metric row */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Panel id="speed" title="Walking Speed" icon="walk">
              <p className="text-2xl font-semibold tabular-nums text-white">{g.speedMs === null ? <span className="text-sm text-amber-200">Unavailable</span> : <>{g.speedMs.toFixed(2)} <span className="text-sm font-normal text-slate-300">m/s</span></>}</p>
              {g.speedDeltaPct !== null && <p className={`text-xs ${g.speedDeltaPct >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{g.speedDeltaPct >= 0 ? "↑" : "↓"} {fmtSigned(g.speedDeltaPct, "%", 0)} vs last session</p>}
            </Panel>
            <Panel id="cadence" title="Cadence" icon="foot"><Stat label="" value={g.cadenceSpm} unit="steps/min" big /></Panel>
            <Panel id="stride" title="Stride Length" icon="timeline"><Stat label="" value={g.strideLengthM} digits={2} unit="m" big /></Panel>
            <Panel id="sym" title="Gait Symmetry">
              <div className="flex items-center gap-2">
                <GaugeRing value={g.symmetryPct} max={100} color={C.green} size="h-16 w-16" ariaLabel={`Gait symmetry ${g.symmetryPct} percent`} />
                <div><p className="text-xl font-semibold tabular-nums text-white">{fmt(g.symmetryPct, "%")}</p>{symLabel && <Chip>{symLabel}</Chip>}</div>
              </div>
            </Panel>
            <Panel id="reg" title="Step Regularity">
              <div className="flex items-center gap-2">
                <GaugeRing value={g.regularity === null ? null : g.regularity * 100} max={100} color={C.green} size="h-16 w-16" ariaLabel={`Step regularity ${g.regularity}`} />
                <div><p className="text-xl font-semibold tabular-nums text-white">{fmt(g.regularity, "", 2)}</p>{regLabel && <Chip>{regLabel}</Chip>}</div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Panel id="cycle" title="Gait Cycle (Joint Angles)" icon="pulse" className="h-full">
                <figure className="flex min-h-[250px] flex-1 flex-col rounded-md bg-black/35 p-2">
                  <figcaption className="mb-1 text-[11px] text-slate-300">Joint angle (°) vs gait cycle (% of stride). Click the chart or use the scrubber.</figcaption>
                  <div className="min-h-[210px] flex-1">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 230 }}>
                      <LineChart data={rows} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}
                        onClick={(s) => { const x = (s as { activeLabel?: string | number } | undefined)?.activeLabel; if (x !== undefined && !Number.isNaN(Number(x))) setP(Math.round(Number(x))); }}>
                        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                        <XAxis dataKey="p" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} />
                        <YAxis domain={[-30, 90]} ticks={[-30, 0, 30, 60, 90]} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} width={36} unit="°" />
                        <ReferenceArea x1={phase.range[0]} x2={phase.range[1]} fill="#22d3ee" fillOpacity={0.14} />
                        <ReferenceLine x={p} stroke="#fff" strokeOpacity={0.85} strokeDasharray="4 3" />
                        <Tooltip content={({ active, payload }) => {
                          const r = payload?.[0]?.payload as { p: number; hip: number; knee: number; ankle: number } | undefined;
                          if (!active || !r) return null;
                          return <div className={TIP_CLASS}><p className="text-slate-300">Cycle <span className="font-semibold text-white">{r.p}%</span></p>
                            <p className="text-slate-300">Hip <span className="font-semibold text-cyan-300">{fmt(r.hip, "°", 1)}</span></p>
                            <p className="text-slate-300">Knee <span className="font-semibold text-pink-300">{fmt(r.knee, "°", 1)}</span></p>
                            <p className="text-slate-300">Ankle <span className="font-semibold text-lime-300">{fmt(r.ankle, "°", 1)}</span></p></div>;
                        }} cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} />
                        <Legend verticalAlign="top" align="right" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, color: AXIS }} />
                        <Line name="Hip" dataKey="hip" stroke={C.cyan} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line name="Knee" dataKey="knee" stroke={C.magenta} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line name="Ankle" dataKey="ankle" stroke={C.lime} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-center text-[11px] text-slate-300">Gait Cycle (% of Stride)</p>
                </figure>
              </Panel>
            </div>
            <div className="lg:col-span-4">
              <Panel id="keym" title="Key Metrics" className="h-full">
                <table className="w-full text-sm">
                  <caption className="sr-only">Key gait metrics</caption>
                  <tbody>
                    {[
                      ["Stance Phase", fmt(g.stancePct, "%")],
                      ["Swing Phase", fmt(g.swingPct, "%")],
                      ["Double Support", fmt(g.doubleSupportPct, "%")],
                      ["Step Time", fmt(g.stepTimeS, " s", 2)],
                      ["Stride Time", fmt(g.strideTimeS, " s", 2)],
                    ].map(([k, v]) => (
                      <tr key={k} className="border-b border-cyan-400/15 last:border-0">
                        <th scope="row" className="py-1.5 text-left font-normal text-slate-300">{k}</th>
                        <td className={`py-1.5 text-right tabular-nums ${v === "Unavailable" ? "text-amber-200" : "text-white"}`}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Panel id="timeline" title="Gait Cycle Timeline" icon="timeline" className="h-full">
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-200">
              <label htmlFor="scrub">Scrub gait cycle</label>
              <input id="scrub" type="range" min={0} max={100} step={1} value={p} onChange={(e) => setP(Number(e.target.value))}
                className="h-1.5 min-w-[10rem] flex-1 accent-cyan-400" aria-valuetext={`${p}% of the gait cycle, ${phase.label}`} />
              <span className="tabular-nums text-white">{p}%</span>
            </div>
            <div role="group" aria-label="Gait phases" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {GAIT_PHASES.map((ph) => {
                const active = ph.key === phase.key;
                return (
                  <button key={ph.key} type="button" aria-pressed={active} onClick={() => setP(ph.p)}
                    className={`flex flex-col items-center rounded-md border p-1 ${active ? "border-cyan-300 bg-cyan-400/15" : "border-cyan-400/20 hover:bg-white/5"}`}>
                    {ph.key === "pre-swing" ? (
                      // The only supplied walking pose that matches a phase: rear foot at toe-off, front foot flat (double support).
                      <PhotoPose src="/images/gait-phase-preswing.webp" alt={`${ph.label} pose (supplied illustration)`} className="h-24 w-full"
                        fallback={<WalkingFigure p={ph.p} scale={g.curveScale} glow={false} className="h-24 w-full" ariaLabel={`${ph.label} pose`} />} />
                    ) : (
                      <WalkingFigure p={ph.p} scale={g.curveScale} glow={false} className="h-24 w-full" ariaLabel={`${ph.label} pose`} />
                    )}
                    <span className="text-center text-[11px] leading-tight text-slate-100">{ph.label}</span>
                    <span className="text-[10px] text-slate-400">{ph.p}%</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Panel id="dist" title="Phase Distribution" className="h-full">
            <div className="flex flex-1 items-center gap-4">
              {g.stancePct !== null && g.swingPct !== null ? (
                <>
                  <Donut stance={g.stancePct} swing={g.swingPct} />
                  <ul className="space-y-2 text-sm text-white">
                    <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-cyan-400" aria-hidden="true" />Stance <span className="ml-auto tabular-nums">{g.stancePct}%</span></li>
                    <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-fuchsia-400" aria-hidden="true" />Swing <span className="ml-auto tabular-nums">{g.swingPct}%</span></li>
                  </ul>
                </>
              ) : <p className="text-sm text-amber-200">Unavailable</p>}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Panel id="steps" title="Step Timeline (10 s)" icon="timeline" className="h-full">
            {g.stepEvents ? <StepTimeline left={g.stepEvents.leftS} right={g.stepEvents.rightS} /> : <p className="text-sm text-amber-200">Unavailable</p>}
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Panel id="s2s" title="Stride-to-Stride Analysis" icon="chart" className="h-full">
            {g.strideSeries ? (
              <figure className="flex min-h-[150px] flex-1 flex-col rounded-md bg-black/35 p-2">
                <figcaption className="sr-only">Stride length (m) and step time (s) over 30 strides</figcaption>
                <div className="min-h-[140px] flex-1">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 420, height: 150 }}>
                    <LineChart data={g.strideSeries.strideLengthM.map((v, i) => ({ n: i + 1, len: v, step: g.strideSeries!.stepTimeS[i] }))} margin={{ top: 4, right: 4, bottom: 2, left: 0 }}>
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                      <XAxis dataKey="n" type="number" domain={[1, 30]} ticks={[1, 5, 10, 15, 20, 25, 30]} tick={{ fill: AXIS, fontSize: 10 }} stroke={AXIS} />
                      <YAxis yAxisId="l" domain={axisFor(g.strideSeries.strideLengthM, 0.1).domain} ticks={axisFor(g.strideSeries.strideLengthM, 0.1).ticks} tickFormatter={(v) => Number(v).toFixed(2)} tick={{ fill: AXIS, fontSize: 10 }} stroke={C.cyan} width={38} />
                      <YAxis yAxisId="r" orientation="right" domain={axisFor(g.strideSeries.stepTimeS, 0.02).domain} ticks={axisFor(g.strideSeries.stepTimeS, 0.02).ticks} tickFormatter={(v) => Number(v).toFixed(2)} tick={{ fill: AXIS, fontSize: 10 }} stroke={C.magenta} width={38} />
                      <Tooltip content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as { n: number; len: number; step: number } | undefined;
                        if (!active || !r) return null;
                        return <div className={TIP_CLASS}><p className="text-slate-300">Stride <span className="font-semibold text-white">#{r.n}</span></p><p className="text-slate-300">Length <span className="font-semibold text-cyan-300">{fmt(r.len, " m", 2)}</span></p><p className="text-slate-300">Step time <span className="font-semibold text-pink-300">{fmt(r.step, " s", 2)}</span></p></div>;
                      }} />
                      <Legend verticalAlign="top" align="right" height={20} iconType="circle" wrapperStyle={{ fontSize: 10, color: AXIS }} />
                      <Line yAxisId="l" name="Stride Length (m)" dataKey="len" stroke={C.cyan} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                      <Line yAxisId="r" name="Step Time (s)" dataKey="step" stroke={C.magenta} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-[10px] text-slate-400">Stride #</p>
              </figure>
            ) : <p className="text-sm text-amber-200">Unavailable</p>}
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Panel id="gaitai" title="AI Gait Insights" icon="brain" href="/ai-insights" linkLabel="AI insights" className="h-full">
            <div className="flex flex-1 items-start gap-2 rounded-md border border-emerald-400/40 bg-emerald-400/5 p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-10" /></svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-emerald-200">{g.insight.title}</p>
                <p className="mt-0.5 text-xs text-slate-200">{g.insight.text}</p>
                <p className="mt-1 text-[10px] text-slate-400">Simulated &middot; {session.id}</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
