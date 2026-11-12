"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";

const UNAV = <span className="text-sm text-amber-200">No reading recorded</span>;
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * Gait Analysis for recorded mode: speed and cadence calculated from the saved manual totals (the same values Overview and
 * Reports use). Stride length appears only when a real measurement was entered. Gait phase, symmetry and the step timeline
 * need sensor data, so they are shown as unavailable; no demo curve, figure or number is used.
 */
export default function RecordedGait() {
  const { astronaut, walking, selectWalking } = useAstronaut();
  const all = [...(astronaut.walking ?? [])].reverse();
  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Gait Analysis</h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {walking ? walking.label : "No walking sessions saved"} &middot; Recorded Data</p>
        </div>
        {all.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-slate-300">
            Walking session
            <select id="walking-select" value={walking?.id ?? ""} onChange={(e) => selectWalking(e.target.value)} className="max-w-[16rem] rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-0.5 text-white">
              {all.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
        )}
      </header>

      {!walking ? (
        <Panel id="rg-empty" title="No walking sessions saved" icon="walk">
          <p className="text-sm font-semibold text-amber-200">No reading recorded</p>
          <p className="mt-1 text-xs text-slate-300">No walking session is saved for {astronaut.profile.displayName}. Nothing is shown from demo data in recorded mode.</p>
          <Link href="/patient-management" className="mt-2 inline-flex w-fit rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400/25">Add walking session &rarr;</Link>
        </Panel>
      ) : (
        <>
          <Panel id="rg-values" title="Walking speed and cadence" icon="walk" action={<Link href="/patient-management" className="text-[13px] text-cyan-300 hover:underline">Edit session &rarr;</Link>}>
            <p className="text-[13px] text-slate-300">{walking.startedAt} &middot; manual entry. Calculated from the saved totals; rounded only for display.</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
              <div><dt className="text-xs text-slate-400">Walking speed</dt><dd data-metric="speed" className="text-2xl font-semibold tabular-nums text-white">{walking.speedMs === null ? UNAV : <>{r2(walking.speedMs)} <span className="text-sm font-normal text-slate-300">m/s</span></>}</dd><dd className="text-[12px] text-slate-400">distance &divide; duration</dd></div>
              <div><dt className="text-xs text-slate-400">Cadence</dt><dd data-metric="cadence" className="text-2xl font-semibold tabular-nums text-white">{walking.cadenceSpm === null ? <span className="text-sm text-amber-200">No step count entered</span> : <>{r2(walking.cadenceSpm)} <span className="text-sm font-normal text-slate-300">steps/min</span></>}</dd><dd className="text-[12px] text-slate-400">steps &divide; duration &times; 60</dd></div>
              <div><dt className="text-xs text-slate-400">Distance</dt><dd className="text-xl font-semibold tabular-nums text-white">{walking.distanceM} <span className="text-sm font-normal text-slate-300">m</span></dd></div>
              <div><dt className="text-xs text-slate-400">Duration</dt><dd className="text-xl font-semibold tabular-nums text-white">{walking.durationS} <span className="text-sm font-normal text-slate-300">s</span></dd></div>
              <div><dt className="text-xs text-slate-400">Total steps</dt><dd className="text-xl font-semibold tabular-nums text-white">{walking.steps === null ? <span className="text-sm text-amber-200">Not entered</span> : walking.steps}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-200">
              Stride length:{" "}
              {walking.strideLengthM === null
                ? <span className="text-amber-200">No stride measurement recorded</span>
                : <span className="font-semibold tabular-nums text-white">{walking.strideLengthM} m <span className="font-normal text-slate-400">(measured)</span></span>}
            </p>
          </Panel>

          <Panel id="rg-unavailable" title="Gait phase, symmetry and step timeline" icon="pulse">
            <p className="text-sm text-amber-200">Unavailable for manual totals</p>
            <p className="text-xs text-slate-300">Stance and swing phases, double support, left/right symmetry, step times and the step timeline need sensor data. This session has only manual totals, so none of them is shown and nothing is filled in from demo data.</p>
          </Panel>
        </>
      )}
    </div>
  );
}
