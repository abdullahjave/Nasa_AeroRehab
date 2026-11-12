"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import RecordedPressure from "@/components/recorded/RecordedPressure";
import { useAstronaut } from "@/components/AstronautProvider";
import InsoleStatus from "@/components/settings/InsoleStatus";
import Panel from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import Footprints, { PressureLegend, peakSensorViews, sensorViews, type Trace } from "@/components/graphics/Footprints";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import {
  REASON_TEXT, SENSOR_LAYOUT, copPath, getPressureAnalysis, pressureTrend, show, toneClass, valueOf, zoneOfSensor,
  type FootAnalysis, type FootSide, type Metric, type PressureAnalysis,
} from "@/lib/pressure";

const TRAIL_MS = 10_000;
const LEFT = C.cyan;
const RIGHT = C.magenta;

type Row = { t: number; lp: number | null; rp: number | null; lf: number | null; rf: number | null };

function Val({ m, unit, digits = 0, big = false }: { m: Metric<number>; unit: string; digits?: number; big?: boolean }) {
  const s = show(m, unit, digits);
  return (
    <span className={`font-semibold tabular-nums ${s.tone === "value" ? (big ? "text-2xl" : "") : "text-sm"} ${toneClass(s.tone)}`}>
      {s.text}
    </span>
  );
}
const why = (m: Metric<unknown>) => (m.kind === "unavailable" ? REASON_TEXT[m.reason] : null);

/** Time spans (seconds) where a foot is not fully reporting. Drawn as shaded bands, distinct from a measured 0. */
function gapsOf(rows: PressureAnalysis["analyses"], side: FootSide) {
  const out: { from: number; to: number }[] = [];
  let start: number | null = null;
  rows.forEach((f, i) => {
    const bad = (side === "left" ? f.left : f.right).state !== "ok";
    const t = f.timestampMs / 1000;
    if (bad && start === null) start = t;
    if ((!bad || i === rows.length - 1) && start !== null) { out.push({ from: start, to: bad ? t : rows[i - 1].timestampMs / 1000 }); start = null; }
  });
  return out;
}

function Chart({
  id, title, caption, rows, kind, unit, domain, ticks, t, onPick, gaps, icon,
}: {
  id: string; title: string; caption: string; rows: Row[]; kind: "pressure" | "force"; unit: string; domain: [number, number | "auto"]; ticks?: number[];
  t: number; onPick: (sec: number) => void; gaps: Record<FootSide, { from: number; to: number }[]>; icon: "chart" | "load";
}) {
  const kl = kind === "pressure" ? "lp" : "lf";
  const kr = kind === "pressure" ? "rp" : "rf";
  return (
    <Panel id={id} title={title} icon={icon} className="h-full">
      <figure className="flex min-h-[230px] flex-1 flex-col rounded-md bg-black/35 p-2">
        <figcaption className="mb-1 text-[11px] text-slate-300">{caption}</figcaption>
        <div className="min-h-[190px] flex-1">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 460, height: 200 }}>
            <LineChart data={rows} margin={{ top: 4, right: 10, bottom: 2, left: 0 }}
              onClick={(s) => { const x = (s as { activeLabel?: string | number } | undefined)?.activeLabel; if (x !== undefined && !Number.isNaN(Number(x))) onPick(Number(x)); }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={[0, rows[rows.length - 1]?.t ?? 30]} tick={{ fill: AXIS, fontSize: 10 }} stroke={AXIS} tickCount={7} tickFormatter={(v) => `${v}`} />
              <YAxis domain={domain} ticks={ticks} tick={{ fill: AXIS, fontSize: 10 }} stroke={AXIS} width={38} allowDecimals={false} />
              {gaps.left.map((g, i) => <ReferenceArea key={`l${i}`} x1={g.from} x2={g.to} fill="#94a3b8" fillOpacity={0.22} stroke={LEFT} strokeOpacity={0.5} strokeDasharray="3 3" />)}
              {gaps.right.map((g, i) => <ReferenceArea key={`r${i}`} x1={g.from} x2={g.to} fill="#94a3b8" fillOpacity={0.22} stroke={RIGHT} strokeOpacity={0.5} strokeDasharray="3 3" />)}
              <ReferenceLine x={t} stroke="#fff" strokeOpacity={0.85} strokeDasharray="4 3" />
              <Tooltip cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Row | undefined;
                if (!active || !r) return null;
                const f = (v: number | null) => (v === null ? "Unavailable" : `${v.toFixed(kind === "pressure" ? 1 : 1)} ${unit}`);
                return (
                  <div className={TIP_CLASS}>
                    <p className="text-slate-300">Time <span className="font-semibold text-white">{r.t.toFixed(2)} s</span></p>
                    <p className="text-slate-300">Left <span className="font-semibold text-cyan-300">{f(r[kl])}</span></p>
                    <p className="text-slate-300">Right <span className="font-semibold text-pink-300">{f(r[kr])}</span></p>
                  </div>
                );
              }} />
              <Legend verticalAlign="top" align="right" height={20} iconType="circle" wrapperStyle={{ fontSize: 11, color: AXIS }} />
              <Line name="Left foot" dataKey={kl} stroke={LEFT} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line name="Right foot" dataKey={kr} stroke={RIGHT} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-[10px] text-slate-400">Time (s) &middot; shaded band = foot not reporting (Unavailable), not zero</p>
      </figure>
    </Panel>
  );
}

function FootStat({ f, label }: { f: FootAnalysis; label: string }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold" style={{ color: label === "Left" ? LEFT : RIGHT }}>{label}</p>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Force</span><Val m={f.forceN} unit="N" digits={1} /></div>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Peak pressure</span><Val m={f.peakKpa} unit="kPa" digits={1} /></div>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Loaded sensor area</span><Val m={f.loadedAreaCm2} unit="cm²" digits={1} /></div>
      <div className="flex justify-between gap-2"><span className="text-slate-400">Mean loaded pressure</span><Val m={f.meanLoadedKpa} unit="kPa" digits={1} /></div>
    </div>
  );
}

export default function LoadPressure() {
  const { dataMode } = useAstronaut();
  return dataMode === "recorded" ? <RecordedPressure /> : <DemoLoadPressure />;
}

function DemoLoadPressure() {
  const { astronaut, session } = useAstronaut();
  const pa = useMemo(() => getPressureAnalysis(session), [session]);
  const [cur, setCur] = useState<{ sid: string; idx: number } | null>(null);
  const [heatScope, setHeatScope] = useState<"frame" | "peak">("frame");

  const header = (
    <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Load &amp; Pressure</h1>
        <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Simulated Data</p>
        <InsoleStatus />
      </div>
      <SessionPicker />
    </header>
  );

  const trend = useMemo(() => pressureTrend(astronaut), [astronaut]);
  const rows: Row[] = useMemo(() => {
    if (!pa) return [];
    return pa.analyses.map((f) => ({
      t: f.timestampMs / 1000,
      lp: valueOf(f.left.peakKpa), rp: valueOf(f.right.peakKpa), lf: valueOf(f.left.forceN), rf: valueOf(f.right.forceN),
    }));
  }, [pa]);
  const gaps = useMemo(() => (pa ? { left: gapsOf(pa.analyses, "left"), right: gapsOf(pa.analyses, "right") } : { left: [], right: [] }), [pa]);

  if (!pa) {
    return (
      <div className="space-y-3">
        {header}
        <Panel id="empty" title="Load & Pressure" icon="foot" className="min-h-[300px]">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-cyan-400/30 p-6 text-center">
            <p className="text-lg font-semibold text-white">No pressure recording for this session</p>
            <p className="max-w-md text-sm text-slate-300">{session.label} has no insole data, so every pressure and load value is Unavailable. Pick another session.</p>
          </div>
        </Panel>
      </div>
    );
  }

  const n = pa.frames.length;
  const idx = cur && cur.sid === session.id ? Math.min(cur.idx, n - 1) : n - 1;
  const setIdx = (i: number) => setCur({ sid: session.id, idx: Math.max(0, Math.min(n - 1, Math.round(i))) });
  const frame = pa.frames[idx];
  const an = pa.analyses[idx];
  const tMs = frame.timestampMs;
  const tSec = tMs / 1000;
  const S = pa.session;

  const sharesNow = valueOf(an.shares);
  const sharesMean = valueOf(S.meanShares);

  const pathL = copPath(pa.analyses, "left", Math.max(0, tMs - TRAIL_MS), tMs);
  const pathR = copPath(pa.analyses, "right", Math.max(0, tMs - TRAIL_MS), tMs);
  const mkTrace = (side: FootSide, p: Metric<{ points: { x: number; y: number }[] }>): Trace => {
    const a = side === "left" ? an.left : an.right;
    return { points: p.kind === "value" ? p.value.points : [], current: a.copMm.kind === "value" ? a.copMm.value : null };
  };

  const leftViews = heatScope === "frame" ? sensorViews(frame, "left") : peakSensorViews(pa.frames, "left");
  const rightViews = heatScope === "frame" ? sensorViews(frame, "right") : peakSensorViews(pa.frames, "right");

  const copText = (a: FootAnalysis) => (a.copMm.kind === "value" ? `(${a.copMm.value.x.toFixed(1)}, ${a.copMm.value.y.toFixed(1)}) mm` : show(a.copMm as Metric<number>, "").text);

  return (
    <div className="space-y-3">
      {header}

      {/* Shared timeline cursor */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs">
        <label htmlFor="pcursor" className="text-slate-200">Timeline cursor</label>
        <input id="pcursor" type="range" min={0} max={n - 1} step={1} value={idx} onChange={(e) => setIdx(Number(e.target.value))}
          className="h-1.5 min-w-[10rem] flex-1 accent-cyan-400" aria-valuetext={`${tSec.toFixed(2)} seconds of ${(pa.durationMs / 1000).toFixed(2)}`} />
        <span className="tabular-nums text-white">{tSec.toFixed(2)} s / {(pa.durationMs / 1000).toFixed(2)} s</span>
        <button type="button" onClick={() => setIdx(n - 1)} className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-200 hover:bg-white/10">Latest sample</button>
        <span className="text-slate-400">Simulated weight-shift recording &middot; {pa.spec.sampleRateHz} Hz &middot; timestamps in ms since start</span>
      </div>

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel id="m-share" title="Weight Distribution" icon="load">
          {sharesNow ? (
            <p className="text-2xl font-semibold tabular-nums text-white">{sharesNow.leftPct.toFixed(0)}% <span className="text-xs font-normal text-slate-400">Left</span> <span className="mx-1 text-slate-500">|</span> {sharesNow.rightPct.toFixed(0)}% <span className="text-xs font-normal text-slate-400">Right</span></p>
          ) : <Val m={an.shares as Metric<number>} unit="" big />}
          {!sharesNow && <p className="text-[11px] text-slate-400">{why(an.shares)}</p>}
          <p className="mt-1 text-[10px] text-slate-400">
            Cursor frame. Session mean:{" "}
            {sharesMean ? `${sharesMean.leftPct.toFixed(1)}% / ${sharesMean.rightPct.toFixed(1)}%` : `Unavailable (${why(S.meanShares)})`}
          </p>
        </Panel>
        <Panel id="m-peak" title="Peak Pressure" icon="chart">
          <p><Val m={an.peakKpa} unit="kPa" digits={1} big /></p>
          {an.peakKpa.kind === "unavailable" && <p className="text-[11px] text-slate-400">{why(an.peakKpa)}</p>}
          <p className="text-[10px] text-slate-400">Cursor frame (L {show(an.left.peakKpa, "kPa", 1).text} &middot; R {show(an.right.peakKpa, "kPa", 1).text})</p>
          <p className="text-[10px] text-slate-400">Session peak: {show(S.peakKpa.overall, "kPa", 1).text}{S.peakKpa.overall.kind === "unavailable" ? ` (${why(S.peakKpa.overall)}); L ${show(S.peakKpa.left, "kPa", 1).text}, R ${show(S.peakKpa.right, "kPa", 1).text}` : ""}</p>
        </Panel>
        <Panel id="m-diff" title="Load Difference" icon="compare">
          <p><Val m={an.differencePp} unit="pp" digits={1} big /></p>
          {an.differencePp.kind === "unavailable" && <p className="text-[11px] text-slate-400">{why(an.differencePp)}</p>}
          <p className="text-[10px] text-slate-400">|Left % &minus; Right %| in percentage points. Session mean: {show(S.meanDifferencePp, "pp", 1).text}</p>
        </Panel>
        <Panel id="m-cop" title="Center of Pressure" icon="foot">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {([["Left", pathL, LEFT], ["Right", pathR, RIGHT]] as const).map(([lab, p, col]) => (
              <div key={lab}>
                <p className="font-semibold" style={{ color: col }}>{lab}</p>
                {p.kind === "value" ? (
                  <>
                    <p className="tabular-nums text-white">{p.value.lengthMm.toFixed(0)} <span className="text-slate-400">mm path</span></p>
                    <p className="tabular-nums text-white">{p.value.meanSpeedMmPerS.toFixed(1)} <span className="text-slate-400">mm/s</span></p>
                  </>
                ) : <p className="text-sm text-amber-200">Unavailable</p>}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Last {(TRAIL_MS / 1000).toFixed(0)} s up to the cursor. Gaps are not bridged.</p>
        </Panel>
      </div>

      {/* Plantar pressure, CoP, load metrics */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <Panel id="heat" title="Foot Pressure Distribution" icon="foot" className="h-full"
            action={
              <div role="group" aria-label="Heatmap scope" className="flex overflow-hidden rounded-md border border-cyan-400/40">
                {([["frame", "Cursor frame"], ["peak", "Session peak"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={heatScope === k} onClick={() => setHeatScope(k)}
                    className={`px-2 py-0.5 text-[11px] ${heatScope === k ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
                ))}
              </div>
            }>
            <div className="flex flex-1 items-center gap-2">
              <PressureLegend className="h-[24rem] w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <Footprints left={leftViews} right={rightViews} markers className="mx-auto h-[24rem] w-full max-w-[440px]" />
                <div className="mx-auto mt-1 flex max-w-[360px] justify-around text-xs"><span style={{ color: LEFT }}>Left</span><span style={{ color: RIGHT }}>Right</span></div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              Fixed 0&ndash;250 kPa colour scale (does not rescale when scrubbing). White dot = measured; ring with 0 = measured zero; dashed &times; and hatching = sensor missing (Unavailable).
              {heatScope === "frame" ? ` Frame at ${tSec.toFixed(2)} s.` : " Per-sensor maximum over the whole recording."}
            </p>
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Panel id="cop" title="CoP Trajectory" icon="foot" className="h-full">
            <Footprints left={sensorViews(frame, "left")} right={sensorViews(frame, "right")} mode="outline"
              traces={{ left: mkTrace("left", pathL), right: mkTrace("right", pathR) }} className="mx-auto h-[24rem] w-full max-w-[440px]" />
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 text-[10px] text-slate-300">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Start of {(TRAIL_MS / 1000).toFixed(0)} s trail</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 border-cyan-400" />CoP at cursor</span>
              <span><span className="mr-1 inline-block h-0.5 w-3 bg-yellow-300 align-middle" />Trajectory</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div><dt style={{ color: LEFT }}>Left CoP</dt><dd className="tabular-nums text-white">{copText(an.left)}</dd></div>
              <div><dt style={{ color: RIGHT }}>Right CoP</dt><dd className="tabular-nums text-white">{copText(an.right)}</dd></div>
            </dl>
            <p className="mt-1 text-[10px] text-slate-400">Foot-local frame: origin at heel centre, +y toward the toes, +x medial. Force-weighted.</p>
          </Panel>
        </div>
        <div className="xl:col-span-3">
          <Panel id="metrics" title="Load Metrics" icon="chart" className="h-full">
            <div className="space-y-3">
              <FootStat f={an.left} label="Left" />
              <hr className="border-cyan-400/15" />
              <FootStat f={an.right} label="Right" />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Force = pressure (kPa) &times; area (cm²) &times; 0.1 &rarr; N. Cursor frame.</p>
          </Panel>
        </div>
      </div>

      {/* Limb loading */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Panel id="limb" title="Limb Loading" icon="load" className="h-full">
            {sharesNow ? (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span style={{ color: LEFT }}>Left {show(an.left.forceN, "N", 1).text}</span><span className="tabular-nums text-white">{sharesNow.leftPct.toFixed(1)}%</span></div>
                  <div className="h-3 rounded-full bg-slate-700/60" role="img" aria-label={`Left share ${sharesNow.leftPct.toFixed(1)} percent`}><div className="h-full rounded-full" style={{ width: `${sharesNow.leftPct}%`, background: LEFT }} /></div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span style={{ color: RIGHT }}>Right {show(an.right.forceN, "N", 1).text}</span><span className="tabular-nums text-white">{sharesNow.rightPct.toFixed(1)}%</span></div>
                  <div className="h-3 rounded-full bg-slate-700/60" role="img" aria-label={`Right share ${sharesNow.rightPct.toFixed(1)} percent`}><div className="h-full rounded-full" style={{ width: `${sharesNow.rightPct}%`, background: RIGHT }} /></div>
                </div>
                <p className="text-xs text-slate-200">Difference <span className="font-semibold tabular-nums text-white">{show(an.differencePp, "pp", 1).text}</span> (percentage points)</p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm">
                <p className={`font-semibold ${toneClass(an.shares.kind === "unavailable" && an.shares.reason === "zero-load" ? "no-load" : "unavailable")}`}>
                  {an.shares.kind === "unavailable" && an.shares.reason === "zero-load" ? "No load measured" : "Unavailable"}
                </p>
                <p className="text-xs text-slate-300">{why(an.shares)}. A missing foot is never read as 100% on the other side.</p>
                <p className="mt-1 text-xs text-slate-300">Left force {show(an.left.forceN, "N", 1).text} &middot; Right force {show(an.right.forceN, "N", 1).text}</p>
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-400">Share = foot force &divide; (left + right force). Cursor frame at {tSec.toFixed(2)} s.</p>
          </Panel>
        </div>
        <div className="xl:col-span-4">
          <Chart id="pchart" title="Plantar Pressure Over Time" icon="chart" kind="pressure" unit="kPa" caption="Highest sensor pressure per foot (kPa). Click to move the cursor."
            rows={rows} domain={[0, 250]} ticks={[0, 50, 100, 150, 200, 250]} t={tSec} onPick={(s) => setIdx(s * pa.spec.sampleRateHz)} gaps={gaps} />
        </div>
        <div className="xl:col-span-4">
          <Chart id="fchart" title="Foot Force Over Time" icon="load" kind="force" unit="N" caption="Total force per foot (N) = sum of pressure x area x 0.1."
            rows={rows} domain={[0, "auto"]} t={tSec} onPick={(s) => setIdx(s * pa.spec.sampleRateHz)} gaps={gaps} />
        </div>
      </div>

      {/* Trend */}
      <Panel id="trend-p" title="Load Trend" icon="chart">
        <div className="grid gap-3 md:grid-cols-2">
          {([["peakKpa", "Session peak pressure (kPa)", "kPa", C.cyan, [0, 250]], ["differencePp", "Mean left/right difference (percentage points)", "pp", C.amber, [0, "auto"]]] as const).map(([key, label, unit, color, dom]) => (
            <figure key={key} className="rounded-md bg-black/35 p-2">
              <figcaption className="mb-1 text-[11px] text-slate-300">{label}</figcaption>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 400, height: 170 }}>
                  <LineChart data={trend} margin={{ top: 6, right: 10, bottom: 2, left: 0 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} stroke={AXIS} />
                    <YAxis domain={dom as [number, number | "auto"]} ticks={key === "peakKpa" ? [0, 50, 100, 150, 200, 250] : undefined} tick={{ fill: AXIS, fontSize: 10 }} stroke={AXIS} width={36} allowDecimals={false} />
                    <Tooltip cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} content={({ active, payload }) => {
                      const r = payload?.[0]?.payload as (typeof trend)[number] | undefined;
                      if (!active || !r) return null;
                      const v = r[key];
                      return <div className={TIP_CLASS}><p className="font-semibold text-white">{r.label}</p><p className="text-slate-300">{label.split(" (")[0]} <span className="font-semibold" style={{ color }}>{v === null ? "Unavailable" : `${v.toFixed(1)} ${unit}`}</span></p><p className="text-[10px] text-slate-400">{r.source === "session" ? "Recorded session" : r.source === "backfill" ? "Backfilled (same generator)" : "No recording"}</p></div>;
                    }} />
                    <Line dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} isAnimationActive={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Days with a recorded session use that session&apos;s samples; earlier days are simulated by the same generator at slightly lower amplitude (backfill). Gaps = Unavailable.</p>
      </Panel>

      {/* Per-sensor table: also shows zero vs missing as text */}
      <details className="glass rounded-lg p-3 text-xs">
        <summary className="cursor-pointer text-sm font-semibold text-white">Sensor readings at cursor ({tSec.toFixed(2)} s)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="text-slate-400"><tr><th className="py-1 pr-2 font-normal">Sensor</th><th className="pr-2 font-normal">Position (mm)</th><th className="pr-2 font-normal">Area (cm²)</th><th className="pr-2 font-normal">Pressure</th><th className="font-normal">Force</th></tr></thead>
            <tbody>
              {frame.samples.map((s) => (
                <tr key={s.sensorId} className="border-t border-cyan-400/10">
                  <td className="py-1 pr-2 text-white">{s.side === "left" ? "L" : "R"} {SENSOR_LAYOUT[zoneOfSensor(s.sensorId)].label}</td>
                  <td className="pr-2 tabular-nums text-slate-300">({s.positionMm.x}, {s.positionMm.y})</td>
                  <td className="pr-2 tabular-nums text-slate-300">{s.areaCm2}</td>
                  <td className={`pr-2 tabular-nums ${s.status === "missing" ? "text-amber-200" : s.pressureKpa === 0 ? "text-sky-300" : "text-white"}`}>{s.status === "missing" ? "Unavailable (missing)" : `${(s.pressureKpa as number).toFixed(1)} kPa${s.pressureKpa === 0 ? " (measured zero)" : ""}`}</td>
                  <td className="tabular-nums text-slate-300">{s.status === "missing" ? "Unavailable" : `${((s.pressureKpa as number) * s.areaCm2 * 0.1).toFixed(2)} N`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
