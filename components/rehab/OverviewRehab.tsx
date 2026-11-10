"use client";

import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { useRehab } from "./useRehab";
import { DEMO_DAY, weekStartOf } from "@/lib/rehab";

/** Overview rehab summary from the same records, selectors and local edits as the Rehabilitation page. */
export default function OverviewRehab() {
  const { astronaut } = useAstronaut();
  const { view } = useRehab(astronaut, DEMO_DAY, weekStartOf(DEMO_DAY));
  if (!view) {
    return <Panel id="rehab" title="Rehabilitation Status" href="/rehabilitation" linkLabel="Plan" className="h-full"><p className="text-sm text-amber-200">Unavailable</p></Panel>;
  }
  const rate = view.completionRate;
  const adh = view.weeklyAdherence;
  return (
    <Panel id="rehab" title="Rehabilitation Status" href="/rehabilitation" linkLabel="Plan" className="h-full">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 20h16M7 20V12M12 20V6M17 20v-5" /></svg>
        <div>
          <p className="text-base font-semibold text-emerald-300">{view.program.statusLabel}</p>
          <p className="text-[11px] text-slate-300">
            Completion {rate.kind === "value" ? `${rate.pct.toFixed(0)}%` : "Unavailable"} &middot; Week adherence {adh.kind === "value" ? `${adh.pct.toFixed(0)}%` : "Unavailable"}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-700/60" role="img" aria-label={`Program completion ${rate.kind === "value" ? rate.pct.toFixed(0) : "unavailable"} percent`}>
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${rate.kind === "value" ? rate.pct : 0}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{view.program.name} &middot; Week {view.selected.programWeek}/{view.program.totalWeeks}</p>
    </Panel>
  );
}
