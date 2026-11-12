// Rehab completion state, kept SEPARATE per data mode. Pure functions (no React, no storage): the hook in components/rehab/useRehabEdits.ts
// reads and writes localStorage and calls these.
//
// Storage keys (same shape in each): { [astronautId]: { [scheduledSessionId]: { [assignmentId]: done } } }
//   aerorehab.rehab.edits.demo.v1      Demo Mode ticks
//   aerorehab.rehab.edits.recorded.v1  Recorded Mode ticks
//   aerorehab.rehab.edits.v1           LEGACY: written before modes were separated. It has no mode field, and Demo and Recorded share the
//                                      same schedule and assignment ids, so the mode of an old entry cannot be identified. It is never
//                                      written or deleted any more.
//   aerorehab.rehab.edits.legacy-migrated.v1  { [astronautId]: true } once that astronaut's legacy entries were explicitly imported into Recorded.
//
// Rules: Recorded reads ONLY its own store (legacy is excluded from Recorded Overview, Rehabilitation and Reports until explicitly
// imported). Demo reads the legacy entries as a read-only baseline under its own store, which is exactly what Demo showed before, so no
// Demo behaviour changes and nothing is lost. Writes always go to the active mode's store only.

export type RehabMode = "demo" | "recorded";
export type EditsStore = Record<string, Record<string, Record<string, boolean>>>;
export type MigratedFlags = Record<string, boolean>;

export const REHAB_KEYS = {
  legacy: "aerorehab.rehab.edits.v1",
  demo: "aerorehab.rehab.edits.demo.v1",
  recorded: "aerorehab.rehab.edits.recorded.v1",
  migrated: "aerorehab.rehab.edits.legacy-migrated.v1",
} as const;

/** Defensive parse: keeps only boolean completion values under string keys; anything else is dropped. */
export function parseEditsStore(raw: unknown): EditsStore {
  const out: EditsStore = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [aid, sessions] of Object.entries(raw as Record<string, unknown>)) {
    if (!sessions || typeof sessions !== "object" || Array.isArray(sessions)) continue;
    for (const [sid, items] of Object.entries(sessions as Record<string, unknown>)) {
      if (!items || typeof items !== "object" || Array.isArray(items)) continue;
      for (const [iid, v] of Object.entries(items as Record<string, unknown>)) {
        if (typeof v !== "boolean") continue;
        ((out[aid] ??= {})[sid] ??= {})[iid] = v;
      }
    }
  }
  return out;
}

export function parseMigrated(raw: unknown): MigratedFlags {
  const out: MigratedFlags = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (v === true) out[k] = true;
  return out;
}

/** One astronaut's entries flattened to assignmentId -> done. */
export function flatten(store: EditsStore, astronautId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const items of Object.values(store[astronautId] ?? {})) Object.assign(out, items);
  return out;
}

/** The completion edits a mode uses. Recorded: its own store only. Demo: the legacy baseline overlaid by Demo's own store. */
export function effectiveEdits(mode: RehabMode, s: { legacy: EditsStore; demo: EditsStore; recorded: EditsStore }, astronautId: string): Record<string, boolean> {
  if (mode === "recorded") return flatten(s.recorded, astronautId);
  return { ...flatten(s.legacy, astronautId), ...flatten(s.demo, astronautId) };
}

/** Number of legacy entries (ticks and un-ticks) saved for this astronaut. */
export const legacyCount = (legacy: EditsStore, astronautId: string) => Object.keys(flatten(legacy, astronautId)).length;

/** A new store with one entry set. Never mutates the input. */
export function setEntry(store: EditsStore, astronautId: string, sessionId: string, assignmentId: string, done: boolean): EditsStore {
  const mine = { ...(store[astronautId] ?? {}) };
  mine[sessionId] = { ...(mine[sessionId] ?? {}), [assignmentId]: done };
  return { ...store, [astronautId]: mine };
}

/**
 * Explicit import of one astronaut's legacy entries into Recorded. Copies only; the legacy store is not touched. An entry the astronaut
 * already has in the Recorded store is kept as it is (Recorded wins), so an import can never overwrite a Recorded tick or undo.
 */
export function importLegacy(legacy: EditsStore, recorded: EditsStore, astronautId: string): EditsStore {
  let next = recorded;
  for (const [sid, items] of Object.entries(legacy[astronautId] ?? {})) {
    for (const [iid, v] of Object.entries(items)) {
      if (recorded[astronautId]?.[sid] && Object.prototype.hasOwnProperty.call(recorded[astronautId][sid], iid)) continue;
      next = setEntry(next, astronautId, sid, iid, v);
    }
  }
  return next;
}
