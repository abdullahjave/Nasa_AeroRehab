"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import AlertBadge from "./AlertBadge";
import AiExplain from "./AiExplain";
import AckControl from "./AckControl";
import AlertDetails, { useReview } from "./AlertDetails";
import type { Alert } from "@/lib/alerts";

const n1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");
const signed = (v: number, u = "") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n1(Math.abs(v))}${u}`;

/** The measured values, straight from the app's comparison. Shown immediately, before any AI request. */
export function valuesLine(a: Pick<Alert, "values">): string | null {
  const v = a.values;
  if (!v) return null;
  const base = v.baseline !== null ? ` · ${n1(v.baseline)}° baseline (Day ${v.baselineDay})` : "";
  const diff = v.diff !== null && v.pctChange !== null ? ` · ${signed(v.diff, "°")} (${signed(v.pctChange, "%")})` : "";
  return `${v.metricLabel}: ${n1(v.current)}° now${base}${diff}`;
}

const LABEL = "text-xs font-semibold uppercase tracking-wide text-slate-400";

/**
 * One compact dark-glass card with a restrained violet accent, used by Overview ("Your Status") and AI Insights.
 * Order: status, what changed (with the measured values), what to do next (one action), then the optional AI explanation and
 * the technical details. Severity, values and the action come from the app's rules; the AI only explains.
 * `variant="overview"` sends review actions to AI Insights (selecting the finding); `"insights"` opens the measurement.
 */
export default function AiRecommendationCard({ alert, variant, selected = false }: { alert: Alert; variant: "overview" | "insights"; selected?: boolean }) {
  const { selectFinding } = useAstronaut();
  const review = useReview(alert);
  const isReview = alert.action.kind === "review-session";
  const overview = variant === "overview";
  const href = overview && isReview ? "/ai-insights" : alert.action.href;
  const onAction = overview ? () => { if (isReview) selectFinding(alert.key); } : isReview ? review : undefined;
  const line = valuesLine(alert);
  const repeats = alert.changed.toLowerCase().startsWith(alert.title.toLowerCase());

  return (
    <article
      className={`glass rounded-lg border-l-4 border-l-violet-400/70 p-3 ${selected ? "ring-2 ring-violet-300/70" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-2">
          <AlertBadge severity={alert.severity} label={alert.label} simulated={!!alert.simulatedScenario} />
          {alert.severity === "good" && alert.kind === "health" && <span className="text-xs text-slate-300" data-testid="good-scope">for {/^range of motion/i.test(alert.metric) ? "knee range of motion" : alert.metric.toLowerCase()} only</span>}
          {alert.geminiEligible && <span className="rounded-full border border-violet-300/40 bg-violet-400/10 px-2 py-0.5 text-[12px] font-medium text-violet-100">AI Recommendation</span>}
        </span>
        {!overview && (
          <button type="button" aria-pressed={selected} onClick={() => selectFinding(alert.key)} className="rounded px-1 text-[13px] text-cyan-300 hover:text-white hover:underline">{selected ? "Selected" : "Select"}</button>
        )}
      </div>
      {/* The title is kept for screen readers but not repeated visually when "What changed" already starts with it. */}
      <h3 className={repeats ? "sr-only" : "mt-1.5 text-base font-semibold text-white"}>{alert.title}</h3>

      <div className="mt-2" aria-live={overview ? "polite" : undefined}>
        <p className={LABEL}>What changed</p>
        <p className="text-base leading-relaxed text-slate-100">{alert.changed}</p>
        {line && <p className="mt-0.5 text-sm tabular-nums text-slate-300">{line}</p>}
        {alert.simulatedScenario && <p className="mt-1 text-[13px] text-cyan-100">{alert.simulatedScenario}. This is a labelled demo scenario, not a real clinical alert.</p>}
      </div>

      <div className="mt-2">
        <p className={LABEL}>What to do next</p>
        <Link href={href} onClick={onAction} className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400/25">
          {alert.action.label} &rarr;
        </Link>
      </div>

      <AckControl alert={alert} variant={variant} />
      {alert.geminiEligible && <AiExplain key={`${alert.astronautId}|${alert.sessionId}|${alert.id}`} alert={alert} />}
      <AlertDetails alert={alert} />
    </article>
  );
}
