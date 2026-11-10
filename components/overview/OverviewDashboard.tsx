"use client";

import { useAstronaut } from "@/components/AstronautProvider";
import SessionPicker from "@/components/ui/SessionPicker";
import KneeCard from "./KneeCard";
import OverviewPressure from "@/components/pressure/OverviewPressure";
import OverviewBalance from "@/components/balance/OverviewBalance";
import OverviewInsight from "@/components/insights/OverviewInsight";
import OverviewRehab from "@/components/rehab/OverviewRehab";
import { insightView } from "@/lib/insights";
import TrendCard from "./TrendCard";
import {
  ActivityCard, BaselineCard, GaitPreviewCard, KisCard,
  MissionStatusCard, ProfileCard, ReadinessCard,
} from "./Cards";

/** Overview grid (Board 1, screen 1). Every panel reads the shared astronaut and session selection. */
export default function OverviewDashboard() {
  const { astronaut, mission, session } = useAstronaut();
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
          <BaselineCard view={insightView(astronaut, session)} />
          <div className="grid grid-cols-2 gap-3">
            <ActivityCard o={o} />
            <OverviewRehab />
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8"><KneeCard astronaut={astronaut} session={session} /></div>
        <div className="xl:col-span-4"><GaitPreviewCard a={astronaut} s={session} /></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-4"><OverviewPressure session={session} /></div>
        <div className="xl:col-span-4"><OverviewBalance /></div>
        <div className="md:col-span-2 xl:col-span-4"><OverviewInsight /></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-7"><TrendCard trend={astronaut.trend} /></div>
        <div className="xl:col-span-5"><MissionStatusCard mission={mission} a={astronaut} /></div>
      </div>
    </div>
  );
}
