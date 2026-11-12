"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { ImportedPressure } from "./ImportedPlayback";
import { ORIGIN_LABEL, SHARE_REASON, type LoadShares, SUMMARY_RULE, effectivePeak, effectiveShares } from "@/lib/recorded/assessments";

const MISSING = <span className="text-sm text-amber-200">Not measured</span>;
const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/**
 * Load & Pressure for recorded mode: the measured force (N) and peak pressure (kPa) that were entered, kept separate, and the
 * left/right load shares calculated from the two forces of the SAME assessment. A summary-only record has no samples, so the
 * heatmap and centre-of-pressure playback are replaced by "Sensor samples needed". No demo value or figure is shown.
 */
export default function RecordedPressure() {
  const { astronaut, pressureAssessment: x, selectPressureAssessment } = useAstronaut();
  const all = [...(astronaut.pressure ?? [])].reverse();
  const pkL = x ? effectivePeak(x, "left") : { value: null, origin: null };
  const pkR = x ? effectivePeak(x, "right") : { value: null, origin: null };
  const sh = x ? effectiveShares(x) : { shares: { kind: "unavailable", reason: "missing-force" } as LoadShares, origin: null };
  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Load &amp; Pressure</h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {x ? x.label : "No pressure assessments saved"} &middot; Recorded Data</p>
        </div>
        {all.length > 0 && (
          <label className="flex w-full flex-col gap-1 text-xs text-slate-300 sm:w-auto sm:flex-row sm:items-center sm:gap-1.5">
            Pressure assessment
            <select id="pressure-select" value={x?.id ?? ""} onChange={(e) => selectPressureAssessment(e.target.value)} className="w-full min-w-0 rounded border border-cyan-400/40 sm:w-auto sm:max-w-[20rem] bg-navy-900 px-1.5 py-0.5 text-white">
              {all.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        )}
      </header>

      {!x ? (
        <Panel id="rl-empty" title="No pressure assessments saved" icon="foot">
          <p className="text-sm font-semibold text-amber-200">No reading recorded</p>
          <p className="mt-1 text-xs text-slate-300">No pressure assessment is saved for {astronaut.profile.displayName}. Nothing is shown from demo data in recorded mode.</p>
          <Link href="/patient-management" className="mt-2 inline-flex w-fit rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400/25">Add pressure assessment &rarr;</Link>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel id="rl-measured" title="Measured values" icon="foot" action={<Link href="/patient-management" className="text-[13px] text-cyan-300 hover:underline">Edit assessment &rarr;</Link>}>
              <p className="text-[13px] text-slate-300">{x.startedAt} &middot; manual entry{x.csvImport ? <> plus <span data-testid="imported-badge" className="rounded-full border border-violet-300/40 bg-violet-400/10 px-1.5 py-0.5 text-[12px] text-violet-100">Imported CSV</span></> : null}. Force and peak pressure are separate readings.</p>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-slate-400">Left force</dt><dd data-metric="leftForce" className="text-xl font-semibold tabular-nums text-white">{x.leftForceN === null ? MISSING : <>{r1(x.leftForceN)} <span className="text-sm font-normal text-slate-300">N</span></>}</dd></div>
                <div><dt className="text-xs text-slate-400">Right force</dt><dd data-metric="rightForce" className="text-xl font-semibold tabular-nums text-white">{x.rightForceN === null ? MISSING : <>{r1(x.rightForceN)} <span className="text-sm font-normal text-slate-300">N</span></>}</dd></div>
                <div><dt className="text-xs text-slate-400">Left peak pressure</dt><dd data-metric="leftPeak" className="text-xl font-semibold tabular-nums text-white">{pkL.value === null ? MISSING : <>{r1(pkL.value)} <span className="text-sm font-normal text-slate-300">kPa</span>{pkL.origin === "csv" && <span className="ml-1 text-[12px] font-normal text-violet-200">{ORIGIN_LABEL.csv}</span>}</>}</dd></div>
                <div><dt className="text-xs text-slate-400">Right peak pressure</dt><dd data-metric="rightPeak" className="text-xl font-semibold tabular-nums text-white">{pkR.value === null ? MISSING : <>{r1(pkR.value)} <span className="text-sm font-normal text-slate-300">kPa</span>{pkR.origin === "csv" && <span className="ml-1 text-[12px] font-normal text-violet-200">{ORIGIN_LABEL.csv}</span>}</>}</dd></div>
              </dl>
            </Panel>

            <Panel id="rl-shares" title="Load share (how your weight was shared between your feet)" icon="chart">
              {sh.shares.kind === "value" ? (
                <>
                  <p data-metric="shares" className="text-2xl font-semibold tabular-nums text-white">Left {r1(sh.shares.leftPct)}% <span className="text-slate-400">&middot;</span> Right {r1(sh.shares.rightPct)}%</p>
                  <p data-metric="diff" className="mt-1 text-sm tabular-nums text-slate-100">Difference: {r1(sh.shares.diffPp)} percentage points{sh.shares.heavier === "equal" ? " (equal)" : ` more on the ${sh.shares.heavier} foot`}</p>
                  <p className="mt-1 text-[13px] text-slate-400">{sh.origin === "csv" ? "Calculated from the imported CSV: the session mean over frames where both feet are complete. No forces were entered by hand." : "Load share = foot force ÷ combined force × 100, from the two forces entered for this assessment."} <span data-testid="share-origin" className="text-violet-200">[{sh.origin ? ORIGIN_LABEL[sh.origin] : ""}]</span> No comparison rule is set, so no status is given. {SUMMARY_RULE}</p>
                </>
              ) : (
                <>
                  <p data-metric="shares" className="text-sm font-semibold text-amber-200">Load share unavailable</p>
                  <p className="mt-1 text-xs text-slate-300">{SHARE_REASON[sh.shares.reason]}</p>
                </>
              )}
            </Panel>
          </div>

          {x.csvImport ? <ImportedPressure x={x} astronautId={astronaut.id} /> : (
            <Panel id="rl-samples" title="Heatmap and centre-of-pressure playback" icon="pulse">
              <p className="text-sm font-semibold text-amber-200">Sensor samples needed</p>
              <p className="text-xs text-slate-300">The pressure heatmap, per-zone pressures and centre-of-pressure playback need insole sensor samples. This record has only manual totals, so none of them is drawn and nothing is filled in from demo data.</p>
              <Link href="/patient-management" className="mt-2 inline-flex w-fit rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-400/25">Import sensor CSV &rarr;</Link>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
