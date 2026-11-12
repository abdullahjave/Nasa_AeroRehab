"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import { useRehab } from "@/components/rehab/useRehab";
import ReadingRows from "@/components/readings/ReadingRows";
import { DEMO_DAY, weekStartOf } from "@/lib/rehab";


const NA = <span className="text-amber-200">Unavailable</span>;

function Row({ label, href, linkLabel, children }: { label: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm sm:flex-nowrap">
      <dt className="w-40 shrink-0 text-xs text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-white">{children}</dd>
      {href && <Link href={href} className="shrink-0 text-xs text-cyan-300 hover:underline">{linkLabel ?? "Details"} &rarr;</Link>}
    </div>
  );
}

/**
 * Compact summary rows that replace the separate profile, KIS, readiness, baseline, activity, rehab and knee boxes.
 * Each row names what the number is (current, session peak, range, baseline comparison) and links to the full page.
 * Missing values read "Unavailable", never 0 or a normal result.
 */
export default function MeasurementRows() {
  const { dataMode } = useAstronaut();
  if (dataMode === "recorded") {
    return (
      <section aria-label="Readings" className="glass rounded-lg px-3 pb-1">
        <h3 className="pt-3 text-xs font-semibold text-slate-200">Your readings in plain English</h3>
        <ReadingRows />
      </section>
    );
  }
  return <DemoRows />;
}

function DemoRows() {
  const { astronaut, mission } = useAstronaut();
  const { view: rehab } = useRehab(astronaut, DEMO_DAY, weekStartOf(DEMO_DAY));
  const o = astronaut.overview;

  const a = o.dailyActivity;
  const rate = rehab?.completionRate;
  const adh = rehab?.weeklyAdherence;

  return (
    <section aria-label="Readings" className="glass rounded-lg px-3 pb-1">
      <h3 className="pt-3 text-xs font-semibold text-slate-200">Your readings in plain English</h3>
      <ReadingRows />
      <h3 className="border-t border-cyan-400/10 pt-3 text-xs font-semibold text-slate-200">Other summary readings</h3>
      <dl className="divide-y divide-cyan-400/10">
        <Row label="Daily activity (steps and distance walked today)" href="/gait-analysis" linkLabel="Gait Analysis">
          {a.distanceKm === null ? NA : <span className="font-semibold tabular-nums">{a.distanceKm} km</span>}
          <span className="text-slate-300"> &middot; {a.steps === null ? "steps unavailable" : `${(a.steps / 1000).toFixed(1)}k steps`} (goal {(a.stepGoal / 1000).toFixed(0)}k)</span>
        </Row>
        <Row label="Rehabilitation program" href="/rehabilitation" linkLabel="Exercise plan">
          {!rehab ? NA : (
            <>
              <span className="font-semibold">{rehab.program.statusLabel}</span>
              <span className="text-slate-300"> &middot; completion {rate?.kind === "value" ? `${rate.pct.toFixed(0)}%` : "unavailable"} &middot; week adherence {adh?.kind === "value" ? `${adh.pct.toFixed(0)}%` : "unavailable"} &middot; Week {rehab.selected.programWeek}/{rehab.program.totalWeeks}</span>
            </>
          )}
        </Row>
        <Row label="Mission systems">
          <span className="font-semibold">{mission.commsStatus === "nominal" ? "Systems nominal" : "Comms degraded"}</span>
          <span className="text-slate-300"> &middot; crew online {mission.crewOnline}/{mission.crewTotal} &middot; next check-in {mission.nextCheckIn}</span>
        </Row>
      </dl>
    </section>
  );
}
