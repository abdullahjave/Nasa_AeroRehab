"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import { usePlayback } from "./stores";

/** Current (simulated) insole connection for Load & Pressure. Same sensor records as Settings and the sidebar. */
export default function InsoleStatus() {
  const { astronaut, hubConnected } = useAstronaut();
  const playback = usePlayback();
  const insoles = astronaut.sensors.filter((s) => s.site === "insole-left" || s.site === "insole-right");
  if (!insoles.length) return null;
  const down = insoles.filter((s) => s.status === "offline");
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-300" aria-live="polite">
      <span className="text-slate-400">Live insoles{!hubConnected ? " (hub disconnected)" : playback === "paused" ? " (playback paused)" : ""}:</span>
      {insoles.map((s) => (
        <span key={s.id} className="flex items-center gap-1">
          <span className={`led ${s.status === "offline" ? "led-off" : s.status === "low-battery" ? "led-warn" : ""}`} aria-hidden="true" />
          {s.site === "insole-left" ? "Left" : "Right"} {s.status === "offline" ? "offline" : "connected"}
        </span>
      ))}
      {down.length > 0 && <span className="text-amber-200">Saved recordings below are unchanged.</span>}
      <Link href="/settings" className="text-cyan-300 hover:underline">Manage in Settings</Link>
    </p>
  );
}
