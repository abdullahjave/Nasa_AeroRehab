"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Panel from "@/components/ui/Panel";
import Footprints, { PressureLegend, peakSensorViews, sensorViews, type Trace } from "@/components/graphics/Footprints";
import { SwayPlot } from "@/components/balance/parts";
import { C } from "@/components/ui/chart";
import { loadImportData } from "./api";
import { REASON_LABEL, type BMetric } from "@/lib/balance";
import { REASON_TEXT, copPath, show, toneClass, valueOf, type FootAnalysis, type FootSide, type Metric } from "@/lib/pressure";
import { analyzeBalanceRows, analyzePressureRows } from "@/lib/import/summary";
import type { ImportData } from "@/lib/db/imports";
import { SUMMARY_RULE } from "@/lib/recorded/assessments";
import type { BalanceAssessmentView, PressureAssessmentView } from "@/lib/recorded/types";

const LEFT = C.cyan;
const RIGHT = C.magenta;
const TRAIL_MS = 10_000;
const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; data: ImportData };

/** Fetches the saved samples of one import. Remount with key={import id} so a replacement loads fresh samples. */
function useSamples(kind: "pressure" | "balance", astronautId: string, assessmentId: string, importId: string): Load {
  const [s, setS] = useState<Load>({ status: "loading" });
  useEffect(() => {
    let live = true;
    loadImportData(kind, astronautId, assessmentId, importId)
      .then((d) => { if (live) setS(d ? { status: "ready", data: d } : { status: "error" }); })
      .catch(() => { if (live) setS({ status: "error" }); });
    return () => { live = false; };
  }, [kind, astronautId, assessmentId, importId]);
  return s;
}

/** Play / pause stepping one sample every `stepMs`, stopping at the last one. */
function usePlayer(n: number, idx: number, setIdx: (i: number) => void, stepMs: number) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (idx >= n - 1) { const t = setTimeout(() => setPlaying(false), 0); return () => clearTimeout(t); }
    const t = setTimeout(() => setIdx(idx + 1), stepMs);
    return () => clearTimeout(t);
  }, [playing, idx, n, stepMs, setIdx]);
  return { playing, toggle: () => { if (!playing && idx >= n - 1) setIdx(0); setPlaying((p) => !p); }, stop: () => setPlaying(false) };
}

function Badge() {
  return <span data-testid="imported-badge" className="rounded-full border border-violet-300/40 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-100">Imported CSV</span>;
}

const Wait = ({ text }: { text: string }) => <p role="status" className="text-xs text-slate-300">{text}</p>;

// ---------------------------------------------------------------- pressure
export function ImportedPressure({ x, astronautId }: { x: PressureAssessmentView; astronautId: string }) {
  const imp = x.csvImport;
  if (!imp || imp.preview.kind !== "pressure") return null;
  return <PressureLoader key={imp.id} x={x} astronautId={astronautId} />;
}

function PressureLoader({ x, astronautId }: { x: PressureAssessmentView; astronautId: string }) {
  const imp = x.csvImport!;
  const s = useSamples("pressure", astronautId, x.id, imp.id);
  return (
    <Panel id="rl-import" title="Heatmap and centre-of-pressure playback" icon="pulse" action={<Badge />}>
      <p className="text-[11px] text-slate-300" data-testid="import-source">Imported CSV: {imp.fileName} &middot; imported {utc(imp.importedAt)} &middot; {imp.template} &middot; an imported file, not a live sensor feed</p>
      {s.status === "loading" && <Wait text="Loading the saved sensor samples…" />}
      {s.status === "error" && <p role="alert" className="text-sm text-amber-200">The saved samples could not be loaded. Reload the page to try again.</p>}
      {s.status === "ready" && s.data.kind === "pressure" && <PressureView data={s.data} />}
    </Panel>
  );
}

function FootStat({ f, label }: { f: FootAnalysis; label: "Left" | "Right" }) {
  const v = (m: Metric<number>, unit: string, d = 1) => { const sh = show(m, unit, d); return <span className={`font-semibold tabular-nums ${toneClass(sh.tone)}`}>{sh.text}</span>; };
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold" style={{ color: label === "Left" ? LEFT : RIGHT }}>{label}{f.state !== "ok" && <span className="ml-1 font-normal text-amber-200">· {REASON_TEXT[f.state]}</span>}</p>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Force</span>{v(f.forceN, "N")}</div>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Peak pressure</span>{v(f.peakKpa, "kPa")}</div>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Loaded area</span>{v(f.loadedAreaCm2, "cm²")}</div>
    </div>
  );
}

function PressureView({ data }: { data: Extract<ImportData, { kind: "pressure" }> }) {
  const pa = useMemo(() => analyzePressureRows(data.geometry, data.rows), [data]);
  const n = pa.frames.length;
  const [idx, setIdxRaw] = useState(0);
  const [scope, setScope] = useState<"frame" | "peak">("frame");
  const setIdx = (i: number) => setIdxRaw(Math.max(0, Math.min(n - 1, Math.round(i))));
  const player = usePlayer(n, idx, setIdx, 350);
  const frame = pa.frames[idx];
  const an = pa.analyses[idx];
  const S = pa.session;
  const tMs = frame.timestampMs;
  const spanMs = pa.frames[n - 1].timestampMs;
  const sharesNow = valueOf(an.shares);
  const sharesMean = valueOf(S.meanShares);
  const pathL = copPath(pa.analyses, "left", Math.max(0, tMs - TRAIL_MS), tMs);
  const pathR = copPath(pa.analyses, "right", Math.max(0, tMs - TRAIL_MS), tMs);
  const trace = (side: FootSide, p: Metric<{ points: { x: number; y: number }[] }>): Trace => {
    const a = side === "left" ? an.left : an.right;
    return { points: p.kind === "value" ? p.value.points : [], current: a.copMm.kind === "value" ? a.copMm.value : null };
  };
  const hasLeft = data.geometry.some((g) => g.foot === "left");
  const hasRight = data.geometry.some((g) => g.foot === "right");
  const views = (side: FootSide) => (scope === "frame" ? sensorViews(frame, side) : peakSensorViews(pa.frames, side));
  const copText = (a: FootAnalysis) => (a.copMm.kind === "value" ? `(${a.copMm.value.x.toFixed(1)}, ${a.copMm.value.y.toFixed(1)}) mm` : `Unavailable (${a.copMm.reason === "zero-load" ? "no load" : REASON_TEXT[a.copMm.reason].toLowerCase()})`);
  const incomplete = an.left.state !== "ok" && hasLeft || an.right.state !== "ok" && hasRight;
  const why = (m: Metric<unknown>) => (m.kind === "unavailable" ? REASON_TEXT[m.reason] : null);

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-black/25 px-2 py-1.5 text-xs">
        <label htmlFor="ip-cursor" className="text-slate-200">Timeline</label>
        <button type="button" onClick={player.toggle} className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-200 hover:bg-white/10">{player.playing ? "Pause" : "Play"}</button>
        <input id="ip-cursor" type="range" min={0} max={Math.max(0, n - 1)} step={1} value={idx} onChange={(e) => { player.stop(); setIdx(Number(e.target.value)); }}
          className="h-1.5 min-w-[8rem] flex-1 accent-cyan-400" aria-valuetext={`Frame ${idx + 1} of ${n}, ${(tMs / 1000).toFixed(2)} seconds`} />
        <span data-testid="ip-time" className="tabular-nums text-white">{(tMs / 1000).toFixed(2)} s / {(spanMs / 1000).toFixed(2)} s</span>
        <span data-testid="ip-frame" className="tabular-nums text-slate-300">frame {idx + 1} of {n}</span>
        {incomplete && <span className="rounded bg-amber-400/15 px-1.5 text-amber-200">data missing in this frame</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-cyan-400/15 p-2">
          <p className="text-xs font-semibold text-white">Weight distribution</p>
          {sharesNow ? (
            <p data-testid="ip-shares" className="text-xl font-semibold tabular-nums text-white">{sharesNow.leftPct.toFixed(0)}% <span className="text-xs font-normal text-slate-400">Left</span> <span className="mx-1 text-slate-500">|</span> {sharesNow.rightPct.toFixed(0)}% <span className="text-xs font-normal text-slate-400">Right</span></p>
          ) : <p data-testid="ip-shares" className="text-sm font-semibold text-amber-200">Unavailable <span className="font-normal text-slate-300">({why(an.shares)})</span></p>}
          <p data-testid="ip-diff" className="text-[11px] text-slate-300">Difference: {show(an.differencePp, "percentage points", 1).text}</p>
          <p className="mt-1 text-[10px] text-slate-400">Cursor frame. Needs both feet complete and a positive total force. Session mean (frames with both feet complete: {S.completeFrames} of {S.frameCount}): {sharesMean ? `${sharesMean.leftPct.toFixed(1)}% / ${sharesMean.rightPct.toFixed(1)}%` : `Unavailable (${why(S.meanShares)})`}</p>
        </div>
        <div className="rounded-md border border-cyan-400/15 p-2">
          <p className="text-xs font-semibold text-white">Peak pressure</p>
          <p data-testid="ip-peak" className={`text-xl font-semibold tabular-nums ${toneClass(show(an.peakKpa, "kPa").tone)}`}>{show(an.peakKpa, "kPa", 1).text}</p>
          <p className="text-[10px] text-slate-400">Cursor frame (L {show(an.left.peakKpa, "kPa", 1).text} &middot; R {show(an.right.peakKpa, "kPa", 1).text})</p>
          <p className="text-[10px] text-slate-400">Whole recording: {show(S.peakKpa.overall, "kPa", 1).text}{S.peakKpa.overall.kind === "unavailable" ? ` (L ${show(S.peakKpa.left, "kPa", 1).text}, R ${show(S.peakKpa.right, "kPa", 1).text})` : ""}</p>
        </div>
        <div className="rounded-md border border-cyan-400/15 p-2"><FootStat f={an.left} label="Left" /></div>
        <div className="rounded-md border border-cyan-400/15 p-2"><FootStat f={an.right} label="Right" /></div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">Foot pressure distribution</p>
            <div role="group" aria-label="Heatmap scope" className="flex overflow-hidden rounded-md border border-cyan-400/40">
              {([["frame", "Cursor frame"], ["peak", "Recording peak"]] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)} className={`px-2 py-0.5 text-[11px] ${scope === k ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2" data-testid="ip-heatmap">
            <PressureLegend className="h-[20rem] w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <Footprints left={hasLeft ? views("left") : null} right={hasRight ? views("right") : null} markers className="mx-auto h-[20rem] w-full max-w-[400px]" />
              <div className="mx-auto mt-1 flex max-w-[330px] justify-around text-xs"><span style={{ color: LEFT }}>Left</span><span style={{ color: RIGHT }}>Right</span></div>
            </div>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-400">Fixed 0&ndash;250 kPa scale, the same for every frame. White dot = measured; ring with 0 = measured zero; dashed &times; and hatching = missing reading (Unavailable). {scope === "frame" ? `Frame at ${(tMs / 1000).toFixed(2)} s.` : "Per-sensor maximum over the whole recording."}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-white">Centre of pressure (each foot in its own foot-local frame)</p>
          <Footprints left={hasLeft ? sensorViews(frame, "left") : null} right={hasRight ? sensorViews(frame, "right") : null} mode="outline"
            traces={{ left: trace("left", pathL), right: trace("right", pathR) }} className="mx-auto h-[20rem] w-full max-w-[400px]" />
          <dl className="mt-1 grid grid-cols-2 gap-2 text-xs">
            <div><dt style={{ color: LEFT }}>Left CoP</dt><dd data-testid="ip-cop-left" className="tabular-nums text-white">{copText(an.left)}</dd></div>
            <div><dt style={{ color: RIGHT }}>Right CoP</dt><dd data-testid="ip-cop-right" className="tabular-nums text-white">{copText(an.right)}</dd></div>
          </dl>
          <p className="mt-1 text-[10px] text-slate-400">Force-weighted, foot-local frame: origin at the heel centre, +y toward the toes, +x medial. The two feet are never merged into one frame, and the trace is not bridged across a frame without a CoP.</p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400">{SUMMARY_RULE} Force = pressure (kPa) &times; area (cm²) &times; 0.1 &rarr; N.</p>
    </div>
  );
}

// ---------------------------------------------------------------- balance
export function ImportedBalance({ x, astronautId }: { x: BalanceAssessmentView; astronautId: string }) {
  const imp = x.csvImport;
  if (!imp || imp.preview.kind !== "balance") return null;
  return <BalanceLoader key={imp.id} x={x} astronautId={astronautId} />;
}

function BalanceLoader({ x, astronautId }: { x: BalanceAssessmentView; astronautId: string }) {
  const imp = x.csvImport!;
  const s = useSamples("balance", astronautId, x.id, imp.id);
  return (
    <Panel id="rb-import" title="Sway path, ellipse and replay" icon="pulse" action={<Badge />}>
      <p className="text-[11px] text-slate-300" data-testid="import-source">Imported CSV: {imp.fileName} &middot; imported {utc(imp.importedAt)} &middot; {x.trialSide === "left" ? "Left" : "Right"}-leg stance (from the saved trial) &middot; {imp.template} &middot; an imported file, not a live sensor feed</p>
      {s.status === "loading" && <Wait text="Loading the saved sensor samples…" />}
      {s.status === "error" && <p role="alert" className="text-sm text-amber-200">The saved samples could not be loaded. Reload the page to try again.</p>}
      {s.status === "ready" && s.data.kind === "balance" && <BalanceView data={s.data} x={x} />}
    </Panel>
  );
}

const BM = ({ m, unit, d = 1 }: { m: BMetric<number>; unit: string; d?: number }) => m.kind === "value"
  ? <span className="font-semibold tabular-nums text-white">{m.value.toFixed(d)}<span className="ml-1 text-xs font-normal text-slate-300">{unit}</span></span>
  : <span className="text-sm font-semibold text-amber-200">Unavailable <span className="font-normal text-slate-300">({REASON_LABEL[m.reason] ?? m.reason})</span></span>;

function BalanceView({ data, x }: { data: Extract<ImportData, { kind: "balance" }>; x: BalanceAssessmentView }) {
  const an = useMemo(() => analyzeBalanceRows(data.rows), [data]);
  const { samples, summary, sampleRateHz } = an;
  const n = samples.length;
  const [idx, setIdxRaw] = useState(n - 1);
  const setIdx = (i: number) => setIdxRaw(Math.max(0, Math.min(n - 1, Math.round(i))));
  const player = usePlayer(n, idx, setIdx, Math.max(30, Math.min(250, an.intervalMs || 100)));
  const cur = samples[idx];
  const t0 = samples[0].timestampMs;
  const curOk = cur.status === "ok" && cur.mlMm !== null && cur.apMm !== null;
  const prev = x.csvImport?.preview.kind === "balance" ? x.csvImport.preview : null;
  const observed = prev ? prev.observedDurationS : (samples[n - 1].timestampMs - t0) / 1000;
  const differs = Math.abs(observed - x.durationS) > 0.5;
  const ellipseArea: BMetric<number> = summary.ellipse.kind === "value" ? { kind: "value", value: summary.ellipse.value.areaMm2 } : summary.ellipse;

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-black/25 px-2 py-1.5 text-xs">
        <label htmlFor="ib-cursor" className="text-slate-200">Replay</label>
        <button type="button" onClick={player.toggle} className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-200 hover:bg-white/10">{player.playing ? "Pause" : "Play"}</button>
        <input id="ib-cursor" type="range" min={0} max={Math.max(0, n - 1)} step={1} value={idx} onChange={(e) => { player.stop(); setIdx(Number(e.target.value)); }}
          className="h-1.5 min-w-[8rem] flex-1 accent-cyan-400" aria-valuetext={`Sample ${idx + 1} of ${n}`} />
        <span data-testid="ib-time" className="tabular-nums text-white">{((cur.timestampMs - t0) / 1000).toFixed(2)} s / {((samples[n - 1].timestampMs - t0) / 1000).toFixed(2)} s</span>
        <span data-testid="ib-cursor-pos" className="tabular-nums text-slate-200">{curOk ? `ML ${(cur.mlMm as number).toFixed(1)} mm · AP ${(cur.apMm as number).toFixed(1)} mm` : <span className="text-amber-200">missing sample</span>}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div data-testid="ib-plot"><SwayPlot samples={samples} ellipse={summary.ellipse} idx={idx} sampleRateHz={sampleRateHz} /></div>
        <div className="space-y-3">
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2"><dt className="text-slate-400">ML sway RMS</dt><dd data-testid="ib-ml"><BM m={summary.rmsMlMm} unit="mm" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">AP sway RMS</dt><dd data-testid="ib-ap"><BM m={summary.rmsApMm} unit="mm" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Resultant RMS</dt><dd data-testid="ib-res"><BM m={summary.rmsResultantMm} unit="mm" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Path length</dt><dd data-testid="ib-path"><BM m={summary.pathLengthMm} unit="mm" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Mean speed</dt><dd><BM m={summary.meanSpeedMmPerS} unit="mm/s" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">95% ellipse area</dt><dd data-testid="ib-area"><BM m={ellipseArea} unit="mm²" /></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Coverage</dt><dd data-testid="ib-coverage" className="tabular-nums text-white">{(summary.coverage * 100).toFixed(1)}% ({summary.validSamples} of {summary.totalSamples}){summary.coverage < 0.8 ? <span className="text-amber-200"> · below 80%</span> : null}</dd></div>
          </dl>
          <div className="rounded-md border border-cyan-400/15 p-2 text-xs" data-testid="ib-durations">
            <p className="font-semibold text-white">Duration</p>
            <p className="text-slate-200">Entered by hand on the trial: <span className="tabular-nums text-white">{x.durationS} s</span></p>
            <p className="text-slate-200">Observed in the imported CSV: <span className="tabular-nums text-white">{observed.toFixed(2)} s</span></p>
            {differs && <p className="text-amber-200">These differ. Both are shown as recorded; neither is changed.</p>}
          </div>
          <div className="rounded-md border border-cyan-400/15 p-2 text-xs">
            <p className="font-semibold text-white">Sway RMS: manual vs CSV</p>
            <p className="text-slate-200">ML: manual {x.mlRmsMm === null ? "not entered" : `${x.mlRmsMm.toFixed(1)} mm`} &middot; from CSV {summary.rmsMlMm.kind === "value" ? `${summary.rmsMlMm.value.toFixed(1)} mm` : "Unavailable"}</p>
            <p className="text-slate-200">AP: manual {x.apRmsMm === null ? "not entered" : `${x.apRmsMm.toFixed(1)} mm`} &middot; from CSV {summary.rmsApMm.kind === "value" ? `${summary.rmsApMm.value.toFixed(1)} mm` : "Unavailable"}</p>
            <p className="mt-1 text-[11px] text-slate-400">{SUMMARY_RULE}</p>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400">Trial frame: +ML toward the astronaut&apos;s right, +AP anterior, millimetres. The path and replay never bridge a missing interval ({prev && prev.gaps.length ? prev.gaps.map((g) => `${g.fromS.toFixed(2)}–${g.toS.toFixed(2)} s`).join(", ") : "none in this file"}). No Balance Index or fall-risk alert is created from an import: no documented scoring rule applies. <Link href="/patient-management" className="text-cyan-300 hover:underline">Replace or re-import →</Link></p>
    </div>
  );
}
