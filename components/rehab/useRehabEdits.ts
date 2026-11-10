"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Local completion edits, stored as { [astronautId]: { [scheduledSessionId]: { [assignmentId]: boolean } } }.
// Each astronaut has its own branch, so one astronaut's edits never affect another's.
const KEY = "aerorehab.rehab.edits.v1";
type All = Record<string, Record<string, Record<string, boolean>>>;
const EMPTY: All = {};
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: All = EMPTY;

function read(): All {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheVal = raw ? (JSON.parse(raw) as All) : EMPTY;
    } catch {
      cacheVal = EMPTY;
    }
  }
  return cacheVal;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: All) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode): keep the in-memory value for this page view
    cacheRaw = JSON.stringify(next);
    cacheVal = next;
  }
  listeners.forEach((l) => l());
}

/** Edits for one astronaut, flattened to assignmentId -> completed, plus a setter. */
export function useRehabEdits(astronautId: string) {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);
  const mine = all[astronautId];
  const flat = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const s of Object.values(mine ?? {})) Object.assign(out, s);
    return out;
  }, [mine]);
  const setEdit = useCallback(
    (scheduledSessionId: string, assignmentId: string, done: boolean) => {
      const cur = read();
      const a = { ...(cur[astronautId] ?? {}) };
      a[scheduledSessionId] = { ...(a[scheduledSessionId] ?? {}), [assignmentId]: done };
      write({ ...cur, [astronautId]: a });
    },
    [astronautId],
  );
  return { edits: flat, setEdit };
}
