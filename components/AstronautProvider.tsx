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
import { applyDevices, type DeviceState } from "@/lib/settings/devices";
import { useDeviceStore } from "@/components/settings/stores";

type Ctx = {
  /** Selected astronaut with the simulated device state (connection overrides) applied to its sensors. */
  astronaut: AstronautRecord;
  astronauts: AstronautRecord[];
  /** Simulated device overrides for the selected astronaut (undefined = none). */
  deviceState: DeviceState | undefined;
  /** false while the simulated hub link is down for the selected astronaut. */
  hubConnected: boolean;
  /** Back to the astronaut's latest session (Reset Demo). */
  resetSession: () => void;
  mission: Mission;
  selectedId: AstronautId;
  select: (id: AstronautId) => void;
  /** Session shown on every page. Falls back to the astronaut's latest session. */
  session: Session;
  selectSession: (id: string) => void;
  /** Selected single-leg balance trial side, shared by Overview and Stability & Balance. */
  balanceSide: "left" | "right";
  selectBalanceSide: (side: "left" | "right") => void;
  /** Knee shown on Joint Analytics (null = the instrumented knee). Set by "Review measurement" links. */
  kneeSide: "left" | "right" | null;
  selectKneeSide: (side: "left" | "right" | null) => void;
  /** Time to open Joint Analytics at, for one session only. */
  jointFocus: { sessionId: string; tSec: number } | null;
  setJointFocus: (f: { sessionId: string; tSec: number } | null) => void;
  /** Finding selected on AI Insights (cleared on the page when it does not belong to the session). */
  findingId: string | null;
  selectFinding: (id: string | null) => void;
  /** Exercise to open on Rehabilitation (set by an explicit AI Insights match). Only applies to that astronaut. */
  rehabFocus: { astronautId: string; exerciseId: string; at: number } | null;
  setRehabFocus: (f: { astronautId: string; exerciseId: string; at: number } | null) => void;
};

const AstronautContext = createContext<Ctx | null>(null);

/** Single source of truth for the selected astronaut. Mounted once in the root layout. */
export function AstronautProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<AstronautId>(DEFAULT_ASTRONAUT_ID);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [balanceSide, setBalanceSide] = useState<"left" | "right">("left");
  const [kneeSide, setKneeSide] = useState<"left" | "right" | null>(null);
  const [jointFocus, setJointFocus] = useState<{ sessionId: string; tSec: number } | null>(null);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [rehabFocus, setRehabFocus] = useState<{ astronautId: string; exerciseId: string; at: number } | null>(null);
  const devices = useDeviceStore();
  const value = useMemo<Ctx>(() => {
    const base = getAstronaut(selectedId);
    const astronaut = applyDevices(base, devices[selectedId]);
    return {
      astronaut,
      astronauts: ASTRONAUTS.map((a) => applyDevices(a, devices[a.id])),
      deviceState: devices[selectedId],
      hubConnected: devices[selectedId]?.hub !== false,
      resetSession: () => { setSessionId(null); setFindingId(null); },
      mission: MISSION,
      selectedId,
      // Changing astronaut resets to that astronaut's latest session.
      select: (id) => {
        setSelectedId(id);
        setSessionId(null);
        setKneeSide(null);
        setFindingId(null); // a finding belongs to one session
      },
      session: sessionId ? getSession(astronaut, sessionId) : getLatestSession(astronaut),
      selectSession: (id) => {
        setSessionId(id);
        setFindingId(null); // clear a selected event that belongs to the previous session
      },
      balanceSide,
      selectBalanceSide: setBalanceSide,
      kneeSide,
      selectKneeSide: setKneeSide,
      jointFocus,
      setJointFocus,
      findingId,
      selectFinding: setFindingId,
      rehabFocus,
      setRehabFocus,
    };
  }, [selectedId, devices, sessionId, balanceSide, kneeSide, jointFocus, findingId, rehabFocus]);
  return <AstronautContext.Provider value={value}>{children}</AstronautContext.Provider>;
}

export function useAstronaut(): Ctx {
  const ctx = useContext(AstronautContext);
  if (!ctx) throw new Error("useAstronaut must be used inside AstronautProvider");
  return ctx;
}
