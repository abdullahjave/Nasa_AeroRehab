import type { AstronautRecord, Sensor } from "../demo/types";

// Simulated device state (Step 10). Lives apart from saved session data: it only changes how the *current*
// sensor status is displayed. Stored readings, sessions and assessment scores are never touched here.

export type SensorOverride = {
  /** false = the user disconnected it; true = reconnected (also brings a fixture-offline sensor online). */
  connected?: boolean;
  /** Simulated calibration run. `at` is an ISO timestamp taken from the browser clock when the run finished. */
  calibration?: { at: string };
};

export type DeviceState = {
  /** false = the simulated hub link is down, so every sensor of this astronaut is unreachable. */
  hub?: boolean;
  sensors: Record<string, SensorOverride>;
};

/** Keyed by astronaut id, so one astronaut's overrides never leak into another's. */
export type DeviceStore = Record<string, DeviceState>;

export const EMPTY_STORE: DeviceStore = {};
export const LOW_BATTERY_PCT = 25;

export type OfflineReason = "fixture" | "disconnected" | "hub";
export type CalibrationStatus = "valid" | "stale" | "unavailable" | "not-recorded";

export type SensorDetail = {
  sensor: Sensor;
  /** Why the sensor is offline; null while it is connected. */
  reason: OfflineReason | null;
  calibration: { status: CalibrationStatus; at: string | null };
  /** true once a simulated run has happened for this sensor. */
  calibratedInDemo: boolean;
};

export const isConnected = (s: Sensor) => s.status !== "offline";

/** Effective sensor: the fixture record with the simulated connection state applied. */
export function effectiveSensor(base: Sensor, ov: SensorOverride | undefined, hub: boolean): { sensor: Sensor; reason: OfflineReason | null } {
  let reason: OfflineReason | null = null;
  if (!hub) reason = "hub";
  else if (ov?.connected === false) reason = "disconnected";
  else if (base.status === "offline" && ov?.connected !== true) reason = "fixture";
  if (reason) return { sensor: { ...base, status: "offline", battery: null }, reason };
  // Connected: keep the fixture battery. null stays null (no reading), 0 stays a real 0%.
  const status: Sensor["status"] = base.status === "offline" ? (base.battery !== null && base.battery < LOW_BATTERY_PCT ? "low-battery" : "online") : base.status;
  return { sensor: { ...base, status }, reason: null };
}

/** Baseline calibration comes from the latest session's IMU records; insoles have no calibration fixture. */
function baselineCalibration(a: AstronautRecord, s: Sensor): CalibrationStatus {
  const latest = a.sessions[a.sessions.length - 1];
  if (s.site === "thigh" || s.site === "shank") return latest?.joint.imu[s.site]?.status ?? "not-recorded";
  return "not-recorded";
}

export function sensorDetails(a: AstronautRecord, st: DeviceState | undefined): SensorDetail[] {
  const hub = st?.hub !== false;
  return a.sensors.map((base) => {
    const ov = st?.sensors[base.id];
    const { sensor, reason } = effectiveSensor(base, ov, hub);
    const cal = ov?.calibration;
    return {
      sensor,
      reason,
      calibration: cal ? { status: "valid", at: cal.at } : { status: baselineCalibration(a, base), at: null },
      calibratedInDemo: !!cal,
    };
  });
}

/** The astronaut record with effective sensors. Sessions and every reading are the same objects as before. */
export function applyDevices(a: AstronautRecord, st: DeviceState | undefined): AstronautRecord {
  if (!st) return a;
  return { ...a, sensors: sensorDetails(a, st).map((d) => d.sensor) };
}

const stateOf = (store: DeviceStore, id: string): DeviceState => store[id] ?? { sensors: {} };

export function setSensorConnected(store: DeviceStore, astronautId: string, sensorId: string, connected: boolean): DeviceStore {
  const st = stateOf(store, astronautId);
  return { ...store, [astronautId]: { ...st, sensors: { ...st.sensors, [sensorId]: { ...st.sensors[sensorId], connected } } } };
}

export function setHubConnected(store: DeviceStore, astronautId: string, connected: boolean): DeviceStore {
  return { ...store, [astronautId]: { ...stateOf(store, astronautId), hub: connected } };
}

export function recordCalibration(store: DeviceStore, astronautId: string, sensorId: string, atIso: string): DeviceStore {
  const st = stateOf(store, astronautId);
  return { ...store, [astronautId]: { ...st, sensors: { ...st.sensors, [sensorId]: { ...st.sensors[sensorId], calibration: { at: atIso } } } } };
}

/** Why a calibration cannot start (null = it can). */
export function calibrationBlocked(d: SensorDetail | undefined, pending: boolean): string | null {
  if (!d) return "No sensor selected.";
  if (pending) return "Calibration is already running for this sensor.";
  if (d.reason === "hub") return "The hub link is down. Reconnect the hub first.";
  if (d.reason) return "This sensor is disconnected. Reconnect it to calibrate.";
  return null;
}

/** Coerces parsed JSON into a store; anything malformed is dropped rather than trusted. */
export function parseDeviceStore(raw: unknown): DeviceStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_STORE;
  const out: DeviceStore = {};
  for (const [aid, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const st = v as { hub?: unknown; sensors?: unknown };
    const sensors: Record<string, SensorOverride> = {};
    if (st.sensors && typeof st.sensors === "object") {
      for (const [sid, o] of Object.entries(st.sensors as Record<string, unknown>)) {
        if (!o || typeof o !== "object") continue;
        const ov = o as { connected?: unknown; calibration?: { at?: unknown } };
        const clean: SensorOverride = {};
        if (typeof ov.connected === "boolean") clean.connected = ov.connected;
        if (ov.calibration && typeof ov.calibration.at === "string") clean.calibration = { at: ov.calibration.at };
        sensors[sid] = clean;
      }
    }
    out[aid] = { ...(typeof st.hub === "boolean" ? { hub: st.hub } : {}), sensors };
  }
  return out;
}
