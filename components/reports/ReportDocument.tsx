"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { METRIC_META, paddedDomain, type buildReport } from "@/lib/reports";
import { dayLabel, type Ratio } from "@/lib/rehab";
import type { AstronautRecord, Mission } from "@/lib/demo";
import { fmtAgg, fmtChange, tickDays } from "./format";

type Report = ReturnType<typeof buildReport>;

const PRINT_COLORS = { romDeg: "#0e7490", speedMs: "#a21caf", balanceIndex: "#15803d" } as const;

/** Light "paper" report used for the PDF preview and for printing (Save PDF). */
export default function ReportDocument({
  a, mission, report, scopeLabel, rehab, className = "",
}: {
  a: AstronautRecord; mission: Mission; report: Report; scopeLabel: string;
  rehab: { completion: Ratio; adherence: Ratio } | null; className?: string;
}) {
  const r = report.range;
  const ticks = tickDays(r.start, r.end, 5);
  const charts = [
    { key: "romDeg" as const, step: 5, minSpan: 10, ceil: Infinity },
    { key: "speedMs" as const, step: 0.05, minSpan: 0.2, ceil: Infinity },
    { key: "balanceIndex" as const, step: 5, minSpan: 10, ceil: 100 },
  ];
  return (
    <article className={`report-doc mx-auto w-full max-w-[760px] rounded-md bg-white p-6 text-slate-900 shadow-xl ${className}`} aria-label="Report document">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-300 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">AeroRehab</p>
          <h2 className="text-xl font-bold">Rehabilitation Report</h2>
          <p className="text-sm text-slate-700">{scopeLabel}</p>
        </div>
        <span className="rounded border-2 border-amber-600 px-2 py-0.5 text-xs font-bold text-amber-700">SIMULATED DATA</span>
      </header>

      <dl className="avoid-break mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Astronaut</dt><dd className="font-medium">{a.profile.fullName}</dd></div>
        <div><dt className="text-slate-500">Astronaut ID</dt><dd className="font-medium">{a.id} ({a.profile.crewCode})</dd></div>
        <div><dt className="text-slate-500">Mission</dt><dd className="font-medium">{mission.name}</dd></div>
        <div><dt className="text-slate-500">Reporting period</dt><dd className="font-medium">Day {r.start}&ndash;{r.end} ({dayLabel(r.start)} &ndash; {dayLabel(r.end)}, inclusive)</dd></div>
        <div><dt className="text-slate-500">Comparison period</dt><dd className="font-medium">{report.prevRange.end < 1
                ? "None (before mission start)"
                : report.prevRange.start < 1
                  ? `Day 1 to ${report.prevRange.end} (shorter than the reporting period: mission data starts at Day 1)`
                  : `Day ${report.prevRange.start} to ${report.prevRange.end}, same length`}</dd></div>
        <div><dt className="text-slate-500">Knee reference</dt><dd className="font-medium">{report.ref ? `${report.ref.side} knee, ${report.ref.protocol}` : "None"}</dd></div>
      </dl>

      {report.cur.length === 0 ? (
        <p className="mt-4 rounded border border-slate-300 p-3 text-sm">No sessions for this astronaut in the reporting period.</p>
      ) : (
        <>
          <section className="avoid-break mt-4 grid gap-3 sm:grid-cols-3">
            {charts.map((c) => (
              <figure key={c.key} className="rounded border border-slate-300 p-2">
                <figcaption className="text-xs font-semibold">{METRIC_META[c.key].label} ({METRIC_META[c.key].unit.trim()}) &middot; {report.series(c.key).filter((d) => d.value !== null).length} sessions</figcaption>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 220, height: 128 }}>
                    <LineChart data={report.series(c.key)} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="#e2e8f0" />
                      <XAxis dataKey="day" type="number" domain={[r.start, r.end]} ticks={ticks} tickFormatter={dayLabel} tick={{ fill: "#334155", fontSize: 9 }} stroke="#94a3b8" />
                      <YAxis domain={paddedDomain(report.series(c.key).map((d) => d.value), c.step, c.minSpan, 0, c.ceil) ?? [0, 1]} tickCount={4} tickFormatter={(v) => Number(v).toFixed(c.key === "speedMs" ? 2 : 0)} tick={{ fill: "#334155", fontSize: 9 }} stroke="#94a3b8" width={c.key === "speedMs" ? 42 : 34} />
                      <Line dataKey="value" stroke={PRINT_COLORS[c.key]} strokeWidth={1.6} dot={{ r: 2.2, fill: PRINT_COLORS[c.key], strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            ))}
          </section>

          <table className="avoid-break mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-400 text-left">
                <th className="py-1 pr-2">Metric</th><th className="pr-2">Current period</th><th className="pr-2">Previous period</th><th>Change</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.metric} className="border-b border-slate-200">
                  <td className="py-1 pr-2">{METRIC_META[row.metric].label}</td>
                  <td className="pr-2">{fmtAgg(row.current, row.metric)}</td>
                  <td className="pr-2">{fmtAgg(row.previous, row.metric)}</td>
                  <td>{fmtChange(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-600">Values are means of valid session values (n = sessions). ROM uses only sessions with the same knee side and protocol. Missing values are excluded, never counted as 0.</p>
        </>
      )}

      <section className="avoid-break mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-slate-300 p-2 text-sm">
          <p className="font-semibold">Rehabilitation (through Day {r.end})</p>
          <p>Completion rate: {rehab && rehab.completion.kind === "value" ? `${rehab.completion.pct.toFixed(1)}% (${rehab.completion.num}/${rehab.completion.den} items)` : "Unavailable"}</p>
          <p>Weekly adherence (week of Day {r.end}): {rehab && rehab.adherence.kind === "value" ? `${rehab.adherence.pct.toFixed(1)}% (${rehab.adherence.num}/${rehab.adherence.den} sessions)` : "Unavailable"}</p>
        </div>
        <div className="rounded border border-slate-300 p-2 text-sm">
          <p className="font-semibold">AI insights ({report.latestSession ? report.latestSession.label : "no session"})</p>
          {report.insights && report.insights.findings.length ? (
            <ul className="list-disc pl-4">{report.insights.findings.map((f) => <li key={f.id}>{f.title}{f.tSec !== null ? ` at ${Math.floor(f.tSec / 60)}:${String(Math.round(f.tSec % 60)).padStart(2, "0")}` : ""} <span className="text-slate-500">({f.source === "calculated" ? "calculated" : f.source === "measured" ? "measured" : "seeded demo"})</span></li>)}</ul>
          ) : <p>No findings.</p>}
        </div>
      </section>
      <footer className="mt-4 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
        Simulated data for demonstration. Not a clinical document. Dates: mission Day 1 = Sep 30, 2026 (UTC). Units: degrees, m/s, steps/min, score /100.
      </footer>
    </article>
  );
}
