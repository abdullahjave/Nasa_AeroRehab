"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import AiRecommendationCard from "@/components/alerts/AiRecommendationCard";
import AlertHistory from "@/components/alerts/AlertHistory";
import NotAssessed from "@/components/alerts/NotAssessed";
import { useAlerts } from "@/components/alerts/useAlerts";
import ReadingRows from "@/components/readings/ReadingRows";
import RecordedTrend from "./RecordedTrend";

/**
 * AI Insights for recorded mode. The alert cards come from the same alert list as Overview (one selector), with the app's
 * next action and the on-request AI Recommendation (the server rebuilds the alert from the saved records; no names or notes are sent).
 * Charts, anomaly timelines and anatomy panels need sensor samples and are not drawn for manual sessions.
 */
export default function RecordedInsights() {
  const { astronaut, session, findingId } = useAstronaut();
  const { alerts, summary } = useAlerts();
  const selected = alerts.find((x) => x.key === findingId) ?? summary.primary ?? null;
  const li = (x: (typeof alerts)[number]) => (
    <li key={x.id} id={`alert-${x.key}`} aria-current={selected?.id === x.id ? "true" : undefined} className="list-none">
      <AiRecommendationCard alert={x} variant="insights" selected={selected?.id === x.id} />
    </li>
  );
  const health = alerts.filter((x) => x.kind === "health");
  const data = alerts.filter((x) => x.kind === "data");
  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">AI Insights</h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Recorded Data</p>
        </div>
        <SessionPicker />
      </header>

      <Panel id="ai-alerts" title="Your alerts" icon="warn">
        <p className="mb-2 text-[13px] text-slate-300">{summary.scope} Press &quot;Get AI Recommendation&quot; on a card for suggested next steps; only the knee numbers and status are sent, never names or notes.</p>
        <NotAssessed />
        {health.length > 0 && <ul className="space-y-2" aria-label="Health findings">{health.map(li)}</ul>}
        {data.length > 0 && (
          <div className={health.length ? "mt-3" : ""}>
            <h3 className="mb-1 text-xs font-semibold text-slate-200">{health.length ? "Data issues " : "Status "}<span className="font-normal text-slate-400">(measurement or record problems, not health findings)</span></h3>
            <ul className="space-y-2" aria-label="Data issues">{data.map(li)}</ul>
          </div>
        )}
      </Panel>

      <AlertHistory />

      <Panel id="ai-readings" title="Your readings" icon="chart"><ReadingRows /></Panel>
      <RecordedTrend />
      <Panel id="ai-unavailable" title="Charts and timeline" icon="pulse">
        <p className="text-sm text-amber-200">Unavailable for manual sessions</p>
        <p className="text-xs text-slate-300">The knee-angle overlay, movement timeline and anatomy view need sensor samples. Nothing is filled in from demo data. <Link href="/joint-analytics" className="text-cyan-300 hover:underline">See the entered values in Joint Analytics &rarr;</Link></p>
      </Panel>
    </div>
  );
}
