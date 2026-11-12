"use client";

import { useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip } from "@/components/ui/Panel";
import GaugeRing from "@/components/ui/GaugeRing";
import { REASON_LABEL, balanceView, type BMetric } from "@/lib/balance";

const show = (m: BMetric<number>, unit: string, d = 1) => (m.kind === "value" ? `${m.value.toFixed(d)} ${unit}` : `Unavailable`);

/** Overview balance preview. Same selector (balanceView) and the same shared trial side as Stability & Balance. */
export default function OverviewBalance() {
  const { astronaut, session, balanceSide } = useAstronaut();
  const v = useMemo(() => balanceView(astronaut, session, balanceSide), [astronaut, session, balanceSide]);
  const s = v.summary;
  const area: BMetric<number> = !s ? { kind: "unavailable", reason: "no-trial" } : s.ellipse.kind === "value" ? { kind: "value", value: s.ellipse.value.areaMm2 } : s.ellipse;
  const side = balanceSide === "left" ? "Left" : "Right";
  return (
    <Panel id="balance" title="Stability & Balance" icon="balance" href="/stability-balance" linkLabel={`${side}-leg view`} className="h-full">
      <div className="flex flex-1 items-center gap-3">
        <GaugeRing value={v.fixtures?.index ?? null} max={100} color="#34d399" size="h-20 w-20" ariaLabel={`Balance Index ${v.fixtures?.index} out of 100`} />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] text-slate-300">Balance Index (demo)</p>
          {v.fixtures?.index != null ? <p className="text-2xl font-semibold tabular-nums text-white">{v.fixtures.index}<span className="ml-1 text-sm font-normal text-slate-300">/100</span></p> : <p className="text-sm font-semibold text-amber-200">Unavailable</p>}
          {v.fixtures && <Chip tone={v.fixtures.index != null ? "green" : "amber"}>{v.fixtures.indexStatus}</Chip>}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-slate-400">{side}-leg sway area (95%)</dt><dd className={area.kind === "value" ? "tabular-nums text-white" : "text-amber-200"}>{show(area, "mm²")}</dd></div>
        <div><dt className="text-slate-400">Resultant sway RMS</dt><dd className={s?.rmsResultantMm.kind === "value" ? "tabular-nums text-white" : "text-amber-200"}>{s ? show(s.rmsResultantMm, "mm", 1) : "Unavailable"}</dd></div>
      </dl>
      <p className="mt-1 text-[12px] text-slate-400">
        {v.trial ? `Full trial, ${v.trial.durationS.toFixed(1)} s` : REASON_LABEL["no-trial"]}
        {s?.partial ? ` · ${Math.round(s.coverage * 100)}% coverage` : ""} &middot; Simulated
      </p>
    </Panel>
  );
}
