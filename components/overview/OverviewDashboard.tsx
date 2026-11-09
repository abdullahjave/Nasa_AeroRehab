"use client";

import { useAstronaut } from "@/components/AstronautProvider";
import SessionPicker from "@/components/ui/SessionPicker";
import { getLatestInsight } from "@/lib/demo";
import KneeCard from "./KneeCard";
import TrendCard from "./TrendCard";
import {
  ActivityCard, BalanceCard, BaselineCard, GaitPreviewCard, InsightCard, KisCard,
  MissionStatusCard, PressureCard, ProfileCard, ReadinessCard, RehabStatusCard,
} from "./Cards";

/** Overview grid (Board 1, screen 1). Every panel reads the shared astronaut and session selection. */
export default function OverviewDashboard() {
  const { astronaut, mission, session } = useAstronaut();
  const { insight, session: insightSession } = getLatestInsight(astronaut);
  const o = astronaut.overview;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Overview</h1>
          <p className="text-xs text-slate-300">
            {astronaut.profile.displayName} &middot; {session.label} &middot; {mission.name}, Day {mission.day} &middot; Simulated Data
          </p>
        </div>
        <SessionPicker />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-3"><ProfileCard a={astronaut} mission={mission} /></div>
        <div className="xl:col-span-3"><KisCard o={o} /></div>
        <div className="xl:col-span-2"><ReadinessCard o={o} /></div>
        <div className="grid gap-3 sm:col-span-2 xl:col-span-4">
          <BaselineCard o={o} />
          <div className="grid grid-cols-2 gap-3">
            <ActivityCard o={o} />
            <RehabStatusCard o={o} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8"><KneeCard astronaut={astronaut} session={session} /></div>
        <div className="xl:col-span-4"><GaitPreviewCard a={astronaut} s={session} /></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-4"><PressureCard s={session} /></div>
        <div className="xl:col-span-4"><BalanceCard s={session} /></div>
        <div className="md:col-span-2 xl:col-span-4"><InsightCard insight={insight} session={insightSession} /></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-7"><TrendCard trend={astronaut.trend} /></div>
        <div className="xl:col-span-5"><MissionStatusCard mission={mission} a={astronaut} /></div>
      </div>
    </div>
  );
}
