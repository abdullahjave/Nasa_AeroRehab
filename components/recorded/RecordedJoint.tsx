"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import RecordedTrend from "./RecordedTrend";
import { insightView } from "@/lib/insights";
import { REDUCED_ROM_DEMO } from "@/lib/insights/config";
import { PROTOCOL_LABEL } from "@/lib/recorded/types";
import { fmt, fmtSigned } from "@/lib/format";

const UNAV = <span className="text-amber-200">No reading recorded</span>;

/**
 * Joint Analytics for recorded mode. It shows what was entered (angles, ROM, torque), the baseline comparison from the shared
 * insight selector, and the session-to-session trend. The IMU trace, velocity, acceleration, joint load and sensor panels are
 * not drawn: a manual session has no samples, and nothing is filled in from demo data.
 */
export default function RecordedJoint() {
  const { astronaut, session } = useAstronaut();
  const insight = useMemo(() => insightView(astronaut, session), [astronaut, session]);
  const r = session.recorded;
  const empty = !r || r.empty;
  const ctx = session.joint.measurement;
  const k = session.knee;
  const rom = insight.rom;
  const hasBase = rom.baseline.kind === "value" && rom.diff.kind === "value" && rom.pct.kind === "value";
  const limit = Math.abs(REDUCED_ROM_DEMO.thresholdPct);

  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Joint Analytics <span className="font-normal text-slate-300">&mdash; Knee ({ctx.side === "left" ? "Left" : "Right"})</span></h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Recorded Data</p>
        </div>
        <SessionPicker />
      </header>

      {empty ? (
        <Panel id="rj-empty" title="No saved sessions" icon="joint">
          <p className="text-sm text-white">No knee sessions are saved for {astronaut.profile.displayName} yet.</p>
          <p className="text-xs text-slate-300">Nothing is shown from demo data in recorded mode.</p>
          <Link href="/patient-management" className="mt-2 inline-flex w-fit rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400/25">Add session &rarr;</Link>
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel id="rj-values" title="Entered values" icon="joint" action={<Link href="/patient-management" className="text-[11px] text-cyan-300 hover:underline">Edit session &rarr;</Link>}>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-slate-400">Minimum angle</dt><dd className="text-xl font-semibold tabular-nums text-white">{k.minAngleDeg === null ? UNAV : fmt(k.minAngleDeg, "°", 1)}</dd></div>
              <div><dt className="text-xs text-slate-400">Maximum angle</dt><dd className="text-xl font-semibold tabular-nums text-white">{k.peakFlexionDeg === null ? UNAV : fmt(k.peakFlexionDeg, "°", 1)}</dd></div>
              <div><dt className="text-xs text-slate-400">Range of motion</dt><dd className="text-xl font-semibold tabular-nums text-white">{k.romDeg === null ? UNAV : fmt(k.romDeg, "°", 1)}</dd></div>
              <div><dt className="text-xs text-slate-400">Measured torque</dt><dd className="text-xl font-semibold tabular-nums text-white">{r.torqueNm === null ? UNAV : fmt(r.torqueNm, " Nm", 1)}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-slate-300">ROM = maximum angle &minus; minimum angle. {PROTOCOL_LABEL[ctx.protocol as keyof typeof PROTOCOL_LABEL] ?? ctx.protocol} &middot; {r.activity} &middot; {session.startedAt} &middot; manual entry.</p>
          </Panel>

          <Panel id="rj-baseline" title="Personal baseline" icon="chart" action={<Link href="/ai-insights" className="text-[11px] text-cyan-300 hover:underline">AI Insights &rarr;</Link>}>
            {r.isBaseline ? (
              <div className="text-sm"><p className="font-semibold text-emerald-300">This session is the saved baseline</p><p className="text-xs text-slate-300">Later sessions for the same knee side, movement and protocol are compared with it. It is not compared with itself.</p></div>
            ) : !hasBase ? (
              <div className="text-sm">
                <p className="font-semibold text-amber-200">Baseline unavailable</p>
                <p className="text-xs text-slate-300">No saved baseline for the {ctx.side} knee, {ctx.movement} and {ctx.protocol}, so no comparison is made. Current readings stay visible. <Link href="/patient-management" className="text-cyan-300 hover:underline">Choose a baseline &rarr;</Link></p>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="tabular-nums text-white">ROM {fmt(k.romDeg, "°", 1)} <span className="text-slate-400">vs baseline {fmt((rom.baseline as { value: number }).value, "°", 1)} (Day {insight.baselineDay})</span></p>
                <p className={`tabular-nums font-semibold ${(rom.diff as { value: number }).value < 0 ? "text-amber-200" : "text-emerald-300"}`}>{fmtSigned((rom.diff as { value: number }).value, "°", 1)} ({fmtSigned((rom.pct as { value: number }).value, "%", 1)})</p>
                <p className="text-[11px] text-slate-400">Prototype rule (demo threshold, not a clinical limit): flagged when ROM is {limit}% or more below the baseline. {insight.romFlagged ? "This session meets it." : "This session does not."}</p>
              </div>
            )}
          </Panel>
        </div>
      )}

      <RecordedTrend />

      <Panel id="rj-unavailable" title="Sensor readings" icon="pulse">
        <p className="text-sm text-amber-200">Unavailable for manual sessions</p>
        <p className="text-xs text-slate-300">IMU trace, angular velocity and acceleration, accelerometer, gyroscope, joint load and sensor calibration need sensor samples. This session has none, so these are not shown and nothing is filled in from demo data.</p>
      </Panel>
    </div>
  );
}
