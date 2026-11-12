"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import { mmss, type Alert } from "@/lib/alerts";

/** Opens the exact source measurement for an alert (knee side and time) before navigating to Joint Analytics. */
export function useReview(alert: Alert) {
  const { selectKneeSide, setJointFocus } = useAstronaut();
  return () => {
    if (alert.source) selectKneeSide(alert.source.side);
    setJointFocus(alert.source?.tSec != null ? { sessionId: alert.sessionId, tSec: alert.source.tSec } : null);
  };
}

/**
 * Alert details shared by Overview ("Your Status") and AI Insights. Opens instantly with the built-in explanation
 * (no network), then the source measurement and exact session link. The optional AI explanation sits above it, in the card.
 * The status, numbers and next action come from the app's own rules and never depend on this block.
 */
export default function AlertDetails({ alert }: { alert: Alert }) {
  const review = useReview(alert);
  const isReview = alert.action.kind === "review-session";
  const side = alert.source ? (alert.source.side === "left" ? "Left" : "Right") : null;
  const sourceLine = alert.source
    ? `${alert.source.label} \u00b7 ${side} knee \u00b7 ${alert.sessionLabel}${alert.source.tSec != null ? ` \u00b7 at ${mmss(alert.source.tSec)}` : ""}`
    : alert.sessionLabel;
  return (
    <details className="group mt-3 rounded-md border border-cyan-400/20 bg-black/20 px-2 py-1.5">
      <summary className="cursor-pointer text-xs font-medium text-cyan-200 hover:text-white">Why am I seeing this?</summary>
      <div className="mt-1.5 text-xs text-slate-100">
        <ul className="list-disc space-y-1 pl-4">{alert.why.map((w) => <li key={w}>{w}</li>)}</ul>
        <p className="mt-2 text-[11px] text-slate-300">
          Source: {sourceLine}
          {isReview && <> &middot; <Link href="/joint-analytics" onClick={review} className="text-cyan-300 hover:underline">Open this measurement &rarr;</Link></>}
        </p>
        {alert.guidance && !alert.guidance.reviewed && (
          <p className="mt-2 text-[11px] text-slate-400">No clinician-reviewed guidance is available for this alert. Demo guidance is listed under Rehabilitation Recommendations in AI Insights ({alert.guidance.sourceLabel}).</p>
        )}
        {alert.guidance?.reviewed && (
          <div className="mt-2 rounded border border-emerald-400/30 p-2">
            <p className="text-[11px] font-medium text-emerald-200">Reviewed guidance &middot; Source: {alert.guidance.sourceLabel}</p>
            <ul className="list-disc pl-4">{alert.guidance.items.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        )}
      </div>
    </details>
  );
}
