"use client";

import { useCallback, useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import { createLocalStore } from "@/components/settings/stores";
import { ackAlertApi } from "@/components/recorded/api";
import { useRecorded } from "@/components/recorded/store";
import { ACK_DEMO_KEY, addToStore, entryFor, flattenAcks, parseAckStore, statusOf, type AckEntry, type AckStatus, type AckStore } from "@/lib/alerts/ack";
import type { Alert } from "@/lib/alerts";

// "Mark as seen" for the ACTIVE data mode.
//   Demo:     this browser's localStorage, key aerorehab.alerts.seen.demo.v1 (its own store; nothing is shared with Recorded).
//   Recorded: the local SQLite database through /api/recorded/alerts/ack; the entries arrive in the recorded snapshot.
// Both give the same entry shape, so Overview and AI Insights read them identically.
const demoStore = createLocalStore<AckStore>(ACK_DEMO_KEY, {}, parseAckStore);
const newId = () => `ack-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export type AckOutcome = { ok: true; duplicate: boolean } | { ok: false; error: string };

export function useAlertAcks() {
  const { astronaut, session, dataMode } = useAstronaut();
  const demo = demoStore.use();
  const rec = useRecorded();
  const recorded = dataMode === "recorded";
  const entries = useMemo<AckEntry[]>(
    () => (recorded ? (rec.snapshot?.alertAcks ?? []).filter((e) => e.astronautId === astronaut.id) : flattenAcks(demo, astronaut.id)),
    [recorded, rec.snapshot, demo, astronaut.id],
  );
  /** A recorded astronaut with no saved knee session has no findings to acknowledge. */
  const available = !recorded || !session.recorded?.empty;

  const statusFor = useCallback((a: Alert): AckStatus => statusOf(entries, a), [entries]);
  const acknowledge = useCallback(async (a: Alert): Promise<AckOutcome> => {
    if (!recorded) {
      const r = addToStore(demoStore.read(), entryFor(a, new Date().toISOString(), newId()));
      if (r.added) demoStore.write(r.store);
      return { ok: true, duplicate: !r.added };
    }
    const res = await ackAlertApi({ astronautId: a.astronautId, sessionId: a.sessionId, alertId: a.id });
    return res.ok ? { ok: true, duplicate: !!res.value?.duplicate } : { ok: false, error: res.errors.form ?? "Could not save. Nothing was changed." };
  }, [recorded]);

  return { entries, statusFor, acknowledge, available, mode: recorded ? ("recorded" as const) : ("demo" as const) };
}
