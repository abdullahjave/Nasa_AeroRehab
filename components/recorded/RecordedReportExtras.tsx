"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { ORIGIN_LABEL, SUMMARY_RULE, assessmentRows } from "@/lib/recorded/assessments";

/**
 * Recorded load & pressure and balance readings for a report range. Same records and selectors as the detail pages and Overview.
 * Only comparable assessments are averaged (same protocol for pressure; same standing leg and protocol for balance), readings that
 * were not measured are skipped (never counted as zero), and every row shows its unit and observation count.
 */
export default function RecordedReportExtras({ range }: { range: { start: number; end: number } }) {
  const { astronaut, selectPressureAssessment, selectBalanceTrial } = useAstronaut();
  const rows = assessmentRows(astronaut, range);
  const pressure = rows.filter((r) => ["leftShare", "rightShare", "leftPeak", "rightPeak"].includes(r.key));
  const balance = rows.filter((r) => !pressure.includes(r));
  const inRange = (l: readonly { missionDay: number }[] | undefined) => (l ?? []).some((x) => x.missionDay >= range.start && x.missionDay <= range.end);
  const hasP = inRange(astronaut.pressure), hasB = inRange(astronaut.balance);
  if (!hasP && !hasB) return null; // only sections supported by saved records are shown
  const table = (list: typeof rows, href: string, onLink: (id: string) => void) => (
    <table className="w-full text-left text-xs sm:min-w-[420px]">
      <thead className="text-slate-400"><tr className="border-b border-cyan-400/20"><th className="py-1 pr-2 font-normal">Reading</th><th className="pr-2 font-normal">Mean in range</th><th className="hidden pr-2 font-normal sm:table-cell">Observations</th><th className="font-normal">Assessments</th></tr></thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.key} className="border-b border-cyan-400/10 align-top" data-report-row={r.key}>
            <td className="py-1.5 pr-2 text-white">{r.label}<span className="block text-[10px] text-slate-400">{r.note}</span></td>
            <td className="pr-2 tabular-nums text-white">{r.value.kind === "value" ? `${r.value.mean.toFixed(r.digits)}${r.unit} (mean)` : <span className="text-amber-200">No comparable data</span>}<span className="block text-[10px] text-slate-400 sm:hidden">n={r.value.kind === "value" ? r.value.n : 0}</span></td>
            <td className="hidden pr-2 tabular-nums text-slate-200 sm:table-cell">n={r.value.kind === "value" ? r.value.n : 0}</td>
            <td>{r.points.length === 0 ? <span className="text-slate-400">&mdash;</span> : r.points.map((p, i) => (
              <span key={p.id}>{i > 0 && ", "}<Link href={href} onClick={() => onLink(p.id)} className="text-cyan-300 hover:underline" aria-label={`Open the assessment from Day ${p.day} (${ORIGIN_LABEL[p.origin]})`}>Day {p.day}: {p.value.toFixed(r.digits)}{r.unit}</Link>{p.origin === "csv" && <span data-testid="report-origin-csv" className="ml-0.5 rounded-full border border-violet-300/40 bg-violet-400/10 px-1 text-[9px] text-violet-100">Imported CSV</span>}</span>
            ))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className={`grid gap-3 ${hasP && hasB ? "lg:grid-cols-2" : ""}`}>
      {hasP && <Panel id="rep-rec-pressure" title="Recorded load & pressure" icon="foot" href="/load-pressure" linkLabel="Load & Pressure">
        <div className="overflow-x-auto">{table(pressure, "/load-pressure", selectPressureAssessment)}</div>
        <p className="mt-1 text-[10px] text-slate-400">Load share = foot force &divide; combined force &times; 100 (needs both forces). Peak pressure and force are separate readings. Points marked &quot;Imported CSV&quot; were calculated from an imported sensor file; unmarked points are manual entries. {SUMMARY_RULE}</p>
      </Panel>}
      {hasB && <Panel id="rep-rec-balance" title="Recorded balance" icon="balance" href="/stability-balance" linkLabel="Stability & Balance">
        <div className="overflow-x-auto">{table(balance, "/stability-balance", selectBalanceTrial)}</div>
        <p className="mt-1 text-[10px] text-slate-400">Sway RMS is the typed instrument value, or, where none was entered, calculated from the imported sensor CSV (marked &quot;Imported CSV&quot;). {SUMMARY_RULE} No Balance Index: no documented scoring method applies.</p>
      </Panel>}
    </div>
  );
}
