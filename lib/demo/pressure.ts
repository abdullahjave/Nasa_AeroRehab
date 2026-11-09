import type { PressureZones, ZoneKey } from "./types";

/** Shared colour scale for footprints and the legend (kPa). Blue -> cyan -> green -> yellow -> orange -> red. */
export const PRESSURE_MAX_KPA = 250;
export const PRESSURE_STOPS: { kpa: number; color: string }[] = [
  { kpa: 0, color: "#2b3bd6" },
  { kpa: 60, color: "#00a8ff" },
  { kpa: 110, color: "#00e676" },
  { kpa: 160, color: "#ffe94a" },
  { kpa: 205, color: "#ff7a00" },
  { kpa: 250, color: "#e53935" },
];

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

/** Colour for a pressure value, interpolated along the same stops the legend uses. */
export function pressureColor(kpa: number): string {
  const v = Math.max(0, Math.min(PRESSURE_MAX_KPA, kpa));
  for (let i = 1; i < PRESSURE_STOPS.length; i++) {
    const a = PRESSURE_STOPS[i - 1];
    const b = PRESSURE_STOPS[i];
    if (v <= b.kpa) {
      const f = (v - a.kpa) / (b.kpa - a.kpa);
      const ca = hex(a.color);
      const cb = hex(b.color);
      const m = ca.map((x, j) => Math.round(x + (cb[j] - x) * f));
      return `rgb(${m[0]},${m[1]},${m[2]})`;
    }
  }
  return PRESSURE_STOPS[PRESSURE_STOPS.length - 1].color;
}

export const ZONE_KEYS: ZoneKey[] = ["hallux", "toes", "mt1", "mt23", "mt45", "midfoot", "heel"];

export function peakPressure(zones: PressureZones): number | null {
  const vals = ZONE_KEYS.map((k) => zones[k]).filter((v): v is number => v !== null);
  return vals.length ? Math.max(...vals) : null;
}
