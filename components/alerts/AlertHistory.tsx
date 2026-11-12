"use client";

import Link from "next/link";
import { useState } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { historyFor, mmss } from "@/lib/alerts";
import { SeenBadge, seenTime } from "./AckControl";
import { useAlertAcks } from "./useAlertAcks";
import { valuesLine } from "./AiRecommendationCard";

/**
 * Alert history for the selected astronaut in the active data mode: every time a finding was marked as seen, with the severity, values and
 * source it had at that moment. Newest first. The link opens that exact measurement (session, knee side and time).
 */
export default function AlertHistory() {
  const { astronaut, session, selectSession, selectKneeSide, setJointFocus } = useAstronaut();
  const { entries, mode } = useAlertAcks();
  const [scope, setScope] = useState<"session" | "all">("session");
  const list = historyFor(entries, astronaut.id, scope === "session" ? session.id : null);
  const knownSession = (id: string) => astronaut.sessions.some((s) => s.id === id);

  return (
    <Panel id="ai-history" title="Alert history" icon="timeline"
      action={
        <div role="group" aria-label="History scope" className="flex overflow-hidden rounded-md border border-cyan-400/40">
          {([["session", "This session"], ["all", "All sessions"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)}
              className={`px-2.5 py-1 text-xs ${scope === k ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
          ))}
        </div>
      }>
      <p className="mb-2 text-xs text-slate-300">
        Findings you marked as seen for {astronaut.profile.displayName}, as they read when you saw them. {mode === "recorded" ? "Saved in the local database." : "Demo history is saved in this browser and is separate from Recorded."}
      </p>
      {list.length === 0 ? (
        <p className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm text-slate-200" data-testid="history-empty">
          Nothing marked as seen {scope === "session" ? "for this session" : "yet"}. Use &ldquo;Mark as seen&rdquo; on a finding above.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Seen findings" data-testid="history-list">
          {list.map((e) => {
            const side = e.source ? (e.source.side === "left" ? "Left" : "Right") : null;
            const open = () => {
              if (knownSession(e.sessionId)) selectSession(e.sessionId);
              if (e.source) selectKneeSide(e.source.side);
              setJointFocus(e.source?.tSec != null ? { sessionId: e.sessionId, tSec: e.source.tSec } : null);
            };
            return (
              <li key={e.id} className="rounded-md border border-cyan-400/20 bg-black/20 p-2 text-sm" data-history-id={e.id} data-alert-id={e.alertId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SeenBadge severity={e.severity} label={e.severityLabel} simulated={!!e.simulatedScenario} />
                  <span className="text-xs tabular-nums text-slate-400">Seen {seenTime(e.acknowledgedAt)}</span>
                </div>
                <p className="mt-1 font-medium text-white">{e.title}</p>
                {valuesLine(e) && <p className="text-xs tabular-nums text-slate-300">{valuesLine(e)}</p>}
                <p className="mt-0.5 text-xs text-slate-400">
                  {e.sessionLabel} (Day {e.missionDay})
                  {e.source && <> &middot; Source: {e.source.label} &middot; {side} knee{e.source.tSec != null ? ` · at ${mmss(e.source.tSec)}` : ""}</>}
                  {e.source && <> &middot; <Link href="/joint-analytics" onClick={open} className="text-cyan-300 hover:underline" aria-label={`Open the measurement for: ${e.title}, ${e.sessionLabel}`}>Open this measurement &rarr;</Link></>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
