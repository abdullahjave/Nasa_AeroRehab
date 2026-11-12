"use client";

import { useState } from "react";
import { describeAlert, describeSeen, type Alert } from "@/lib/alerts";
import AlertBadge from "./AlertBadge";
import { useAlertAcks } from "./useAlertAcks";

export const seenTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

/**
 * "Mark as seen" for one alert. Seen only records that you saw it, and what it said then: the alert keeps its status, wording and action, and is
 * never hidden or lowered. If the live alert later says something different, this shows that it changed since it was seen.
 * `variant="overview"` shows the state only (no button), so Overview stays focused on status and the next action.
 */
export default function AckControl({ alert, variant }: { alert: Alert; variant: "overview" | "insights" }) {
  const { statusFor, acknowledge, available, mode } = useAlertAcks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (alert.severity === "good" || !available) return null; // nothing to acknowledge on an "All Good" check
  const st = statusFor(alert);

  async function mark() {
    if (busy) return;
    setBusy(true); setError(null);
    const r = await acknowledge(alert);
    setBusy(false);
    if (!r.ok) setError(r.error);
  }

  const button = (label: string) => (
    <button type="button" onClick={mark} disabled={busy} aria-busy={busy}
      className="rounded-md border border-cyan-300/60 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-50 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60">
      {busy ? "Saving…" : label}
    </button>
  );

  return (
    <div className="mt-3 text-sm" data-testid="ack-control" data-ack-state={st.kind}>
      {st.kind === "unseen" && (variant === "insights" ? (
        <div className="flex flex-wrap items-center gap-2">
          {button("Mark as seen")}
          <span className="text-xs text-slate-400">Records that you saw this and what it said. The alert stays as it is. Saved {mode === "recorded" ? "in the local database" : "in this browser (Demo)"}.</span>
        </div>
      ) : null)}
      {st.kind === "seen" && (
        <p className="text-xs text-slate-300" data-testid="ack-seen">
          <span className="mr-1 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">Seen</span>
          {seenTime(st.entry.acknowledgedAt)} &middot; as {st.entry.severityLabel}. Still showing as {alert.label}.
        </p>
      )}
      {st.kind === "changed" && (
        <div className="rounded-md border border-amber-300/50 bg-amber-300/10 p-2 text-xs text-amber-100" data-testid="ack-changed" role="status">
          <p className="font-semibold">Changed since you saw it</p>
          <p className="mt-0.5">When you saw it ({seenTime(st.entry.acknowledgedAt)}): <span className="font-medium">{describeSeen(st.entry)}</span>.</p>
          <p>Now: <span className="font-medium">{describeAlert(alert)}</span>.</p>
          {variant === "insights" && <div className="mt-1.5">{button("Mark as seen again")}</div>}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

/** Compact severity chip used inside history rows (the severity AT THE TIME it was seen). */
export const SeenBadge = ({ severity, label, simulated }: { severity: Alert["severity"]; label: string; simulated: boolean }) => <AlertBadge severity={severity} label={label} simulated={simulated} />;
