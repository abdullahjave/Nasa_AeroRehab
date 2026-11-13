"use client";

import { useEffect, useRef, useState } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import type { Alert } from "@/lib/alerts";
import type { GeminiExplanation } from "@/lib/alerts/gemini";

const CLIENT_TIMEOUT_MS = 28_000; // a little longer than the server limit

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ai"; explanation: GeminiExplanation; at: Date; ms: number }
  | { phase: "builtin"; reason: string; at: Date; ms: number };

/** "14:32:16 UTC, 3.2 s" - when the response arrived and how long the request took. */
const stampText = (at: Date, ms: number) => `${at.toISOString().slice(11, 19)} UTC, ${(ms / 1000).toFixed(1)} s`;

// Plain reasons for the fallback. They never name the provider and never show raw errors.
const REASON: Record<string, string> = {
  "not-configured": "Recommendations are not set up on this server.",
  "rate-limited": "Too many requests just now. Try again in a minute.",
  "provider-quota": "The AI service is busy right now. Try again later.",
  "upstream-failed": "The AI service is not responding right now. Try again later.",
  timeout: "The recommendation took too long.",
  "invalid-response": "The AI recommendation did not pass the app's checks.",
};

/**
 * On-click AI Recommendation for one alert. The status, measured values, next action and source link are rendered by the app
 * before and regardless of this request; this block adds what the AI makes of those numbers: what they show, what the status
 * means for the astronaut, concrete next steps, and when to tell the flight surgeon. When it cannot, the app's own text is shown
 * ("Built-in guidance"). It works for Demo and Recorded data (the server rebuilds the alert from ids; no names or notes are sent). Mount it with a key of astronaut + session + alert so changing the
 * selection discards an in-flight result.
 */
export default function AiExplain({ alert }: { alert: Alert }) {
  const { dataMode } = useAstronaut();
  const [state, setState] = useState<State>({ phase: "idle" });
  const stamp = `${alert.astronautId}|${alert.sessionId}|${alert.id}`;
  const current = useRef(stamp);
  const ctl = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    current.current = stamp;
    return () => { ctl.current?.abort(); busy.current = false; };
  }, [stamp]);

  async function ask() {
    if (busy.current) return; // duplicate-click protection
    busy.current = true;
    const mine = stamp;
    const c = new AbortController();
    ctl.current = c;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; c.abort(); }, CLIENT_TIMEOUT_MS);
    setState({ phase: "loading" });
    const t0 = performance.now();
    const done = (s: (at: Date, ms: number) => State) => { if (current.current === mine && ctl.current === c) setState(s(new Date(), performance.now() - t0)); };
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ astronautId: alert.astronautId, sessionId: alert.sessionId, alertId: alert.id, mode: dataMode }),
        signal: c.signal,
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; explanation?: GeminiExplanation } | null;
      const explanation = json?.explanation;
      if (res.ok && json?.ok && explanation) done((at, ms) => ({ phase: "ai", explanation, at, ms }));
      else done((at, ms) => ({ phase: "builtin", reason: REASON[json?.error ?? ""] ?? "A recommendation is not available for this alert.", at, ms }));
    } catch {
      done((at, ms) => ({ phase: "builtin", reason: timedOut ? REASON.timeout : "The recommendation could not be reached.", at, ms }));
    } finally {
      clearTimeout(timer);
      if (ctl.current === c) busy.current = false;
    }
  }

  const loading = state.phase === "loading";
  return (
    <div className="mt-3 border-t border-violet-300/15 pt-3" data-testid="ai-explain">
      <button type="button" onClick={ask} disabled={loading} aria-busy={loading}
        className="inline-flex items-center gap-2 rounded-md border border-violet-300/60 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500/30 disabled:cursor-wait disabled:opacity-70">
        <span aria-hidden="true">&#10024;</span>
        {loading ? "Getting AI recommendation…" : state.phase === "idle" ? "Get AI Recommendation" : "Get AI Recommendation again"}
      </button>
      {state.phase === "idle" && <p className="mt-1 text-xs text-slate-400">The AI reads the numbers and status above and suggests what to do next.</p>}
      <div role="status" aria-live="polite" className="mt-2">
        {loading && <p className="text-sm text-violet-100" data-testid="ai-loading">Reading your numbers and status…</p>}
        {state.phase === "ai" && (
          <div className="space-y-3 rounded-lg border border-violet-300/50 bg-violet-950/60 p-4 text-slate-50" data-testid="ai-result">
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
              <span aria-hidden="true">&#10024;</span> AI-generated recommendation
              <span className="rounded-full border border-violet-300/50 bg-violet-400/20 px-2 py-0.5 text-xs font-medium text-violet-100">App status: {alert.label}</span>
            </p>
            <p className="text-xs text-violet-200" data-testid="ai-generated-at">Generated {stampText(state.at, state.ms)}. The status, numbers and next action above are calculated by the app, not by the AI.</p>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-200">What your data shows</h4>
              <p className="mt-0.5 text-base leading-relaxed">{state.explanation.summary}</p>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-200">What it means for you</h4>
              <p className="mt-0.5 text-base leading-relaxed">{state.explanation.risk}</p>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-200">What to do next</h4>
              <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-base leading-relaxed marker:font-semibold marker:text-violet-200">
                {state.explanation.actions.map((a) => <li key={a}>{a}</li>)}
              </ol>
            </section>
            <section className="rounded-md border border-amber-300/40 bg-amber-300/10 p-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-200">Tell the flight surgeon if</h4>
              <p className="mt-0.5 text-sm leading-relaxed text-amber-50">{state.explanation.escalate}</p>
            </section>
            <p className="text-xs text-slate-400">Written by AI from the numbers above. The status and numbers are set by the app. This is a prototype with {alert.simulatedScenario || dataMode === "demo" ? "simulated" : "manually entered"} data, not medical advice.</p>
          </div>
        )}
        {state.phase === "builtin" && (
          <div className="rounded-md border border-slate-400/40 bg-slate-400/10 p-3" data-testid="ai-builtin">
            <p className="text-sm font-semibold text-slate-100">Built-in guidance (not AI-generated)</p>
            <p className="text-xs text-amber-200">AI recommendation unavailable: {state.reason}</p>
            <p className="text-xs text-slate-300" data-testid="builtin-at">Tried {stampText(state.at, state.ms)}. This text is written by the app, not by an AI.</p>
            <p className="mt-1 text-sm text-slate-100">{alert.explanation}</p>
            <p className="mt-1 text-sm text-slate-100">Next step: {alert.action.label}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
