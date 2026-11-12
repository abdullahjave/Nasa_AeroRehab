"use client";

import { useCallback, useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import { createLocalStore } from "@/components/settings/stores";
import {
  REHAB_KEYS, effectiveEdits, importLegacy, legacyCount, parseEditsStore, parseMigrated, setEntry,
  type EditsStore, type MigratedFlags, type RehabMode,
} from "@/lib/rehab/edits";

// Local rehab completion state, separate per data mode (see lib/rehab/edits.ts for the keys and rules). Every reader (Overview, Rehabilitation,
// Reports) goes through this hook and gets the edits of the ACTIVE mode, so they always agree. Each astronaut has their own branch.
const EMPTY: EditsStore = {};
const legacyStore = createLocalStore<EditsStore>(REHAB_KEYS.legacy, EMPTY, parseEditsStore); // read-only: never written after modes were separated
const modeStores: Record<RehabMode, ReturnType<typeof createLocalStore<EditsStore>>> = {
  demo: createLocalStore<EditsStore>(REHAB_KEYS.demo, EMPTY, parseEditsStore),
  recorded: createLocalStore<EditsStore>(REHAB_KEYS.recorded, EMPTY, parseEditsStore),
};
const migratedStore = createLocalStore<MigratedFlags>(REHAB_KEYS.migrated, {}, parseMigrated);

/** Edits for one astronaut in the active data mode, flattened to assignmentId -> completed, plus a setter that writes to that mode only. */
export function useRehabEdits(astronautId: string) {
  const { dataMode } = useAstronaut();
  const mode: RehabMode = dataMode === "recorded" ? "recorded" : "demo";
  const legacy = legacyStore.use();
  const demo = modeStores.demo.use();
  const recorded = modeStores.recorded.use();
  const migrated = migratedStore.use();

  const edits = useMemo(() => effectiveEdits(mode, { legacy, demo, recorded }, astronautId), [mode, legacy, demo, recorded, astronautId]);
  const setEdit = useCallback(
    (scheduledSessionId: string, assignmentId: string, done: boolean) => {
      const store = modeStores[mode];
      store.write(setEntry(store.read(), astronautId, scheduledSessionId, assignmentId, done));
    },
    [mode, astronautId],
  );

  const count = legacyCount(legacy, astronautId);
  const importLegacyIntoRecorded = useCallback(() => {
    modeStores.recorded.write(importLegacy(legacyStore.read(), modeStores.recorded.read(), astronautId)); // copies; the legacy store is untouched
    migratedStore.write({ ...migratedStore.read(), [astronautId]: true });
  }, [astronautId]);

  return {
    edits,
    setEdit,
    mode,
    /** Entries saved before modes were separated (source unknown). Shown in Demo, excluded from Recorded until imported. */
    legacy: { count, imported: !!migrated[astronautId], importIntoRecorded: importLegacyIntoRecorded },
  };
}
