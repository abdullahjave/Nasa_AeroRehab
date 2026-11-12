"use client";

import { useState } from "react";
import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import SessionPicker from "@/components/ui/SessionPicker";
import CrewPortrait from "@/components/graphics/CrewPortrait";
import YourStatusCard from "@/components/alerts/YourStatusCard";
import TodaysTasksCard from "@/components/alerts/TodaysTasksCard";
import KneeCard from "./KneeCard";
import MeasurementRows from "./MeasurementRows";
import OverviewPressure from "@/components/pressure/OverviewPressure";
import OverviewBalance from "@/components/balance/OverviewBalance";
import TrendCard from "./TrendCard";
import { GaitPreviewCard } from "./Cards";
import RecordedTrend from "@/components/recorded/RecordedTrend";

/** Measurement details start collapsed at every screen width; the reader opens them on purpose. */
function Details({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="details-title" className="space-y-3">
      <h2 id="details-title" className="text-[13px] font-semibold text-white">
        <button type="button" aria-expanded={open} aria-controls="measurement-details" onClick={() => setOpen(!open)}
          className="glass flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-white/5">
          <span>Measurement details <span className="font-normal text-slate-400">&middot; summary rows, charts, gait, pressure, balance and trends</span></span>
          <span aria-hidden="true" className={`shrink-0 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`}>&#9662;</span>
        </button>
      </h2>
      {open && <div id="measurement-details" className="space-y-3">{children}</div>}
    </section>
  );
}

/**
 * Overview in one reading order on every screen size: context header, Your Status, Today's Tasks, then the collapsed
 * Measurement details. A reader can name their status, next action and task progress without opening a graph.
 */
export default function OverviewDashboard() {
  const { astronaut, mission, session, dataMode, recordedStatus, refreshRecorded } = useAstronaut();
  const recorded = dataMode === "recorded";
  const p = astronaut.profile;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-11 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#0c2347] to-[#050d1f] ring-1 ring-cyan-400/30"><CrewPortrait profile={p} className="h-full w-full text-lg" /></div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">Overview</h1>
            <p className="text-sm text-slate-200">{p.displayName} &middot; {p.role}</p>
            <p className="text-sm text-slate-300">Mission <strong className="text-white">{mission.name}</strong> &middot; Day {mission.day} of {mission.totalDays}</p>
            <p className="text-xs text-slate-400">{recorded ? "Recorded Data (local database)" : "Simulated Data"}</p>
          </div>
        </div>
        {recorded && recordedStatus !== "ready" ? (
          <div className="text-sm text-slate-300" role="status">
            {recordedStatus === "error" ? (
              <>Could not load recorded readings. <button type="button" onClick={refreshRecorded} className="text-cyan-200 underline">Retry</button></>
            ) : "Loading recorded readings…"}
          </div>
        ) : recorded && session.recorded?.empty ? (
          <p className="text-sm text-slate-300">No knee session saved. <Link href="/patient-management" className="text-cyan-200 underline">Add a session</Link></p>
        ) : <SessionPicker />}
      </header>

      <YourStatusCard />
      <TodaysTasksCard />

      <Details>
        <MeasurementRows />
        {recorded ? (
          <>
            <RecordedTrend id="ov-rec-trend" />
            <section className="glass rounded-lg p-3" aria-label="Sensor readings">
              <h3 className="text-sm font-semibold text-white">Sensor playback</h3>
              <p className="mt-1 text-sm text-slate-300">
                Open the recorded <Link href="/load-pressure" className="text-cyan-200 underline">pressure assessment</Link> or <Link href="/stability-balance" className="text-cyan-200 underline">balance trial</Link> to play its imported samples. Manual knee and walking entries show their recorded summaries.
              </p>
            </section>
          </>
        ) : (
          <>
            <KneeCard astronaut={astronaut} session={session} />
            <div className="grid gap-3 md:grid-cols-2">
              <GaitPreviewCard a={astronaut} s={session} />
              <OverviewPressure session={session} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <OverviewBalance />
              <TrendCard trend={astronaut.trend} />
            </div>
          </>
        )}
      </Details>
    </div>
  );
}
