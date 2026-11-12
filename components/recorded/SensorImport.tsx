"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Panel from "@/components/ui/Panel";
import Footprints, { type SensorView } from "@/components/graphics/Footprints";
import { previewImportApi, saveImportApi, type ImportFailure } from "./api";
import type { PreviewValue } from "@/lib/db/imports";
import { MAX_FILE_BYTES } from "@/lib/import/csv";
import { BALANCE_COLUMNS, BALANCE_TEMPLATE_CSV, BALANCE_TEMPLATE_NAME } from "@/lib/import/balance";
import { PRESSURE_COLUMNS, PRESSURE_TEMPLATE_CSV, PRESSURE_TEMPLATE_NAME } from "@/lib/import/pressure";
import { BALANCE_PROTOCOL_LABEL, PRESSURE_PROTOCOL_LABEL, type BalanceAssessmentView, type PressureAssessmentView } from "@/lib/recorded/types";
import type { AstronautRecord } from "@/lib/demo";

const btn = "rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-50";
const ghost = "rounded-md border border-slate-400/40 px-2.5 py-1 text-xs text-slate-100 hover:bg-white/10";
const fmtMs = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 3).replace(/\.?0+$/, "") || "0"} s`;
const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

type Target =
  | { kind: "pressure"; x: PressureAssessmentView }
  | { kind: "balance"; x: BalanceAssessmentView };

type State =
  | { phase: "idle" }
  | { phase: "checking"; fileName: string }
  | { phase: "rejected"; fileName: string; failure: ImportFailure }
  | { phase: "ready"; fileName: string; csv: string; result: PreviewValue }
  | { phase: "saving"; fileName: string }
  | { phase: "saved"; fileName: string; duplicate: boolean; replaced: boolean };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-t border-cyan-400/10 py-1 first:border-0"><dt className="text-slate-400">{k}</dt><dd className="text-right tabular-nums text-white">{v}</dd></div>;
}

function PreviewCard({ p, geometry }: { p: PreviewValue["preview"]; geometry?: PreviewValue["geometry"] }) {
  if (p.kind === "pressure") {
    const views = (foot: "left" | "right"): SensorView[] => (geometry ?? []).filter((g) => g.foot === foot).map((g) => ({ id: g.sensorId, zone: "heel", xMm: g.xMm, yMm: g.yMm, areaCm2: g.areaCm2, kpa: 1 }));
    return (
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <dl className="text-xs" data-testid="import-preview">
          <Row k="Frames" v={p.frameCount.toLocaleString("en-US")} />
          <Row k="Readings (rows)" v={p.rowCount.toLocaleString("en-US")} />
          <Row k="Time span" v={`${fmtMs(p.startMs)} to ${fmtMs(p.endMs)} (${fmtMs(p.endMs - p.startMs)})`} />
          <Row k="Frame spacing (median)" v={p.intervalMs > 0 ? `${p.intervalMs} ms` : "single frame"} />
          <Row k="Sensors" v={`left ${p.sensorCount.left} · right ${p.sensorCount.right}`} />
          <Row k="Complete frames (both feet)" v={`${p.bilateralFrames} of ${p.frameCount}`} />
          <Row k="Frames with missing data" v={p.incompleteFrames} />
          <Row k="Blank readings" v={p.blankReadings} />
          <Row k="Sensors with no row" v={p.absentReadings} />
          <Row k="Frames without a left / right foot" v={`${p.missingFootFrames.left} / ${p.missingFootFrames.right}`} />
          <p className="mt-1 text-[13px] text-slate-300">{p.orientation}</p>
          <p className="mt-1 text-[13px] text-slate-400">Missing readings stay missing (Unavailable); they are never read as 0 kPa. Load share is only calculated from frames where both feet are complete.</p>
        </dl>
        {geometry && geometry.length > 0 && (
          <figure className="mx-auto w-40" aria-label="Imported sensor positions on the foot outlines">
            <Footprints left={views("left")} right={views("right")} mode="outline" markers className="h-44 w-full" />
            <figcaption className="text-center text-[12px] text-slate-400">Sensor positions. Toes point up; big-toe side faces the other foot.</figcaption>
          </figure>
        )}
      </div>
    );
  }
  return (
    <dl className="text-xs" data-testid="import-preview">
      <Row k="Samples (rows)" v={p.rowCount.toLocaleString("en-US")} />
      <Row k="Valid samples" v={`${p.validSamples} of ${p.validSamples + p.missingSamples} expected`} />
      <Row k="Missing samples" v={`${p.missingSamples} (${p.skippedSlots} skipped timestamps)`} />
      <Row k="Coverage" v={`${(p.coverage * 100).toFixed(1)}%${p.coverage < 0.8 ? " (below 80%: sway statistics will be Unavailable)" : ""}`} />
      <Row k="Time span" v={`${fmtMs(p.startMs)} to ${fmtMs(p.endMs)}`} />
      <Row k="Observed duration (CSV)" v={`${p.observedDurationS.toFixed(2)} s`} />
      <Row k="Sampling interval (median)" v={`${p.intervalMs} ms`} />
      <Row k="Gaps" v={p.gaps.length === 0 ? "none" : p.gaps.map((g) => `${g.fromS.toFixed(2)}–${g.toS.toFixed(2)} s`).join(", ")} />
      <p className="mt-1 text-[13px] text-slate-400">The path and replay are never drawn across a gap. No Balance Index or fall-risk flag is created from an import.</p>
    </dl>
  );
}

const download = (name: string, text: string) => ({ href: `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`, name });

/**
 * "Import sensor CSV" for ONE saved pressure or balance assessment of the selected astronaut. The file is read in the browser only to be
 * sent to the server; the server parses and validates it, and nothing is saved until "Save import" is pressed.
 */
export default function SensorImport({ a, target, onClose }: { a: AstronautRecord; target: Target; onClose: () => void }) {
  const { kind, x } = target;
  const existing = x.csvImport;
  const [st, setSt] = useState<State>({ phase: "idle" });
  const [replace, setReplace] = useState(false);
  const busy = useRef(false);
  const tpl = download(kind === "pressure" ? "aerorehab-pressure-template.csv" : "aerorehab-balance-template.csv", kind === "pressure" ? PRESSURE_TEMPLATE_CSV : BALANCE_TEMPLATE_CSV);
  const cols = kind === "pressure" ? PRESSURE_COLUMNS : BALANCE_COLUMNS;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setReplace(false);
    if (f.size > MAX_FILE_BYTES) { setSt({ phase: "rejected", fileName: f.name, failure: { ok: false, errors: { form: "The file is larger than 2 MB. Nothing was imported." }, issues: [], hidden: 0 } }); return; }
    setSt({ phase: "checking", fileName: f.name });
    const csv = await f.text();
    const r = await previewImportApi({ kind, astronautId: a.id, assessmentId: x.id, fileName: f.name, csv });
    setSt(r.ok ? { phase: "ready", fileName: f.name, csv, result: r.value } : { phase: "rejected", fileName: f.name, failure: r });
  }

  async function save() {
    if (st.phase !== "ready" || busy.current) return; // one save at a time, even with a double click
    busy.current = true;
    const { fileName, csv } = st;
    setSt({ phase: "saving", fileName });
    const r = await saveImportApi({ kind, astronautId: a.id, assessmentId: x.id, fileName, csv, replace });
    busy.current = false;
    if (r.ok) setSt({ phase: "saved", fileName, duplicate: r.value.duplicate, replaced: r.value.replaced });
    else setSt({ phase: "rejected", fileName, failure: r });
  }

  const ready = st.phase === "ready" ? st : null;
  const needsReplace = !!ready?.result.existing && !ready.result.existing.sameFile;
  const sameFile = !!ready?.result.existing?.sameFile;
  const canSave = !!ready && !sameFile && (!needsReplace || replace);
  const specLabel = kind === "pressure" ? PRESSURE_TEMPLATE_NAME : BALANCE_TEMPLATE_NAME;

  return (
    <Panel id={`si-${kind}`} title="Import sensor CSV" icon={kind === "pressure" ? "foot" : "balance"} action={<button type="button" className={ghost} onClick={onClose}>Close</button>}>
      <div className="space-y-3 text-xs">
        <dl className="grid gap-x-4 sm:grid-cols-2" aria-label="Import target">
          <Row k="Astronaut" v={a.profile.displayName} />
          <Row k="Assessment" v={`${x.startedAt}`} />
          {kind === "pressure"
            ? <Row k="Protocol" v={PRESSURE_PROTOCOL_LABEL[(x as PressureAssessmentView).protocol]} />
            : <><Row k="Standing leg" v={`${(x as BalanceAssessmentView).trialSide === "left" ? "Left" : "Right"} leg`} /><Row k="Protocol" v={BALANCE_PROTOCOL_LABEL[(x as BalanceAssessmentView).protocol]} /></>}
          <Row k="Source now" v={existing ? `Imported CSV: ${existing.fileName} (${utc(existing.importedAt)})` : "Manual entry only"} />
        </dl>

        <p className="text-slate-400">A CSV is an imported file that is saved with this assessment. It is not a live sensor feed: Recorded mode has no live sensor connection.</p>

        <details className="rounded-md border border-cyan-400/20 p-2">
          <summary className="cursor-pointer text-slate-200">Expected file format: {specLabel}</summary>
          <p className="mt-1 text-slate-300">UTF-8 CSV, comma separated, header row exactly: <code className="rounded bg-black/40 px-1 text-cyan-200">{cols.join(",")}</code>. Limit 2 MB.</p>
          {kind === "pressure" ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
              <li><b>time_ms</b>: elapsed milliseconds since the start of the assessment, ascending. Sensors sharing a time form one frame.</li>
              <li><b>foot</b>: left or right. <b>sensor_id</b>: letters, digits, _ or -. A sensor keeps the same foot, area and position in every row.</li>
              <li><b>pressure_kpa</b>: kilopascals. 0 is a real zero; <b>blank = missing reading</b>. A sensor with no row in a frame is also missing.</li>
              <li><b>area_cm2</b>: sensing area in cm². <b>x_mm, y_mm</b>: sensor centre in the foot-local frame used for BOTH feet: origin at the heel centre, +y toward the toes, +x medial (toward the other foot), millimetres.</li>
            </ul>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
              <li><b>time_ms</b>: elapsed milliseconds since the start of the trial; unique and strictly increasing.</li>
              <li><b>ml_mm, ap_mm</b>: centre-of-pressure position in millimetres in the one trial frame (+ML toward the astronaut&apos;s right, +AP toward the toes). Both blank = missing sample.</li>
              <li>The standing leg and protocol are taken from this saved trial, not from the file. Skipped timestamps are gaps; paths are never drawn across them.</li>
            </ul>
          )}
          <a href={tpl.href} download={tpl.name} className="mt-2 inline-block text-cyan-300 hover:underline">Download the template</a>
        </details>

        <div>
          <label htmlFor={`si-file-${kind}`} className="mb-1 block text-slate-300">CSV file</label>
          <input id={`si-file-${kind}`} type="file" accept=".csv,text/csv" onChange={pick} disabled={st.phase === "checking" || st.phase === "saving"}
            className="block w-full max-w-md text-xs text-slate-200 file:mr-2 file:rounded file:border file:border-cyan-300/60 file:bg-cyan-400/10 file:px-2 file:py-1 file:text-white" />
        </div>

        <div role="status" aria-live="polite">
          {st.phase === "checking" && <p className="text-slate-300">Checking {st.fileName} on the server…</p>}
          {st.phase === "saving" && <p className="text-slate-300">Saving {st.fileName}…</p>}
        </div>

        {st.phase === "rejected" && (
          <div role="alert" className="rounded-md border border-rose-400/60 bg-rose-500/10 p-2" data-testid="import-errors">
            <p className="font-semibold text-rose-200">{st.fileName}: {st.failure.errors.form ?? "The file was not accepted. Nothing was imported."}</p>
            {st.failure.issues.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-rose-100">
                {st.failure.issues.map((i, n) => (
                  <li key={n}>{i.line !== null ? `Line ${i.line}` : "File"}{i.column ? ` · column ${i.column}` : ""}: {i.message}</li>
                ))}
                {st.failure.hidden > 0 && <li>…and {st.failure.hidden} more problem{st.failure.hidden === 1 ? "" : "s"}.</li>}
              </ul>
            )}
            <p className="mt-1 text-[13px] text-rose-100/80">Nothing was saved. Fix the file and choose it again.</p>
          </div>
        )}

        {ready && (
          <div className="space-y-2 rounded-md border border-cyan-400/30 p-2" data-testid="import-ready">
            <p className="font-semibold text-white">Preview: {ready.fileName}</p>
            <PreviewCard p={ready.result.preview} geometry={ready.result.geometry} />
            {sameFile && <p role="status" className="text-amber-200">This exact file is already imported for this assessment. Nothing to save.</p>}
            {needsReplace && ready.result.existing && (
              <label className="flex items-start gap-2 text-amber-100">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-0.5" />
                <span>Replace the existing import ({ready.result.existing.fileName}, {utc(ready.result.existing.importedAt)}). Its samples are deleted and these are saved in one step.</span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={btn} onClick={save} disabled={!canSave}>Save import</button>
              <button type="button" className={ghost} onClick={() => setSt({ phase: "idle" })}>Choose another file</button>
              <span className="text-slate-400">Manual values stay as entered.</span>
            </div>
          </div>
        )}

        {st.phase === "saved" && (
          <p role="status" className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2 text-emerald-200" data-testid="import-saved">
            {st.duplicate ? "This file was already imported; nothing changed." : st.replaced ? `Replaced the import with ${st.fileName}.` : `Imported ${st.fileName}.`}{" "}
            <Link href={kind === "pressure" ? "/load-pressure" : "/stability-balance"} className="underline">Open {kind === "pressure" ? "Load & Pressure" : "Stability & Balance"} →</Link>
          </p>
        )}
      </div>
    </Panel>
  );
}
