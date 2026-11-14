"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { ImportedBalance } from "./ImportedPlayback";
import { ORIGIN_LABEL, comparableBalance, effectiveSway } from "@/lib/recorded/assessments";
import { BALANCE_PROTOCOL_LABEL } from "@/lib/recorded/types";

const MISSING = <span className="text-sm text-amber-200">Not entered</span>;
const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/**
 * Stability & Balance for recorded mode: the saved trial (side, protocol, observed duration), the instrument-reported ML and AP sway
 * RMS exactly as entered, and the comparable history (same trial side and protocol). The Balance Index stays unavailable because no
 * documented scoring method applies to these inputs. Sway path, ellipse and replay need samples. No demo values or flags are shown.
 */
export default function RecordedBalance() {
  const { astronaut, balanceTrial: x, selectBalanceTrial } = useAstronaut();
  const all = [...(astronaut.balance ?? [])].reverse();
  const history = x ? comparableBalance(astronaut, x) : [];
  const ml = x ? effectiveSway(x, "ml") : { value: null, origin: null };
  const ap = x ? effectiveSway(x, "ap") : { value: null, origin: null };
  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Stability &amp; Balance</h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {x ? x.label : "No balance trials saved"} &middot; Recorded Data</p>
        </div>
        {all.length > 0 && (
          <label className="flex w-full flex-col gap-1 text-xs text-slate-300 sm:w-auto sm:flex-row sm:items-center sm:gap-1.5">
            Balance trial
            <select id="balance-select" value={x?.id ?? ""} onChange={(e) => selectBalanceTrial(e.target.value)} className="w-full min-w-0 rounded border border-cyan-400/40 sm:w-auto sm:max-w-[20rem] bg-navy-900 px-1.5 py-0.5 text-white">
              {all.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
        )}
      </header>

      {!x ? (
        <Panel id="rb-empty" title="No balance trials saved" icon="balance">
          <p className="text-sm font-semibold text-amber-200">No reading recorded</p>
          <p className="mt-1 text-xs text-slate-300">No balance trial is saved for {astronaut.profile.displayName}. Nothing is shown from demo data in recorded mode.</p>
          <Link href="/patient-management" className="mt-2 inline-flex w-fit rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400/25">Add balance trial &rarr;</Link>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel id="rb-trial" title="Saved trial" icon="balance" action={<Link href="/patient-management" className="text-[13px] text-cyan-300 hover:underline">Edit trial &rarr;</Link>}>
              <p className="text-[13px] text-slate-300">{x.startedAt} &middot; manual entry{x.csvImport ? <> plus <span data-testid="imported-badge" className="rounded-full border border-violet-300/40 bg-violet-400/10 px-1.5 py-0.5 text-[12px] text-violet-100">Imported CSV</span></> : null} &middot; {x.trialSide === "left" ? "Left" : "Right"}-leg stance &middot; {BALANCE_PROTOCOL_LABEL[x.protocol]}</p>
              <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div><dt className="text-xs text-slate-400">Duration (entered by hand)</dt><dd data-metric="duration" className="text-xl font-semibold tabular-nums text-white">{r1(x.durationS)} <span className="text-sm font-normal text-slate-300">s</span></dd></div>
                <div><dt className="text-xs text-slate-400">ML sway RMS</dt><dd data-metric="ml" className="text-xl font-semibold tabular-nums text-white">{ml.value === null ? MISSING : <>{r1(ml.value)} <span className="text-sm font-normal text-slate-300">mm</span><span data-testid="ml-origin" className="ml-1 text-[12px] font-normal text-violet-200">{ml.origin ? ORIGIN_LABEL[ml.origin] : ""}</span></>}</dd></div>
                <div><dt className="text-xs text-slate-400">AP sway RMS</dt><dd data-metric="ap" className="text-xl font-semibold tabular-nums text-white">{ap.value === null ? MISSING : <>{r1(ap.value)} <span className="text-sm font-normal text-slate-300">mm</span><span data-testid="ap-origin" className="ml-1 text-[12px] font-normal text-violet-200">{ap.origin ? ORIGIN_LABEL[ap.origin] : ""}</span></>}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-slate-200">Resultant RMS (calculated from ML and AP): {x.resultantRmsMm === null ? <span className="text-amber-200">needs both entered values</span> : <span data-metric="resultant" className="font-semibold tabular-nums text-white">{r1(x.resultantRmsMm)} mm</span>}</p>
              <p className="mt-2 text-xs text-slate-200">Balance Index: <span className="text-amber-200">Unavailable</span></p>
              <p className="text-[13px] text-slate-400">No documented scoring method applies to these recorded inputs, so no index, risk flag or radar score is given.</p>
            </Panel>

            <Panel id="rb-history" title={`Comparable trials · ${x.trialSide === "left" ? "left" : "right"} leg, ${BALANCE_PROTOCOL_LABEL[x.protocol].toLowerCase()}`} icon="chart">
              <p className="text-[13px] text-slate-300">Only trials with the same standing leg and protocol are listed ({history.length}).</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-200" aria-label="Comparable balance trials">
                {history.map((h) => (
                  <li key={h.id} className="tabular-nums">
                    <button type="button" onClick={() => selectBalanceTrial(h.id)} aria-current={h.id === x.id ? "true" : undefined} className={`text-left hover:underline ${h.id === x.id ? "font-semibold text-white" : ""}`}>Day {h.missionDay}</button>
                    {": "}ML {h.mlRmsMm === null ? "not entered" : `${r1(h.mlRmsMm)} mm`} &middot; AP {h.apRmsMm === null ? "not entered" : `${r1(h.apRmsMm)} mm`} &middot; {r1(h.durationS)} s
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {x.csvImport ? <ImportedBalance x={x} astronautId={astronaut.id} /> : (
            <Panel id="rb-samples" title="Sway path, ellipse and replay" icon="pulse">
              <p className="text-sm font-semibold text-amber-200">Sensor samples needed</p>
              <p className="text-xs text-slate-300">The sway path, 95% ellipse and trial replay need centre-of-pressure samples. This trial has only entered totals, so none of them is drawn and nothing is filled in from demo data.</p>
              <Link href="/patient-management" className="mt-2 inline-flex w-fit rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-400/25">Import sensor CSV &rarr;</Link>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
