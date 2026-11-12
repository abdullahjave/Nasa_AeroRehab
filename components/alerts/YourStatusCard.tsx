"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import AlertBadge from "./AlertBadge";
import AiRecommendationCard from "./AiRecommendationCard";
import { useAlerts } from "./useAlerts";
import type { Alert } from "@/lib/alerts";

/** Where an alert's primary action goes from Overview. Review actions open the same finding in AI Insights. */
export function overviewTarget(a: Alert): string {
  return a.action.kind === "review-session" ? "/ai-insights" : a.action.href;
}

/**
 * "Your Status": the highest-priority alert as one AI Recommendation card (what changed, what to do next, then the optional
 * explanation and details). Data and sensor issues are listed separately and never read as a normal result.
 */
export default function YourStatusCard() {
  const { summary, alerts, session } = useAlerts();
  const { selectFinding } = useAstronaut();
  const p = summary.primary;
  const open = (a: Alert) => { if (a.action.kind === "review-session") selectFinding(a.key); };
  const otherHealth = alerts.filter((a) => a.kind === "health" && a.severity !== "good" && a !== p).length;

  return (
    <Panel id="status" title="Your Status" icon="check">
      {!p ? (
        <div className="rounded-md border border-slate-400/50 bg-slate-400/10 p-3">
          <p className="text-sm font-semibold text-white">No status for this session</p>
          <p className="text-sm text-slate-200">No checks are available for {session.label}, so nothing is shown as normal or flagged.</p>
        </div>
      ) : (
        <AiRecommendationCard alert={p} variant="overview" />
      )}
      <p className="mt-2 text-[11px] text-slate-300">{summary.scope}</p>
      {otherHealth > 0 && (
        <p className="mt-1 text-[11px] text-slate-300">
          {otherHealth} more finding{otherHealth === 1 ? "" : "s"} in <Link href="/ai-insights" className="text-cyan-300 hover:underline">AI Insights</Link>.
        </p>
      )}
      {summary.dataIssues.length > 0 && (
        <div className="mt-2 border-t border-cyan-400/15 pt-2">
          <p className="text-[11px] font-medium text-slate-300">Data and sensor issues (not health findings)</p>
          <ul className="mt-1 space-y-1">
            {summary.dataIssues.slice(0, 3).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <AlertBadge severity="neutral" label={d.label} />
                <span className="text-slate-200">{d.title}.</span>
                <Link href={overviewTarget(d)} onClick={() => open(d)} className="text-cyan-300 hover:underline">{d.action.label} &rarr;</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
