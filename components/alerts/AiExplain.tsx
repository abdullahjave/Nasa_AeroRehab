"use client";

import { useEffect, useRef, useState } from "react";
import type { Alert } from "@/lib/alerts";
import type { GeminiExplanation } from "@/lib/alerts/gemini";

const CLIENT_TIMEOUT_MS = 28_000; // a little longer than the server limit

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ai"; explanation: GeminiExplanation }
  | { phase: "builtin"; reason: string };

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
 * On-click AI explanation for one alert. The status, measured values, next action and source link are rendered by the app
 * before and regardless of this request; this block only adds a short plain-English explanation ("AI explanation") or, when
 * it cannot, the app's own text ("Built-in guidance"). Mount it with a key of astronaut + session + alert so changing the
 * selection discards an in-flight result.
 */
export default function AiExplain({ alert }: { alert: Alert }) {
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
    const done = (s: State) => { if (current.current === mine && ctl.current === c) setState(s); };
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ astronautId: alert.astronautId, sessionId: alert.sessionId, alertId: alert.id }),
        signal: c.signal,
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; explanation?: GeminiExplanation } | null;
      if (res.ok && json?.ok && json.explanation) done({ phase: "ai", explanation: json.explanation });
      else done({ phase: "builtin", reason: REASON[json?.error ?? ""] ?? "A recommendation is not available for this alert." });
    } catch {
      done({ phase: "builtin", reason: timedOut ? REASON.timeout : "The recommendation could not be reached." });
    } finally {
      clearTimeout(timer);
      if (ctl.current === c) busy.current = false;
    }
  }

  const loading = state.phase === "loading";
  return (
    <div className="mt-3 border-t border-violet-300/15 pt-3 text-xs">
      <button type="button" onClick={ask} disabled={loading} aria-busy={loading}
        className="inline-flex items-center gap-2 rounded-md border border-violet-300/50 bg-violet-400/10 px-3 py-2 text-sm font-medium text-violet-100 hover:bg-violet-400/20 disabled:cursor-wait disabled:opacity-60">
        <span aria-hidden="true">&#10024;</span>
        {loading ? "Getting recommendation…" : state.phase === "idle" ? "Get Recommendation" : "Get Recommendation Again"}
      </button>
      <div role="status" aria-live="polite" className="mt-2">
        {state.phase === "ai" && (
          <div className="rounded-md border border-violet-300/30 bg-violet-400/10 p-2">
            <p className="text-sm font-semibold text-violet-100">AI Recommendation</p>
            <dl className="mt-1 space-y-1 text-slate-100">
              <div><dt className="text-[11px] text-slate-400">In plain words</dt><dd>{state.explanation.meaning}</dd></div>
              <div><dt className="text-[11px] text-slate-400">The numbers</dt><dd>{state.explanation.change}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Why this is recommended</dt><dd>{state.explanation.relevance}</dd></div>
            </dl>
            <p className="mt-1 text-[10px] text-slate-400">Written by AI from the values above. The status, numbers and next action are set by the app.</p>
          </div>
        )}
        {state.phase === "builtin" && (
          <div className="rounded-md border border-slate-400/40 bg-slate-400/10 p-2">
            <p className="font-semibold text-slate-100">Built-in guidance</p>
            <p className="text-[11px] text-amber-200">{state.reason}</p>
            <p className="mt-1 text-slate-100">{alert.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
