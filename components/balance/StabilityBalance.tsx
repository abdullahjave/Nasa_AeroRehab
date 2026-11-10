"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip } from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import GaugeRing from "@/components/ui/GaugeRing";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { BalanceArt, StabilityRadar, SwayPlot } from "./parts";
import { PROTOCOL_LABEL, REASON_LABEL, balanceView, bval, percentChange, type BMetric, type TrialSide, type TrialSummary } from "@/lib/balance";

const sideName = (s: TrialSide) => (s === "left" ? "Left" : "Right");

function M({ m, unit, digits = 1, big = false }: { m: BMetric<number>; unit: string; digits?: number; big?: boolean }) {
  if (m.kind === "unavailable") return <span className="text-sm font-semibold text-amber-200">Unavailable</span>;
  return (
    <span className={`font-semibold tabular-nums text-white ${big ? "text-3xl" : "text-lg"}`}>
      {m.value.toFixed(digits)}<span className="ml-1 text-xs font-normal text-slate-300">{unit}</span>
    </span>
  );
}
const why = (m: BMetric<unknown>) => (m.kind === "unavailable" ? REASON_LABEL[m.reason] ?? m.reason : null);
const pct = (m: BMetric<number>) => (m.kind === "value" ? `${m.value > 0 ? "+" : m.value < 0 ? "−" : ""}${Math.abs(m.value).toFixed(0)}%` : null);
const area = (s: TrialSummary | null): BMetric<number> =>
  !s ? { kind: "unavailable", reason: "no-trial" } : s.ellipse.kind === "value" ? { kind: "value", value: s.ellipse.value.areaMm2 } : s.ellipse;

export default function StabilityBalance({ hasBalanceArt }: { hasBalanceArt: boolean }) {
  const { astronaut, session, balanceSide, selectBalanceSide } = useAstronaut();
  const view = useMemo(() => balanceView(astronaut, session, balanceSide), [astronaut, session, balanceSide]);
  const leftView = useMemo(() => balanceView(astronaut, session, "left"), [astronaut, session]);
  const rightView = useMemo(() => balanceView(astronaut, session, "right"), [astronaut, session]);
  const [cur, setCur] = useState<{ id: string; idx: number } | null>(null);
  const [metric, setMetric] = useState<"area" | "rms">("area");

  const { trial, summary, fixtures } = view;
  const n = trial?.samples.length ?? 0;
  const idx = trial && cur && cur.id === trial.id ? Math.min(cur.idx, n - 1) : Math.max(0, n - 1);
  const sample = trial?.samples[idx];

  const history = view.history;
  const pos = trial ? history.findIndex((h) => h.trial.id === trial.id) : -1;
  const prev = pos > 0 ? history[pos - 1] : null;
  const prevAreaChange: BMetric<number> = !summary ? { kind: "unavailable", reason: "no-trial" } : prev ? percentChange(area(summary), area(prev.summary)) : { kind: "unavailable", reason: "no-baseline" };
  const rows = history.map((h) => ({
    label: `Day ${h.trial.missionDay}`,
    day: h.trial.missionDay,
    startedAt: h.trial.startedAt,
    coverage: h.summary.coverage,
    current: h.trial.id === trial?.id,
    area: bval(area(h.summary)),
    rms: bval(h.summary.rmsResultantMm),
  }));

  const trialToggle = (
    <div role="group" aria-label="Trial side" className="flex overflow-hidden rounded-md border border-cyan-400/40">
      {(["left", "right"] as const).map((s) => (
        <button key={s} type="button" aria-pressed={balanceSide === s} onClick={() => selectBalanceSide(s)}
          className={`px-3 py-1 text-xs ${balanceSide === s ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>
          {sideName(s)} leg
        </button>
      ))}
    </div>
  );

  const noTrial = (
    <div className="rounded-md border border-dashed border-cyan-400/30 p-3 text-sm">
      <p className="font-semibold text-amber-200">Unavailable</p>
      <p className="text-xs text-slate-300">No {balanceSide}-leg trial recorded for {session.label}.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Stability &amp; Balance</h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; {PROTOCOL_LABEL[view.protocol]} &middot; Simulated Data</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SessionPicker />
          <span className="text-xs text-slate-300">Trial</span>
          {trialToggle}
        </div>
      </header>

      {/* Top row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel id="b-index" title="Balance Index" icon="balance">
          <div className="flex items-center gap-3">
            <GaugeRing value={fixtures?.index ?? null} max={100} color={C.green} size="h-20 w-20" ariaLabel={`Balance Index ${fixtures?.index} out of 100`} />
            <div>
              {fixtures?.index != null ? <p className="text-3xl font-semibold tabular-nums text-white">{fixtures.index}<span className="ml-1 text-sm font-normal text-slate-300">/100</span></p> : <p className="text-sm font-semibold text-amber-200">Unavailable</p>}
              {fixtures && <Chip tone={fixtures.index != null ? "green" : "amber"}>{fixtures.indexStatus}</Chip>}
              <p className="mt-1 text-[10px] text-slate-400">Simulated demo score (session fixture)</p>
            </div>
          </div>
        </Panel>
        <Panel id="b-rms" title="Postural Sway (RMS)" icon="pulse">
          {!summary ? noTrial : (
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between"><dt className="text-xs text-slate-300">ML (Med-Lat)</dt><dd><M m={summary.rmsMlMm} unit="mm" /></dd></div>
              <div className="flex items-baseline justify-between"><dt className="text-xs text-slate-300">AP (Ant-Post)</dt><dd><M m={summary.rmsApMm} unit="mm" /></dd></div>
              <p className="text-[10px] text-slate-400">Full {balanceSide}-leg trial, mean-centred RMS per axis{summary.partial ? ` · ${Math.round(summary.coverage * 100)}% coverage` : ""}</p>
            </dl>
          )}
        </Panel>
        <Panel id="b-area" title="Sway Area (95%)" icon="chart">
          {!summary ? noTrial : (
            <>
              <p><M m={area(summary)} unit="mm²" big /></p>
              {summary.ellipse.kind === "unavailable" && <p className="text-[11px] text-slate-400">{why(summary.ellipse)}</p>}
              <p className={`mt-1 text-xs ${view.areaChangePct.kind === "value" ? (view.areaChangePct.value <= 0 ? "text-emerald-300" : "text-amber-300") : "text-slate-400"}`}>
                {view.areaChangePct.kind === "value"
                  ? `${view.areaChangePct.value <= 0 ? "↓" : "↑"} ${pct(view.areaChangePct)} vs baseline (Day ${view.baseline?.trial.missionDay}, same leg and protocol)`
                  : `Baseline change unavailable: ${why(view.areaChangePct)}`}
              </p>
            </>
          )}
        </Panel>
        <Panel id="b-flag" title="Fall Risk" icon="warn">
          {fixtures?.scenarioFlag ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-300/10 p-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/25 text-amber-200" aria-hidden="true">!</span>
              <div>
                <p className="text-base font-semibold text-amber-200">Demo flag</p>
                <p className="text-[11px] text-slate-200">{fixtures.scenarioFlag}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-cyan-400/25 p-2">
              <p className="text-sm font-semibold text-slate-200">No demo flag set</p>
              <p className="text-[11px] text-slate-400">This session has no scenario flag. No risk score is calculated.</p>
            </div>
          )}
        </Panel>
      </div>

      {/* Middle row */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <Panel id="b-path" title="Postural Sway Path" icon="balance" className="h-full">
            {!trial || !summary ? noTrial : (
              <>
                <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <SwayPlot samples={trial.samples} ellipse={summary.ellipse} idx={idx} sampleRateHz={trial.sampleRateHz} />
                  <div className="space-y-2 text-xs">
                    <ul className="space-y-1 text-slate-200">
                      <li className="flex items-center gap-2"><span className="h-0.5 w-4 bg-cyan-400" aria-hidden="true" />CoP path</li>
                      <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />Start</li>
                      <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />End</li>
                      <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-white" aria-hidden="true" />Current sample</li>
                      <li className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-full border border-dashed border-slate-200" aria-hidden="true" />95% ellipse</li>
                    </ul>
                    <div><p className="text-slate-400">Area (95%)</p><M m={area(summary)} unit="mm²" /></div>
                    <div><p className="text-slate-400">Path length</p><M m={summary.pathLengthMm} unit="mm" /></div>
                    <div><p className="text-slate-400">Mean speed</p><M m={summary.meanSpeedMmPerS} unit="mm/s" /></div>
                  </div>
                </div>
                {summary.partial && (
                  <p className="mt-1 rounded border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-100">
                    Partial coverage: {Math.round(summary.coverage * 100)}% valid samples. The path is broken at the gap; distance is not added across it.
                  </p>
                )}
                {/* Replay: moves only the marker and the sample readout; the summaries above stay full-trial. */}
                <div className="mt-2 rounded-md border border-cyan-400/20 bg-black/25 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="replay" className="text-slate-200">Replay</label>
                    <input id="replay" type="range" min={0} max={Math.max(0, n - 1)} step={1} value={idx} onChange={(e) => setCur({ id: trial.id, idx: Number(e.target.value) })}
                      className="h-1.5 min-w-[8rem] flex-1 accent-cyan-400" aria-valuetext={`${((sample?.timestampMs ?? 0) / 1000).toFixed(2)} seconds`} />
                    <span className="tabular-nums text-white">{((sample?.timestampMs ?? 0) / 1000).toFixed(2)} s / {trial.durationS.toFixed(1)} s</span>
                  </div>
                  <p className="mt-1 text-slate-300" aria-live="polite">
                    Current sample #{idx + 1}:{" "}
                    {sample && sample.status === "ok" && sample.mlMm !== null
                      ? <span className="tabular-nums text-white">ML {sample.mlMm.toFixed(2)} mm, AP {(sample.apMm as number).toFixed(2)} mm</span>
                      : <span className="text-amber-200">Missing sample (Unavailable)</span>}
                    <span className="text-slate-500"> &middot; summaries above use the full trial</span>
                  </p>
                </div>
              </>
            )}
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel id="b-assess" title="Balance Assessment" icon="user" className="h-full">
            <div className="grid flex-1 grid-cols-2 items-center gap-2">
              <BalanceArt side={balanceSide} hasImage={hasBalanceArt} className="mx-auto h-64 w-full max-w-[200px]" />
              <div className="space-y-2">
                {([["left", leftView], ["right", rightView]] as const).map(([s, v]) => {
                  const selected = balanceSide === s;
                  return (
                    <button key={s} type="button" aria-pressed={selected} onClick={() => selectBalanceSide(s)}
                      className={`w-full rounded-md border p-2 text-left text-xs ${selected ? "border-cyan-300 bg-cyan-400/10" : "border-cyan-400/20 hover:bg-white/5"}`}>
                      <p className="flex items-center justify-between font-semibold text-white">
                        Single-Leg Stance ({s === "left" ? "L" : "R"})
                        {selected && <span className="rounded border border-cyan-300/60 px-1 text-[10px] font-normal text-cyan-200">Selected</span>}
                      </p>
                      {v.trial && v.summary ? (
                        <dl className="mt-1 space-y-0.5">
                          <div className="flex justify-between"><dt className="text-slate-400">Time</dt><dd className="tabular-nums text-white">{v.trial.durationS.toFixed(1)} s</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-400">Sway (resultant RMS)</dt><dd><M m={v.summary.rmsResultantMm} unit="mm" /></dd></div>
                          {v.summary.partial && <div className="text-[10px] text-amber-200">{Math.round(v.summary.coverage * 100)}% coverage</div>}
                        </dl>
                      ) : <p className="mt-1 text-amber-200">Unavailable: no trial</p>}
                    </button>
                  );
                })}
                <p className="text-[10px] text-slate-400">Resultant RMS = &radic;(ML RMS&sup2; + AP RMS&sup2;)</p>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{hasBalanceArt ? "Illustration: supplied astronaut artwork, mirrored for the left leg. Decorative; it does not show measured sway." : "Illustration: local fallback pose (astronaut-balance.webp not present)."}</p>
          </Panel>
        </div>

        <div className="xl:col-span-3">
          <Panel id="b-profile" title="Stability Profile" icon="chart" className="h-full">
            <div className="flex flex-1 items-center justify-center"><StabilityRadar profile={fixtures?.profile ?? null} /></div>
            <p className="text-center text-[10px] text-slate-400">Demo scores, 0&ndash;100 (simulated fixture, no scoring model)</p>
          </Panel>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel id="b-history" title="Stability History" icon="chart" className="h-full"
            action={
              <div role="group" aria-label="History metric" className="flex overflow-hidden rounded-md border border-cyan-400/40">
                {([["area", "Sway area"], ["rms", "Resultant RMS"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)}
                    className={`px-2 py-0.5 text-[11px] ${metric === k ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
                ))}
              </div>
            }>
            <figure className="flex min-h-[200px] flex-1 flex-col rounded-md bg-black/35 p-2">
              <figcaption className="mb-1 text-[11px] text-slate-300">
                {metric === "area" ? "95% sway ellipse area (mm²)" : "Resultant sway RMS (mm)"} per {balanceSide}-leg trial, {PROTOCOL_LABEL[view.protocol].toLowerCase()}. Lower = less sway.
              </figcaption>
              <div className="min-h-[170px] flex-1">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 560, height: 180 }}>
                  <LineChart data={rows} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} />
                    <YAxis domain={[0, "auto"]} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} width={40} unit={metric === "area" ? "" : ""} allowDecimals={false} />
                    <Tooltip cursor={{ stroke: C.green, strokeOpacity: 0.4 }} content={({ active, payload }) => {
                      const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                      if (!active || !r) return null;
                      const val = metric === "area" ? r.area : r.rms;
                      return (
                        <div className={TIP_CLASS}>
                          <p className="font-semibold text-white">{r.label} &middot; {r.startedAt}{r.current ? " (selected session)" : ""}</p>
                          <p className="text-slate-300">{metric === "area" ? "Sway area" : "Resultant RMS"} <span className="font-semibold text-emerald-300">{val === null ? "Unavailable" : metric === "area" ? `${val.toFixed(1)} mm²` : `${val.toFixed(2)} mm`}</span></p>
                          <p className="text-[10px] text-slate-400">Coverage {Math.round(r.coverage * 100)}%</p>
                        </div>
                      );
                    }} />
                    <Line dataKey={metric} stroke={C.green} strokeWidth={2} isAnimationActive={false} connectNulls={false}
                      dot={(p: { cx?: number; cy?: number; payload?: { current: boolean }; index?: number }) => (
                        <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.current ? 5.5 : 3.2} fill={p.payload?.current ? "#fff" : C.green} stroke={C.green} strokeWidth={p.payload?.current ? 2.5 : 0} />
                      )} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-[10px] text-slate-400">White point = selected session. Days 36&ndash;40 are history trials without a full session record.</p>
            </figure>
          </Panel>
        </div>
        <div className="xl:col-span-5">
          <Panel id="b-insights" title="Key Insights" icon="brain" className="h-full">
            <ul className="space-y-2 text-sm">
              {[
                {
                  ok: prevAreaChange.kind === "value" && prevAreaChange.value <= 0,
                  warn: false,
                  text: prevAreaChange.kind === "value"
                    ? `Sway area ${pct(prevAreaChange)} vs previous ${balanceSide}-leg trial (Day ${prev?.trial.missionDay}).`
                    : `History change unavailable: ${why(prevAreaChange) ?? "no earlier trial"}.`,
                },
                {
                  ok: view.rmsChangePct.kind === "value" && view.rmsChangePct.value <= 0,
                  warn: false,
                  text: view.rmsChangePct.kind === "value"
                    ? `Resultant sway RMS ${pct(view.rmsChangePct)} vs personal baseline (Day ${view.baseline?.trial.missionDay}).`
                    : `Baseline comparison unavailable: ${why(view.rmsChangePct)}.`,
                },
                ...(summary?.partial ? [{ ok: false, warn: true, text: `Selected trial has ${Math.round(summary.coverage * 100)}% valid samples; summaries use the valid part only.` }] : []),
                ...(fixtures?.scenarioFlag ? [{ ok: false, warn: true, text: `Demo flag: ${fixtures.scenarioFlag}` }] : []),
              ].map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${r.warn ? "bg-amber-300/25 text-amber-200" : r.ok ? "bg-emerald-400/20 text-emerald-300" : "bg-slate-500/25 text-slate-300"}`} aria-hidden="true">
                    {r.warn ? "!" : r.ok ? "✓" : "•"}
                  </span>
                  <span className={r.warn ? "text-amber-100" : "text-slate-100"}>{r.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-slate-400">Comparisons are computed from the same trial records as the cards and charts. Simulated data.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
