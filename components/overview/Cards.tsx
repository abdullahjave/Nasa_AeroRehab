import Panel, { Chip, Stat } from "@/components/ui/Panel";
import GaugeRing from "@/components/ui/GaugeRing";
import Footprints, { PressureLegend } from "@/components/graphics/Footprints";
import WalkingFigure from "@/components/graphics/WalkingFigure";
import AstronautImage from "@/components/graphics/AstronautImage";
import { fmt, fmtSigned } from "@/lib/format";
import { peakPressure } from "@/lib/demo";
import type { AstronautRecord, Insight, Mission, OverviewMetrics, Session } from "@/lib/demo";

const CYAN = "#22d3ee";
const GREEN = "#34d399";

const kisLabel = (v: number | null) => (v === null ? null : v >= 90 ? "Excellent" : v >= 80 ? "Good" : "Fair");
const readinessLabel = (v: number | null) => (v === null ? null : v >= 90 ? "Ready" : v >= 80 ? "Nearly ready" : "Limited");
const balanceLabel = (v: number | null) => (v === null ? null : v >= 85 ? "Stable" : v >= 70 ? "Moderate" : "Unstable");

export function ProfileCard({ a, mission }: { a: AstronautRecord; mission: Mission }) {
  const p = a.profile;
  return (
    <Panel id="profile" title="Astronaut Profile" icon="user" className="h-full">
      <div className="flex items-stretch gap-3">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#0c2347] to-[#050d1f] ring-1 ring-cyan-400/30"><AstronautImage className="h-full w-full" label={`${p.displayName}: astronaut portrait (render of the supplied 3D model, not a photo of the person)`} /></div>
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
      <div className="flex flex-1 items-center gap-3">
        <GaugeRing value={o.readinessPct} max={100} color={GREEN} ariaLabel={`Mission readiness ${o.readinessPct} percent`} size="h-24 w-24" />
        <div>
          {o.readinessPct === null ? <p className="text-sm text-amber-200">Unavailable</p> : (
            <p className="text-3xl font-semibold tabular-nums text-white">{o.readinessPct}%</p>
          )}
          {label && <Chip>{label}</Chip>}
        </div>
      </div>
    </Panel>
  );
}

export function BaselineCard({ o }: { o: OverviewMetrics }) {
  const d = o.baselineDeviationPct;
  const within = d !== null && Math.abs(d) <= 5;
  return (
    <Panel id="baseline" title="Baseline Deviation" className="h-full">
      {d === null ? (
        <p className="text-sm text-amber-200">Unavailable</p>
      ) : (
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${within ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-300/20 text-amber-200"}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={within ? "M5 13l4 4 10-10" : "M12 6v8M12 18v.5"} /></svg>
          </span>
          <div>
            <p className={`text-base font-semibold ${within ? "text-emerald-300" : "text-amber-200"}`}>{within ? "Within Baseline" : "Outside Baseline"}</p>
            <p className="text-xs text-slate-300">{fmtSigned(d, "%", 1)} vs personal baseline (limit &plusmn;5%)</p>
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

export function RehabStatusCard({ o }: { o: OverviewMetrics }) {
  const r = o.rehab;
  return (
    <Panel id="rehab" title="Rehabilitation Status" href="/rehabilitation" linkLabel="Plan" className="h-full">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 20h16M7 20V12M12 20V6M17 20v-5" /></svg>
        <div>
          <p className="text-base font-semibold text-emerald-300">{r.progressPct === null ? "Unavailable" : r.statusLabel}</p>
          <p className="text-[11px] text-slate-300">{r.deltaVsLastPct === null ? "" : `${fmtSigned(r.deltaVsLastPct, "%", 0)} vs last session`} &middot; {fmt(r.progressPct, "%")} complete</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-700/60" role="img" aria-label={`Rehab ${r.progressPct} percent complete`}>
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${r.progressPct ?? 0}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{r.phase} &middot; Week {r.week}/{r.totalWeeks}</p>
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
          <WalkingFigure p={5} scale={g.curveScale} className="h-full min-h-[18rem] w-44" ariaLabel={`Walking figure for ${a.profile.displayName}`} />
        </div>
      )}
    </Panel>
  );
}

export function PressureCard({ s }: { s: Session }) {
  const p = s.pressure;
  const l = s.loadSplit;
  const peaks = p ? [peakPressure(p.left), peakPressure(p.right)].filter((v): v is number => v !== null) : [];
  const peak = peaks.length ? Math.max(...peaks) : null;
  return (
    <Panel id="pressure" title="Load & Pressure" icon="foot" href="/load-pressure" linkLabel="Load details" className="h-full">
      <div className="flex flex-1 items-center gap-2">
        <PressureLegend className="h-44 w-12 shrink-0" />
        <Footprints left={p?.left ?? null} right={p?.right ?? null} className="h-44 w-36 shrink-0" />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-[11px] text-slate-300">Weight Distribution</p>
            {l === null ? <p className="text-sm text-amber-200">Unavailable</p> : (
              <p className="text-lg font-semibold tabular-nums text-white">{l.leftPct}% <span className="text-[11px] font-normal text-slate-400">Left</span> &nbsp;{l.rightPct}% <span className="text-[11px] font-normal text-slate-400">Right</span></p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-slate-300">Peak Pressure</p>
            <p className={`font-semibold tabular-nums ${peak === null ? "text-sm text-amber-200" : "text-xl text-white"}`}>{peak === null ? "Unavailable" : <>{peak} <span className="text-xs font-normal text-slate-300">kPa</span></>}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

const RADAR_LABELS = ["Forward", "Backward", "Right", "Lateral", "Left"]; // clockwise from top
const RADAR_INDEX = [0, 1, 3, 4, 2]; // into balanceAxes [forward, backward, left, right, lateral]

export function BalanceCard({ s }: { s: Session }) {
  const b = s.balanceIndex;
  const axes = s.balanceAxes;
  const cx = 88;
  const cy = 66;
  const R = 46;
  const pt = (i: number, f: number) => {
    const ang = ((-90 + i * 72) * Math.PI) / 180;
    return [cx + R * f * Math.cos(ang), cy + R * f * Math.sin(ang)] as const;
  };
  const ring = (f: number) => [0, 1, 2, 3, 4].map((i) => pt(i, f).join(",")).join(" ");
  const label = balanceLabel(b);
  return (
    <Panel id="balance" title="Stability & Balance" icon="balance" href="/stability-balance" linkLabel="Stability" className="h-full">
      <div className="flex flex-1 items-center gap-3">
        <svg viewBox="0 0 176 132" className="h-32 w-44 shrink-0" role="img" aria-label={axes ? "Balance radar chart" : "Balance radar unavailable"}>
          {[0.33, 0.66, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="rgba(148,163,184,0.3)" />)}
          {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="rgba(148,163,184,0.25)" />)}
          {axes && (
            <polygon points={[0, 1, 2, 3, 4].map((i) => pt(i, axes[RADAR_INDEX[i]] / 100).join(",")).join(" ")} fill="rgba(34,211,238,0.25)" stroke={CYAN} strokeWidth="1.8" />
          )}
          {RADAR_LABELS.map((t, i) => {
            const [x, y] = pt(i, 1.25);
            return <text key={t} x={x} y={y + 3} textAnchor={i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end"} fontSize="8.5" fill="#cbd5e1">{t}</text>;
          })}
          {!axes && <text x={cx} y={cy + 3} textAnchor="middle" fontSize="10" fill="#fde68a">Unavailable</text>}
        </svg>
        <div>
          <p className="text-[11px] text-slate-300">Balance Index</p>
          {b === null ? <p className="text-sm text-amber-200">Unavailable</p> : (
            <p className="text-3xl font-semibold tabular-nums text-white">{b}<span className="ml-1 text-sm font-normal text-slate-300">/100</span></p>
          )}
          {label ? <Chip>{label}</Chip> : <p className="text-[11px] text-slate-400">Not calibrated</p>}
        </div>
      </div>
    </Panel>
  );
}

export function InsightCard({ insight, session }: { insight: Insight; session: Session | undefined }) {
  const watch = insight.severity === "watch";
  return (
    <Panel id="insight" title="AI Health Insights" icon="brain" href="/ai-insights" linkLabel="AI insights" className="h-full">
      <div className={`flex-1 rounded-md border p-3 ${watch ? "border-amber-300/70 bg-amber-300/5" : "border-cyan-300/50 bg-cyan-300/5"}`}>
        <div className="flex items-start gap-2">
          <svg viewBox="0 0 24 24" className={`mt-0.5 h-5 w-5 shrink-0 ${watch ? "text-amber-300" : "text-cyan-300"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={watch ? "M12 3l10 18H2zM12 10v5M12 18v.5" : "M5 13l4 4 10-10"} />
          </svg>
          <div>
            <p className={`text-sm font-semibold ${watch ? "text-amber-200" : "text-cyan-200"}`}>{insight.title}</p>
            <p className="mt-0.5 text-xs text-slate-200">{insight.body}</p>
            {insight.recommendation && <p className="mt-1.5 text-xs text-slate-300"><span className="text-amber-200">Recommendation: </span>{insight.recommendation}</p>}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Simulated &middot; {insight.generatedAt}{session ? ` · from ${session.id}` : ""}</p>
      </div>
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
