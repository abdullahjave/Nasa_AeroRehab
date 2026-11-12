import type { AstronautRecord, Session } from "../demo/types";
import type { WalkingSessionView } from "./types";

// The one calculation for manual walking totals. Values are NOT rounded here; screens round only when they display.

/** Speed in m/s = distance / duration. null unless the duration is finite and above zero and the distance is finite and not negative. */
export function walkingSpeedMs(distanceM: number | null, durationS: number | null): number | null {
  if (distanceM === null || durationS === null || !Number.isFinite(distanceM) || !Number.isFinite(durationS) || distanceM < 0 || durationS <= 0) return null;
  return distanceM / durationS;
}

/** Cadence in steps/min = steps / duration x 60. null when the step count was not entered (a missing count is not zero). */
export function walkingCadenceSpm(steps: number | null, durationS: number | null): number | null {
  if (steps === null || durationS === null || !Number.isFinite(steps) || !Number.isFinite(durationS) || steps < 0 || durationS <= 0) return null;
  return (steps * 60) / durationS;
}

/**
 * Which walking session Overview shows for the selected knee session: the walking session recorded on the same mission day when
 * there is one, otherwise the latest walking session. The chosen session is always named next to its numbers.
 * An explicit pick (Gait Analysis) wins.
 */
export function walkingFor(a: AstronautRecord, session: Session | null, pickedId: string | null = null): WalkingSessionView | null {
  const all = a.walking ?? [];
  if (!all.length) return null;
  const picked = pickedId ? all.find((w) => w.id === pickedId) : undefined;
  if (picked) return picked;
  if (session && !session.recorded?.empty) {
    const sameDay = [...all].reverse().find((w) => w.missionDay === session.missionDay);
    if (sameDay) return sameDay;
  }
  return all[all.length - 1];
}
