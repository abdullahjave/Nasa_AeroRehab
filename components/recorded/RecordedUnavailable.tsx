"use client";

import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";

/**
 * Page body for sensor-based pages (gait, foot pressure, balance) in recorded mode. Manual knee sessions have no gait,
 * pressure or balance samples, so these pages say so. They never show simulated values as if they were recorded.
 */
export default function RecordedUnavailable({ title, what }: { title: string; what: string }) {
  const { astronaut, session } = useAstronaut();
  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">{title}</h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Recorded Data</p>
        </div>
        <SessionPicker />
      </header>
      <Panel id="rec-unavailable" title="Unavailable in recorded mode" icon="warn">
        <p className="text-sm font-semibold text-amber-200">No {what} recorded</p>
        <p className="mt-1 text-xs text-slate-300">Manual knee sessions contain only the entered knee angles and torque. {what[0].toUpperCase() + what.slice(1)} needs sensor data, which none of the saved sessions have, so nothing is shown and nothing is filled in from demo data.</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="/joint-analytics" className="text-cyan-300 hover:underline">Joint Analytics &rarr;</Link>
          <Link href="/patient-management" className="text-cyan-300 hover:underline">Add or edit sessions &rarr;</Link>
        </div>
      </Panel>
    </div>
  );
}
