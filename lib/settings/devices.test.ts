import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDevices, calibrationBlocked, effectiveSensor, parseDeviceStore, recordCalibration, sensorDetails, setHubConnected, setSensorConnected, EMPTY_STORE,
} from "./devices";
import type { AstronautRecord, Sensor } from "../demo/types";

const S = (id: string, site: Sensor["site"], status: Sensor["status"], battery: number | null): Sensor => ({ id, label: id, site, status, battery });
const imu = (status: "valid" | "stale") => ({ status, biasG: [0, 0, 0] as [number, number, number], scaleFactor: 1, tempC: 30 });
const astro = (id: string, sensors: Sensor[]): AstronautRecord =>
  ({ id, sensors, sessions: [{ joint: { imu: { thigh: imu("valid"), shank: imu("stale") } } }] } as unknown as AstronautRecord);

test("no override keeps the fixture sensor untouched", () => {
  const b = S("a", "thigh", "online", 80);
  assert.deepEqual(effectiveSensor(b, undefined, true), { sensor: b, reason: null });
});

test("disconnect makes the sensor offline with no battery; reconnect restores the fixture battery", () => {
  const b = S("a", "thigh", "online", 80);
  const off = effectiveSensor(b, { connected: false }, true);
  assert.equal(off.sensor.status, "offline");
  assert.equal(off.sensor.battery, null);
  assert.equal(off.reason, "disconnected");
  const on = effectiveSensor(b, { connected: true }, true);
  assert.deepEqual(on.sensor, b);
});

test("a valid 0% battery is kept as 0 and is not treated as missing", () => {
  const e = effectiveSensor(S("a", "thigh", "low-battery", 0), undefined, true);
  assert.equal(e.sensor.battery, 0);
  assert.equal(e.sensor.status, "low-battery");
});

test("a fixture-offline sensor stays offline until reconnected, and reconnecting does not invent a battery", () => {
  const b = S("r", "insole-right", "offline", null);
  assert.equal(effectiveSensor(b, undefined, true).reason, "fixture");
  const on = effectiveSensor(b, { connected: true }, true);
  assert.equal(on.sensor.status, "online");
  assert.equal(on.sensor.battery, null);
});

test("hub down takes every sensor offline, and the sensor overrides survive for when it returns", () => {
  const a = astro("x", [S("a", "thigh", "online", 80)]);
  let st = setSensorConnected(EMPTY_STORE, "x", "a", true);
  st = setHubConnected(st, "x", false);
  assert.equal(applyDevices(a, st.x).sensors[0].status, "offline");
  assert.equal(sensorDetails(a, st.x)[0].reason, "hub");
  st = setHubConnected(st, "x", true);
  assert.equal(applyDevices(a, st.x).sensors[0].status, "online");
});

test("overrides are isolated per astronaut", () => {
  const st = setSensorConnected(EMPTY_STORE, "x", "a", false);
  assert.equal(st.y, undefined);
  const y = astro("y", [S("a", "thigh", "online", 50)]);
  assert.equal(applyDevices(y, st.y).sensors[0].status, "online");
});

test("applyDevices does not change sessions", () => {
  const a = astro("x", [S("a", "thigh", "online", 80)]);
  const eff = applyDevices(a, setSensorConnected(EMPTY_STORE, "x", "a", false).x);
  assert.equal(eff.sessions, a.sessions);
});

test("calibration baseline comes from fixtures; a run sets valid + timestamp and nothing else", () => {
  const a = astro("x", [S("t", "thigh", "online", 80), S("s", "shank", "online", 70), S("i", "insole-left", "online", 60)]);
  const base = sensorDetails(a, undefined);
  assert.deepEqual(base.map((d) => d.calibration.status), ["valid", "stale", "not-recorded"]);
  assert.ok(base.every((d) => d.calibration.at === null));
  const st = recordCalibration(EMPTY_STORE, "x", "s", "2026-11-10T14:00:00.000Z");
  const after = sensorDetails(a, st.x);
  assert.deepEqual(after[1].calibration, { status: "valid", at: "2026-11-10T14:00:00.000Z" });
  assert.equal(after[0].calibration.status, "valid"); // untouched sensors keep their baseline
  assert.equal(after[1].sensor.battery, 70);
});

test("calibration is blocked for disconnected sensors, hub-down and duplicate runs", () => {
  const a = astro("x", [S("t", "thigh", "online", 80)]);
  const ok = sensorDetails(a, undefined)[0];
  assert.equal(calibrationBlocked(ok, false), null);
  assert.match(calibrationBlocked(ok, true) ?? "", /already running/);
  const off = sensorDetails(a, setSensorConnected(EMPTY_STORE, "x", "t", false).x)[0];
  assert.match(calibrationBlocked(off, false) ?? "", /disconnected/);
  const hub = sensorDetails(a, setHubConnected(EMPTY_STORE, "x", false).x)[0];
  assert.match(calibrationBlocked(hub, false) ?? "", /hub/i);
});

test("a reconnected sensor keeps its earlier calibration", () => {
  const a = astro("x", [S("t", "thigh", "online", 80)]);
  let st = recordCalibration(EMPTY_STORE, "x", "t", "2026-11-10T14:00:00.000Z");
  st = setSensorConnected(st, "x", "t", false);
  st = setSensorConnected(st, "x", "t", true);
  assert.equal(sensorDetails(a, st.x)[0].calibration.at, "2026-11-10T14:00:00.000Z");
});

test("parseDeviceStore drops malformed data", () => {
  assert.deepEqual(parseDeviceStore(null), EMPTY_STORE);
  assert.deepEqual(parseDeviceStore([1]), EMPTY_STORE);
  assert.deepEqual(parseDeviceStore({ x: { hub: "no", sensors: { a: { connected: "yes", calibration: { at: 5 } }, b: { connected: false } } } }), { x: { sensors: { a: {}, b: { connected: false } } } });
});
