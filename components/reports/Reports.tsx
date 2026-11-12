"use client";

import Link from "next/link";
import RecordedReportExtras from "@/components/recorded/RecordedReportExtras";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { useRehab } from "@/components/rehab/useRehab";
import { useRehabEdits } from "@/components/rehab/useRehabEdits";
import ReportDocument from "./ReportDocument";
import { fmtAgg, fmtChange, tickDays } from "./format";
import { useSavedReports } from "./useSavedReports";
import { MAX_DAY, METRIC_META, MIN_DAY, buildReport, latestRecordDay, paddedDomain, validateRange, visibleMetrics, type MetricKey, type Range } from "@/lib/reports";
import { dayLabel, dayToDate, recordedRehabInScope, weekStartOf } from "@/lib/rehab";
import { ASTRONAUTS } from "@/lib/demo";

const QUICK = [7, 14, 30, 60, 90] as const;
const DAY1 = Date.UTC(2026, 8, 30);
const toIso = (day: number) => dayToDate(day).toISOString().slice(0, 10);
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Number.isFinite(y) ? Math.round((Date.UTC(y, m - 1, d) - DAY1) / 86_400_000) + 1 : NaN;
};
const quickRange = (n: number): Range => ({ start: Math.max(MIN_DAY, MAX_DAY - n + 1), end: MAX_DAY });
const fullDate = (day: number) => `${dayLabel(day)}, ${dayToDate(day).getUTCFullYear()}`;

const CHARTS: { key: MetricKey; title: string; color: string; step: number; minSpan: number; ceil?: number }[] = [
  { key: "romDeg", title: "ROM Trend \u2013 Knee (Flexion)", color: C.cyan, step: 5, minSpan: 10 },
  { key: "speedMs", title: "Gait Trend \u2013 Walking Speed", color: C.magenta, step: 0.05, minSpan: 0.2 },
  { key: "balanceIndex", title: "Balance Trend \u2013 Balance Index", color: C.green, step: 5, minSpan: 10, ceil: 100 },
];

export default function Reports() {
  const { astronaut, session, mission, select, selectSession, dataMode } = useAstronaut();
  const [tab, setTab] = useState<"session" | "history" | "pdf">("history");
  // The print copy is mounted only while printing (Save PDF or Ctrl+P), so hidden charts never measure a 0-size container.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  const [scopeKind, setScopeKind] = useState<"session" | "history">("history");
  const [range, setRange] = useState<Range>(quickRange(30));
  const [quick, setQuick] = useState<number | null>(30);
  const { list, save, remove } = useSavedReports();

  const check = validateRange(range, MIN_DAY, MAX_DAY);
  const recorded = dataMode === "recorded";
  // An astronaut with no saved knee session still has a Session report: it covers the latest day with any recorded entry.
  const noKnee = recorded && astronaut.sessions.length === 0;
  const latestDay = useMemo(() => latestRecordDay(astronaut), [astronaut]);
  const scope = useMemo(
    () => (scopeKind === "session"
      ? (noKnee ? ({ kind: "history", range: { start: latestDay ?? MAX_DAY, end: latestDay ?? MAX_DAY } } as const) : ({ kind: "session", session } as const))
      : ({ kind: "history", range } as const)),
    [scopeKind, session, range, noKnee, latestDay],
  );
  const report = useMemo(() => (scopeKind === "history" && !check.ok ? null : buildReport(astronaut, scope)), [astronaut, scope, scopeKind, check.ok]);
  const endDay = report?.range.end ?? MAX_DAY;
  const { view: rehab } = useRehab(astronaut, endDay, weekStartOf(endDay));
  const { edits: rehabEdits } = useRehabEdits(astronaut.id);
  // Demo mode: the plan view through the end day. Recorded mode: only rehab with saved completion state inside the report scope; none -> no box.
  const recordedRehab = useMemo(() => (report && recorded ? recordedRehabInScope(astronaut, rehabEdits, report.range) : null), [report, recorded, astronaut, rehabEdits]);
  const rehabSummary = recorded
    ? (recordedRehab ? { completion: recordedRehab.completion, adherence: recordedRehab.sessions, basis: "recorded" as const } : null)
    : rehab ? { completion: rehab.completionRate, adherence: rehab.weeklyAdherence, basis: "plan" as const } : null;

  const scopeLabel = report
    ? scopeKind === "session"
      ? noKnee
        ? `Session report · latest recorded entries, Day ${report.range.start} (${fullDate(report.range.start)}); no knee session saved`
        : `Session report · ${session.label} (${fullDate(session.missionDay)})`
      : `Historical trends · Day ${report.range.start}–${report.range.end} (${fullDate(report.range.start)} – ${fullDate(report.range.end)})`
    : "Invalid range";

  const tabs = (
    <div role="tablist" aria-label="Report view" className="flex overflow-hidden rounded-md border border-cyan-400/40">
      {([["session", "Session Report"], ["history", "Historical Trends"], ["pdf", "PDF Preview"]] as const).map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k}
          onClick={() => { setTab(k); if (k !== "pdf") setScopeKind(k); }}
          className={`px-3 py-1 text-xs ${tab === k ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
      ))}
    </div>
  );

  const doc = report ? <ReportDocument a={astronaut} mission={mission} report={report} scopeLabel={scopeLabel} rehab={rehabSummary} recorded={recorded} /> : null;
  const shown = report ? visibleMetrics(report, recorded) : [];
  const charts = CHARTS.filter((c) => shown.includes(c.key));
  const noTable = report ? report.rows.filter((r) => shown.includes(r.metric)).length === 0 : true;
  const chartCols = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3"][Math.min(3, charts.length)];
  const kinds = report ? [report.kneeCount && "knee", report.walkingCount && "walking", report.pressure.length && "pressure", report.balance.length && "balance"].filter(Boolean).join(", ") : "";
  const ticks = report ? tickDays(report.range.start, report.range.end, 6) : [];

  return (
    <div className="space-y-3">
      <div className="no-print space-y-3">
        <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
          <div>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">Reports <span className="font-normal text-slate-300">&ndash; Historical Trends &amp; Documentation</span></h1>
            <p className="text-xs text-slate-300">{astronaut.profile.displayName} ({astronaut.id}) &middot; {scopeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/60 bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">{dataMode === "recorded" ? "Recorded Data" : "Simulated Data"}</span>
            {tabs}
          </div>
        </header>

        {/* Range controls */}
        <div className="glass flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs">
          {scopeKind === "session" ? (
            <><span className="text-sm text-slate-200">Report scope</span>{noKnee ? <span className="text-xs text-slate-300">Latest recorded entries{latestDay ? ` (Day ${latestDay})` : ""}; no knee session is saved</span> : <SessionPicker />}</>
          ) : (
            <>
              <span className="text-sm text-slate-200">Report Range</span>
              <label className="flex items-center gap-1 text-slate-300">From
                <input type="date" value={toIso(range.start)} min={toIso(MIN_DAY)} max={toIso(MAX_DAY)} onChange={(e) => { setRange({ ...range, start: fromIso(e.target.value) }); setQuick(null); }}
                  className="rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-0.5 text-white [color-scheme:dark]" />
              </label>
              <span className="text-slate-400">&ndash;</span>
              <label className="flex items-center gap-1 text-slate-300">To
                <input type="date" value={toIso(range.end)} min={toIso(MIN_DAY)} max={toIso(MAX_DAY)} onChange={(e) => { setRange({ ...range, end: fromIso(e.target.value) }); setQuick(null); }}
                  className="rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-0.5 text-white [color-scheme:dark]" />
              </label>
              <div role="group" aria-label="Quick ranges ending on the demo date" className="flex overflow-hidden rounded-md border border-cyan-400/40">
                {QUICK.map((n) => {
                  const q = quickRange(n);
                  return (
                    <button key={n} type="button" aria-pressed={quick === n} title={`${fullDate(q.start)} – ${fullDate(q.end)}`}
                      onClick={() => { setRange(q); setQuick(n); }}
                      className={`px-2.5 py-1 ${quick === n ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{n}D</button>
                  );
                })}
              </div>
              <span className="text-slate-400">{report ? `${fullDate(report.range.start)} – ${fullDate(report.range.end)} · ${report.range.end - report.range.start + 1} days${quick && quick > MAX_DAY ? " (starts at mission Day 1)" : ""}` : ""}</span>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={!report?.hasData} onClick={() => save({ astronautId: astronaut.id, view: scopeKind, sessionId: scopeKind === "session" ? session.id : null, start: range.start, end: range.end })}
              className="rounded border border-cyan-400/50 px-2.5 py-1 text-cyan-100 hover:bg-white/10 disabled:opacity-40">Save configuration</button>
            <button type="button" disabled={!report?.hasData} onClick={() => window.print()}
              className="rounded bg-cyan-500/80 px-3 py-1 font-semibold text-[#031022] hover:bg-cyan-400 disabled:opacity-40">Save PDF</button>
          </div>
        </div>
        {!check.ok && scopeKind === "history" && <p role="alert" className="rounded-md border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{check.message}</p>}
      </div>

      {tab === "pdf" ? (
        <div className="space-y-2">
          <p className="no-print text-xs text-slate-300">This is the document that Save PDF prints (browser print dialog &rarr; Save as PDF).</p>
          {doc ?? <p className="text-sm text-amber-200">Fix the range to preview the report.</p>}
        </div>
      ) : (
        <>
          {/* Off-screen copy so Save PDF prints the same report from any tab */}
          {doc && printing && <div className="hidden print:block">{doc}</div>}
          {report && !report.hasData ? (
            <Panel id="rep-empty" title={recorded ? "No records in this scope" : "No sessions"} icon="chart" className="no-print">
              <p className="text-sm text-white">{recorded ? "No knee, walking, pressure or balance records" : "No sessions"} for {astronaut.profile.displayName} between {fullDate(report.range.start)} and {fullDate(report.range.end)}.</p>
              {astronaut.sessions.length === 0
                ? <p className="text-xs text-slate-300">{recorded ? "Nothing is saved for this astronaut in this scope." : "No sessions are saved for this astronaut yet."} <Link href="/patient-management" className="text-cyan-300 hover:underline">{recorded ? "Add a record" : "Add session"} &rarr;</Link></p>
                : <p className="text-xs text-slate-300">Sessions for this astronaut exist on Day {astronaut.sessions[0].missionDay}&ndash;{astronaut.sessions[astronaut.sessions.length - 1].missionDay} ({astronaut.sessions.length} sessions); widen the range to include them.</p>}
            </Panel>
          ) : report && (
            <div className="no-print space-y-3">
              {charts.length > 0 && <div className={`grid gap-3 ${chartCols}`}>
                {charts.map((c) => {
                  const row = report.rows.find((r) => r.metric === c.key)!;
                  const data = report.series(c.key);
                  const n = data.filter((d) => d.value !== null).length;
                  const missing = data.length - n;
                  const domain = paddedDomain(data.map((d) => d.value), c.step, c.minSpan, 0, c.ceil);
                  const meta = METRIC_META[c.key];
                  return (
                    <Panel key={c.key} id={`rep-${c.key}`} title={c.title} icon="chart" className="h-full"
                      action={<span className={`text-xs font-semibold ${row.change === null ? "text-slate-400" : row.change >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{row.change === null ? "No comparison" : `${row.change >= 0 ? "\u2191" : "\u2193"} ${fmtChange(row)}`}</span>}>
                      <figure className="flex min-h-[190px] flex-1 flex-col rounded-md bg-black/35 p-2">
                        <figcaption className="mb-1 text-[13px] text-slate-300">
                          {meta.label} ({meta.unit.trim()}) &middot; {n === 0 ? (missing ? "no values" : "no sessions") : n === 1 ? "1 session in this range" : `${n} sessions`}{missing ? ` \u00B7 ${missing} missing measurement${missing > 1 ? "s" : ""} (line joins the neighbouring sessions)` : ""}
                        </figcaption>
                        {n === 0 || !domain ? (
                          <div className="flex min-h-[150px] flex-1 items-center justify-center rounded border border-dashed border-cyan-400/25 text-xs text-slate-300">No {meta.label.toLowerCase()} values in this range</div>
                        ) : (
                          <div className="min-h-[150px] flex-1">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 380, height: 160 }}>
                              <AreaChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
                                <defs>
                                  <linearGradient id={`grad-${c.key}`} x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0" stopColor={c.color} stopOpacity={0.35} />
                                    <stop offset="1" stopColor={c.color} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                                <XAxis dataKey="day" type="number" domain={[report.range.start, report.range.end]} ticks={ticks} tickFormatter={dayLabel} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} />
                                <YAxis domain={domain} tickCount={5} allowDecimals tickFormatter={(v) => Number(v).toFixed(c.key === "speedMs" ? 2 : 0)} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} width={40} />
                                <Tooltip cursor={{ stroke: c.color, strokeOpacity: 0.4 }} content={({ active, payload }) => {
                                  const p = payload?.[0]?.payload as { day: number; sessionId: string; value: number | null } | undefined;
                                  if (!active || !p) return null;
                                  return <div className={TIP_CLASS}><p className="font-semibold text-white">{fullDate(p.day)} &middot; Day {p.day}</p><p className="text-slate-300">{meta.label} <span className="font-semibold" style={{ color: c.color }}>{p.value === null ? "Missing measurement" : `${p.value.toFixed(meta.digits)}${meta.unit}`}</span></p><p className="text-[12px] text-slate-400">{p.sessionId}</p></div>;
                                }} />
                                <Area type="linear" dataKey="value" stroke={c.color} strokeWidth={1.6} fill={`url(#grad-${c.key})`} dot={{ r: 2.6, fill: c.color, strokeWidth: 0 }} activeDot={{ r: 4.5 }} connectNulls isAnimationActive={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </figure>
                    </Panel>
                  );
                })}
              </div>}

              <div className="grid gap-3 xl:grid-cols-12">
                {!noTable && <div className="min-w-0 xl:col-span-5">
                  <Panel id="rep-table" title={`Key Metrics Summary (vs. previous ${report.range.end - report.range.start + 1} day${report.range.end === report.range.start ? "" : "s"})`} icon="chart" className="h-full">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px] [&_td]:align-top [&_th]:align-top">
                        <thead className="text-slate-400"><tr className="border-b border-cyan-400/20"><th className="py-1 pr-2 font-normal">Metric</th><th className="pr-2 font-normal">Current</th><th className="pr-2 font-normal">Previous</th><th className="font-normal">Change</th></tr></thead>
                        <tbody>
                          {report.rows.filter((r) => shown.includes(r.metric)).map((row) => (
                            <tr key={row.metric} className="border-b border-cyan-400/10">
                              <th scope="row" className="py-1.5 pr-2 font-normal text-white">{METRIC_META[row.metric].label}</th>
                              <td className={`pr-2 tabular-nums ${row.current.kind === "value" ? "text-white" : "text-amber-200"}`}>{fmtAgg(row.current, row.metric)}</td>
                              <td className={`pr-2 tabular-nums ${row.previous.kind === "value" ? "text-slate-200" : "text-slate-400"}`}>{fmtAgg(row.previous, row.metric)}</td>
                              <td className={`tabular-nums ${row.change === null ? "text-slate-400" : row.change >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{fmtChange(row)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[12px] text-slate-400">
                      Previous = {report.prevRange.end < 1 ? "none (before mission start)" : report.prevRange.start < 1 ? `Day 1–${report.prevRange.end} (shorter: mission data starts at Day 1)` : `Day ${report.prevRange.start}–${report.prevRange.end} (same length, just before)`}. Means of valid sessions; ROM only for {report.ref ? `${report.ref.side} knee, ${report.ref.protocol}` : "the reference knee context"}
                      {report.rows[0].excludedCurrent + report.rows[0].excludedPrevious > 0 ? ` (${report.rows[0].excludedCurrent + report.rows[0].excludedPrevious} session(s) with a different protocol excluded)` : ""}.
                    </p>
                  </Panel>
                </div>}
                <div className={`min-w-0 ${noTable ? "xl:col-span-6" : "xl:col-span-4"}`}>
                  <Panel id="rep-doc" title="Report Document" icon="check" className="h-full">
                    <div className="flex flex-1 gap-3">
                      <div className="flex h-36 w-28 shrink-0 flex-col justify-between rounded border border-cyan-300/40 bg-white p-2 text-[12px] text-slate-800 shadow-lg" aria-hidden="true">
                        <p className="font-bold text-cyan-800">AeroRehab<br />Rehabilitation Report</p>
                        <div className="space-y-0.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-1 rounded bg-slate-300" style={{ width: `${90 - i * 15}%` }} />)}</div>
                        <p className="font-bold text-amber-700">{recorded ? "RECORDED" : "SIMULATED"}</p>
                      </div>
                      <dl className="min-w-0 space-y-1 text-xs">
                        <div><dt className="text-slate-400">Type</dt><dd className="text-white">{scopeKind === "session" ? "Session report" : "Historical trends"}</dd></div>
                        <div><dt className="text-slate-400">Astronaut</dt><dd className="text-white">{astronaut.profile.fullName} &middot; {astronaut.id}</dd></div>
                        <div><dt className="text-slate-400">Period</dt><dd className="text-white">{fullDate(report.range.start)} &ndash; {fullDate(report.range.end)}</dd></div>
                        <div><dt className="text-slate-400">Contents</dt><dd className="text-white">{recorded ? `${kinds || "no"} records, rehab summary` : "3 charts, metrics table, rehab and insight summary"}</dd></div>
                      </dl>
                    </div>
                    <button type="button" onClick={() => setTab("pdf")} className="mt-3 w-full rounded-md border border-cyan-400/60 bg-cyan-400/10 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/20">Preview</button>
                  </Panel>
                </div>
                <div className={`min-w-0 ${noTable ? "xl:col-span-6" : "xl:col-span-3"}`}>
                  <Panel id="rep-recent" title="Recent Reports" icon="timeline" className="h-full">
                    {list.length === 0 ? (
                      <div className="rounded-md border border-dashed border-cyan-400/30 p-3 text-xs text-slate-300">
                        No saved report configurations yet. Use &ldquo;Save configuration&rdquo; to keep the current filters here. No files are stored.
                      </div>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {list.map((r) => {
                          const a = ASTRONAUTS.find((x) => x.id === r.astronautId);
                          const s = a?.sessions.find((x) => x.id === r.sessionId);
                          return (
                            <li key={r.id} className="flex items-center gap-2 rounded border border-cyan-400/20 p-2">
                              <button type="button" className="min-w-0 flex-1 text-left hover:text-cyan-100"
                                onClick={() => {
                                  if (!a) return;
                                  if (a.id !== astronaut.id) select(a.id);
                                  if (r.view === "session" && r.sessionId) selectSession(r.sessionId);
                                  setScopeKind(r.view); setTab(r.view); setRange({ start: r.start, end: r.end }); setQuick(null);
                                }}>
                                <p className="truncate font-semibold text-white">{r.view === "session" ? `Session · ${s?.label ?? r.sessionId}` : `Trends · ${dayLabel(r.start)} – ${dayLabel(r.end)}`}</p>
                                <p className="truncate text-slate-400">{a?.profile.displayName ?? r.astronautId} &middot; saved {new Date(r.savedAtIso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                              </button>
                              <button type="button" onClick={() => remove(r.id)} aria-label="Remove saved configuration" className="rounded px-1 text-slate-400 hover:text-white">&times;</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Panel>
                </div>
              </div>
              {dataMode === "recorded" && <RecordedReportExtras range={report.range} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
