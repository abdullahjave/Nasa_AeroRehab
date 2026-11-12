"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { useRehab } from "@/components/rehab/useRehab";
import MilestoneBadge from "@/components/rehab/MilestoneBadge";
import { DEMO_DAY, dayLabel, todaysMilestone, todaysTasks, weekStartOf } from "@/lib/rehab";

const linkCls = "mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400/25";

/**
 * Today's assigned activities for the selected astronaut on the demo mission day. Reads the same records and local edits as
 * the Rehabilitation page, so a completion or undo there changes this count and the calendar together. Completion and
 * undo happen in the exercise plan; this card only shows progress and links there.
 */
export default function TodaysTasksCard() {
  const { astronaut } = useAstronaut();
  const { completions } = useRehab(astronaut, DEMO_DAY, weekStartOf(DEMO_DAY));
  const t = todaysTasks(astronaut, completions);
  const milestone = todaysMilestone(t);
  const complete = t.kind === "tasks" && t.done === t.total;
  return (
    <Panel id="tasks" title="Today's Tasks" icon="check">
      {t.kind === "none" ? (
        <div className="rounded-md border border-dashed border-cyan-400/30 p-3">
          <p className="text-sm font-semibold text-white">No activities scheduled today.</p>
          <p className="text-xs text-slate-300">
            {t.reason === "no-program" ? "This astronaut has no active rehabilitation plan." : `Nothing is scheduled on Day ${t.day} (${dayLabel(t.day)}).`}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-semibold text-white" aria-live="polite">{t.done} of {t.total} complete</p>
            <span className="text-[11px] text-slate-400">Day {t.day} &middot; {dayLabel(t.day)}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-700/60" role="progressbar" aria-label="Today's exercise progress" aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={t.done} aria-valuetext={`${t.done} of ${t.total} complete`}>
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }} />
          </div>
          {complete && <p className="mt-2 text-sm font-semibold text-emerald-300" role="status">Today&rsquo;s plan complete.</p>}
          <ul className="mt-2 space-y-1.5">
            {t.tasks.map((x) => (
              <li key={x.assignmentId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${x.done ? "bg-emerald-400 text-[#04121f]" : "border border-slate-400/60 text-transparent"}`} aria-hidden="true">&#10003;</span>
                <span className={x.done ? "text-slate-300" : "text-white"}>{x.name}</span>
                <span className="text-xs text-slate-400">{x.prescription}</span>
                <span className="sr-only">{x.done ? "completed" : "not completed yet"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/rehabilitation" className={linkCls}>Open today&rsquo;s plan &rarr;</Link>
      {milestone && <div><MilestoneBadge m={milestone} /></div>}
    </Panel>
  );
}
