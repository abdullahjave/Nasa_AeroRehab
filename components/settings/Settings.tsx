"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/ui/Panel";
import AstronautImage from "@/components/graphics/AstronautImage";
import Footprints, { PressureLegend, sensorViews } from "@/components/graphics/Footprints";
import { useAstronaut } from "@/components/AstronautProvider";
import { useSystemReducedMotion, useWideScreen } from "@/components/SpaceBackdrop";
import { getAstronaut } from "@/lib/demo";
import { getPressureAnalysis } from "@/lib/pressure";
import { backdropMode } from "@/lib/settings/display";
import { calibrationBlocked, sensorDetails, type SensorDetail } from "@/lib/settings/devices";
import {
  CALIBRATION_MS, calibrationResult, clearCalibrationResult, connectHub, connectSensor, isCalibrating, patchDisplay, resetDemoState, runCalibration,
  setPlayback, useCalibrationVersion, useDisplayPrefs, usePlayback,
} from "./stores";
import { BatteryBar, CAL_TEXT, STATUS_LED, Switch, btn, calLed, calTone, fmtStamp, siteLabel, statusText } from "./parts";

type Assets = { videoSrc: string | null; hasPoster: boolean };

export default function Settings({ assets }: { assets: Assets }) {
  const { astronaut, deviceState, session, dataMode, setDataMode } = useAstronaut();
  if (dataMode === "recorded") {
    return (
      <div className="space-y-3">
        <header className="glass rounded-lg px-3 py-2">
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Settings <span className="text-base font-normal text-slate-300">&ndash; Data &amp; Display</span></h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; Recorded Data</p>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          <Panel id="set-data" title="Data mode" icon="chip">
            <p className="text-sm text-white">Recorded (local database)</p>
            <p className="mt-1 text-xs text-slate-300">Profiles and knee sessions are saved in a SQLite file on this computer. There is no sign-in or access control yet, so do not enter real patient data.</p>
            <p className="mt-2 text-sm font-semibold text-amber-200">No sensors in recorded mode</p>
            <p className="text-xs text-slate-300">Sensor status, calibration and connectivity apply to the simulated demo only.</p>
            <button type="button" onClick={() => setDataMode("demo")} className="mt-3 rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm text-white hover:bg-cyan-400/25">Switch to demo data</button>
          </Panel>
          <DisplayPanel assets={assets} />
        </div>
      </div>
    );
  }
  // The context astronaut already has overrides applied; details are computed from the fixture record so the
  // reason a sensor is offline (fixture / disconnected / hub) is known.
  const details = sensorDetails(getAstronaut(astronaut.id), deviceState);
  return (
    <div className="space-y-3">
      <header className="glass rounded-lg px-3 py-2">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Settings <span className="text-base font-normal text-slate-300">&ndash; Sensors, Calibration &amp; System Configuration</span></h1>
        <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {session.label} &middot; Simulated Data. Device changes here are simulated and never alter saved readings.</p>
      </header>
      <Devices details={details} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ConnectivityPanel details={details} />
        <SystemPanel />
        <DisplayPanel assets={assets} />
      </div>
    </div>
  );
}

/** Top row: sensor table, pressure stream and calibration share the selected sensor / device state. */
function Devices({ details }: { details: SensorDetail[] }) {
  const { astronaut, session } = useAstronaut();
  const [sel, setSel] = useState<{ aid: string; sid: string } | null>(null);
  const selectedId = sel && sel.aid === astronaut.id && details.some((d) => d.sensor.id === sel.sid) ? sel.sid : details[0]?.sensor.id;
  const setSelected = (sid: string) => setSel({ aid: astronaut.id, sid });
  const selected = details.find((d) => d.sensor.id === selectedId);
  const knee = session.joint.measurement.side;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
      <div className="md:col-span-2 xl:col-span-1"><SensorTable details={details} knee={knee} selectedId={selectedId} onSelect={setSelected} /></div>
      <PressurePanel details={details} />
      <CalibrationPanel details={details} selected={selected} knee={knee} />
    </div>
  );
}

function SensorTable({ details, knee, selectedId, onSelect }: { details: SensorDetail[]; knee: "left" | "right"; selectedId: string | undefined; onSelect: (id: string) => void }) {
  const { astronaut } = useAstronaut();
  const [msg, setMsg] = useState("");
  const hasSignal = details.some((d) => d.sensor.signalPct !== undefined && d.sensor.signalPct !== null);
  const toggle = (d: SensorDetail) => {
    const on = d.reason === "disconnected" || d.reason === "fixture";
    connectSensor(astronaut.id, d.sensor.id, on);
    setMsg(`${siteLabel(d.sensor, knee)} ${on ? "connected" : "disconnected"} (simulated).`);
  };
  return (
    <Panel id="set-sensors" title="Sensor Configuration" icon="chip" className="h-full">
      <ul className="divide-y divide-cyan-400/10 text-xs" aria-label="Assigned sensors">
        {details.map((d) => {
          const s = d.sensor;
          const label = siteLabel(s, knee);
          const canToggle = d.reason !== "hub";
          const connectAction = d.reason === "disconnected" || d.reason === "fixture";
          return (
            <li key={s.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 py-1.5 pl-1.5 ${selectedId === s.id ? "border-cyan-300 bg-cyan-400/10" : "border-transparent"}`}>
              <button type="button" aria-pressed={selectedId === s.id} onClick={() => onSelect(s.id)} title="Select as the calibration target"
                className="min-w-[6.5rem] flex-1 rounded px-1 py-0.5 text-left font-medium text-white hover:bg-white/5">
                {label}
              </button>
              <span className="flex w-[5.5rem] items-center gap-1.5">
                <span className={`led ${STATUS_LED[s.status]}`} aria-hidden="true" />
                <span className={s.status === "offline" ? "text-slate-300" : s.status === "low-battery" ? "text-amber-300" : "text-emerald-300"}>{statusText(s, d.reason)}</span>
              </span>
              <BatteryBar value={s.battery} />
              {hasSignal && <span className="w-10 tabular-nums text-slate-200">{s.signalPct === null || s.signalPct === undefined ? "n/a" : `${s.signalPct}%`}</span>}
              <button type="button" disabled={!canToggle} onClick={() => toggle(d)} aria-label={`${connectAction ? "Connect" : "Disconnect"} ${label}`} className={`${btn} w-[5.5rem]`}>
                {connectAction ? "Connect" : "Disconnect"}
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-[13px] text-cyan-200">{msg}</p>
      <p className="text-[12px] text-slate-400">
        Battery shows Unavailable when a sensor is disconnected or has no reading; 0% would be a real empty battery.
        {!hasSignal && " The demo fixtures provide no signal-strength value, so that column is not shown."}
        {" "}IMUs are on the {knee} knee used in this session.
      </p>
    </Panel>
  );
}

const STEP_FRAMES = 4; // 4 frames per tick = real time at the 20 Hz recording rate (200 ms ticks)
const TICK_MS = 200;

function PressurePanel({ details }: { details: SensorDetail[] }) {
  const { session } = useAstronaut();
  const playback = usePlayback();
  const systemReduced = useSystemReducedMotion();
  const prefs = useDisplayPrefs();
  const reduced = systemReduced || prefs.reduceMotion;
  const pa = getPressureAnalysis(session);
  const n = pa ? pa.frames.length : 0;
  const [cur, setCur] = useState<{ sid: string; idx: number } | null>(null);
  const animate = playback === "running" && !reduced && n > 0;
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setCur((c) => ({ sid: session.id, idx: ((c && c.sid === session.id ? c.idx : n - 1) + STEP_FRAMES) % n })), TICK_MS);
    return () => clearInterval(id);
  }, [animate, session.id, n]);

  const left = details.find((d) => d.sensor.site === "insole-left");
  const right = details.find((d) => d.sensor.site === "insole-right");
  const leftUp = !!left && !left.reason;
  const rightUp = !!right && !right.reason;
  const anyUp = leftUp || rightUp;
  const idx = pa ? (cur && cur.sid === session.id ? Math.min(cur.idx, n - 1) : n - 1) : 0;
  const frame = pa?.frames[idx];
  const state = !anyUp ? "Disconnected" : playback === "paused" ? "Paused" : "Live (simulated)";
  const led = !anyUp ? "led-off" : playback === "paused" ? "led-warn" : "";
  return (
    <Panel id="set-pressure" title="Pressure Stream Status" icon="foot" className="h-full">
      {!pa || !frame ? (
        <p className="text-sm text-amber-200">No pressure recording for {session.label}. Stream preview is Unavailable.</p>
      ) : (
        <div className="flex items-center gap-2">
          <PressureLegend className="h-36 w-12 shrink-0" />
          <Footprints left={leftUp ? sensorViews(frame, "left") : null} right={rightUp ? sensorViews(frame, "right") : null} className="h-36 w-32 shrink-0" />
          <dl className="min-w-0 flex-1 space-y-1 text-xs">
            <div><dt className="text-slate-400">Stream</dt><dd className="flex items-center gap-1.5 text-white" aria-live="polite"><span className={`led ${led}`} aria-hidden="true" />{state}</dd></div>
            <div><dt className="text-slate-400">Sample rate</dt><dd className="text-white">{session.pressureSpec ? `${session.pressureSpec.sampleRateHz} Hz` : "Not provided"}</dd></div>
            <div><dt className="text-slate-400">{animate ? "Sample time" : "Last sample"}</dt><dd className="tabular-nums text-white">t = {(frame.timestampMs / 1000).toFixed(2)} s</dd></div>
          </dl>
        </div>
      )}
      <ul className="mt-2 grid grid-cols-2 gap-x-3 text-[13px]">
        {([["Left insole", left, leftUp], ["Right insole", right, rightUp]] as const).map(([l, d, up]) => (
          <li key={l} className="flex items-center gap-1.5"><span className={`led ${up ? "" : "led-off"}`} aria-hidden="true" /><span className="text-slate-300">{l}:</span> <span className={up ? "text-emerald-300" : "text-slate-300"}>{d ? statusText(d.sensor, d.reason) : "Not assigned"}</span></li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-slate-400">
        Fixed 0&ndash;250 kPa scale, same as Load &amp; Pressure. Replays the selected session&rsquo;s recording{animate ? " in real time" : ""}; {reduced && playback === "running" ? "animation is off because motion is reduced. " : ""}latency and signal quality are not in the demo data, so they are not shown. A disconnected insole only affects this live view; the saved recording is unchanged.
      </p>
    </Panel>
  );
}

function CalibrationPanel({ details, selected, knee }: { details: SensorDetail[]; selected: SensorDetail | undefined; knee: "left" | "right" }) {
  const { astronaut } = useAstronaut();
  useCalibrationVersion();
  const pending = selected ? isCalibrating(astronaut.id, selected.sensor.id) : false;
  const anyPending = details.some((d) => isCalibrating(astronaut.id, d.sensor.id));
  const blocked = calibrationBlocked(selected, pending);
  const result = selected ? calibrationResult(astronaut.id, selected.sensor.id) : null;
  return (
    <Panel id="set-cal" title="Calibration" icon="check" className="h-full">
      <ul className="space-y-1 text-xs" aria-label="Calibration status by sensor">
        {details.map((d) => {
          const c = d.calibration;
          const busy = isCalibrating(astronaut.id, d.sensor.id);
          return (
            <li key={d.sensor.id} className={`flex flex-wrap items-center justify-between gap-x-2 rounded px-1 py-0.5 ${selected?.sensor.id === d.sensor.id ? "bg-cyan-400/10" : ""}`}>
              <span className="text-slate-200">{siteLabel(d.sensor, knee)}</span>
              <span className="flex items-center gap-1.5">
                <span className={`led ${busy ? "led-warn" : calLed(c.status)}`} aria-hidden="true" />
                <span className={busy ? "text-amber-300" : calTone(c.status)}>{busy ? "Calibrating…" : CAL_TEXT[c.status]}</span>
              </span>
              <span className="w-full text-[12px] text-slate-400">{c.at ? `Last calibrated ${fmtStamp(c.at)} (simulated)` : "Last calibration time: not provided"}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-cyan-400/15 pt-2">
        <p className="text-[13px] text-slate-300">Target sensor: <span className="font-medium text-white">{selected ? siteLabel(selected.sensor, knee) : "none"}</span> <span className="text-slate-500">(select a row in Sensor Configuration)</span></p>
        <button type="button" disabled={!!blocked} aria-disabled={!!blocked} onClick={() => selected && runCalibration(astronaut.id, selected.sensor.id)}
          className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-cyan-400/70 bg-cyan-500/20 px-3 py-1.5 text-sm text-white hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-45">
          {pending ? "Calibrating…" : "Run Calibration"}
        </button>
        <div role="status" aria-live="polite" className="mt-1.5 min-h-8 text-[13px]">
          {pending ? <span className="text-amber-200">Calibrating {selected ? siteLabel(selected.sensor, knee) : ""} (simulated, about {Math.round(CALIBRATION_MS / 1000)} s)…</span> : (
            <>
              {result && <span className={result.ok ? "text-emerald-300" : "text-amber-200"}>{result.message}{" "}<button type="button" onClick={() => selected && clearCalibrationResult(astronaut.id, selected.sensor.id)} className="text-cyan-300 underline">Dismiss</button></span>}
              {blocked && !anyPending && <span className="block text-amber-200">{blocked}</span>}
            </>
          )}
        </div>
        <p className="text-[12px] text-slate-400">Simulated. Updates the status and time above only; stored readings and assessment scores do not change.</p>
      </div>
    </Panel>
  );
}

function ConnectivityPanel({ details }: { details: SensorDetail[] }) {
  const { astronaut, mission, hubConnected } = useAstronaut();
  const reachable = details.filter((d) => !d.reason).length;
  const [msg, setMsg] = useState("");
  return (
    <Panel id="set-conn" title="Connectivity" icon="pulse" className="h-full">
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Hub ID</dt><dd className="text-white">{mission.hubId} <span className="text-slate-500">&middot; simulated</span></dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Data link</dt><dd className="flex items-center gap-1.5" aria-live="polite"><span className={`led ${hubConnected ? "" : "led-off"}`} aria-hidden="true" /><span className={hubConnected ? "text-emerald-300" : "text-slate-300"}>{hubConnected ? "Connected" : "Disconnected"} (simulated)</span></dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Sensors reachable</dt><dd className="text-white">{reachable} of {details.length}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-400">Mission comms</dt><dd className="text-white capitalize">{mission.commsStatus} <span className="text-slate-500">(fixture)</span></dd></div>
      </dl>
      <button type="button" className={`${btn} mt-2 w-fit`} onClick={() => { connectHub(astronaut.id, !hubConnected); setMsg(`Hub ${hubConnected ? "disconnected" : "connected"} (simulated).`); }}>
        {hubConnected ? "Disconnect hub" : "Connect hub"}
      </button>
      <p role="status" aria-live="polite" className="mt-1.5 min-h-4 text-[13px] text-cyan-200">{msg}</p>
      <p className="text-[12px] text-slate-400">Uplink, downlink, packet-loss and latency values are not in the demo fixtures, so none are shown. Disconnecting the hub takes {astronaut.profile.displayName}&rsquo;s sensors offline in the live status everywhere; saved sessions stay available.</p>
    </Panel>
  );
}

function SystemPanel() {
  const { astronaut, session, selectSession, resetSession } = useAstronaut();
  const playback = usePlayback();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) confirmRef.current?.focus(); }, [confirming]);
  const sessions = [...astronaut.sessions].reverse();
  const running = playback === "running";
  const hasRecording = !!session.pressureSpec;
  return (
    <Panel id="set-system" title="System & Demo Controls" icon="timeline" className="h-full">
      <div className="space-y-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Scenario (session replayed on every page)</span>
          <select value={session.id} onChange={(e) => { selectSession(e.target.value); setNote(""); }} className="rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-1 text-white">
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <p className="text-[13px] text-slate-300">Selected: <span className="text-white">{session.label}</span> &middot; Day {session.missionDay}, {session.startedAt} &middot; {session.scenarioEvents.length} seeded event{session.scenarioEvents.length === 1 ? "" : "s"} &middot; {hasRecording ? "pressure recording available" : "no pressure recording"}</p>
        <p className="flex items-center gap-1.5 text-white" aria-live="polite"><span className={`led ${running ? "" : "led-warn"}`} aria-hidden="true" />Playback: {running ? "Running" : "Paused"} <span className="text-slate-500">(simulated)</span></p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={running} onClick={() => setPlayback("running")}>{"Start / Resume"}</button>
          <button type="button" className={btn} disabled={!running} onClick={() => setPlayback("paused")}>Pause</button>
          <button type="button" ref={resetRef} className={btn} onClick={() => { setConfirming(true); setNote(""); }} aria-expanded={confirming}>Reset Demo</button>
        </div>
        {confirming && (
          <div role="alertdialog" aria-labelledby="reset-title" aria-describedby="reset-desc" className="rounded-md border border-amber-300/50 bg-amber-300/10 p-2">
            <p id="reset-title" className="font-semibold text-amber-100">Reset the demo?</p>
            <div id="reset-desc" className="mt-1 space-y-1 text-[13px] text-slate-200">
              <p><span className="text-amber-200">Clears:</span> playback (back to Running), the selected scenario (back to the latest session), and all simulated sensor connection, hub and calibration changes for every astronaut.</p>
              <p><span className="text-emerald-300">Keeps:</span> rehab completion, alert history (seen findings), patient notes, saved reports and display preferences.</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" ref={confirmRef} className={btn} onClick={() => { resetDemoState(); resetSession(); setConfirming(false); setNote("Demo reset. Playback, scenario and simulated sensor changes were cleared."); resetRef.current?.focus(); }}>Confirm reset</button>
              <button type="button" className={btn} onClick={() => { setConfirming(false); resetRef.current?.focus(); }}>Cancel</button>
            </div>
          </div>
        )}
        <p role="status" aria-live="polite" className="min-h-4 text-[13px] text-cyan-200">{note}</p>
      </div>
    </Panel>
  );
}

function DisplayPanel({ assets }: { assets: Assets }) {
  const prefs = useDisplayPrefs();
  const systemReduced = useSystemReducedMotion();
  const wide = useWideScreen();
  const reduced = systemReduced || prefs.reduceMotion;
  const mode = backdropMode({ hasVideo: !!assets.videoSrc, hasPoster: assets.hasPoster, prefVideo: prefs.backgroundVideo, reducedMotion: reduced, wide, failed: false });
  const why = !assets.videoSrc ? "no video file found" : !prefs.backgroundVideo ? "background video is off" : reduced ? "reduced motion is on" : !wide ? "narrow screen" : "";
  return (
    <Panel id="set-display" title="Display Settings" icon="chart" className="relative h-full overflow-hidden">
      <div className="relative z-10 space-y-2 text-xs sm:pr-24">
        <div className="flex items-center justify-between gap-3">
          <span><span className="text-white">Reduce motion</span><span id="rm-hint" className="block text-[12px] text-slate-400">{systemReduced ? "Your system already asks for reduced motion, so it stays on." : "Stops animation and the background video."}</span></span>
          <Switch checked={prefs.reduceMotion || systemReduced} disabled={systemReduced} label="Reduce motion" describedBy="rm-hint" onChange={(v) => patchDisplay({ reduceMotion: v })} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span><span className="text-white">Background video</span><span id="bv-hint" className="block text-[12px] text-slate-400">Shared space loop behind every page.</span></span>
          <Switch checked={prefs.backgroundVideo} label="Background video" describedBy="bv-hint" onChange={(v) => patchDisplay({ backgroundVideo: v })} />
        </div>
        <p role="status" aria-live="polite" className="rounded border border-cyan-400/20 bg-black/20 px-2 py-1 text-[13px] text-slate-200">
          Backdrop now: <span className="text-white">{mode === "video" ? "video" : mode === "poster" ? "poster image" : "CSS starfield"}</span>{why && mode !== "video" ? <span className="text-slate-400"> ({why})</span> : null}
        </p>
        <p className="text-[12px] text-slate-400">Saved in this browser. No 3D or heatmap switch is offered because no page has a view for it to control. Reset Demo does not change these.</p>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1 hidden h-28 w-20 opacity-80 sm:block">
        <AstronautImage className="h-full w-full" label="" />
      </div>
    </Panel>
  );
}
