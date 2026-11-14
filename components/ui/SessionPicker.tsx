"use client";

import Select from "@/components/ui/Select";
import { useAstronaut } from "@/components/AstronautProvider";

/** Writes to the shared session selection, so every page agrees. */
export default function SessionPicker() {
  const { astronaut, session, selectSession } = useAstronaut();
  if (astronaut.sessions.length === 0) return <span className="text-xs text-slate-300">Session: none saved</span>;
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
      <span id="session-picker-label">Session</span>
      <Select ariaLabelledBy="session-picker-label" value={session.id} onChange={selectSession} alignRight
        options={astronaut.sessions.map((s) => ({ value: s.id, label: s.label }))} className="w-[15.5rem] max-w-full text-sm" />
    </div>
  );
}
