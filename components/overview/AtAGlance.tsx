"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import { useAlerts } from "@/components/alerts/useAlerts";
import { SeverityIcon, TONE } from "@/components/alerts/AlertBadge";
import { useRehab } from "@/components/rehab/useRehab";
import GaugeRing from "@/components/ui/GaugeRing";
import { AnimatedNumber } from "@/components/ui/motion";
import { C } from "@/components/ui/chart";
import { DEMO_DAY, todaysTasks, weekStartOf } from "@/lib/rehab";

const TILE = "glass lift group flex min-w-0 items-center gap-3 rounded-xl p-4";
const GO = "mt-1 inline-block text-[13px] text-cyan-300 transition-transform group-hover:translate-x-0.5";

/**
 * Three tiles that answer the first three questions without reading a card: how am I, what is my knee doing against
 * baseline, and how far through today's plan am I. Each tile reads the same data as the detailed card it links to.
 */
export default function AtAGlance() {
  const { astronaut, session, dataMode, selectFinding } = useAstronaut();
  const { summary } = useAlerts();
  const { completions } = useRehab(astronaut, DEMO_DAY, weekStartOf(DEMO_DAY));
  const t = todaysTasks(astronaut, completions, DEMO_DAY, dataMode === "recorded" ? "recorded" : "demo");
  const p = summary.primary;
  const v = p?.values ?? null;
  const rom = v?.current ?? session.knee.romDeg;
  const tone = p ? TONE[p.severity] : TONE.neutral;
  const flagged = p?.severity === "action";

  return (
    <section aria-label="At a glance" className="stagger grid gap-3 md:grid-cols-3">
      <Link href="/ai-insights" onClick={() => { if (p?.action.kind === "review-session") selectFinding(p.key); }}
        className={`${TILE} border ${tone.box} ${flagged ? "glow-action" : ""}`}>
        {/* Keyed on the label so the badge pops when Replay crosses from All Good to Action Required. */}
        <span key={p?.label ?? "none"} className={`status-pop flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${tone.box}`}>
          <SeverityIcon severity={p?.severity ?? "neutral"} className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="eyebrow block">Status</span>
          <span className={`block text-xl font-semibold leading-tight ${tone.text}`} aria-live="polite">{p?.label ?? "No status"}</span>
          <span className={GO}>{p && p.severity !== "good" ? "See the finding" : "See insights"} &rarr;</span>
        </span>
      </Link>

      <Link href="/joint-analytics" className={TILE}>
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">Knee range of motion</span>
          {rom === null ? (
            <span className="block text-base font-semibold text-amber-200">Unavailable</span>
          ) : (
            <span className="block text-3xl font-semibold leading-tight text-white">
              <AnimatedNumber value={rom} digits={Number.isInteger(rom) ? 0 : 1} />&deg;
              {v?.pctChange != null && (
                <span className={`ml-2 align-middle text-sm font-medium ${flagged ? "text-rose-300" : p?.severity === "attention" ? "text-amber-200" : "text-emerald-300"}`}>
                  <AnimatedNumber value={v.pctChange} digits={1} signed />%
                </span>
              )}
            </span>
          )}
          <span className="block text-[13px] text-slate-300">
            {v?.baseline != null ? <>vs {v.baseline}&deg; baseline{v.baselineDay ? ` (Day ${v.baselineDay})` : ""}</> : `Day ${session.missionDay}`}
          </span>
          {rom !== null && v?.baseline != null && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-700/60" aria-hidden="true">
              <span className={`bar-grow block h-full rounded-full ${flagged ? "bg-rose-400" : "bg-cyan-400"}`} style={{ width: `${Math.max(4, Math.min(100, (rom / v.baseline) * 100))}%` }} />
            </span>
          )}
        </span>
      </Link>

      <Link href="/rehabilitation" className={TILE}>
        {t.kind === "tasks" ? (
          <>
            <GaugeRing value={t.done} max={t.total} color={C.green} size="h-14 w-14" ariaLabel={`${t.done} of ${t.total} tasks complete`} />
            <span className="min-w-0">
              <span className="eyebrow block">Today&rsquo;s plan</span>
              <span className="block text-xl font-semibold leading-tight text-white"><AnimatedNumber value={t.done} /> of {t.total} done</span>
              <span className={GO}>Open today&rsquo;s plan &rarr;</span>
            </span>
          </>
        ) : (
          <span className="min-w-0">
            <span className="eyebrow block">Today&rsquo;s plan</span>
            <span className="block text-base font-semibold text-white">{t.reason === "no-program" ? "No plan assigned" : "Nothing scheduled today"}</span>
            <span className={GO}>Open rehabilitation &rarr;</span>
          </span>
        )}
      </Link>
    </section>
  );
}
