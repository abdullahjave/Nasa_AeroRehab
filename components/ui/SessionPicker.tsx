"use client";

import { useAstronaut } from "@/components/AstronautProvider";

/** Writes to the shared session selection, so every page agrees. */
export default function SessionPicker() {
  const { astronaut, session, selectSession } = useAstronaut();
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-300">
      Session
      <select
        value={session.id}
        onChange={(e) => selectSession(e.target.value)}
        className="max-w-[16rem] rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-0.5 text-white"
      >
        {astronaut.sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </label>
  );
}
