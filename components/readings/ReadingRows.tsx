"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import { READINGS, WEIGHT_SHARE, NO_RULE_NOTE, type Reading } from "@/lib/alerts/glossary";
import { balanceView } from "@/lib/balance";
import { fmt, fmtSigned } from "@/lib/format";
import { insightView } from "@/lib/insights";
import { REDUCED_ROM_DEMO } from "@/lib/insights/config";
import { ORIGIN_LABEL, SUMMARY_RULE, effectivePeak, effectiveShares, effectiveSway, type LoadShares, type Origin } from "@/lib/recorded/assessments";
import { getPressureAnalysis, show as showP, valueOf } from "@/lib/pressure";


/** One reading: plain label and meaning first; the technical name and what exactly is shown sit in the details. */
function Item({ r, href, linkLabel, children, note, extra, onLink }: { r: Pick<Reading, "label" | "meaning" | "technical"> & { shows?: string }; href?: string; linkLabel?: string; children: React.ReactNode; note: React.ReactNode; extra?: React.ReactNode ; onLink?: () => void}) {
  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <dt className="text-sm font-semibold text-white">{r.label}</dt>
        {href && <Link href={href} onClick={onLink} className="shrink-0 text-xs text-cyan-300 hover:underline">{linkLabel ?? "Details"} &rarr;</Link>}
      </div>
      <dd className="mt-0.5 text-xs text-slate-300">{r.meaning}</dd>
      <dd className="mt-1 text-sm text-white">{children}</dd>
      <dd className="mt-1 text-xs text-slate-300">{note}</dd>
      <dd>
        <details className="mt-1 text-[11px] text-slate-300">
          <summary className="inline-block cursor-pointer text-cyan-200 hover:text-white">Technical details</summary>
          <p className="mt-1">Technical name: {r.technical}.{r.shows ? ` Shown as: ${r.shows}.` : ""}</p>
          {extra}
        </details>
      </dd>
    </div>
  );
}

/** "From Day 42 · Quiet standing · 09:00 (manual entry)" as a link to the exact saved assessment. */
function Source({ label, href, onOpen, imported = false }: { label: string; href: string; onOpen: () => void; imported?: boolean }) {
  return <span className="block text-[11px] text-slate-400">From <Link href={href} onClick={onOpen} className="text-cyan-300 hover:underline" aria-label={`Open the saved entry: ${label}`}>{label}</Link> (manual entry{imported ? <> + <span data-testid="source-imported" className="text-violet-200">Imported CSV</span></> : null})</span>;
}

const Tag = ({ origin }: { origin: Origin | null }) => (origin === "csv" ? <span data-testid="origin-csv" className="ml-1 text-[10px] text-violet-200">[{ORIGIN_LABEL.csv}]</span> : null);

/**
 * The four main readings in plain language, used on Overview (Measurement details) and AI Insights so both say the same
 * thing. Only knee movement has a configured comparison rule; the others show the reading without a status.
 */
export default function ReadingRows() {
  const { astronaut, session, balanceSide, dataMode, walking, pressureAssessment, selectPressureAssessment, balanceTrial, selectBalanceTrial, selectWalking } = useAstronaut();
  // In recorded mode a missing reading is plainly "not recorded"; in demo mode it stays "Unavailable".
  const NA = dataMode === "recorded"
    ? <span><span className="text-amber-200">No reading recorded</span> <Link href="/patient-management" className="text-xs text-cyan-300 hover:underline">Add one &rarr;</Link></span>
    : <span className="text-amber-200">Unavailable</span>;
  const k = session.knee;
  const iv = insightView(astronaut, session);
  const rom = iv.rom;
  const hasBase = rom.pct.kind === "value" && rom.baseline.kind === "value" && rom.current.kind === "value";
  const pct = hasBase ? (rom.pct as { value: number }).value : 0;
  const diff = rom.diff.kind === "value" ? rom.diff.value : null;
  const flagged = iv.romFlagged;

  const g = session.gait;
  const pa = useMemo(() => getPressureAnalysis(session), [session]);
  const shares = pa ? valueOf(pa.session.meanShares) : null;
  const bv = useMemo(() => balanceView(astronaut, session, balanceSide), [astronaut, session, balanceSide]);
  const bs = bv.summary;
  const side = balanceSide === "left" ? "Left" : "Right";
  // Recorded mode: manual values win; otherwise values calculated from the imported CSV are used and labelled (see SUMMARY_RULE).
  const pShare = pressureAssessment ? effectiveShares(pressureAssessment) : { shares: { kind: "unavailable", reason: "missing-force" } as LoadShares, origin: null };
  const pPeakL = pressureAssessment ? effectivePeak(pressureAssessment, "left") : { value: null, origin: null };
  const pPeakR = pressureAssessment ? effectivePeak(pressureAssessment, "right") : { value: null, origin: null };
  const bMl = balanceTrial ? effectiveSway(balanceTrial, "ml") : { value: null, origin: null };
  const bAp = balanceTrial ? effectiveSway(balanceTrial, "ap") : { value: null, origin: null };

  return (
    <dl className="divide-y divide-cyan-400/10">
      <Item r={READINGS.knee} href="/joint-analytics" linkLabel="Joint Analytics"
        note={hasBase
          ? <>Compared with your baseline session (Day {iv.baselineDay}: {fmt((rom.baseline as { value: number }).value, "°")}). Demo rule: flagged at {REDUCED_ROM_DEMO.thresholdPct}% or lower.</>
          : <>No baseline session for this knee side and movement, so there is no comparison and no status.</>}
        extra={<p className="mt-1">Peak bend {fmt(k.peakFlexionDeg, "°", 0)}; now {fmt(k.currentAngleDeg, "°", 0)}. {hasBase && diff !== null ? `Change vs baseline: ${fmtSigned(diff, "°", 1)} (${fmtSigned(pct, "%", 1)}).` : ""}</p>}>
        {k.romDeg === null ? NA : <><span className="font-semibold tabular-nums">{fmt(k.romDeg, "°", 0)}</span>{hasBase && <span className={flagged ? "text-amber-200" : "text-slate-300"}> &middot; {diff === null || diff === 0 ? "matches your baseline session" : `${fmt(Math.abs(diff), "°", 0)} ${diff < 0 ? "less" : "more"} than your baseline session`}</span>}</>}
      </Item>

      {dataMode === "recorded" ? (
        <Item r={READINGS.walking} href="/gait-analysis" linkLabel="Gait Analysis" note={NO_RULE_NOTE} onLink={walking ? () => selectWalking(walking.id) : undefined}
          extra={walking ? <p className="mt-1">Calculated from saved totals: {walking.distanceM} m in {walking.durationS} s{walking.steps === null ? ", no step count entered" : `, ${walking.steps} steps`}. Manual entry.</p> : undefined}>
          {!walking || walking.speedMs === null ? NA : (
            <>
              <span className="font-semibold tabular-nums">{walking.speedMs.toFixed(2)} m/s</span>
              <span className="text-slate-300"> &middot; </span>
              {walking.cadenceSpm === null ? <span className="text-slate-300">no step count entered</span> : <span className="tabular-nums">{walking.cadenceSpm.toFixed(2)} steps/min</span>}
              <Source label={walking.label} href="/gait-analysis" onOpen={() => selectWalking(walking.id)} />
            </>
          )}
        </Item>
      ) : (
      <Item r={READINGS.walking} href="/gait-analysis" linkLabel="Gait Analysis" note={NO_RULE_NOTE}
        extra={g?.speedDeltaPct != null ? <p className="mt-1">Change vs earlier session: {fmtSigned(g.speedDeltaPct, "%", 0)} (shown for information only).</p> : undefined}>
        {!g || g.speedMs === null ? NA : <><span className="font-semibold tabular-nums">{g.speedMs.toFixed(2)} m/s</span></>}
      </Item>
      )}

      {dataMode === "recorded" ? (
        <Item r={READINGS.pressure} href="/load-pressure" linkLabel="Load & Pressure" note={NO_RULE_NOTE} onLink={pressureAssessment ? () => selectPressureAssessment(pressureAssessment.id) : undefined}
          extra={pressureAssessment ? <p className="mt-1">{WEIGHT_SHARE.technical}: foot force &divide; combined force &times; 100. Force (N) and peak pressure (kPa) are separate readings. {SUMMARY_RULE}</p> : undefined}>
          {!pressureAssessment ? NA : (
            <>
              {pShare.shares.kind === "value"
                ? <><span className="text-xs text-slate-200">{WEIGHT_SHARE.meaning}</span>{" "}<span className="font-semibold tabular-nums">Left {pShare.shares.leftPct.toFixed(0)}% &middot; Right {pShare.shares.rightPct.toFixed(0)}%</span><Tag origin={pShare.origin} /> <span className="text-slate-300 tabular-nums">({pShare.shares.diffPp.toFixed(0)} percentage points apart)</span></>
                : <span className="text-slate-300">Load share unavailable (needs both forces, and a positive total)</span>}
              <span className="block text-slate-200 tabular-nums">Peak pressure: left {pPeakL.value === null ? "not measured" : `${pPeakL.value.toFixed(1)} kPa`}<Tag origin={pPeakL.origin} /> &middot; right {pPeakR.value === null ? "not measured" : `${pPeakR.value.toFixed(1)} kPa`}<Tag origin={pPeakR.origin} /></span>
              <Source label={pressureAssessment.label} href="/load-pressure" onOpen={() => selectPressureAssessment(pressureAssessment.id)} imported={!!pressureAssessment.csvImport} />
            </>
          )}
        </Item>
      ) : (
      <Item r={READINGS.pressure} href="/load-pressure" linkLabel="Load & Pressure" note={NO_RULE_NOTE}
        extra={<p className="mt-1">{WEIGHT_SHARE.technical}: session mean. Peak pressure: left {pa ? showP(pa.session.peakKpa.left, "kPa").text : "Unavailable"}, right {pa ? showP(pa.session.peakKpa.right, "kPa").text : "Unavailable"}.</p>}>
        {!pa ? NA : <>
          {showP(pa.session.peakKpa.overall, "kPa").tone === "value"
            ? <><span className="font-semibold tabular-nums">{showP(pa.session.peakKpa.overall, "kPa").text}</span> <span className="text-slate-300">highest pressure in this session</span></>
            : <>{NA} <span className="text-slate-300">(no usable pressure value in this session)</span></>}
          <span className="block text-xs text-slate-200 sm:inline sm:before:content-['·'] sm:before:mx-1.5">{WEIGHT_SHARE.meaning}{" "}
            {shares ? <span className="tabular-nums text-white">Left {shares.leftPct.toFixed(0)}% &middot; Right {shares.rightPct.toFixed(0)}%</span> : NA}</span>
        </>}
      </Item>
      )}

      {dataMode === "recorded" ? (
        <Item r={READINGS.balance} href="/stability-balance" linkLabel="Stability & Balance" note={NO_RULE_NOTE} onLink={balanceTrial ? () => selectBalanceTrial(balanceTrial.id) : undefined}
          extra={balanceTrial ? <p className="mt-1">Sway RMS (ML = side to side, AP = front to back) is the typed instrument value when entered, otherwise calculated from the imported sensor CSV. Duration entered by hand: {balanceTrial.durationS} s{balanceTrial.csvImport?.preview.kind === "balance" ? `; observed in the CSV: ${balanceTrial.csvImport.preview.observedDurationS.toFixed(1)} s` : ""}. Balance Index: unavailable, no documented scoring method applies. {SUMMARY_RULE}</p> : undefined}>
          {!balanceTrial || (bMl.value === null && bAp.value === null) ? (balanceTrial ? <span className="text-slate-300">Trial saved ({balanceTrial.durationS} s), no sway readings available</span> : NA) : (
            <span className="tabular-nums">ML {bMl.value === null ? "not entered" : `${bMl.value.toFixed(1)} mm`}<Tag origin={bMl.origin} /> &middot; AP {bAp.value === null ? "not entered" : `${bAp.value.toFixed(1)} mm`}<Tag origin={bAp.origin} /> <span className="text-slate-300">average sway ({balanceTrial.trialSide} leg)</span></span>
          )}
          {balanceTrial && <Source label={balanceTrial.label} href="/stability-balance" onOpen={() => selectBalanceTrial(balanceTrial.id)} imported={!!balanceTrial.csvImport} />}
        </Item>
      ) : (
      <Item r={READINGS.balance} href="/stability-balance" linkLabel="Stability & Balance" note={NO_RULE_NOTE}
        extra={bs ? <p className="mt-1">{side}-leg trial. Sway area (95%): {bs.ellipse.kind === "value" ? `${bs.ellipse.value.areaMm2.toFixed(1)} mm²` : "Unavailable"}. Balance Index (demo score): {bv.fixtures?.index ?? "Unavailable"}.</p> : undefined}>
        {bs && bs.rmsResultantMm.kind === "value" ? <><span className="font-semibold tabular-nums">{bs.rmsResultantMm.value.toFixed(1)} mm</span> <span className="text-slate-300">average sway ({side} leg)</span></> : NA}
      </Item>
      )}
    </dl>
  );
}
