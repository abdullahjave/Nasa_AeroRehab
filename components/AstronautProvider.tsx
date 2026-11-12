"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  ASTRONAUTS,
  DEFAULT_ASTRONAUT_ID,
  MISSION,
  getLatestSession,
  getSession,
  type AstronautId,
  type AstronautRecord,
  type Mission,
  type Session,
} from "@/lib/demo";
import { applyDevices, type DeviceState } from "@/lib/settings/devices";
import { emptySession, missionShape, recordedAstronauts } from "@/lib/recorded/build";
import { walkingFor } from "@/lib/recorded/walking";
import { balanceFor, pressureFor } from "@/lib/recorded/assessments";
import type { BalanceAssessmentView, PressureAssessmentView, WalkingSessionView } from "@/lib/recorded/types";
import { SEED_ASTRONAUTS, SEED_MISSION } from "@/lib/db/seed";
import type { RecordedSnapshot } from "@/lib/recorded/types";
import { loadRecorded, setDataMode as storeSetMode, useDataMode, useEnsureRecorded, type DataMode } from "@/components/recorded/store";
import { useDeviceStore } from "@/components/settings/stores";

type Ctx = {
  /** "demo" = simulated fixtures. "recorded" = sessions saved in the local database (no demo values are used). */
  dataMode: DataMode;
  setDataMode: (m: DataMode) => void;
  /** Recorded mode only: loading state of the database snapshot and a way to read it again. */
  recordedStatus: "idle" | "loading" | "ready" | "error";
  refreshRecorded: () => void;
  /** Recorded mode: the walking session shown on Gait Analysis, Overview and Reports context (null when none is saved). */
  walking: WalkingSessionView | null;
  selectWalking: (id: string | null) => void;
  /** Recorded mode: the pressure assessment and the balance trial shown on their pages and in Overview (null when none is saved). */
  pressureAssessment: PressureAssessmentView | null;
  selectPressureAssessment: (id: string | null) => void;
  balanceTrial: BalanceAssessmentView | null;
  selectBalanceTrial: (id: string | null) => void;
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
  const [walkingId, setWalkingId] = useState<string | null>(null);
  const [pressureId, setPressureId] = useState<string | null>(null);
  const [balanceTrialId, setBalanceTrialId] = useState<string | null>(null);
  const [rehabFocus, setRehabFocus] = useState<{ astronautId: string; exerciseId: string; at: number } | null>(null);
  const devices = useDeviceStore();
  const dataMode = useDataMode();
  const recorded = dataMode === "recorded";
  const rec = useEnsureRecorded(recorded);
  const value = useMemo<Ctx>(() => {
    // Recorded mode builds everything from database rows. Before the first load it uses the seed profiles with no sessions,
    // never the demo fixtures.
    const seedSnap: RecordedSnapshot = { mission: SEED_MISSION, astronauts: SEED_ASTRONAUTS, sessions: [], baselines: [], walkingSessions: [], pressureAssessments: [], balanceAssessments: [], sensorImports: [], alertAcks: [] };
    const portraits = Object.fromEntries(ASTRONAUTS.map((a) => [a.id, a.profile.portrait]));
    const recAll = recorded ? recordedAstronauts(rec.snapshot ?? seedSnap, portraits) : [];
    const all = recorded ? recAll : ASTRONAUTS;
    const base = all.find((a) => a.id === selectedId) ?? all[0];
    const astronaut = recorded ? base : applyDevices(base, devices[selectedId]);
    const recMission = rec.snapshot?.mission ?? SEED_MISSION;
    const fallbackSession = () => (recorded ? emptySession(astronaut.id, recMission) : getLatestSession(astronaut));
    const pick = (id: string | null) => (id ? astronaut.sessions.find((x) => x.id === id) : undefined) ?? (astronaut.sessions.length ? getLatestSession(astronaut) : fallbackSession());
    return {
      dataMode,
      setDataMode: (m: DataMode) => { storeSetMode(m); setWalkingId(null); setPressureId(null); setBalanceTrialId(null); setSessionId(null); setFindingId(null); setKneeSide(null); setJointFocus(null); },
      walking: recorded ? walkingFor(astronaut, recorded ? pick(sessionId) : null, walkingId) : null,
      selectWalking: setWalkingId,
      pressureAssessment: recorded ? pressureFor(astronaut, pick(sessionId), pressureId) : null,
      selectPressureAssessment: setPressureId,
      balanceTrial: recorded ? balanceFor(astronaut, pick(sessionId), balanceTrialId) : null,
      selectBalanceTrial: setBalanceTrialId,
      recordedStatus: rec.status,
      refreshRecorded: () => { void loadRecorded(); },
      astronaut,
      astronauts: recorded ? recAll : ASTRONAUTS.map((a) => applyDevices(a, devices[a.id])),
      deviceState: devices[selectedId],
      hubConnected: devices[selectedId]?.hub !== false,
      resetSession: () => { setSessionId(null); setFindingId(null); },
      mission: recorded ? missionShape(recMission, MISSION) : MISSION,
      selectedId,
      // Changing astronaut resets to that astronaut's latest session.
      select: (id) => {
        setSelectedId(id);
        setWalkingId(null);
        setPressureId(null);
        setBalanceTrialId(null);
        setSessionId(null);
        setKneeSide(null);
        setFindingId(null); // a finding belongs to one session
      },
      session: recorded ? pick(sessionId) : sessionId ? getSession(astronaut, sessionId) : getLatestSession(astronaut),
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
  }, [selectedId, devices, sessionId, walkingId, pressureId, balanceTrialId, balanceSide, kneeSide, jointFocus, findingId, rehabFocus, dataMode, recorded, rec.snapshot, rec.status]);
  return <AstronautContext.Provider value={value}>{children}</AstronautContext.Provider>;
}

export function useAstronaut(): Ctx {
  const ctx = useContext(AstronautContext);
  if (!ctx) throw new Error("useAstronaut must be used inside AstronautProvider");
  return ctx;
}
