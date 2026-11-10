import { ASTRONAUTS, MISSION } from "./fixtures";
import type { AstronautId, AstronautRecord, Session } from "./types";

export * from "./types";
export * from "./knee";
export * from "./gait";
export * from "./imu";
export * from "./pressure";
export { MISSION, ASTRONAUTS };

export const DEFAULT_ASTRONAUT_ID: AstronautId = "astro-chen";

export function getAstronaut(id: AstronautId): AstronautRecord {
  return ASTRONAUTS.find((a) => a.id === id) ?? ASTRONAUTS[0];
}

export function getSession(a: AstronautRecord, id: string | null | undefined): Session {
  return a.sessions.find((s) => s.id === id) ?? getLatestSession(a);
}

export function getLatestSession(a: AstronautRecord): Session {
  return a.sessions[a.sessions.length - 1];
}


/** Sensors summary used by the sidebar status. */
export function getSensorSummary(a: AstronautRecord) {
  const online = a.sensors.filter((s) => s.status !== "offline");
  const batteries = a.sensors.map((s) => s.battery).filter((b): b is number => b !== null);
  return {
    total: a.sensors.length,
    connected: online.length,
    lowestBattery: batteries.length ? Math.min(...batteries) : null,
    state: online.length === a.sensors.length ? ("all" as const) : online.length === 0 ? ("none" as const) : ("partial" as const),
  };
}
