"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { insightView } from "@/lib/insights";

/** Overview preview of the same insight records as AI Insights; the link opens the matching finding. */
export default function OverviewInsight() {
  const { astronaut, session, selectFinding } = useAstronaut();
  const v = useMemo(() => insightView(astronaut, session), [astronaut, session]);
  const f = v.findings[0] ?? null;
  const calc = f?.kind === "reduced-rom";
  return (
    <Panel id="insight" title="AI Health Insights" icon="brain" className="h-full"
      action={<Link href="/ai-insights" onClick={() => selectFinding(f?.id ?? null)} className="rounded px-1 text-[11px] text-cyan-300 hover:text-white hover:underline" aria-label="AI Health Insights: open finding">AI insights &rarr;</Link>}>
      {f ? (
        <div className={`flex-1 rounded-md border p-3 ${calc ? "border-rose-400/60 bg-rose-500/10" : "border-amber-300/70 bg-amber-300/5"}`}>
          <p className={`text-sm font-semibold ${calc ? "text-rose-200" : "text-amber-200"}`}>{f.title}</p>
          <p className="mt-0.5 text-xs text-slate-200">{f.text}</p>
          <p className="mt-2 text-[10px] text-slate-400">
            {f.source === "calculated" ? "Calculated from measurements" : f.source === "measured" ? "Measured data gap" : "Seeded demo scenario event"} &middot; {session.label}
            {v.findings.length > 1 ? ` · ${v.findings.length - 1} more` : ""}
          </p>
        </div>
      ) : (
        <div className="flex-1 rounded-md border border-dashed border-cyan-400/30 p-3 text-sm">
          <p className="font-semibold text-white">No findings for this session</p>
          <p className="text-xs text-slate-300">{v.baselineComparable ? "ROM is within the demo threshold and there are no timeline events." : "No comparable baseline and no timeline events."}</p>
        </div>
      )}
    </Panel>
  );
}
