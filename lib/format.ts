export const UNAVAILABLE = "Unavailable";

/** Formats a reading with units. null/undefined/NaN render as "Unavailable", never as 0. */
export function fmt(value: number | null | undefined, unit = "", digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return UNAVAILABLE;
  return `${value.toFixed(digits)}${unit}`;
}

export function fmtSigned(value: number | null | undefined, unit = "", digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return UNAVAILABLE;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}${unit}`;
}

/** mm:ss from seconds. */
export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
