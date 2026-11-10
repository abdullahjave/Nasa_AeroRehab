import type { FootSide, ZoneKey } from "./types";

// Insole sensor array: one sensor per zone, per foot. Positions are in the foot-local frame documented in
// types.ts (mm; origin heel centre; +y anterior; +x medial). Areas are the active sensing area per sensor.
export const ZONE_KEYS: ZoneKey[] = ["hallux", "toes", "mt1", "mt23", "mt45", "midfoot", "heel"];

export const SENSOR_LAYOUT: Record<ZoneKey, { label: string; areaCm2: number; x: number; y: number }> = {
  hallux: { label: "Hallux", areaCm2: 2, x: 28, y: 235 },
  toes: { label: "Toes 2-5", areaCm2: 3, x: -5, y: 240 },
  mt1: { label: "Metatarsal 1", areaCm2: 3, x: 25, y: 190 },
  mt23: { label: "Metatarsal 2-3", areaCm2: 3, x: 5, y: 188 },
  mt45: { label: "Metatarsal 4-5", areaCm2: 3, x: -18, y: 180 },
  midfoot: { label: "Midfoot", areaCm2: 4, x: -10, y: 105 },
  heel: { label: "Heel", areaCm2: 6, x: 0, y: 25 },
};

export const sensorId = (side: FootSide, zone: ZoneKey) => `${side === "left" ? "L" : "R"}-${zone}`;
export const zoneOfSensor = (id: string): ZoneKey => id.slice(2) as ZoneKey;

// Drawing: the left-foot sole SVG is 120 x 262 with the heel centre at (64, 246) and 0.8 SVG units per mm.
// The right foot is drawn by mirroring the same group, so the same mapping serves heatmap, markers and CoP.
export const FOOT_SVG = { w: 120, h: 262, originX: 64, originY: 246, unitsPerMm: 0.8 } as const;

export function footLocalToSvg(xMm: number, yMm: number) {
  return { x: FOOT_SVG.originX + xMm * FOOT_SVG.unitsPerMm, y: FOOT_SVG.originY - yMm * FOOT_SVG.unitsPerMm };
}

/** Blob radius (SVG units) for a sensor, from its active area. */
export function blobRadius(areaCm2: number) {
  return 14 * Math.sqrt(areaCm2) * FOOT_SVG.unitsPerMm;
}
