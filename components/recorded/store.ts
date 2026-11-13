"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createLocalStore } from "@/components/settings/stores";
import type { RecordedSnapshot } from "@/lib/recorded/types";

// Browser side of recorded mode. The database lives on the server; the browser only holds the last snapshot it received and
// the chosen data mode ("demo" = simulated fixtures, "recorded" = saved sessions). Every page reads the same snapshot.

export type DataMode = "demo" | "recorded";
export const MODE_KEY = "aerorehab.data-mode.v1";
const mode = createLocalStore<DataMode>(MODE_KEY, "demo", (raw) => (raw === "recorded" ? "recorded" : "demo"));
export const useDataMode = mode.use;
export const setDataMode = (m: DataMode) => mode.write(m);

export type RecordedState = { status: "idle" | "loading" | "ready" | "error"; snapshot: RecordedSnapshot | null; error: string | null; loadedAt: number | null };
let state: RecordedState = { status: "idle", snapshot: null, error: null, loadedAt: null };
const listeners = new Set<() => void>();
const set = (next: RecordedState) => { state = next; listeners.forEach((l) => l()); };

export async function loadRecorded(): Promise<void> {
  if (state.status === "loading") return;
  set({ ...state, status: "loading", error: null });
  try {
    const res = await fetch("/api/recorded", { cache: "no-store" });
    const json = (await res.json()) as { ok?: boolean; snapshot?: RecordedSnapshot };
    if (!res.ok || !json.ok || !json.snapshot) throw new Error("bad response");
    set({ status: "ready", snapshot: json.snapshot, error: null, loadedAt: Date.now() });
  } catch {
    set({ ...state, status: "error", error: "Recorded data could not be loaded from the local database." }); // keeps the last snapshot and its loadedAt so the page can label it as out of date
  }
}

/** A save returns a fresh snapshot; applying it updates every page at once. */
export const applySnapshot = (snapshot: RecordedSnapshot) => set({ status: "ready", snapshot, error: null, loadedAt: Date.now() });

export function useRecorded(): RecordedState {
  const s = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
  return s;
}

/** Loads the snapshot once when recorded mode is on. */
export function useEnsureRecorded(active: boolean) {
  const s = useRecorded();
  useEffect(() => { if (active && s.status === "idle") void loadRecorded(); }, [active, s.status]);
  return s;
}
