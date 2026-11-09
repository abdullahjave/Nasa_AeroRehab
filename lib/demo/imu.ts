import { angularAccelerationAt, angularVelocityAt, kneeAt, sessionEnd } from "./knee";
import type { Session } from "./types";

export type ImuSite = "thigh" | "shank";
export type ImuPoint = { t: number; ax: number | null; ay: number | null; az: number | null; gx: number | null; gy: number | null; gz: number | null };

export const IMU_WINDOW_SEC = 20;
const RATE_HZ = 10;

/** Window [start, start+20] centred on the cursor, clamped to the session. */
export function imuWindowStart(s: Session, cursorT: number) {
  return Math.max(0, Math.min(sessionEnd(s) - IMU_WINDOW_SEC, cursorT - IMU_WINDOW_SEC / 2));
}

const SITE_SCALE: Record<ImuSite, number> = { shank: 1, thigh: 0.25 };

/**
 * Deterministic accelerometer (g) and gyroscope (deg/s) streams derived from the same knee-angle
 * curve the rest of the app uses. Gyro Y is the knee angular velocity; accel follows segment tilt
 * plus a tangential term. X/Z get small deterministic cross-axis motion.
 */
export function imuWindow(s: Session, site: ImuSite, cursorT: number): ImuPoint[] {
  const t0 = imuWindowStart(s, cursorT);
  const k = SITE_SCALE[site];
  const out: ImuPoint[] = [];
  for (let i = 0; i <= IMU_WINDOW_SEC * RATE_HZ; i++) {
    const t = t0 + i / RATE_HZ;
    const ang = kneeAt(s, t);
    const w = angularVelocityAt(s, t);
    const al = angularAccelerationAt(s, t);
    if (ang === null || w === null || al === null) {
      out.push({ t, ax: null, ay: null, az: null, gx: null, gy: null, gz: null });
      continue;
    }
    const th = (ang * k * Math.PI) / 180;
    const tang = 0.0255 * al * k;
    out.push({
      t,
      ax: Math.sin(th) + tang + 0.03 * Math.sin(t * 2.1),
      ay: 0.08 * Math.sin(t * 1.3 + 1) + 0.02 * w * k * 0.05,
      az: Math.cos(th) + 0.03 * Math.cos(t * 1.7),
      gx: 0.18 * w * k * Math.cos(t * 0.8) + 0.6 * Math.sin(t * 2.4),
      gy: w * k,
      gz: 0.12 * w * k * Math.sin(t * 0.6) + 0.5 * Math.cos(t * 1.9),
    });
  }
  return out;
}

/** Sensor orientation (deg) at the cursor. Pitch follows the segment angle. */
export function orientationAt(s: Session, site: ImuSite, t: number) {
  const ang = kneeAt(s, t);
  if (ang === null) return null;
  return { roll: 2 * Math.sin(t * 0.4), pitch: ang * SITE_SCALE[site], yaw: 3 * Math.cos(t * 0.3) };
}
