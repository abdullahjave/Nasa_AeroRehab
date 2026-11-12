"use client";

import { useState } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import SensorImport from "./SensorImport";
import { createBalanceApi, createPressureApi, updateBalanceApi, updatePressureApi } from "./api";
import { dayToDate } from "@/lib/rehab";
import { SHARE_REASON, loadShares } from "@/lib/recorded/assessments";
import { readNumber } from "@/lib/recorded/validate";
import { BALANCE_PROTOCOLS, BALANCE_PROTOCOL_LABEL, PRESSURE_PROTOCOLS, PRESSURE_PROTOCOL_LABEL, type BalanceAssessmentView, type FieldErrors, type PressureAssessmentView } from "@/lib/recorded/types";
import type { AstronautRecord } from "@/lib/demo";

const input = "w-full rounded border border-cyan-400/40 bg-navy-900 px-2 py-1 text-sm text-white placeholder:text-slate-500 aria-[invalid=true]:border-rose-400";
const btn = "rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-400/25 disabled:opacity-50";
const ghost = "rounded-md border border-slate-400/40 px-2.5 py-1 text-xs text-slate-100 hover:bg-white/10";
const r1 = (n: number) => (Math.round(n * 10) / 10).toString();

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

const when = () => `${dayToDate(42).toISOString().slice(0, 10)}T09:00`;
const str = (n: number | null) => (n === null ? "" : String(n));
const numOrNull = (v: string) => { const n = readNumber(v); return n === null || !Number.isFinite(n) ? null : n; };

// ---------------------------------------------------------------- pressure
type PDraft = { recordedAt: string; protocol: string; leftForceN: string; rightForceN: string; leftPeakKpa: string; rightPeakKpa: string };
const pBlank = (): PDraft => ({ recordedAt: when(), protocol: PRESSURE_PROTOCOLS[0], leftForceN: "", rightForceN: "", leftPeakKpa: "", rightPeakKpa: "" });
const pDraft = (x: PressureAssessmentView): PDraft => ({ recordedAt: x.recordedAt.slice(0, 16), protocol: x.protocol, leftForceN: str(x.leftForceN), rightForceN: str(x.rightForceN), leftPeakKpa: str(x.leftPeakKpa), rightPeakKpa: str(x.rightPeakKpa) });

function PressureForm({ a, editing, onClose }: { a: AstronautRecord; editing: PressureAssessmentView | null; onClose: () => void }) {
  const [id, setId] = useState<string | null>(editing?.id ?? null);
  const [d, setD] = useState<PDraft>(() => (editing ? pDraft(editing) : pBlank()));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setD({ ...d, [k]: e.target.value }); setMsg(null); };
  const p = (k: keyof PDraft) => ({ id: `pf-${k}`, value: d[k], onChange: set(k), "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `pf-${k}-err` : undefined, className: input });
  const sh = loadShares(numOrNull(d.leftForceN), numOrNull(d.rightForceN));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = { ...d, astronautId: a.id, forceUnit: "N", pressureUnit: "kPa" };
    const r = id ? await updatePressureApi(id, body) : await createPressureApi(body);
    setBusy(false);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({});
    const savedId = id ?? (r as { value?: { id: string } }).value?.id ?? null;
    if (savedId) setId(savedId);
    setMsg(id ? "Changes saved to the same assessment." : "Pressure assessment saved. You can keep editing it here.");
  }
  return (
    <Panel id="rp-pform" title={id ? "Edit pressure assessment" : "Add pressure assessment"} icon="foot" action={<button type="button" className={ghost} onClick={onClose}>Close</button>}>
      <form onSubmit={save} noValidate className="space-y-2" aria-label={id ? "Edit pressure assessment" : "Add pressure assessment"}>
        <p className="text-[11px] text-slate-300">Manual entry for {a.profile.displayName}. Force in newtons (N) and peak pressure in kilopascals (kPa) are separate readings; leave a box blank if it was not measured (blank is not 0). Times are UTC.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field id="pf-recordedAt" label="Date and time (UTC)" error={errors.recordedAt}><input type="datetime-local" {...p("recordedAt")} /></Field>
          <Field id="pf-protocol" label="Protocol" error={errors.protocol}><select {...p("protocol")}>{PRESSURE_PROTOCOLS.map((x) => <option key={x} value={x}>{PRESSURE_PROTOCOL_LABEL[x]}</option>)}</select></Field>
          <Field id="pf-leftForceN" label="Left foot force (N, optional)" error={errors.leftForceN}><input inputMode="decimal" {...p("leftForceN")} /></Field>
          <Field id="pf-rightForceN" label="Right foot force (N, optional)" error={errors.rightForceN}><input inputMode="decimal" {...p("rightForceN")} /></Field>
          <Field id="pf-leftPeakKpa" label="Left peak pressure (kPa, optional)" error={errors.leftPeakKpa}><input inputMode="decimal" {...p("leftPeakKpa")} /></Field>
          <Field id="pf-rightPeakKpa" label="Right peak pressure (kPa, optional)" error={errors.rightPeakKpa}><input inputMode="decimal" {...p("rightPeakKpa")} /></Field>
          <Field id="pf-source" label="Measurement source"><input id="pf-source" value="Manual entry" readOnly className={`${input} opacity-70`} /></Field>
        </div>
        <p className="text-xs text-slate-200" aria-live="polite">
          Load share: {sh.kind === "value" ? <span className="font-semibold text-white">Left {r1(sh.leftPct)}% &middot; Right {r1(sh.rightPct)}% (difference {r1(sh.diffPp)} percentage points)</span> : <span className="text-amber-200">{SHARE_REASON[sh.reason]}</span>}
        </p>
        {errors.form && <p role="alert" className="rounded border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{errors.form}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn} disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Save pressure assessment"}</button>
          <button type="button" className={ghost} onClick={onClose}>{id ? "Done" : "Cancel"}</button>
          {msg && <span role="status" className="text-xs text-emerald-300">{msg}</span>}
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- balance
type BDraft = { recordedAt: string; protocol: string; trialSide: string; durationS: string; mlRmsMm: string; apRmsMm: string };
const bBlank = (side: string): BDraft => ({ recordedAt: when(), protocol: BALANCE_PROTOCOLS[0], trialSide: side, durationS: "", mlRmsMm: "", apRmsMm: "" });
const bDraft = (x: BalanceAssessmentView): BDraft => ({ recordedAt: x.recordedAt.slice(0, 16), protocol: x.protocol, trialSide: x.trialSide, durationS: String(x.durationS), mlRmsMm: str(x.mlRmsMm), apRmsMm: str(x.apRmsMm) });

function BalanceForm({ a, editing, onClose }: { a: AstronautRecord; editing: BalanceAssessmentView | null; onClose: () => void }) {
  const [id, setId] = useState<string | null>(editing?.id ?? null);
  const [d, setD] = useState<BDraft>(() => (editing ? bDraft(editing) : bBlank(a.profile.affectedLimb)));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof BDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setD({ ...d, [k]: e.target.value }); setMsg(null); };
  const p = (k: keyof BDraft) => ({ id: `bf-${k}`, value: d[k], onChange: set(k), "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `bf-${k}-err` : undefined, className: input });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const body = { ...d, astronautId: a.id, durationUnit: "s", swayUnit: "mm" };
    const r = id ? await updateBalanceApi(id, body) : await createBalanceApi(body);
    setBusy(false);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({});
    const savedId = id ?? (r as { value?: { id: string } }).value?.id ?? null;
    if (savedId) setId(savedId);
    setMsg(id ? "Changes saved to the same trial." : "Balance trial saved. You can keep editing it here.");
  }
  return (
    <Panel id="rp-bform" title={id ? "Edit balance trial" : "Add balance trial"} icon="balance" action={<button type="button" className={ghost} onClick={onClose}>Close</button>}>
      <form onSubmit={save} noValidate className="space-y-2" aria-label={id ? "Edit balance trial" : "Add balance trial"}>
        <p className="text-[11px] text-slate-300">Manual entry for {a.profile.displayName}. Sway RMS values are what the instrument reported; they are saved as entered measurements. Times are UTC.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field id="bf-recordedAt" label="Date and time (UTC)" error={errors.recordedAt}><input type="datetime-local" {...p("recordedAt")} /></Field>
          <Field id="bf-protocol" label="Protocol" error={errors.protocol}><select {...p("protocol")}>{BALANCE_PROTOCOLS.map((x) => <option key={x} value={x}>{BALANCE_PROTOCOL_LABEL[x]}</option>)}</select></Field>
          <Field id="bf-trialSide" label="Trial side (standing leg)" error={errors.trialSide} hint="Only trials with the same side and protocol are compared."><select {...p("trialSide")}><option value="left">Left leg</option><option value="right">Right leg</option></select></Field>
          <Field id="bf-durationS" label="Observed duration (s)" error={errors.durationS} hint="Must be above zero, e.g. 28"><input inputMode="decimal" {...p("durationS")} /></Field>
          <Field id="bf-mlRmsMm" label="ML sway RMS (mm, optional)" error={errors.mlRmsMm}><input inputMode="decimal" {...p("mlRmsMm")} /></Field>
          <Field id="bf-apRmsMm" label="AP sway RMS (mm, optional)" error={errors.apRmsMm}><input inputMode="decimal" {...p("apRmsMm")} /></Field>
          <Field id="bf-source" label="Measurement source"><input id="bf-source" value="Manual entry" readOnly className={`${input} opacity-70`} /></Field>
        </div>
        {errors.form && <p role="alert" className="rounded border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{errors.form}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn} disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Save balance trial"}</button>
          <button type="button" className={ghost} onClick={onClose}>{id ? "Done" : "Cancel"}</button>
          {msg && <span role="status" className="text-xs text-emerald-300">{msg}</span>}
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- panels
export default function RecordedAssessmentsPanel({ a }: { a: AstronautRecord }) {
  const { selectPressureAssessment, selectBalanceTrial } = useAstronaut();
  const [pf, setPf] = useState<{ aid: string; id: string | null; n: number } | null>(null);
  const [bf, setBf] = useState<{ aid: string; id: string | null; n: number } | null>(null);
  const pOpen = pf && pf.aid === a.id ? pf : null;
  const bOpen = bf && bf.aid === a.id ? bf : null;
  const [imp, setImp] = useState<{ aid: string; kind: "pressure" | "balance"; id: string } | null>(null);
  const impOpen = imp && imp.aid === a.id ? imp : null;
  const pRows = [...(a.pressure ?? [])].reverse();
  const bRows = [...(a.balance ?? [])].reverse();
  return (
    <>
      <Panel id="rp-pressure" title={`Pressure assessments · ${a.profile.displayName}`} icon="foot" action={<button type="button" className={btn} onClick={() => setPf((f) => ({ aid: a.id, id: null, n: (f?.n ?? 0) + 1 }))}>Add pressure assessment</button>}>
        {pRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm text-slate-200">No pressure assessments are saved for {a.profile.displayName} yet.</p>
        ) : (
          <ul className="space-y-2" aria-label="Saved pressure assessments">
            {pRows.map((x) => (
              <li key={x.id} className="rounded-md border border-cyan-400/20 p-2 text-xs" data-pressure-id={x.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{x.label} <span className="font-normal text-slate-400">&middot; {x.startedAt}</span> {x.csvImport && <span data-testid="imported-badge" className="ml-1 rounded-full border border-violet-300/40 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-100">Imported CSV</span>}</p>
                  <span className="flex gap-2"><button type="button" className={ghost} aria-label={`Import sensor CSV for ${x.label}`} onClick={() => { selectPressureAssessment(x.id); setImp({ aid: a.id, kind: "pressure", id: x.id }); }}>Import sensor CSV</button>
                  <button type="button" className={ghost} aria-label={`Edit ${x.label}`} onClick={() => { selectPressureAssessment(x.id); setPf((f) => ({ aid: a.id, id: x.id, n: (f?.n ?? 0) + 1 })); }}>Edit</button></span>
                </div>
                {x.csvImport && <p className="mt-0.5 text-[11px] text-violet-200">Imported CSV: {x.csvImport.fileName} &middot; {x.csvImport.preview.kind === "pressure" ? `${x.csvImport.preview.frameCount} frames, ${x.csvImport.preview.incompleteFrames} with missing data` : `${x.csvImport.preview.validSamples} valid samples, ${(x.csvImport.preview.coverage * 100).toFixed(0)}% coverage`}</p>}
                <p className="mt-0.5 tabular-nums text-slate-100">Force L {x.leftForceN === null ? "—" : `${r1(x.leftForceN)} N`} &middot; R {x.rightForceN === null ? "—" : `${r1(x.rightForceN)} N`} &middot; Peak L {x.leftPeakKpa === null ? "—" : `${r1(x.leftPeakKpa)} kPa`} &middot; R {x.rightPeakKpa === null ? "—" : `${r1(x.rightPeakKpa)} kPa`}</p>
                <p className="mt-0.5 tabular-nums text-slate-300">{x.shares.kind === "value" ? `Load share L ${r1(x.shares.leftPct)}% · R ${r1(x.shares.rightPct)}% (difference ${r1(x.shares.diffPp)} pp)` : `Load share unavailable: ${SHARE_REASON[x.shares.reason]}`} &middot; manual entry</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {impOpen?.kind === "pressure" && pRows.find((x) => x.id === impOpen.id) && <SensorImport key={`${a.id}:${impOpen.id}`} a={a} target={{ kind: "pressure", x: pRows.find((x) => x.id === impOpen.id) as PressureAssessmentView }} onClose={() => setImp(null)} />}
      {pOpen && <PressureForm key={`${a.id}:${pOpen.n}`} a={a} editing={pOpen.id ? pRows.find((x) => x.id === pOpen.id) ?? null : null} onClose={() => setPf(null)} />}

      <Panel id="rp-balance" title={`Balance trials · ${a.profile.displayName}`} icon="balance" action={<button type="button" className={btn} onClick={() => setBf((f) => ({ aid: a.id, id: null, n: (f?.n ?? 0) + 1 }))}>Add balance trial</button>}>
        {bRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm text-slate-200">No balance trials are saved for {a.profile.displayName} yet.</p>
        ) : (
          <ul className="space-y-2" aria-label="Saved balance trials">
            {bRows.map((x) => (
              <li key={x.id} className="rounded-md border border-cyan-400/20 p-2 text-xs" data-balance-id={x.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{x.label} <span className="font-normal text-slate-400">&middot; {x.startedAt}</span> {x.csvImport && <span data-testid="imported-badge" className="ml-1 rounded-full border border-violet-300/40 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-100">Imported CSV</span>}</p>
                  <span className="flex gap-2"><button type="button" className={ghost} aria-label={`Import sensor CSV for ${x.label}`} onClick={() => { selectBalanceTrial(x.id); setImp({ aid: a.id, kind: "balance", id: x.id }); }}>Import sensor CSV</button>
                  <button type="button" className={ghost} aria-label={`Edit ${x.label}`} onClick={() => { selectBalanceTrial(x.id); setBf((f) => ({ aid: a.id, id: x.id, n: (f?.n ?? 0) + 1 })); }}>Edit</button></span>
                </div>
                {x.csvImport && <p className="mt-0.5 text-[11px] text-violet-200">Imported CSV: {x.csvImport.fileName} &middot; {x.csvImport.preview.kind === "pressure" ? `${x.csvImport.preview.frameCount} frames, ${x.csvImport.preview.incompleteFrames} with missing data` : `${x.csvImport.preview.validSamples} valid samples, ${(x.csvImport.preview.coverage * 100).toFixed(0)}% coverage`}</p>}
                <p className="mt-0.5 tabular-nums text-slate-100">{r1(x.durationS)} s observed &middot; ML RMS {x.mlRmsMm === null ? "not entered" : `${r1(x.mlRmsMm)} mm`} &middot; AP RMS {x.apRmsMm === null ? "not entered" : `${r1(x.apRmsMm)} mm`} &middot; manual entry</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {impOpen?.kind === "balance" && bRows.find((x) => x.id === impOpen.id) && <SensorImport key={`${a.id}:${impOpen.id}`} a={a} target={{ kind: "balance", x: bRows.find((x) => x.id === impOpen.id) as BalanceAssessmentView }} onClose={() => setImp(null)} />}
      {bOpen && <BalanceForm key={`${a.id}:${bOpen.n}`} a={a} editing={bOpen.id ? bRows.find((x) => x.id === bOpen.id) ?? null : null} onClose={() => setBf(null)} />}
    </>
  );
}
