"use client";

import { useState } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import RecordedWalkingPanel from "./RecordedWalkingPanel";
import RecordedAssessmentsPanel from "./RecordedAssessmentsPanel";
import { clearBaselineApi, createSessionApi, saveProfile, setBaselineApi, updateSessionApi } from "./api";
import { computeRom } from "@/lib/recorded/build";
import { dayToDate } from "@/lib/rehab";
import { MOVEMENTS, PROTOCOLS, PROTOCOL_LABEL, type FieldErrors } from "@/lib/recorded/types";
import type { AstronautRecord, Session } from "@/lib/demo";

const input = "w-full rounded border border-cyan-400/40 bg-navy-900 px-2 py-1 text-sm text-white placeholder:text-slate-500 aria-[invalid=true]:border-rose-400";
const btn = "rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-400/25 disabled:opacity-50";
const ghost = "rounded-md border border-slate-400/40 px-2.5 py-1 text-xs text-slate-100 hover:bg-white/10";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-0.5 block text-xs text-slate-300">{label}</label>
      {children}
      {hint && !error && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-0.5 text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- profile
const PROFILE_KEYS = ["fullName", "displayName", "role", "status", "ageYears", "heightCm", "massKg", "rehabFocus", "affectedLimb"] as const;

function ProfileForm({ a }: { a: AstronautRecord }) {
  const p = a.profile;
  const initial = { fullName: p.fullName, displayName: p.displayName, role: p.role, status: p.status, ageYears: String(p.ageYears), heightCm: String(p.heightCm), massKg: String(p.massKg), rehabFocus: p.rehabFocus, affectedLimb: p.affectedLimb as string };
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setV({ ...v, [k]: e.target.value }); setMsg(null); };
  const dirty = PROFILE_KEYS.some((k) => v[k] !== initial[k]);
  const err = (k: string) => errors[k];
  const props = (k: keyof typeof initial) => ({ id: `pf-${k}`, value: v[k], onChange: set(k), "aria-invalid": !!err(k), "aria-describedby": err(k) ? `pf-${k}-err` : undefined, className: input });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await saveProfile(a.id, v);
    setBusy(false);
    if (r.ok) { setErrors({}); setMsg("Profile saved."); } else setErrors(r.errors);
  }
  return (
    <Panel id="rp-profile" title="Edit profile" icon="user">
      <form onSubmit={save} noValidate className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field id="pf-fullName" label="Full name" error={err("fullName")}><input {...props("fullName")} /></Field>
          <Field id="pf-displayName" label="Short name" error={err("displayName")}><input {...props("displayName")} /></Field>
          <Field id="pf-role" label="Role" error={err("role")}><input {...props("role")} /></Field>
          <Field id="pf-status" label="Status" error={err("status")}><input {...props("status")} /></Field>
          <Field id="pf-ageYears" label="Age (years)" error={err("ageYears")}><input inputMode="numeric" {...props("ageYears")} /></Field>
          <Field id="pf-heightCm" label="Height (cm)" error={err("heightCm")}><input inputMode="numeric" {...props("heightCm")} /></Field>
          <Field id="pf-massKg" label="Mass (kg)" error={err("massKg")}><input inputMode="numeric" {...props("massKg")} /></Field>
          <Field id="pf-affectedLimb" label="Affected limb" error={err("affectedLimb")}>
            <select {...props("affectedLimb")}><option value="left">Left</option><option value="right">Right</option></select>
          </Field>
        </div>
        <Field id="pf-rehabFocus" label="Rehabilitation focus" error={err("rehabFocus")}><input {...props("rehabFocus")} /></Field>
        <p className="text-[11px] text-slate-400">Crew code {p.crewCode} and ID {a.id} cannot be changed.</p>
        {errors.form && <p role="alert" className="rounded border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{errors.form}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn} disabled={busy || !dirty}>{busy ? "Saving…" : "Save profile"}</button>
          {msg && <span role="status" className="text-xs text-emerald-300">{msg}</span>}
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- session form
type Draft = { recordedAt: string; activity: string; side: string; movement: string; protocol: string; minAngleDeg: string; maxAngleDeg: string; torqueNm: string };
const ACTIVITIES = ["Knee mobility", "Range of motion check", "Strength set", "Balance drills"];
const num = (v: string) => { const t = v.trim(); return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null; };

function draftOf(s: Session | null, defaultSide: string): Draft {
  if (!s?.recorded) return { recordedAt: `${dayToDate(42).toISOString().slice(0, 10)}T09:00`, activity: "Knee mobility", side: defaultSide, movement: MOVEMENTS[0], protocol: PROTOCOLS[0], minAngleDeg: "", maxAngleDeg: "", torqueNm: "" };
  const j = s.joint.measurement;
  return { recordedAt: s.recorded.recordedAt.slice(0, 16), activity: s.recorded.activity, side: j.side, movement: j.movement, protocol: j.protocol, minAngleDeg: s.knee.minAngleDeg === null ? "" : String(s.knee.minAngleDeg), maxAngleDeg: s.knee.peakFlexionDeg === null ? "" : String(s.knee.peakFlexionDeg), torqueNm: s.recorded.torqueNm === null ? "" : String(s.recorded.torqueNm) };
}

function SessionForm({ a, editing, onClose }: { a: AstronautRecord; editing: Session | null; onClose: () => void }) {
  const [id, setId] = useState<string | null>(editing?.id ?? null); // after the first save the form keeps editing this same row
  const [d, setD] = useState<Draft>(() => draftOf(editing, a.profile.affectedLimb));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setD({ ...d, [k]: e.target.value }); setMsg(null); };
  const err = (k: string) => errors[k];
  const p = (k: keyof Draft) => ({ id: `sf-${k}`, value: d[k], onChange: set(k), "aria-invalid": !!err(k), "aria-describedby": err(k) ? `sf-${k}-err` : undefined, className: input });
  const lo = num(d.minAngleDeg), hi = num(d.maxAngleDeg);
  const rom = lo !== null && hi !== null ? computeRom(lo, hi) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = { ...d, astronautId: a.id, angleUnit: "deg", torqueUnit: "Nm" };
    const r = id ? await updateSessionApi(id, body) : await createSessionApi(body);
    setBusy(false);
    if (!r.ok) { setErrors(r.errors); return; } // keeps every entered value
    setErrors({});
    const savedId = id ?? (r as { value?: { id: string } }).value?.id ?? null;
    if (savedId) setId(savedId);
    setMsg(id ? "Changes saved to the same session." : "Session saved. You can keep editing it here.");
  }

  return (
    <Panel id="rp-form" title={id ? "Edit session" : "Add session"} icon="joint" action={<button type="button" className={ghost} onClick={onClose}>Close</button>}>
      <form onSubmit={save} noValidate className="space-y-2" aria-label={id ? "Edit knee session" : "Add knee session"}>
        <p className="text-[11px] text-slate-300">Manual entry for {a.profile.displayName}. Angles are in degrees (°), torque in newton-metres (Nm). Times are UTC.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field id="sf-recordedAt" label="Date and time (UTC)" error={err("recordedAt")}><input type="datetime-local" {...p("recordedAt")} /></Field>
          <Field id="sf-activity" label="Activity" error={err("activity")}>
            <input list="sf-activities" {...p("activity")} /><datalist id="sf-activities">{ACTIVITIES.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field id="sf-side" label="Knee side" error={err("side")}><select {...p("side")}><option value="left">Left</option><option value="right">Right</option></select></Field>
          <Field id="sf-movement" label="Movement" error={err("movement")}><select {...p("movement")}>{MOVEMENTS.map((m) => <option key={m} value={m}>Knee flexion and extension</option>)}</select></Field>
          <Field id="sf-protocol" label="Measurement protocol" error={err("protocol")} hint="Only sessions with the same side, movement and protocol are compared."><select {...p("protocol")}>{PROTOCOLS.map((x) => <option key={x} value={x}>{PROTOCOL_LABEL[x]}</option>)}</select></Field>
          <Field id="sf-source" label="Measurement source"><input id="sf-source" value="Manual entry" readOnly className={`${input} opacity-70`} /></Field>
          <Field id="sf-minAngleDeg" label="Minimum knee angle (°)" error={err("minAngleDeg")} hint="Most extended angle, e.g. 4"><input inputMode="decimal" {...p("minAngleDeg")} /></Field>
          <Field id="sf-maxAngleDeg" label="Maximum knee angle (°)" error={err("maxAngleDeg")} hint="Most bent angle, e.g. 120"><input inputMode="decimal" {...p("maxAngleDeg")} /></Field>
          <Field id="sf-torqueNm" label="Measured torque (Nm, optional)" error={err("torqueNm")}><input inputMode="decimal" {...p("torqueNm")} /></Field>
        </div>
        <p className="text-xs text-slate-200" aria-live="polite">Range of motion (maximum minus minimum): <span className="font-semibold text-white">{rom === null ? "Unavailable until both angles are valid" : `${rom}°`}</span></p>
        {errors.form && <p role="alert" className="rounded border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{errors.form}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn} disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Save session"}</button>
          <button type="button" className={ghost} onClick={onClose}>{id ? "Done" : "Cancel"}</button>
          {msg && <span role="status" className="text-xs text-emerald-300">{msg}</span>}
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- page
function SessionRow({ s, onEdit }: { s: Session; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const r = s.recorded;
  if (!r) return null;
  const j = s.joint.measurement;
  const toggle = async () => {
    setBusy(true); setErr(null);
    const res = r.isBaseline ? await clearBaselineApi(s.id) : await setBaselineApi(s.id);
    setBusy(false);
    if (!res.ok) setErr(res.errors.form ?? "Could not change the baseline.");
  };
  const f = (n: number | null, u: string) => (n === null ? "—" : `${n}${u}`);
  return (
    <li className="rounded-md border border-cyan-400/20 p-2 text-xs" data-session-id={s.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">{s.label} <span className="font-normal text-slate-400">&middot; {s.startedAt}</span>{r.isBaseline && <span className="ml-2 rounded-full border border-emerald-300/60 bg-emerald-300/10 px-2 py-0.5 text-[10px] text-emerald-200">Baseline</span>}</p>
        <span className="flex gap-2">
          <button type="button" className={ghost} onClick={onEdit} aria-label={`Edit ${s.label}`}>Edit</button>
          <button type="button" className={ghost} onClick={toggle} disabled={busy} aria-label={`${r.isBaseline ? "Clear baseline" : "Use as baseline"}: ${s.label}`}>{r.isBaseline ? "Clear baseline" : "Use as baseline"}</button>
        </span>
      </div>
      <p className="mt-0.5 text-slate-300">{j.side === "left" ? "Left" : "Right"} knee &middot; {PROTOCOL_LABEL[j.protocol as keyof typeof PROTOCOL_LABEL] ?? j.protocol} &middot; manual entry</p>
      <p className="mt-0.5 tabular-nums text-slate-100">Min {f(s.knee.minAngleDeg, "°")} &middot; Max {f(s.knee.peakFlexionDeg, "°")} &middot; ROM {f(s.knee.romDeg, "°")} &middot; Torque {f(r.torqueNm, " Nm")}</p>
      {err && <p role="alert" className="mt-1 text-rose-300">{err}</p>}
    </li>
  );
}

export default function RecordedPatients() {
  const { astronaut, astronauts, select, recordedStatus, refreshRecorded } = useAstronaut();
  const [form, setForm] = useState<{ aid: string; sessionId: string | null; n: number } | null>(null);
  const openForm = (sessionId: string | null) => setForm((f) => ({ aid: astronaut.id, sessionId, n: (f?.n ?? 0) + 1 }));
  const open = form && form.aid === astronaut.id ? form : null;
  const editing = open?.sessionId ? astronaut.sessions.find((s) => s.id === open.sessionId) ?? null : null;
  const sessions = [...astronaut.sessions].reverse();

  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Patient Management <span className="font-normal text-slate-300">&ndash; Recorded Profiles &amp; Knee Sessions</span></h1>
          <p className="text-xs text-slate-300">Saved in this computer&rsquo;s local database. No sign-in or access control yet: do not enter real patient data.</p>
        </div>
        <span className="rounded-full border border-emerald-300/60 bg-emerald-300/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">Recorded Data</span>
      </header>

      {recordedStatus === "error" && (
        <p role="alert" className="rounded-md border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          Recorded data could not be loaded from the local database. <button type="button" className="underline" onClick={refreshRecorded}>Try again</button>
        </p>
      )}

      {recordedStatus !== "ready" && recordedStatus !== "error" && (
        <p role="status" className="rounded-md border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-sm text-slate-200">Loading saved profiles and sessions from the local database…</p>
      )}

      {/* Forms are created only after the saved records have loaded, so they never start from placeholder values. */}
      {recordedStatus === "ready" && <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
        <Panel id="rp-roster" title="Astronauts" icon="user">
          <ul className="space-y-1" aria-label="Astronaut roster">
            {astronauts.map((a) => (
              <li key={a.id}>
                <button type="button" aria-pressed={a.id === astronaut.id} onClick={() => select(a.id)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-sm ${a.id === astronaut.id ? "border-cyan-300 bg-cyan-400/15 text-white" : "border-cyan-400/20 text-slate-200 hover:bg-white/5"}`}>
                  <span className="block font-medium">{a.profile.displayName}</span>
                  <span className="block text-[11px] text-slate-400">{a.profile.crewCode} &middot; {a.sessions.length} saved session{a.sessions.length === 1 ? "" : "s"}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-3">
          <ProfileForm key={astronaut.id} a={astronaut} />

          <Panel id="rp-sessions" title={`Knee sessions · ${astronaut.profile.displayName}`} icon="timeline"
            action={<button type="button" className={btn} onClick={() => openForm(null)}>Add session</button>}>
            {sessions.length === 0 ? (
              <p className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm text-slate-200">No knee sessions are saved for {astronaut.profile.displayName} yet. Use &ldquo;Add session&rdquo; to enter the first one. Nothing is shown from demo data.</p>
            ) : (
              <ul className="space-y-2" aria-label="Saved sessions">
                {sessions.map((s) => <SessionRow key={s.id} s={s} onEdit={() => openForm(s.id)} />)}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-slate-400">&ldquo;Use as baseline&rdquo; compares later sessions for the same astronaut, knee side, movement and protocol with that session.</p>
          </Panel>

          <RecordedWalkingPanel a={astronaut} />
          <RecordedAssessmentsPanel a={astronaut} />

          {open && <SessionForm key={`${astronaut.id}:${open.n}`} a={astronaut} editing={editing} onClose={() => setForm(null)} />}
        </div>
      </div>}
    </div>
  );
}
