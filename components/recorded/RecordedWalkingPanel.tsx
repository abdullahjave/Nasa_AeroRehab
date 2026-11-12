"use client";

import { useState } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import { createWalkingApi, updateWalkingApi } from "./api";
import { dayToDate } from "@/lib/rehab";
import { walkingCadenceSpm, walkingSpeedMs } from "@/lib/recorded/walking";
import type { FieldErrors, WalkingSessionView } from "@/lib/recorded/types";
import type { AstronautRecord } from "@/lib/demo";

const input = "w-full rounded border border-cyan-400/40 bg-navy-900 px-2 py-1 text-sm text-white placeholder:text-slate-500 aria-[invalid=true]:border-rose-400";
const btn = "rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-400/25 disabled:opacity-50";
const ghost = "rounded-md border border-slate-400/40 px-2.5 py-1 text-xs text-slate-100 hover:bg-white/10";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-0.5 block text-xs text-slate-300">{label}</label>
      {children}
      {hint && !error && <p className="mt-0.5 text-[13px] text-slate-400">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-0.5 text-[13px] text-rose-300">{error}</p>}
    </div>
  );
}

type Draft = { recordedAt: string; distanceM: string; durationS: string; steps: string; strideLengthM: string };
const blank = (): Draft => ({ recordedAt: `${dayToDate(42).toISOString().slice(0, 10)}T09:00`, distanceM: "", durationS: "", steps: "", strideLengthM: "" });
const draftOf = (w: WalkingSessionView): Draft => ({ recordedAt: w.recordedAt.slice(0, 16), distanceM: String(w.distanceM), durationS: String(w.durationS), steps: w.steps === null ? "" : String(w.steps), strideLengthM: w.strideLengthM === null ? "" : String(w.strideLengthM) });
const num = (v: string) => { const t = v.trim(); return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null; };
const r2 = (n: number) => (Math.round(n * 100) / 100).toString();

function WalkingForm({ a, editing, onClose }: { a: AstronautRecord; editing: WalkingSessionView | null; onClose: () => void }) {
  const [id, setId] = useState<string | null>(editing?.id ?? null); // after the first save, further saves edit this same record
  const [d, setD] = useState<Draft>(() => (editing ? draftOf(editing) : blank()));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => { setD({ ...d, [k]: e.target.value }); setMsg(null); };
  const p = (k: keyof Draft) => ({ id: `wf-${k}`, value: d[k], onChange: set(k), "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `wf-${k}-err` : undefined, className: input });
  const dist = num(d.distanceM), dur = num(d.durationS), st = d.steps.trim() === "" ? null : num(d.steps);
  const speed = dist !== null && dur !== null ? walkingSpeedMs(dist, dur) : null;
  const cad = st !== null && dur !== null ? walkingCadenceSpm(st, dur) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = { ...d, astronautId: a.id, distanceUnit: "m", durationUnit: "s" };
    const r = id ? await updateWalkingApi(id, body) : await createWalkingApi(body);
    setBusy(false);
    if (!r.ok) { setErrors(r.errors); return; } // every entered value stays
    setErrors({});
    const savedId = id ?? (r as { value?: { id: string } }).value?.id ?? null;
    if (savedId) setId(savedId);
    setMsg(id ? "Changes saved to the same walking session." : "Walking session saved. You can keep editing it here.");
  }

  return (
    <Panel id="rw-form" title={id ? "Edit walking session" : "Add walking session"} icon="walk" action={<button type="button" className={ghost} onClick={onClose}>Close</button>}>
      <form onSubmit={save} noValidate className="space-y-2" aria-label={id ? "Edit walking session" : "Add walking session"}>
        <p className="text-[13px] text-slate-300">Manual entry for {a.profile.displayName}. Distance in metres (m), duration in seconds (s). Times are UTC. Speed and cadence are calculated from these totals.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field id="wf-recordedAt" label="Date and time (UTC)" error={errors.recordedAt}><input type="datetime-local" {...p("recordedAt")} /></Field>
          <Field id="wf-source" label="Measurement source"><input id="wf-source" value="Manual entry" readOnly className={`${input} opacity-70`} /></Field>
          <Field id="wf-distanceM" label="Distance walked (m)" error={errors.distanceM} hint="e.g. 60"><input inputMode="decimal" {...p("distanceM")} /></Field>
          <Field id="wf-durationS" label="Duration (s)" error={errors.durationS} hint="Must be above zero, e.g. 60"><input inputMode="decimal" {...p("durationS")} /></Field>
          <Field id="wf-steps" label="Total steps (optional)" error={errors.steps} hint="Leave blank if not counted. Blank is not the same as 0."><input inputMode="numeric" {...p("steps")} /></Field>
          <Field id="wf-strideLengthM" label="Measured stride length (m, optional)" error={errors.strideLengthM} hint="Only if you measured it. It is never worked out from distance and steps."><input inputMode="decimal" {...p("strideLengthM")} /></Field>
        </div>
        <p className="text-xs text-slate-200" aria-live="polite">
          Speed: <span className="font-semibold text-white">{speed === null ? "Unavailable until distance and duration are valid" : `${r2(speed)} m/s`}</span>
          {" · "}Cadence: <span className="font-semibold text-white">{cad === null ? (d.steps.trim() === "" ? "No step count entered" : "Unavailable") : `${r2(cad)} steps/min`}</span>
        </p>
        {errors.form && <p role="alert" className="rounded border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{errors.form}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn} disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Save walking session"}</button>
          <button type="button" className={ghost} onClick={onClose}>{id ? "Done" : "Cancel"}</button>
          {msg && <span role="status" className="text-xs text-emerald-300">{msg}</span>}
        </div>
      </form>
    </Panel>
  );
}

/** Walking sessions for the selected astronaut: list, add and edit (same record). */
export default function RecordedWalkingPanel({ a }: { a: AstronautRecord }) {
  const { selectWalking } = useAstronaut();
  const [form, setForm] = useState<{ aid: string; id: string | null; n: number } | null>(null);
  const open = form && form.aid === a.id ? form : null;
  const rows = [...(a.walking ?? [])].reverse();
  const editing = open?.id ? rows.find((w) => w.id === open.id) ?? null : null;
  const openForm = (id: string | null) => setForm((f) => ({ aid: a.id, id, n: (f?.n ?? 0) + 1 }));
  return (
    <>
      <Panel id="rw-list" title={`Walking sessions · ${a.profile.displayName}`} icon="walk" action={<button type="button" className={btn} onClick={() => openForm(null)}>Add walking session</button>}>
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm text-slate-200">No walking sessions are saved for {a.profile.displayName} yet. Use &ldquo;Add walking session&rdquo; to enter distance, duration and (optionally) steps.</p>
        ) : (
          <ul className="space-y-2" aria-label="Saved walking sessions">
            {rows.map((w) => (
              <li key={w.id} className="rounded-md border border-cyan-400/20 p-2 text-xs" data-walking-id={w.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{w.label} <span className="font-normal text-slate-400">&middot; {w.startedAt}</span></p>
                  <button type="button" className={ghost} onClick={() => { selectWalking(w.id); openForm(w.id); }} aria-label={`Edit ${w.label}`}>Edit</button>
                </div>
                <p className="mt-0.5 tabular-nums text-slate-100">{r2(w.distanceM)} m in {r2(w.durationS)} s &middot; steps {w.steps === null ? "not entered" : w.steps} &middot; manual entry</p>
                <p className="mt-0.5 tabular-nums text-slate-300">Speed {w.speedMs === null ? "—" : `${r2(w.speedMs)} m/s`} &middot; cadence {w.cadenceSpm === null ? "—" : `${r2(w.cadenceSpm)} steps/min`}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {open && <WalkingForm key={`${a.id}:${open.n}`} a={a} editing={editing} onClose={() => setForm(null)} />}
    </>
  );
}
