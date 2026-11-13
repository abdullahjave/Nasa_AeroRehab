"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { METRIC_META, paddedDomain, visibleMetrics, type buildReport } from "@/lib/reports";
import { ORIGIN_LABEL, SUMMARY_RULE, reportAssessments, type ReportAssessment } from "@/lib/recorded/assessments";
import { dayLabel, excludedTicksNote, type Ratio } from "@/lib/rehab";
import type { AstronautRecord, Mission } from "@/lib/demo";
import { fmtAgg, fmtChange, tickDays } from "./format";

type Report = ReturnType<typeof buildReport>;

const PRINT_COLORS = { romDeg: "#0e7490", speedMs: "#a21caf", balanceIndex: "#15803d" } as const;

/** Light "paper" report used for the PDF preview and for printing (Save PDF). */
export default function ReportDocument({
  a, mission, report, scopeLabel, rehab, className = "", recorded = false, excludedTicks = 0,
}: {
  a: AstronautRecord; mission: Mission; report: Report; scopeLabel: string;
  rehab: { completion: Ratio; adherence: Ratio; basis: "plan" | "recorded" } | null; className?: string; excludedTicks?: number;
  /** Recorded mode: only sections supported by saved records are printed, and the document is labelled Recorded Data. */
  recorded?: boolean;
}) {
  const r = report.range;
  const ticks = tickDays(r.start, r.end, 5);
  const shown = visibleMetrics(report, recorded);
  const charts = [
    { key: "romDeg" as const, step: 5, minSpan: 10, ceil: Infinity },
    { key: "speedMs" as const, step: 0.05, minSpan: 0.2, ceil: Infinity },
    { key: "balanceIndex" as const, step: 5, minSpan: 10, ceil: 100 },
  ].filter((c) => shown.includes(c.key));
  const rows = report.rows.filter((row) => shown.includes(row.metric));
  const assess = recorded ? reportAssessments(a, report.range) : { pressure: [], balance: [] };
  return (
    <article className={`report-doc mx-auto w-full max-w-[760px] rounded-md bg-white p-6 text-slate-900 shadow-xl ${className}`} aria-label="Report document">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-300 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">AeroRehab</p>
          <h2 className="text-xl font-bold">Rehabilitation Report</h2>
          <p className="text-sm text-slate-700">{scopeLabel}</p>
        </div>
        <span className="rounded border-2 border-amber-600 px-2 py-0.5 text-xs font-bold text-amber-700">{recorded ? "RECORDED DATA" : "SIMULATED DATA"}</span>
      </header>

      <dl className="avoid-break mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Astronaut</dt><dd className="font-medium">{a.profile.fullName}</dd></div>
        <div><dt className="text-slate-500">Astronaut ID</dt><dd className="font-medium">{a.id} ({a.profile.crewCode})</dd></div>
        <div><dt className="text-slate-500">Role</dt><dd className="font-medium">{a.profile.role}</dd></div>
        <div><dt className="text-slate-500">Rehab focus</dt><dd className="font-medium">{a.profile.rehabFocus}</dd></div>
        <div><dt className="text-slate-500">Mission</dt><dd className="font-medium">{mission.name}</dd></div>
        <div><dt className="text-slate-500">Reporting period</dt><dd className="font-medium">Day {r.start}&ndash;{r.end} ({dayLabel(r.start)} &ndash; {dayLabel(r.end)}, inclusive)</dd></div>
        <div><dt className="text-slate-500">Comparison period</dt><dd className="font-medium">{report.prevRange.end < 1
                ? "None (before mission start)"
                : report.prevRange.start < 1
                  ? `Day 1 to ${report.prevRange.end} (shorter than the reporting period: mission data starts at Day 1)`
                  : `Day ${report.prevRange.start} to ${report.prevRange.end}, same length`}</dd></div>
        {(!recorded || report.ref) && <div><dt className="text-slate-500">Knee reference</dt><dd className="font-medium">{report.ref ? `${report.ref.side} knee, ${report.ref.protocol}` : "None"}</dd></div>}
      </dl>

      {!(recorded ? report.hasData : report.cur.length > 0) ? (
        <p className="mt-4 rounded border border-slate-300 p-3 text-sm">{recorded ? "No knee, walking, pressure or balance records for this astronaut in the reporting period." : "No sessions for this astronaut in the reporting period."}</p>
      ) : (
        <>
          {charts.length > 0 && <section className="avoid-break mt-4 flex flex-wrap gap-3">
            {charts.map((c) => (
              <figure key={c.key} className="min-w-[180px] flex-1 rounded border border-slate-300 p-2">
                <figcaption className="text-xs font-semibold">{METRIC_META[c.key].label} ({METRIC_META[c.key].unit.trim()}) &middot; {report.series(c.key).filter((d) => d.value !== null).length} sessions</figcaption>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 220, height: 128 }}>
                    <LineChart data={report.series(c.key)} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="#e2e8f0" />
                      <XAxis dataKey="day" type="number" domain={[r.start, r.end]} ticks={ticks} tickFormatter={dayLabel} tick={{ fill: "#334155", fontSize: 9 }} stroke="#94a3b8" />
                      <YAxis domain={paddedDomain(report.series(c.key).map((d) => d.value), c.step, c.minSpan, 0, c.ceil) ?? [0, 1]} tickCount={4} tickFormatter={(v) => Number(v).toFixed(c.key === "speedMs" ? 2 : 0)} tick={{ fill: "#334155", fontSize: 9 }} stroke="#94a3b8" width={c.key === "speedMs" ? 42 : 34} />
                      <Line dataKey="value" stroke={PRINT_COLORS[c.key]} strokeWidth={1.6} dot={{ r: 2.2, fill: PRINT_COLORS[c.key], strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            ))}
          </section>}

          {rows.length > 0 && <table className="avoid-break mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-400 text-left">
                <th className="py-1 pr-2">Metric</th><th className="pr-2">Current period</th><th className="pr-2">Previous period</th><th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.metric} className="border-b border-slate-200">
                  <td className="py-1 pr-2">{METRIC_META[row.metric].label}</td>
                  <td className="pr-2">{fmtAgg(row.current, row.metric)}</td>
                  <td className="pr-2">{fmtAgg(row.previous, row.metric)}</td>
                  <td>{fmtChange(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>}
          {rows.length > 0 && <p className="mt-1 text-[13px] text-slate-600">Values are means of valid session values (n = sessions). ROM uses only sessions with the same knee side and protocol. Missing values are excluded, never counted as 0.</p>}
          {assess.pressure.length > 0 && <AssessmentTable title="Load & pressure assessments" items={assess.pressure} />}
          {assess.balance.length > 0 && <AssessmentTable title="Balance trials" items={assess.balance} />}
          {(assess.pressure.length > 0 || assess.balance.length > 0) && <p className="mt-1 text-[13px] text-slate-600">{SUMMARY_RULE} Each value shows its source. Load share = foot force ÷ combined force × 100. No Balance Index is given for recorded balance data.</p>}
        </>
      )}

      {!recorded && report.latestSession && <LatestSession a={a} s={report.latestSession} />}

      <section className="avoid-break mt-3 grid gap-3 sm:grid-cols-2">
        {(rehab?.basis === "recorded" ? (
          <div className="rounded border border-slate-300 p-2 text-sm" data-testid="doc-rehab">
            <p className="font-semibold">Rehabilitation (Day {r.start}&ndash;{r.end}, recorded completions)</p>
            <p>Completion rate: {rehab.completion.kind === "value" ? `${rehab.completion.pct.toFixed(1)}% (${rehab.completion.num}/${rehab.completion.den} assigned items completed)` : "Unavailable"}</p>
            <p>Sessions fully completed: {rehab.adherence.kind === "value" ? `${rehab.adherence.pct.toFixed(1)}% (${rehab.adherence.num}/${rehab.adherence.den} sessions with recorded completions)` : "Unavailable"}</p>
          </div>
        ) : (
          <div className="rounded border border-slate-300 p-2 text-sm" data-testid="doc-rehab">
            <p className="font-semibold">Rehabilitation (through Day {r.end})</p>
            {rehab ? (
              <>
                <p className="text-slate-600">Ground / Post-flight sample plan (simulated)</p>
                <p>Completion rate: {rehab.completion.kind === "value" ? `${rehab.completion.pct.toFixed(1)}% (${rehab.completion.num}/${rehab.completion.den} items)` : "Unavailable"}</p>
                <p>Weekly adherence (week of Day {r.end}): {rehab.adherence.kind === "value" ? `${rehab.adherence.pct.toFixed(1)}% (${rehab.adherence.num}/${rehab.adherence.den} sessions)` : "Unavailable"}</p>
              </>
            ) : <><p data-testid="doc-rehab-none">No plan assigned. No completion rate is calculated.</p>{excludedTicksNote(excludedTicks) && <p className="text-slate-600" data-testid="doc-rehab-excluded">{excludedTicksNote(excludedTicks)}</p>}</>}
          </div>
        ))}
        {(!recorded || report.latestSession) && <div className="rounded border border-slate-300 p-2 text-sm">
          <p className="font-semibold">AI insights ({report.latestSession ? report.latestSession.label : "no session"})</p>
          {report.insights && report.insights.findings.length ? (
            <ul className="list-disc pl-4">{report.insights.findings.map((f) => <li key={f.id}>{f.title}{f.tSec !== null ? ` at ${Math.floor(f.tSec / 60)}:${String(Math.round(f.tSec % 60)).padStart(2, "0")}` : ""} <span className="text-slate-500">({f.source === "calculated" ? "calculated" : f.source === "measured" ? "measured" : "seeded demo"})</span></li>)}</ul>
          ) : <p>No findings.</p>}
        </div>}
      </section>
      <footer className="mt-2 border-t border-slate-300 pt-1 text-[12px] text-slate-500">
        {recorded ? "Recorded data saved in the local AeroRehab database (manual entries and imported sensor CSV files, each labelled). Not a clinical document." : "Simulated data for demonstration. Not a clinical document."} Dates: mission Day 1 = Sep 30, 2026 (UTC). Units: degrees, m/s, steps/min, N, kPa, mm, %.
      </footer>
    </article>
  );
}

/** The newest session in the period, read from the same session record the other pages use, so the document differs for every astronaut. */
function LatestSession({ a, s }: { a: AstronautRecord; s: NonNullable<Report["latestSession"]> }) {
  const base = s.joint.baseline;
  const rom = s.knee.romDeg;
  const rows: [string, string][] = [
    ["Knee range of motion", rom === null ? "Unavailable" : `${rom.toFixed(0)}\u00B0${base ? ` vs ${base.romDeg.toFixed(0)}\u00B0 baseline (Day ${base.recordedMissionDay}), ${(((rom - base.romDeg) / base.romDeg) * 100).toFixed(1)}%` : " (no baseline)"}`],
    ["Walking speed", s.gait?.speedMs == null ? "Unavailable" : `${s.gait.speedMs.toFixed(2)} m/s, cadence ${s.gait.cadenceSpm ?? "n/a"} steps/min`],
    ["Balance Index", s.balance?.index == null ? "Unavailable" : `${s.balance.index} / 100 (${s.balance.indexStatus})`],
  ];
  return (
    <section className="avoid-break mt-4 rounded border border-slate-300 p-2 text-sm" aria-label="Latest session">
      <p className="font-semibold">Latest session in period: {s.label}</p>
      <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-600">{k}</dt><dd className="tabular-nums">{v}</dd></div>)}
      </dl>
      <p className="mt-1 text-[13px] text-slate-500">{a.profile.displayName}, {a.profile.affectedLimb} side.</p>
    </section>
  );
}

/** One block per assessment: its date and source, then each value with its own origin label. */
function AssessmentTable({ title, items }: { title: string; items: ReportAssessment[] }) {
  return (
    <section className="mt-4" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.map((x) => (
        <div key={x.id} className="avoid-break mt-2 rounded border border-slate-300 p-2 text-sm" data-report-assessment={x.id}>
          <p className="font-medium">{x.label} <span className="font-normal text-slate-500">&middot; {x.startedAt}</span>
            <span className="ml-1 rounded border border-slate-400 px-1 text-[12px] font-semibold text-slate-700">{x.csvFile ? `Manual entry + ${ORIGIN_LABEL.csv}: ${x.csvFile}` : "Manual entry"}</span></p>
          <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {x.values.map((v) => (
              <div key={v.label} className="flex justify-between gap-2"><dt className="text-slate-600">{v.label}</dt>
                <dd className="tabular-nums">{v.text}{v.origin === "csv" && <span data-testid="doc-origin-csv" className="ml-1 text-[12px] font-semibold text-violet-800">[{ORIGIN_LABEL.csv}]</span>}</dd></div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
