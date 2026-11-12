"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip, Stat } from "@/components/ui/Panel";
import SessionPicker from "@/components/ui/SessionPicker";
import GaugeRing from "@/components/ui/GaugeRing";
import KneeAnatomy from "@/components/graphics/KneeAnatomy";
import { ImuChip, JointLoadKnee, OrientationGizmo } from "@/components/graphics/Misc";
import { insightView } from "@/lib/insights";
import RecordedJoint from "@/components/recorded/RecordedJoint";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import { fmt, fmtClock, fmtSigned } from "@/lib/format";
import { fmtStamp } from "@/components/settings/parts";
import { getLatestSession } from "@/lib/demo";
import {
  IMU_WINDOW_SEC, PRESSURE_STOPS, angularAccelerationAt, angularVelocityAt, imuWindow, imuWindowStart, kneeAt,
  orientationAt, peakAngularVelocity, sessionEnd, torqueAt, type ImuPoint, type ImuSite,
} from "@/lib/demo";

const UNAV = <span className="text-sm text-amber-200">Unavailable</span>;

function Sparkline({ values, cursorIdx, color }: { values: (number | null)[]; cursorIdx: number; color: string }) {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return <p className="text-xs text-amber-200">Unavailable</p>;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const x = (i: number) => (i / (values.length - 1)) * 118 + 1;
  const y = (v: number) => 26 - ((v - lo) / (hi - lo || 1)) * 22;
  let d = "";
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${d && values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
  });
  const cv = values[Math.max(0, Math.min(values.length - 1, cursorIdx))];
  return (
    <svg viewBox="0 0 120 30" className="h-8 w-full" role="img" aria-label="20 second trend around the time cursor">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {cv !== null && cv !== undefined && <circle cx={x(cursorIdx)} cy={y(cv)} r="2.6" fill="#fff" />}
    </svg>
  );
}

function ImuTip({ active, payload, unit }: { active?: boolean; payload?: ReadonlyArray<{ payload?: ImuPoint }>; unit: "g" | "°/s" }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const isA = unit === "g";
  const v = isA ? [p.ax, p.ay, p.az] : [p.gx, p.gy, p.gz];
  return (
    <div className={TIP_CLASS}>
      <p className="text-slate-300">Time <span className="font-semibold text-white">{fmtClock(p.t)}</span></p>
      {["X", "Y", "Z"].map((n, i) => (
        <p key={n} className="text-slate-300">{n} <span className="font-semibold text-white">{fmt(v[i], ` ${unit}`, isA ? 2 : 1)}</span></p>
      ))}
    </div>
  );
}

function ImuChart({ id, title, unit, data, cursorT, t0, domain }: { id: string; title: string; unit: "g" | "°/s"; data: ImuPoint[]; cursorT: number; t0: number; domain: [number, number] }) {
  const isA = unit === "g";
  return (
    <Panel id={id} title={title} icon="pulse" className="h-full" action={<span className="text-[13px] text-slate-400">&plusmn;{domain[1]} {unit}</span>}>
      <figure className="flex min-h-[190px] flex-1 flex-col rounded-md bg-black/35 p-2">
        <figcaption className="sr-only">{title} X, Y and Z over a 20 second window. Cursor at {fmtClock(cursorT)}.</figcaption>
        <div className="min-h-[170px] flex-1">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 420, height: 190 }}>
            <LineChart data={data} margin={{ top: 4, right: 10, bottom: 2, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={[t0, t0 + IMU_WINDOW_SEC]} tickFormatter={fmtClock} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} tickCount={6} />
              <YAxis domain={domain} allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} width={34} />
              <Tooltip content={({ active, payload }) => <ImuTip active={active} payload={payload as never} unit={unit} />} cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} />
              <Legend verticalAlign="top" align="right" height={20} iconType="circle" wrapperStyle={{ fontSize: 12, color: AXIS }} />
              <ReferenceLine x={Math.max(t0, Math.min(t0 + IMU_WINDOW_SEC, cursorT))} stroke="#fff" strokeOpacity={0.7} strokeDasharray="4 3" />
              <Line name="X" dataKey={isA ? "ax" : "gx"} stroke={C.cyan} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line name="Y" dataKey={isA ? "ay" : "gy"} stroke={C.magenta} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line name="Z" dataKey={isA ? "az" : "gz"} stroke={C.lime} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </Panel>
  );
}

function BaselineRow({ label, value, base, unit, digits = 0 }: { label: string; value: number | null; base: number | null; unit: string; digits?: number }) {
  const pct = value === null || base === null ? null : Math.min(110, (value / base) * 100);
  const delta = value === null || base === null ? null : value - base;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-white">
          {fmt(value, unit, digits)} <span className="text-slate-400">vs {fmt(base, unit, digits)}</span>{" "}
          <span className={delta !== null && delta < 0 ? "text-amber-300" : "text-emerald-300"}>{delta === null ? "" : fmtSigned(delta, unit, digits)}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-700/60" role="img" aria-label={`${label} ${pct === null ? "unavailable" : `${Math.round(pct)} percent of baseline`}`}>
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

/** Demo mode keeps the simulated sensor page. Recorded mode shows entered values, the baseline comparison and the trend. */
export default function JointAnalytics() {
  const { dataMode } = useAstronaut();
  return dataMode === "recorded" ? <RecordedJoint /> : <DemoJointAnalytics />;
}

function DemoJointAnalytics() {
  const { astronaut, session, kneeSide, selectKneeSide, jointFocus, deviceState } = useAstronaut();
  // Shared comparability rule (lib/insights): the baseline is used only for the same side, movement and protocol.
  const insight = useMemo(() => insightView(astronaut, session), [astronaut, session]);
  const end = sessionEnd(session);
  const [cur, setCur] = useState<{ sid: string; t: number } | null>(null);
  // A "Review measurement" link can open the page at an event time for this session.
  const focusT = jointFocus && jointFocus.sessionId === session.id ? jointFocus.tSec : null;
  const t = cur && cur.sid === session.id ? cur.t : focusT ?? end;
  const setT = (v: number) => setCur({ sid: session.id, t: Math.max(0, Math.min(end, Math.round(v))) });

  const affected = astronaut.profile.affectedLimb;
  const side = kneeSide;
  const setSide = selectKneeSide;
  const shown = side ?? affected;
  const live = shown === affected;
  const [site, setSite] = useState<ImuSite>("shank");

  const j = session.joint;
  const knee = session.knee;
  const t0 = imuWindowStart(session, t);
  const win = useMemo(() => imuWindow(session, site, t), [session, site, t]);
  const cursorIdx = Math.round((t - t0) * 10);

  // Cursor readouts (all derived from the same knee curve the charts use)
  const angle = live ? kneeAt(session, t) : null;
  const vel = live ? angularVelocityAt(session, t) : null;
  const acc = live ? angularAccelerationAt(session, t) : null;
  const tq = live ? torqueAt(session, t) : j.contralateral?.torqueNm ?? null;
  const peakVel = useMemo(() => peakAngularVelocity(session), [session]);
  const orient = live ? orientationAt(session, site, t) : null;
  const romShown = live ? knee.romDeg : j.contralateral?.romDeg ?? null;

  const velSeries = useMemo(() => win.map((p) => p.gy), [win]);
  const accSeries = useMemo(() => {
    const out: (number | null)[] = [];
    for (let i = 0; i < win.length; i++) out.push(live ? angularAccelerationAt(session, win[i].t) : null);
    return out;
  }, [win, session, live]);

  const sensor = astronaut.sensors.find((s) => s.site === site);
  // A simulated calibration run only changes the status and time shown for the current (latest) session.
  const calRun = sensor && session.id === getLatestSession(astronaut).id ? deviceState?.sensors[sensor.id]?.calibration : undefined;
  const cal = calRun ? { ...j.imu[site], status: "valid" as const } : j.imu[site];
  const thighS = astronaut.sensors.find((s) => s.site === "thigh");
  const shankS = astronaut.sensors.find((s) => s.site === "shank");

  const flexRows = session.kneeSamples;
  const sideName = (s: "left" | "right") => (s === "left" ? "Left" : "Right");
  const other = affected === "left" ? "right" : "left";
  const checks = j.checks;

  const toggle = (
    <div role="group" aria-label="Knee side" className="flex overflow-hidden rounded-md border border-cyan-400/40">
      {(["left", "right"] as const).map((s) => (
        <button key={s} type="button" aria-pressed={shown === s} onClick={() => setSide(s)}
          className={`px-3 py-1 text-xs ${shown === s ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>
          {sideName(s)} Knee
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Joint Analytics <span className="font-normal text-slate-300">&mdash; Knee ({sideName(shown)})</span></h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Simulated Data</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SessionPicker />
          {toggle}
        </div>
      </header>

      {!live && (
        <p role="status" className="rounded-md border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          Time-series sensors are on the {affected} knee. For the {shown} knee only summary values are available; everything else shows Unavailable.
        </p>
      )}

      {/* Shared time cursor */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs">
        <label htmlFor="cursor" className="text-slate-200">Time cursor</label>
        <input id="cursor" type="range" min={0} max={end} step={1} value={t} onChange={(e) => setT(Number(e.target.value))}
          className="h-1.5 min-w-[10rem] flex-1 accent-cyan-400" aria-valuetext={`${fmtClock(t)} of ${fmtClock(end)}`} />
        <span className="tabular-nums text-white">{fmtClock(t)} / {fmtClock(end)}</span>
        <button type="button" onClick={() => setCur(null)} className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-200 hover:bg-white/10">Latest</button>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        {/* Anatomy focal panel */}
        <div className="xl:col-span-5">
          <Panel id="anatomy" title="Knee Anatomy" icon="joint" className="h-full">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <KneeAnatomy angle={angle === null ? null : Math.round(angle * 10) / 10} thigh={thighS} shank={shankS} className="mx-auto w-full max-w-[380px]" />
              <div className="flex flex-col items-center justify-center gap-2">
                <GaugeRing value={angle} max={130} color={C.cyan} size="h-32 w-32" center={angle === null ? undefined : `${angle.toFixed(1)}°`} centerSub="Knee Flexion (°)" ariaLabel={`Flexion at cursor ${angle?.toFixed(1)} degrees`} />
                <div className="grid w-full grid-cols-2 gap-x-3 gap-y-2">
                  <Stat label="Minimum Knee Angle (°)" value={live ? knee.minAngleDeg : null} unit="°" />
                  <Stat label="Peak flexion" value={live ? knee.peakFlexionDeg : null} unit="°" />
                  <Stat label="Max ROM" value={romShown} unit="°" />
                  <Stat label="Torque (sim.)" value={tq} digits={1} unit="Nm" />
                </div>
              </div>
            </div>
            <p className="mt-1 text-center text-[12px] text-slate-500">Knee illustration is static (supplied artwork). Arc, IMU patches and labels are live UI.</p>
          </Panel>
        </div>

        {/* Velocity / acceleration / smoothness */}
        <div className="grid content-start gap-3 xl:col-span-3">
          <Panel id="vel" title="Angular Velocity" icon="pulse">
            <p className="text-2xl font-semibold tabular-nums text-white">{vel === null ? UNAV : <>{vel.toFixed(1)} <span className="text-sm font-normal text-slate-300">°/s</span></>}</p>
            <Sparkline values={velSeries} cursorIdx={cursorIdx} color={C.cyan} />
          </Panel>
          <Panel id="acc" title="Angular Acceleration" icon="pulse">
            <p className="text-2xl font-semibold tabular-nums text-white">{acc === null ? UNAV : <>{acc.toFixed(1)} <span className="text-sm font-normal text-slate-300">°/s²</span></>}</p>
            <Sparkline values={accSeries} cursorIdx={cursorIdx} color={C.magenta} />
          </Panel>
          <Panel id="smooth" title="Movement Smoothness" icon="chart">
            <p className="text-2xl font-semibold tabular-nums text-white">{live ? fmt(j.smoothnessPct, "%") : "Unavailable"}</p>
            <p className="text-[13px] text-slate-400">Simulated session score (fixture)</p>
          </Panel>
        </div>

        {/* Comparisons */}
        <div className="grid content-start gap-3 xl:col-span-4">
          <Panel id="lr" title="Left / Right Comparison" icon="compare">
            {j.contralateral === null ? (
              <p className="text-sm text-amber-200">Bilateral data unavailable for this session.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { side: affected, tag: "Current", rom: knee.romDeg, tq: j.peakTorqueNm, v: peakVel, hi: true },
                    { side: other, tag: "Baseline", rom: j.contralateral.romDeg, tq: j.contralateral.torqueNm, v: j.contralateral.peakVelDegS, hi: false },
                  ].map((c) => (
                    <div key={c.side} className={`rounded-md border p-2 ${c.hi ? "border-emerald-400/60" : "border-cyan-400/30"}`}>
                      <p className="mb-1 font-semibold text-white">{sideName(c.side as "left" | "right")} ({c.tag})</p>
                      <dl className="space-y-0.5">
                        <div className="flex justify-between"><dt className="text-slate-400">ROM</dt><dd className="tabular-nums text-white">{fmt(c.rom, "°")}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-400">Torque</dt><dd className="tabular-nums text-white">{fmt(c.tq, " Nm")}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-400">Peak vel.</dt><dd className="tabular-nums text-white">{fmt(c.v, " °/s", 1)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex items-center gap-2 text-sm text-white">
                  <span className="led" aria-hidden="true" /> Symmetry: {fmt(j.symmetryPct, "%")} {j.symmetryPct !== null && <span className="text-emerald-300">(Within Normal)</span>}
                </p>
              </>
            )}
          </Panel>
          <Panel id="baseline" title="Personal Baseline" icon="chart">
            {j.baseline === null || !insight.baselineComparable ? (
              <div className="text-sm">
                <p className="font-semibold text-amber-200">No comparable baseline</p>
                <p className="text-xs text-slate-300">The stored baseline is for a different knee, movement or protocol ({insight.context.protocol}). Current: peak {knee.peakFlexionDeg ?? "Unavailable"}°, ROM {knee.romDeg ?? "Unavailable"}°.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <BaselineRow label="Peak flexion" value={live ? knee.peakFlexionDeg : null} base={j.baseline.peakFlexionDeg} unit="°" />
                <BaselineRow label="ROM" value={live ? knee.romDeg : null} base={j.baseline.romDeg} unit="°" />
                <BaselineRow label="Peak torque" value={live ? j.peakTorqueNm : null} base={j.baseline.torqueNm} unit=" Nm" />
                <BaselineRow label="Smoothness" value={live ? j.smoothnessPct : null} base={j.baseline.smoothnessPct} unit="%" />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          {live ? <ImuChart id="accel" title={`Accelerometer (${site === "shank" ? "Shank" : "Thigh"} IMU) XYZ`} unit="g" data={win} cursorT={t} t0={t0} domain={[-2, 2]} /> : <Panel id="accel" title="Accelerometer XYZ" icon="pulse" className="h-full"><p className="text-sm text-amber-200">Unavailable</p></Panel>}
        </div>
        <div className="xl:col-span-4">
          {live ? <ImuChart id="gyro" title={`Gyroscope (${site === "shank" ? "Shank" : "Thigh"} IMU) XYZ`} unit="°/s" data={win} cursorT={t} t0={t0} domain={[-30, 30]} /> : <Panel id="gyro" title="Gyroscope XYZ" icon="pulse" className="h-full"><p className="text-sm text-amber-200">Unavailable</p></Panel>}
        </div>
        <div className="xl:col-span-4">
          <Panel id="cal" title="Calibration & Sensor Status" icon="chip" className="h-full"
            action={
              <div role="group" aria-label="IMU site" className="flex overflow-hidden rounded-md border border-cyan-400/40">
                {(["thigh", "shank"] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={site === s} onClick={() => setSite(s)}
                    className={`px-2 py-0.5 text-[13px] ${site === s ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{s === "thigh" ? "Thigh" : "Shank"}</button>
                ))}
              </div>
            }>
            <div className="grid flex-1 grid-cols-[auto_1fr] items-center gap-3">
              <div className="space-y-2">
                <ImuChip className="h-24 w-28" />
                {orient ? <OrientationGizmo roll={orient.roll} pitch={orient.pitch} yaw={orient.yaw} className="mx-auto h-20 w-20" /> : <p className="text-center text-xs text-amber-200">Orientation<br />Unavailable</p>}
              </div>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Connection</dt><dd className={sensor?.status === "offline" ? "text-slate-300" : sensor?.status === "low-battery" ? "text-amber-300" : "text-emerald-300"}>{sensor?.status === "offline" ? "Offline" : sensor?.status === "low-battery" ? `Low battery (${sensor.battery}%)` : `Online (${fmt(sensor?.battery ?? null, "%")})`}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Calibration</dt><dd className={cal.status === "valid" ? "text-emerald-300" : "text-amber-300"}>{cal.status === "valid" ? "✓ Valid" : cal.status === "stale" ? "Stale" : "Unavailable"}</dd></div>
                {calRun && <div className="flex justify-between gap-2"><dt className="text-slate-400">Calibrated</dt><dd className="text-white">{fmtStamp(calRun.at)} <span className="text-slate-500">(sim.)</span></dd></div>}
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Bias (X/Y/Z)</dt><dd className="tabular-nums text-white">{cal.biasG.map((b) => b.toFixed(2)).join(" / ")} g</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Scale factor</dt><dd className="tabular-nums text-white">{fmt(cal.scaleFactor, "", 3)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Temp.</dt><dd className="tabular-nums text-white">{fmt(cal.tempC, " °C", 1)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Roll / pitch / yaw</dt><dd className="tabular-nums text-white">{orient ? `${orient.roll.toFixed(0)}° / ${orient.pitch.toFixed(0)}° / ${orient.yaw.toFixed(0)}°` : "Unavailable"}</dd></div>
              </dl>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Panel id="flex" title="Knee Flexion (°) · Session" icon="pulse" className="h-full">
            {live ? (
              <figure className="flex min-h-[200px] flex-1 flex-col rounded-md bg-black/35 p-2">
                <figcaption className="mb-1 text-[13px] text-slate-300">Click the chart or use the time cursor. Shaded band = 20 s IMU window.</figcaption>
                <div className="min-h-[170px] flex-1">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 420, height: 190 }}>
                    <LineChart data={flexRows} margin={{ top: 6, right: 10, bottom: 2, left: 0 }}
                      onClick={(s) => { const x = (s as { activeLabel?: string | number } | undefined)?.activeLabel; if (x !== undefined && !Number.isNaN(Number(x))) setT(Number(x)); }}>
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                      <XAxis dataKey="t" type="number" domain={[0, end]} tickFormatter={fmtClock} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} tickCount={6} />
                      <YAxis domain={[0, 130]} ticks={[0, 30, 60, 90, 120]} tick={{ fill: AXIS, fontSize: 12 }} stroke={AXIS} width={34} unit="°" />
                      <ReferenceArea x1={t0} x2={t0 + IMU_WINDOW_SEC} fill="#22d3ee" fillOpacity={0.15} />
                      {j.baseline && insight.baselineComparable && <ReferenceLine y={j.baseline.peakFlexionDeg} stroke={C.amber} strokeDasharray="4 4" label={{ value: `Baseline peak ${j.baseline.peakFlexionDeg}°`, fill: "#fde68a", fontSize: 12, position: "insideTopRight" }} />}
                      <ReferenceLine x={t} stroke="#fff" strokeOpacity={0.8} strokeDasharray="4 3" />
                      <Tooltip content={({ active, payload }) => {
                        const p = payload?.[0]?.payload as { t: number; flexionDeg: number | null } | undefined;
                        if (!active || !p) return null;
                        return <div className={TIP_CLASS}><p className="text-slate-300">Time <span className="font-semibold text-white">{fmtClock(p.t)}</span></p><p className="text-slate-300">Knee Flexion (°) <span className="font-semibold text-cyan-300">{fmt(p.flexionDeg, "°", 1)}</span></p></div>;
                      }} cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} />
                      <Line dataKey="flexionDeg" stroke={C.cyan} strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-center text-[13px] text-slate-300">ROM: {fmt(knee.minAngleDeg, "°")} &ndash; {fmt(knee.peakFlexionDeg, "°")} &middot; Cursor {fmtClock(t)}: {fmt(angle, "°", 1)}</p>
              </figure>
            ) : <p className="text-sm text-amber-200">Unavailable</p>}
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel id="load" title="Joint Load Distribution" icon="load" className="h-full">
            {j.cartilage === null ? <p className="text-sm text-amber-200">Unavailable</p> : (
              <div className="flex flex-1 items-center gap-3">
                <JointLoadKnee medial={j.cartilage.medial} lateral={j.cartilage.lateral} patellofemoral={j.cartilage.patellofemoral} className="h-40 w-28 shrink-0" />
                <svg viewBox="0 0 40 160" className="h-36 w-9 shrink-0" role="img" aria-label="Cartilage pressure legend 0 to 4 megapascals">
                  <defs>
                    <linearGradient id="mpa-lg" x1="0" x2="0" y1="0" y2="1">
                      {[...PRESSURE_STOPS].reverse().map((s) => <stop key={s.kpa} offset={1 - s.kpa / 250} stopColor={s.color} />)}
                    </linearGradient>
                  </defs>
                  <rect x="2" y="10" width="10" height="140" rx="3" fill="url(#mpa-lg)" stroke="#67e8f9" strokeOpacity="0.5" />
                  <text x="15" y="18" fontSize="9" fill="#cbd5e1">4.0</text>
                  <text x="15" y="82" fontSize="9" fill="#cbd5e1">2.0</text>
                  <text x="15" y="150" fontSize="9" fill="#cbd5e1">0.0</text>
                  <text x="2" y="6" fontSize="8" fill="#94a3b8">MPa</text>
                </svg>
                <div>
                  <p className="text-[13px] text-slate-300">Cartilage Pressure (Peak)</p>
                  <p className="text-2xl font-semibold tabular-nums text-white">{j.cartilage.peakMpa.toFixed(1)} <span className="text-sm font-normal text-slate-300">MPa</span></p>
                  <Chip tone={j.cartilage.peakMpa <= j.cartilage.limitMpa ? "green" : "amber"}>{j.cartilage.peakMpa <= j.cartilage.limitMpa ? "Within Limit" : "Above Limit"}</Chip>
                  <p className="mt-1 text-[12px] text-slate-400">Limit {j.cartilage.limitMpa.toFixed(1)} MPa &middot; medial {j.cartilage.medial.toFixed(1)} &middot; lateral {j.cartilage.lateral.toFixed(1)} &middot; patellofemoral {j.cartilage.patellofemoral.toFixed(1)}</p>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="xl:col-span-4">
          <Panel id="insights" title="Trend & Insights" icon="check" className="h-full">
            <ul className="space-y-2 text-sm text-white">
              {checks.map((c) => {
                const warn = /battery|dropout/i.test(c);
                return (
                  <li key={c} className="flex items-start gap-2">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${warn ? "bg-amber-300/20 text-amber-200" : "bg-emerald-400/20 text-emerald-300"}`} aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={warn ? "M12 6v8M12 18v.5" : "M5 13l4 4 10-10"} /></svg>
                    </span>
                    {c}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[12px] text-slate-400">Simulated &middot; {session.id}</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
