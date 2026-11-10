import Panel, { Chip, Stat } from "@/components/ui/Panel";
import GaugeRing from "@/components/ui/GaugeRing";
import WalkingFigure from "@/components/graphics/WalkingFigure";
import PhotoPose from "@/components/graphics/PhotoPose";
import AstronautImage from "@/components/graphics/AstronautImage";
import CrewPortrait from "@/components/graphics/CrewPortrait";
import { fmt, fmtSigned } from "@/lib/format";
import { REDUCED_ROM_DEMO } from "@/lib/insights/config";
import type { InsightView } from "@/lib/insights";
import type { AstronautRecord, Mission, OverviewMetrics, Session } from "@/lib/demo";

const CYAN = "#22d3ee";
const GREEN = "#34d399";

const kisLabel = (v: number | null) => (v === null ? null : v >= 90 ? "Excellent" : v >= 80 ? "Good" : "Fair");
const readinessLabel = (v: number | null) => (v === null ? null : v >= 90 ? "Ready" : v >= 80 ? "Nearly ready" : "Limited");

export function ProfileCard({ a, mission }: { a: AstronautRecord; mission: Mission }) {
  const p = a.profile;
  return (
    <Panel id="profile" title="Astronaut Profile" icon="user" className="h-full">
      <div className="flex items-stretch gap-3">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#0c2347] to-[#050d1f] ring-1 ring-cyan-400/30"><CrewPortrait profile={p} className="h-full w-full text-3xl" /></div>
        <dl className="min-w-0 space-y-1 text-xs">
          <div className="flex gap-1"><dt className="text-slate-400">ID:</dt><dd className="text-white">{p.crewCode}</dd></div>
          <div className="flex gap-1"><dt className="text-slate-400">Role:</dt><dd className="text-white">{p.role}</dd></div>
          <div className="flex gap-1"><dt className="text-slate-400">Mission:</dt><dd className="text-white">{mission.name}</dd></div>
          <div className="flex items-center gap-1"><dt className="text-slate-400">Status:</dt><dd className="flex items-center gap-1 text-white"><span className="led" aria-hidden="true" />{p.status}</dd></div>
          <div className="truncate text-slate-300" title={p.rehabFocus}>{p.rehabFocus}</div>
        </dl>
      </div>
    </Panel>
  );
}

export function KisCard({ o }: { o: OverviewMetrics }) {
  const label = kisLabel(o.kis);
  return (
    <Panel id="kis" title="Knee Integrity Score (KIS)" className="h-full">
      <div className="flex flex-1 items-center gap-3">
        <GaugeRing value={o.kis} max={o.kisMax} color={GREEN} ariaLabel={`KIS ${o.kis} out of ${o.kisMax}`} size="h-24 w-24" />
        <div>
          {o.kis === null ? <p className="text-sm text-amber-200">Unavailable</p> : (
            <p className="text-3xl font-semibold tabular-nums text-white">{o.kis}<span className="ml-1 text-sm font-normal text-slate-300">/{o.kisMax}</span></p>
          )}
          {label && <Chip>{label}</Chip>}
        </div>
      </div>
    </Panel>
  );
}

export function ReadinessCard({ o }: { o: OverviewMetrics }) {
  const label = readinessLabel(o.readinessPct);
  return (
    <Panel id="readiness" title="Mission Readiness" className="h-full">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <GaugeRing value={o.readinessPct} max={100} color={GREEN} ariaLabel={`Mission readiness ${o.readinessPct} percent`} size="h-20 w-20" />
        <div className="min-w-0">
          {o.readinessPct === null ? <p className="text-sm text-amber-200">Unavailable</p> : (
            <p className="text-2xl font-semibold tabular-nums text-white">{o.readinessPct}%</p>
          )}
          {label && <Chip>{label}</Chip>}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Baseline deviation = the same ROM comparison that AI Insights and Joint Analytics use (insightView), for the shown
 * session. It is only available when the baseline matches the session's knee side and protocol.
 */
export function BaselineCard({ view }: { view: InsightView }) {
  const rom = view.rom;
  const has = rom.pct.kind === "value" && rom.baseline.kind === "value" && rom.current.kind === "value";
  const limit = Math.abs(REDUCED_ROM_DEMO.thresholdPct);
  const within = has && Math.abs((rom.pct as { value: number }).value) <= limit;
  return (
    <Panel id="baseline" title="Baseline Deviation" className="h-full">
      {!has ? (
        <>
          <p className="text-sm text-amber-200">Unavailable</p>
          <p className="text-[11px] text-slate-300">No baseline recorded for this session&rsquo;s knee side and protocol, so no comparison is made.</p>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${within ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-300/20 text-amber-200"}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={within ? "M5 13l4 4 10-10" : "M12 6v8M12 18v.5"} /></svg>
          </span>
          <div>
            <p className={`text-base font-semibold ${within ? "text-emerald-300" : "text-amber-200"}`}>{within ? "Within Baseline" : "Outside Baseline"}</p>
            <p className="text-xs text-slate-300">ROM {fmtSigned((rom.pct as { value: number }).value, "%", 1)} vs Day {view.baselineDay} baseline (limit &plusmn;{limit}%, demo)</p>
            <p className="text-[10px] text-slate-400">{fmt((rom.current as { value: number }).value, "°")} now vs {fmt((rom.baseline as { value: number }).value, "°")} baseline &middot; {view.context.side} knee</p>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function ActivityCard({ o }: { o: OverviewMetrics }) {
  const a = o.dailyActivity;
  const max = Math.max(...a.hourly);
  return (
    <Panel id="activity" title="Daily Activity" className="h-full">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 20l2-6-3-3 2-5 4 3 3 1M12 14l4 6" /></svg>
        <div>
          <p className={`font-semibold tabular-nums ${a.distanceKm === null ? "text-sm text-amber-200" : "text-xl text-white"}`}>{a.distanceKm === null ? "Unavailable" : `${a.distanceKm} km`}</p>
          <p className="text-[11px] text-slate-300">{a.steps === null ? "Steps unavailable" : `${(a.steps / 1000).toFixed(1)}k steps`} &middot; goal {(a.stepGoal / 1000).toFixed(0)}k</p>
        </div>
      </div>
      <svg viewBox="0 0 120 26" className="mt-1 h-6 w-full" role="img" aria-label="Hourly activity, last 12 hours">
        {a.hourly.map((h, i) => (
          <rect key={i} x={i * 10 + 1} y={26 - (h / max) * 24} width="7" height={(h / max) * 24} rx="1.5" fill={CYAN} opacity="0.75" />
        ))}
      </svg>
    </Panel>
  );
}

export function GaitPreviewCard({ a, s }: { a: AstronautRecord; s: Session }) {
  const g = s.gait;
  return (
    <Panel id="gait" title="Gait Analysis" icon="walk" href="/gait-analysis" linkLabel="Gait analysis" className="h-full">
      {g === null ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-cyan-400/30 p-4 text-center">
          <p className="text-sm font-semibold text-amber-200">No gait data</p>
          <p className="mt-1 text-xs text-slate-300">{s.label} has no walking recording.</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[1fr_auto] gap-2">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-slate-300">Walking Speed</p>
              <p className="text-2xl font-semibold tabular-nums text-white">
                {g.speedMs === null ? <span className="text-sm text-amber-200">Unavailable</span> : <>{g.speedMs.toFixed(2)} <span className="text-sm font-normal text-slate-300">m/s</span></>}
                {g.speedDeltaPct !== null && <span className={`ml-2 text-xs ${g.speedDeltaPct >= 0 ? "text-emerald-300" : "text-amber-300"}`}>{g.speedDeltaPct >= 0 ? "↑" : "↓"} {fmtSigned(g.speedDeltaPct, "%", 0)}</span>}
              </p>
            </div>
            <Stat label="Cadence" value={g.cadenceSpm} unit="steps/min" />
            <Stat label="Stride Length" value={g.strideLengthM} digits={2} unit="m" />
          </div>
          <PhotoPose src="/images/gait-walk-overview.webp" alt="Walking pose illustration (toe-off, supplied artwork; not live data)" className="h-full min-h-[18rem] w-44" blend={false}
            fallback={<WalkingFigure p={5} scale={g.curveScale} className="h-full min-h-[18rem] w-44" ariaLabel={`Walking figure for ${a.profile.displayName}`} />} />
        </div>
      )}
    </Panel>
  );
}

export function MissionStatusCard({ mission, a }: { mission: Mission; a: AstronautRecord }) {
  const pct = Math.round((mission.day / mission.totalDays) * 100);
  const nominal = mission.commsStatus === "nominal";
  return (
    <Panel id="mission" title="Astronaut Status" icon="user" className="h-full overflow-hidden">
      <div className="relative flex flex-1 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${nominal ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-300/20 text-amber-200"}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-10" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-emerald-300">{nominal ? "Systems Nominal" : "Comms Degraded"}</p>
          <p className="text-xs text-slate-200">Mobility &amp; rehabilitation on schedule.</p>
          <p className="mt-1 text-[11px] text-slate-400">{a.profile.displayName} &middot; {mission.name} &middot; Day {mission.day} of {mission.totalDays}</p>
          <div className="mt-1 h-1.5 max-w-[14rem] rounded-full bg-slate-700/60" role="img" aria-label={`Mission day ${mission.day} of ${mission.totalDays}`}>
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Crew online {mission.crewOnline}/{mission.crewTotal} &middot; Next check-in {mission.nextCheckIn}</p>
        </div>
        <div className="relative hidden h-28 w-36 shrink-0 overflow-hidden rounded-md sm:block" style={{ background: "radial-gradient(ellipse 120% 70% at 85% 115%, #1e6fd9 0%, #0b2a66 45%, transparent 70%)" }}><AstronautImage className="h-full w-full" earth label="Astronaut (render of the supplied 3D model)" /></div>
      </div>
    </Panel>
  );
}
