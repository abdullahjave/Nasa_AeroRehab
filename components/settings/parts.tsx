"use client";

import type { Sensor } from "@/lib/demo";
import { LOW_BATTERY_PCT, type CalibrationStatus, type OfflineReason } from "@/lib/settings/devices";

/** Accessible on/off switch. */
export function Switch({ checked, onChange, label, disabled = false, describedBy }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; describedBy?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "border-emerald-400/70 bg-emerald-500/40" : "border-slate-500/60 bg-slate-700/50"}`}
    >
      <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

/** Battery bar. null = no reading (Unavailable); 0 is a real, empty battery. */
export function BatteryBar({ value }: { value: number | null }) {
  const has = value !== null;
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={has ? `Battery ${value} percent` : "Battery unavailable"}>
      <span className="relative h-3 w-9 shrink-0 rounded-[3px] border border-cyan-300/60 p-[1px]">
        {has && <span className={`block h-full rounded-[1px] ${value < LOW_BATTERY_PCT ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${value}%` }} />}
      </span>
      <span className={`w-14 tabular-nums ${has ? "text-white" : "text-slate-400"}`}>{has ? `${value}%` : "Unavailable"}</span>
    </span>
  );
}

export function siteLabel(s: Sensor, kneeSide: "left" | "right") {
  const side = kneeSide === "left" ? "L" : "R";
  if (s.site === "thigh") return `Thigh IMU (${side})`;
  if (s.site === "shank") return `Shank IMU (${side})`;
  return s.site === "insole-left" ? "Left insole" : "Right insole";
}

export const STATUS_LED: Record<Sensor["status"], string> = { online: "", "low-battery": "led-warn", offline: "led-off" };

export function statusText(s: Sensor, reason: OfflineReason | null) {
  if (reason === "hub") return "Hub offline";
  if (reason === "disconnected") return "Disconnected";
  if (reason === "fixture") return "Offline";
  return s.status === "low-battery" ? "Low battery" : "Connected";
}

export const CAL_TEXT: Record<CalibrationStatus, string> = { valid: "Valid", stale: "Stale", unavailable: "Unavailable", "not-recorded": "Not recorded" };
export const calTone = (s: CalibrationStatus) => (s === "valid" ? "text-emerald-300" : s === "stale" ? "text-amber-300" : "text-slate-300");
export const calLed = (s: CalibrationStatus) => (s === "valid" ? "" : s === "stale" ? "led-warn" : "led-off");

/** Browser-clock time of a simulated action, shown in UTC. */
export function fmtStamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
}

export const btn = "rounded-md border border-cyan-400/60 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-cyan-400/10";
