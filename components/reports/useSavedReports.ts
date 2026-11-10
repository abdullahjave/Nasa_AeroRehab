"use client";

import { useCallback, useSyncExternalStore } from "react";

/** A locally saved report configuration (filters only; no files are stored or generated). */
export type SavedReport = {
  id: string;
  astronautId: string;
  view: "session" | "history";
  sessionId: string | null;
  start: number;
  end: number;
  savedAtIso: string;
};

const KEY = "aerorehab.reports.saved.v1";
const EMPTY: SavedReport[] = [];
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: SavedReport[] = EMPTY;

function read(): SavedReport[] {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { raw = null; }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try { cacheVal = raw ? (JSON.parse(raw) as SavedReport[]) : EMPTY; } catch { cacheVal = EMPTY; }
  }
  return cacheVal;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const on = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", on);
  return () => { listeners.delete(cb); window.removeEventListener("storage", on); };
}
function write(list: SavedReport[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { cacheRaw = JSON.stringify(list); cacheVal = list; }
  listeners.forEach((l) => l());
}

export function useSavedReports() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  const save = useCallback((r: Omit<SavedReport, "id" | "savedAtIso">) => {
    const now = new Date();
    write([{ ...r, id: `rep-${now.getTime()}`, savedAtIso: now.toISOString() }, ...read()].slice(0, 12));
  }, []);
  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), []);
  return { list, save, remove };
}
