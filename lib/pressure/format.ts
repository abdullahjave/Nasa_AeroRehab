import type { Metric, UnavailableReason } from "./types";

/** Short UI text for why a metric cannot be shown. "zero-load" is a real measurement (no force), so it is worded differently. */
export const REASON_TEXT: Record<UnavailableReason, string> = {
  "missing-foot": "Foot not reporting",
  "missing-sensor": "Sensor missing",
  "invalid-input": "Invalid data",
  "zero-load": "No load measured",
  "no-frames": "No data",
};

export type Shown = { text: string; tone: "value" | "no-load" | "unavailable"; reason?: UnavailableReason };

/** Rounds only here, at display time. Unavailable metrics never become 0. */
export function show(m: Metric<number>, unit: string, digits = 0): Shown {
  if (m.kind === "value") return { text: `${m.value.toFixed(digits)}${unit ? ` ${unit}` : ""}`, tone: "value" };
  if (m.reason === "zero-load") return { text: "No load", tone: "no-load", reason: m.reason };
  return { text: "Unavailable", tone: "unavailable", reason: m.reason };
}

export const toneClass = (t: Shown["tone"]) => (t === "value" ? "text-white" : t === "no-load" ? "text-sky-300" : "text-amber-200");

export const fmtSec = (ms: number, digits = 2) => `${(ms / 1000).toFixed(digits)} s`;
