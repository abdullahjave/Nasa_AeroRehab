import type { Milestone } from "@/lib/rehab";

/** Compact "Daily plan complete" milestone. Shown below the task content; it reflects task completion only. */
export default function MilestoneBadge({ m }: { m: Milestone }) {
  return (
    <p role="status" data-milestone={m.earned ? "earned" : "open"} className={`mt-3 inline-flex flex-wrap items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${m.earned ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-200" : "border-slate-400/40 text-slate-300"}`}>
      <span aria-hidden="true">{m.earned ? "\u2605" : "\u2606"}</span>
      <span className="font-semibold">{m.label}</span>
      <span>{m.earned ? "Earned" : `Not yet (${m.done} of ${m.total} tasks)`}</span>
    </p>
  );
}
