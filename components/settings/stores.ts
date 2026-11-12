"use client";

import { useSyncExternalStore } from "react";
import { getAstronaut, type AstronautId } from "@/lib/demo";
import {
  EMPTY_STORE, calibrationBlocked, parseDeviceStore, recordCalibration, sensorDetails, setHubConnected, setSensorConnected,
  type DeviceStore,
} from "@/lib/settings/devices";
import { DEFAULT_DISPLAY, parseDisplay, type DisplayPrefs } from "@/lib/settings/display";

// Browser-local persistence, same pattern as the notes / rehab / report stores: one JSON blob per key,
// useSyncExternalStore with an empty server snapshot, and an in-memory fallback if storage is blocked.

export function createLocalStore<T>(key: string, empty: T, parse: (raw: unknown) => T) {
  const listeners = new Set<() => void>();
  let cacheRaw: string | null | undefined;
  let cacheVal: T = empty;

  function read(): T {
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(key); } catch { /* storage blocked: keep the in-memory value */ return cacheRaw === undefined ? empty : cacheVal; }
    if (raw !== cacheRaw) {
      cacheRaw = raw;
      try { cacheVal = raw ? parse(JSON.parse(raw)) : empty; } catch { cacheVal = empty; }
    }
    return cacheVal;
  }
  function subscribe(cb: () => void) {
    listeners.add(cb);
    const on = (e: StorageEvent) => { if (e.key === key || e.key === null) cb(); };
    window.addEventListener("storage", on);
    return () => { listeners.delete(cb); window.removeEventListener("storage", on); };
  }
  function write(next: T) {
    const raw = JSON.stringify(next);
    try { window.localStorage.setItem(key, raw); } catch { /* keep in memory below */ }
    cacheRaw = raw;
    cacheVal = next;
    listeners.forEach((l) => l());
  }
  function remove() {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    cacheRaw = null;
    cacheVal = empty;
    listeners.forEach((l) => l());
  }
  const use = () => useSyncExternalStore(subscribe, read, () => empty);
  return { read, write, remove, use };
}

// ---- simulated device overrides (connection, hub link, calibration) ----
export const DEVICES_KEY = "aerorehab.settings.devices.v1";
const devices = createLocalStore<DeviceStore>(DEVICES_KEY, EMPTY_STORE, parseDeviceStore);
export const useDeviceStore = devices.use;
export const connectSensor = (aid: string, sid: string, on: boolean) => devices.write(setSensorConnected(devices.read(), aid, sid, on));
export const connectHub = (aid: string, on: boolean) => devices.write(setHubConnected(devices.read(), aid, on));

// ---- demo playback (Start / Pause) ----
export type Playback = "running" | "paused";
export const SIM_KEY = "aerorehab.settings.sim.v1";
const sim = createLocalStore<Playback>(SIM_KEY, "running", (raw) => (raw === "paused" ? "paused" : "running"));
export const usePlayback = sim.use;
export const setPlayback = (p: Playback) => sim.write(p);

// ---- display preferences (kept across Reset Demo) ----
export const DISPLAY_KEY = "aerorehab.settings.display.v1";
const display = createLocalStore<DisplayPrefs>(DISPLAY_KEY, DEFAULT_DISPLAY, parseDisplay);
export const useDisplayPrefs = display.use;
export const patchDisplay = (patch: Partial<DisplayPrefs>) => display.write({ ...display.read(), ...patch });

/** Reset Demo: clears only playback and simulated sensor overrides. Display prefs, notes, rehab and reports are untouched. */
export function resetDemoState() {
  devices.remove();
  sim.remove();
  resetCalibrationRuns();
}

// ---- simulated calibration runs ----
// Pending runs live in memory (not persisted) so leaving the page cannot allow a duplicate run, and a run still
// completes if the user navigates away. Completion re-checks the sensor, so a sensor that dropped mid-run fails.
export const CALIBRATION_MS = 2500;
export type CalResult = { ok: boolean; message: string; at: number };
const pending = new Set<string>();
const results = new Map<string, CalResult>();
const calListeners = new Set<() => void>();
let calVersion = 0;
const calKey = (aid: string, sid: string) => `${aid}:${sid}`;
let generation = 0;
const bump = () => { calVersion++; calListeners.forEach((l) => l()); };

function calSubscribe(cb: () => void) { calListeners.add(cb); return () => { calListeners.delete(cb); }; }
/** Re-renders on every calibration state change; read the state through the helpers below. */
export const useCalibrationVersion = () => useSyncExternalStore(calSubscribe, () => calVersion, () => 0);
export const isCalibrating = (aid: string, sid: string) => pending.has(calKey(aid, sid));
export const calibrationResult = (aid: string, sid: string) => results.get(calKey(aid, sid)) ?? null;

/** Starts a simulated calibration. Returns false (and does nothing) when blocked or already running. */
export function runCalibration(aid: string, sid: string): boolean {
  const key = calKey(aid, sid);
  const base = getAstronaut(aid as AstronautId);
  const detail = () => sensorDetails(base, devices.read()[aid]).find((d) => d.sensor.id === sid);
  if (calibrationBlocked(detail(), pending.has(key))) return false;
  pending.add(key);
  results.delete(key);
  bump();
  const g = generation;
  setTimeout(() => {
    if (g !== generation) return; // Reset Demo happened mid-run: the run is cancelled and writes nothing
    pending.delete(key);
    const d = detail();
    if (calibrationBlocked(d, false)) {
      results.set(key, { ok: false, message: "Calibration failed: the sensor disconnected during the run. Nothing was changed.", at: Date.now() });
    } else {
      devices.write(recordCalibration(devices.read(), aid, sid, new Date().toISOString()));
      results.set(key, { ok: true, message: "Calibration complete (simulated).", at: Date.now() });
    }
    bump();
  }, CALIBRATION_MS);
  return true;
}
export const clearCalibrationResult = (aid: string, sid: string) => { if (results.delete(calKey(aid, sid))) bump(); };

function resetCalibrationRuns() {
  generation++;
  pending.clear();
  results.clear();
  bump();
}
