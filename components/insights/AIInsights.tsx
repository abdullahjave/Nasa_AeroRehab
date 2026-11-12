"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip } from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import KneeAnatomy from "@/components/graphics/KneeAnatomy";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import RecordedInsights from "@/components/recorded/RecordedInsights";
import ReadingRows from "@/components/readings/ReadingRows";
import { READINGS } from "@/lib/alerts/glossary";
import { IREASON_TEXT, REDUCED_ROM_DEMO, insightView, type Finding, type IM } from "@/lib/insights";
import { sessionEnd } from "@/lib/demo";
import { EXERCISES, INSIGHT_EXERCISE_MATCH, programFor } from "@/lib/rehab";
import { GUIDANCE_SOURCE, demoGuidance, mmss } from "@/lib/alerts";
import AiRecommendationCard from "@/components/alerts/AiRecommendationCard";
import AlertHistory from "@/components/alerts/AlertHistory";
import NotAssessed from "@/components/alerts/NotAssessed";
import { TONE } from "@/components/alerts/AlertBadge";
import { useAlerts } from "@/components/alerts/useAlerts";

const VIOLET = "#a78bfa";
const n1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");
const signed = (v: number, unit = "") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n1(Math.abs(v))}${unit}`;
const why = (m: IM<unknown>) => (m.kind === "unavailable" ? IREASON_TEXT[m.reason] : "");

const SOURCE: Record<Finding["source"], { label: string; tone: "cyan" | "amber" | "green" }> = {
  calculated: { label: "Calculated from measurements", tone: "cyan" },
  measured: { label: "Measured data gap", tone: "amber" },
  seeded: { label: "Seeded demo scenario event", tone: "amber" },
};

export default function AIInsights() {
  const { dataMode } = useAstronaut();
  return dataMode === "recorded" ? <RecordedInsights /> : <DemoAIInsights />;
}

function DemoAIInsights() {
  const { astronaut, session, findingId, selectFinding, selectKneeSide, setJointFocus, setRehabFocus } = useAstronaut();
  const program = programFor(astronaut);
  const planItem = program ? `${EXERCISES[program.exercises[0]].name}, ${EXERCISES[program.exercises[0]].prescription}` : "no active plan";
  const v = useMemo(() => insightView(astronaut, session), [astronaut, session]);
  // A selection from another session is ignored (cleared) and the first finding is used instead.
  const { alerts, summary } = useAlerts();
  // The alert list is the single source: Overview opens an alert by its key, and the same alert is selected here.
  const selectedAlert = alerts.find((x) => x.key === findingId) ?? summary.primary ?? null;
  const selected = v.findings.find((f) => f.id === selectedAlert?.findingId) ?? null;
  const healthAlerts = alerts.filter((x) => x.kind === "health");
  const dataAlerts = alerts.filter((x) => x.kind === "data");
  const end = sessionEnd(session);
  const peakCur = v.peak.current.kind === "value" ? v.peak.current.value : null;

  const review = () => {
    selectKneeSide(v.context.side);
    setJointFocus(selected?.tSec != null ? { sessionId: session.id, tSec: selected.tSec } : null);
  };

  const diffChip = (m: IM<number>, pct: IM<number>) =>
    m.kind === "value" ? (
      <span className={`rounded-md border px-2 py-1 text-center text-sm font-semibold tabular-nums ${m.value < 0 ? "border-rose-400/70 bg-rose-500/15 text-rose-200" : "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"}`}>
        {m.value < 0 ? "↓" : m.value > 0 ? "↑" : ""} {signed(m.value, "°")}
        <span className="block text-[11px] font-normal">{pct.kind === "value" ? `(${signed(pct.value, "%")})` : why(pct)}</span>
      </span>
    ) : <span className="text-xs text-amber-200">{why(m)}</span>;

  // Open an exercise only on an explicit per-astronaut match that is part of the astronaut's program.
  const matchId = selected ? INSIGHT_EXERCISE_MATCH[astronaut.id]?.[selected.kind] : undefined;
  const match = matchId && program?.exercises.includes(matchId) ? EXERCISES[matchId] : null;

  const deltaEvents = v.previousEventCount === null ? null : v.events.length - v.previousEventCount;

  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">AI Insights</h1>
          <p className="text-xs text-slate-300">
            {astronaut.profile.displayName} &middot; {session.label} &middot; {v.context.side === "left" ? "Left" : "Right"} knee, {v.context.protocol} &middot; Simulated Data
          </p>
        </div>
        <SessionPicker />
      </header>

      {/* Actionable alerts first: severity, then time. Data issues are listed separately from health findings. */}
      <Panel id="ai-alerts" title="Your alerts" icon="warn">
        <p className="mb-2 text-[11px] text-slate-300">{summary.scope}</p>
        <NotAssessed />
        {healthAlerts.length === 0 ? (
          <p className="text-sm text-slate-200">No health check could be evaluated for this session, so nothing is shown as good or flagged.</p>
        ) : (
          <ul className="space-y-2" aria-label="Health findings">
            {healthAlerts.map((x) => <li key={x.id} id={`alert-${x.key}`} aria-current={selectedAlert?.id === x.id ? "true" : undefined} className="list-none"><AiRecommendationCard alert={x} variant="insights" selected={selectedAlert?.id === x.id} /></li>)}
          </ul>
        )}
        {dataAlerts.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-xs font-semibold text-slate-200">Data and sensor issues <span className="font-normal text-slate-400">(measurement problems, not health findings)</span></h3>
            <ul className="space-y-2" aria-label="Data and sensor issues">
              {dataAlerts.map((x) => <li key={x.id} id={`alert-${x.key}`} aria-current={selectedAlert?.id === x.id ? "true" : undefined} className="list-none"><AiRecommendationCard alert={x} variant="insights" selected={selectedAlert?.id === x.id} /></li>)}
            </ul>
          </div>
        )}
      </Panel>

      <AlertHistory />

      <Panel id="ai-readings" title="Your readings" icon="chart">
        <ReadingRows />
      </Panel>

      {/* Top row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr]">
        <Panel id="ai-angle" title="Knee Angle Analysis" icon="joint">
          <p className="mb-2 text-[11px] text-slate-300">How far your knee bent at its deepest point, next to your baseline session.</p>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-white">{v.peak.current.kind === "value" ? `${n1(v.peak.current.value)}°` : <span className="text-sm text-amber-200">Unavailable</span>}</p>
              <p className="text-[11px] text-slate-300">Current (peak flexion)</p>
            </div>
            <div className="border-l border-cyan-400/20 pl-4">
              <p className="text-3xl font-semibold tabular-nums text-white">{v.peak.baseline.kind === "value" ? `${n1(v.peak.baseline.value)}°` : <span className="text-sm text-amber-200">{why(v.peak.baseline)}</span>}</p>
              <p className="text-[11px] text-slate-300">Personal baseline{v.baselineDay ? ` (Day ${v.baselineDay})` : ""}</p>
            </div>
            {diffChip(v.peak.diff, v.peak.pct)}
          </div>
        </Panel>
        <Panel id="ai-rom" title="Knee movement" icon="compare">
          <p className="mb-1 text-[11px] text-slate-300">{READINGS.knee.meaning}</p>
          <p className="text-3xl font-semibold tabular-nums text-white">{v.rom.current.kind === "value" ? `${n1(v.rom.current.value)}°` : <span className="text-sm text-amber-200">Unavailable</span>}</p>
          <p className={`text-xs ${v.rom.diff.kind === "value" ? (v.rom.diff.value < 0 ? "text-rose-200" : "text-emerald-300") : "text-amber-200"}`}>
            {v.rom.diff.kind === "value" ? `(${v.rom.diff.value < 0 ? "↓" : "↑"} ${signed(v.rom.diff.value, "°")} vs. baseline${v.rom.baseline.kind === "value" ? ` ${n1(v.rom.baseline.value)}°` : ""})` : why(v.rom.diff)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">{READINGS.knee.technical}: {READINGS.knee.shows} (Joint Analytics convention)</p>
        </Panel>
        <Panel id="ai-events" title="Movement Anomalies" icon="pulse">
          <p className="mb-1 text-[11px] text-slate-300">Moments the demo scenario marked as unusual movement, plus gaps in the sensor data.</p>
          <p className="text-3xl font-semibold tabular-nums text-white">{v.events.length} <span className="text-base font-normal">Event{v.events.length === 1 ? "" : "s"}</span></p>
          <p className="text-xs text-slate-300">{deltaEvents === null ? "No previous session to compare" : `(${deltaEvents > 0 ? "↑ +" : deltaEvents < 0 ? "↓ " : ""}${deltaEvents} vs. previous session)`}</p>
          <p className="mt-1 text-[10px] text-slate-400">Seeded demo events plus measured data gaps, each counted once</p>
        </Panel>
      </div>

      {/* Middle row */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <Panel id="ai-chart" title="Knee Angle: Current vs. Personal Baseline" icon="joint" className="h-full">
            {v.chart.current.kind === "value" ? (
              <figure className="flex min-h-[260px] flex-1 flex-col rounded-md bg-black/35 p-2">
                <figcaption className="mb-1 text-[11px] text-slate-300">
                  Peak repetition of each recording, normalised to 0&ndash;100% of that repetition. Values appear only at real samples.
                  {v.chart.baseline.kind === "unavailable" && ` Baseline: ${why(v.chart.baseline)}.`}
                </figcaption>
                <div className="min-h-[220px] flex-1">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 230 }}>
                    <LineChart data={v.chart.rows} margin={{ top: 36, right: 16, bottom: 6, left: 0 }}>
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                      <XAxis dataKey="pct" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS}
                        label={{ value: "Repetition cycle (%)", position: "insideBottom", offset: -2, fill: AXIS, fontSize: 11 }} height={34} />
                      <YAxis domain={[0, 140]} ticks={[0, 20, 40, 60, 80, 100, 120, 140]} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} width={44}
                        label={{ value: "Angle (°)", angle: -90, position: "insideLeft", fill: AXIS, fontSize: 11, dx: 8 }} />
                      <Tooltip cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as { pct: number; current: number | null; baseline: number | null } | undefined;
                        if (!active || !r) return null;
                        return (
                          <div className={TIP_CLASS}>
                            <p className="text-slate-300">Cycle <span className="font-semibold text-white">{r.pct.toFixed(1)}%</span></p>
                            <p className="text-slate-300">Current <span className="font-semibold text-cyan-300">{r.current === null ? "no sample here" : `${n1(r.current)}°`}</span></p>
                            <p className="text-slate-300">Baseline <span className="font-semibold text-violet-300">{r.baseline === null ? "no sample here" : `${n1(r.baseline)}°`}</span></p>
                          </div>
                        );
                      }} />
                      <Legend verticalAlign="top" align="right" height={30} wrapperStyle={{ fontSize: 11, color: AXIS }} />
                      <Line name={`Current (Day ${session.missionDay})`} dataKey="current" stroke={C.cyan} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} type="monotone" />
                      {v.chart.baseline.kind === "value" && (
                        <Line name={`Personal baseline (Day ${v.baselineDay})`} dataKey="baseline" stroke={VIOLET} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} type="monotone" />
                      )}
                      <ReferenceDot x={v.chart.current.value.peak.pct} y={v.chart.current.value.peak.deg} r={5} fill="#fff" stroke={C.cyan} strokeWidth={2}
                        label={{ value: `${n1(v.chart.current.value.peak.deg)}° (Current)`, position: "bottom", fill: "#a5f3fc", fontSize: 11 }} />
                      {v.chart.baseline.kind === "value" && (
                        <ReferenceDot x={v.chart.baseline.value.peak.pct} y={v.chart.baseline.value.peak.deg} r={5} fill="#fff" stroke={VIOLET} strokeWidth={2}
                          label={{ value: `${n1(v.chart.baseline.value.peak.deg)}° (Baseline)`, position: "top", fill: "#ddd6fe", fontSize: 11 }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            ) : <p className="text-sm text-amber-200">Unavailable: {why(v.chart.current)}</p>}
          </Panel>
        </div>
        <div className="xl:col-span-3">
          <Panel id="ai-anatomy" title="Knee Anatomy" icon="joint" className="h-full">
            <KneeAnatomy angle={peakCur} thigh={astronaut.sensors.find((s) => s.site === "thigh")} shank={astronaut.sensors.find((s) => s.site === "shank")} className="mx-auto w-full max-w-[250px]" />
            <p className="mt-1 text-center text-[10px] text-slate-400">Knee illustration is static (supplied artwork); the arc shows the session peak flexion.</p>
          </Panel>
        </div>
        <div className="xl:col-span-3">
          <Panel id="ai-key" title="Key Insight" icon="warn" className="h-full">
            {selected ? (
              <div className={`flex flex-1 flex-col rounded-md border p-3 ${TONE[selectedAlert?.severity ?? "attention"].box}`} aria-live="polite">
                <p className={`text-base font-semibold ${TONE[selectedAlert?.severity ?? "attention"].text}`}>{selected.title}</p>
                <p className="mt-1"><Chip tone={SOURCE[selected.source].tone}>{SOURCE[selected.source].label}</Chip></p>
                <p className="mt-2 text-sm text-slate-100">{selected.text}</p>
                <dl className="mt-2 space-y-0.5 text-[11px]">
                  <div className="flex gap-1"><dt className="text-slate-400">Metric:</dt><dd className="text-white">{selected.metric}</dd></div>
                  <div className="flex gap-1"><dt className="text-slate-400">Session:</dt><dd className="text-white">{session.label}{selected.tSec != null ? ` · at ${mmss(selected.tSec)}` : ""}</dd></div>
                </dl>
                <Link href="/joint-analytics" onClick={review}
                  className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-cyan-400/60 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/20">
                  Review measurement &rarr;
                </Link>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm">
                <p className="font-semibold text-white">No findings for this session</p>
                <p className="text-xs text-slate-300">
                  {v.baselineComparable ? `ROM change does not reach the demo threshold (${REDUCED_ROM_DEMO.thresholdPct}%).` : "No comparable baseline, so no ROM comparison is made."} No timeline events.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <Panel id="ai-timeline" title="Movement Anomaly Timeline" icon="pulse" className="h-full">
            <div className="mb-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-slate-300">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Seeded scenario event</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" />Measured data gap</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-cyan-300" />Selected</span>
            </div>
            <div className="relative mx-2 h-14">
              <div className="absolute inset-x-0 top-5 h-1 rounded-full bg-emerald-400/50" />
              {Array.from({ length: Math.floor(end / 300) + 1 }).map((_, i) => (
                <span key={i} className="absolute top-9 -translate-x-1/2 text-[10px] text-slate-400" style={{ left: `${((i * 300) / end) * 100}%` }}>{i * 5} min</span>
              ))}
              {v.events.map((e) => {
                const isSel = selected?.id === e.id;
                const left = (e.tSec / end) * 100;
                return (
                  <button key={e.id} type="button" onClick={() => selectFinding(e.id)} aria-pressed={isSel}
                    aria-label={`${e.label} at ${mmss(e.tSec)}${e.source === "seeded" ? ", seeded demo event" : ", measured data gap"}`}
                    className={`absolute top-2.5 h-6 w-6 -translate-x-1/2 rounded-full ${isSel ? "ring-2 ring-cyan-300" : ""}`} style={{ left: `${left}%` }}>
                    <span className={`absolute inset-1 ${e.source === "seeded" ? "rounded-full bg-rose-400" : "rounded-sm bg-amber-300"}`} />
                  </button>
                );
              })}
              <span className="absolute top-3 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-cyan-300/70" style={{ left: "100%" }} title="Session end" />
            </div>
            {v.events.length === 0 ? (
              <p className="mt-2 text-sm text-slate-300">No events in this session.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {v.events.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => selectFinding(e.id)} aria-pressed={selected?.id === e.id}
                      className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left ${selected?.id === e.id ? "border-cyan-300 bg-cyan-400/10" : "border-cyan-400/15 hover:bg-white/5"}`}>
                      <span className="text-white">{mmss(e.tSec)} &middot; {e.label}</span>
                      <span className="text-slate-400">{e.source === "seeded" ? "Seeded demo" : "Measured"}</span>
                    </button>
                  </li>
                ))}
                {v.findings.filter((f) => f.tSec === null).map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => selectFinding(f.id)} aria-pressed={selected?.id === f.id}
                      className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left ${selected?.id === f.id ? "border-cyan-300 bg-cyan-400/10" : "border-cyan-400/15 hover:bg-white/5"}`}>
                      <span className="text-white">Whole session &middot; {f.title}</span>
                      <span className="text-slate-400">Calculated</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="xl:col-span-6">
          <Panel id="ai-recs" title="Rehabilitation Recommendations" icon="check" className="h-full">
            <p className="mb-2 text-[11px] text-amber-200">Demo guidance tied to the selected finding. Source: {GUIDANCE_SOURCE}. Not a clinical recommendation.</p>
            <ul className="space-y-2 text-sm text-slate-100">
              {demoGuidance(selected?.kind ?? null, v.baselineDay, planItem, selected?.tSec ?? null).map((g) => (
                <li key={g} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[11px] text-emerald-300" aria-hidden="true">&#10003;</span>
                  {g}
                </li>
              ))}
            </ul>
            {match ? (
              <Link href="/rehabilitation" onClick={() => setRehabFocus({ astronautId: astronaut.id, exerciseId: match.id, at: Date.now() })}
                className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-cyan-400/60 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/20">
                Open exercise: {match.name} &rarr;
              </Link>
            ) : (
              <p className="mt-2 text-[10px] text-slate-400">No explicit exercise match for this finding, so guidance is shown as text.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
