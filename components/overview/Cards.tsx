import Panel, { Stat } from "@/components/ui/Panel";
import WalkingFigure from "@/components/graphics/WalkingFigure";
import PhotoPose from "@/components/graphics/PhotoPose";
import { fmtSigned } from "@/lib/format";
import type { AstronautRecord, Session } from "@/lib/demo";

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
