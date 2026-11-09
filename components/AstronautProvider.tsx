"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  ASTRONAUTS,
  DEFAULT_ASTRONAUT_ID,
  MISSION,
  getAstronaut,
  getLatestSession,
  getSession,
  type AstronautId,
  type AstronautRecord,
  type Mission,
  type Session,
} from "@/lib/demo";

type Ctx = {
  astronaut: AstronautRecord;
  astronauts: AstronautRecord[];
  mission: Mission;
  selectedId: AstronautId;
  select: (id: AstronautId) => void;
  /** Session shown on every page. Falls back to the astronaut's latest session. */
  session: Session;
  selectSession: (id: string) => void;
};

const AstronautContext = createContext<Ctx | null>(null);

/** Single source of truth for the selected astronaut. Mounted once in the root layout. */
export function AstronautProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<AstronautId>(DEFAULT_ASTRONAUT_ID);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const value = useMemo<Ctx>(() => {
    const astronaut = getAstronaut(selectedId);
    return {
      astronaut,
      astronauts: ASTRONAUTS,
      mission: MISSION,
      selectedId,
      // Changing astronaut resets to that astronaut's latest session.
      select: (id) => {
        setSelectedId(id);
        setSessionId(null);
      },
      session: sessionId ? getSession(astronaut, sessionId) : getLatestSession(astronaut),
      selectSession: setSessionId,
    };
  }, [selectedId, sessionId]);
  return <AstronautContext.Provider value={value}>{children}</AstronautContext.Provider>;
}

export function useAstronaut(): Ctx {
  const ctx = useContext(AstronautContext);
  if (!ctx) throw new Error("useAstronaut must be used inside AstronautProvider");
  return ctx;
}
