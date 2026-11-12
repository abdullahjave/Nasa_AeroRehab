"use client";

import { useMemo, useState } from "react";
import Panel from "@/components/ui/Panel";
import Footprints, { PressureLegend, peakSensorViews, sensorViews } from "@/components/graphics/Footprints";
import { REASON_TEXT, getPressureAnalysis, show, toneClass, valueOf } from "@/lib/pressure";
import type { Session } from "@/lib/demo";

type Scope = "latest" | "peak";

/** Overview pressure preview. Same derived metrics as Load & Pressure; the scope is always labelled. */
export default function OverviewPressure({ session }: { session: Session }) {
  const [scope, setScope] = useState<Scope>("latest");
  const pa = useMemo(() => getPressureAnalysis(session), [session]);

  const controls = (
    <div role="group" aria-label="Pressure scope" className="flex overflow-hidden rounded-md border border-cyan-400/40">
      {([["latest", "Latest sample"], ["peak", "Session peak"]] as const).map(([k, l]) => (
        <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)}
          className={`px-2 py-0.5 text-[13px] ${scope === k ? "bg-cyan-400/25 text-white" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
      ))}
    </div>
  );

  if (!pa) {
    return (
      <Panel id="pressure" title="Load & Pressure" icon="foot" href="/load-pressure" linkLabel="Load details" className="h-full">
        <p className="text-sm font-semibold text-amber-200">Unavailable</p>
        <p className="mt-1 text-xs text-slate-300">No pressure recording for {session.label}.</p>
      </Panel>
    );
  }

  const last = pa.analyses[pa.analyses.length - 1];
  const lastFrame = pa.frames[pa.frames.length - 1];
  const isLatest = scope === "latest";
  const leftViews = isLatest ? sensorViews(lastFrame, "left") : peakSensorViews(pa.frames, "left");
  const rightViews = isLatest ? sensorViews(lastFrame, "right") : peakSensorViews(pa.frames, "right");

  const shares = isLatest ? last.shares : pa.session.meanShares;
  const peak = isLatest ? last.peakKpa : pa.session.peakKpa.overall;
  const sharesShown = valueOf(shares);
  const peakShown = show(peak, "kPa");
  const perFootPeak = isLatest ? { l: last.left.peakKpa, r: last.right.peakKpa } : { l: pa.session.peakKpa.left, r: pa.session.peakKpa.right };
  const scopeLabel = isLatest ? `Latest sample, t = ${(last.timestampMs / 1000).toFixed(2)} s` : `Session peak, ${(pa.durationMs / 1000).toFixed(0)} s recording`;

  return (
    <Panel id="pressure" title="Load & Pressure" icon="foot" href="/load-pressure" linkLabel="Load details" action={controls} className="h-full">
      <p className="mb-1 text-[12px] text-slate-400">{scopeLabel} &middot; Simulated data</p>
      <div className="flex flex-1 items-center gap-2">
        <PressureLegend className="h-44 w-12 shrink-0" />
        <Footprints left={leftViews} right={rightViews} className="h-44 w-40 shrink-0" />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-[13px] text-slate-300">{isLatest ? "Weight Distribution" : "Weight Distribution (session mean)"}</p>
            {sharesShown ? (
              <p className="text-lg font-semibold tabular-nums text-white">{sharesShown.leftPct.toFixed(0)}% <span className="text-[13px] font-normal text-slate-400">Left</span> &nbsp;{sharesShown.rightPct.toFixed(0)}% <span className="text-[13px] font-normal text-slate-400">Right</span></p>
            ) : (
              <p className={`text-sm font-semibold ${toneClass(shares.kind === "unavailable" && shares.reason === "zero-load" ? "no-load" : "unavailable")}`}>
                {shares.kind === "unavailable" && shares.reason === "zero-load" ? "No load" : "Unavailable"}
                <span className="block text-[12px] font-normal text-slate-400">{shares.kind === "unavailable" ? REASON_TEXT[shares.reason] : ""}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-[13px] text-slate-300">{isLatest ? "Peak Pressure" : "Peak Pressure (session)"}</p>
            <p className={`font-semibold tabular-nums ${peakShown.tone === "value" ? "text-xl" : "text-sm"} ${toneClass(peakShown.tone)}`}>{peakShown.text}</p>
            {peak.kind === "unavailable" ? (
              <p className="text-[12px] text-slate-400">
                L {show(perFootPeak.l, "kPa").text} &middot; R {show(perFootPeak.r, "kPa").text}
              </p>
            ) : (
              <p className="text-[12px] text-slate-400">L {show(perFootPeak.l, "kPa").text} &middot; R {show(perFootPeak.r, "kPa").text}</p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
