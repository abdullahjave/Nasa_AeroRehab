"use client";

import { useCallback, useSyncExternalStore } from "react";
import { saveNote, type ClinicalRecord, type NoteDraft, type NoteStore } from "@/lib/patients/notes";

// Stored as { [astronautId]: { [recordId]: record } }; each astronaut has its own branch.
const KEY = "aerorehab.patients.notes.v1";
type All = Record<string, NoteStore>;
const EMPTY: All = {};
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: All = EMPTY;

function read(): All {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { raw = null; }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try { cacheVal = raw ? (JSON.parse(raw) as All) : EMPTY; } catch { cacheVal = EMPTY; }
  }
  return cacheVal;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const on = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", on);
  return () => { listeners.delete(cb); window.removeEventListener("storage", on); };
}
function write(next: All) {
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { cacheRaw = JSON.stringify(next); cacheVal = next; }
  listeners.forEach((l) => l());
}

export function useNotes(astronautId: string, seed: ClinicalRecord[]) {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);
  const stored = all[astronautId] ?? {};
  const save = useCallback(
    (draft: NoteDraft, id: string | null) => {
      const cur = read();
      const mine = cur[astronautId] ?? {};
      // New IDs are unique per astronaut: one more than the highest existing note number.
      const n = Object.keys(mine).filter((k) => k.startsWith("note-")).map((k) => Number(k.slice(5))).filter(Number.isFinite);
      const newId = `note-${(n.length ? Math.max(...n) : 0) + 1}`;
      write({ ...cur, [astronautId]: saveNote(seed, mine, draft, id, newId) });
    },
    [astronautId, seed],
  );
  return { stored, save };
}
