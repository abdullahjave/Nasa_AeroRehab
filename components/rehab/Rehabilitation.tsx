"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip } from "@/components/ui/Panel";
import GaugeRing from "@/components/ui/GaugeRing";
import { AXIS, C, GRID, TIP_CLASS } from "@/components/ui/chart";
import ExerciseVisual from "./ExerciseVisual";
import { useRehab } from "./useRehab";
import { DEMO_DAY, dayLabel, dayToDate, programFor, scheduleOf, weekStartOf, weekdayShort, type DayStatus, type ExerciseId, type Ratio } from "@/lib/rehab";

const pctText = (r: Ratio) => (r.kind === "value" ? `${r.pct.toFixed(0)}%` : "Unavailable");
const STATUS: Record<DayStatus, { label: string; icon: string; cls: string }> = {
  completed: { label: "Completed", icon: "✓", cls: "bg-emerald-400 text-[#04121f]" },
  pending: { label: "Pending", icon: "", cls: "border-2 border-slate-300 text-slate-200" },
  incomplete: { label: "Not completed", icon: "!", cls: "bg-amber-300/25 text-amber-200 border border-amber-300/60" },
  unscheduled: { label: "No session", icon: "–", cls: "text-slate-500" },
  outside: { label: "Outside program", icon: "", cls: "text-slate-600" },
};

/** Event-time stamp for ordering manual selections against "Open exercise" links (called from handlers only). */
const stamp = () => Date.now();

/** Remounted per astronaut, so no plan selection is carried from one astronaut to another. */
export default function Rehabilitation({ assets }: { assets: Record<string, boolean> }) {
  const { astronaut } = useAstronaut();
  return <RehabPage key={astronaut.id} assets={assets} />;
}

function RehabPage({ assets }: { assets: Record<string, boolean> }) {
  const { astronaut, rehabFocus } = useAstronaut();
  const program = programFor(astronaut);
  const focusEx = rehabFocus && rehabFocus.astronautId === astronaut.id ? (rehabFocus.exerciseId as ExerciseId) : null;
  // Selection is tagged with the astronaut, so switching astronaut never carries the previous plan selection.
  const [sel, setSel] = useState<{ aid: string; weekStart: number; day: number; at: number } | null>(null);
  // A newer "Open exercise" link from AI Insights wins over an older manual selection and opens today's plan.
  const focusAt = rehabFocus && rehabFocus.astronautId === astronaut.id ? rehabFocus.at : 0;
  const today = { aid: astronaut.id, weekStart: weekStartOf(DEMO_DAY), day: DEMO_DAY, at: focusAt };
  const cur = sel && sel.aid === astronaut.id && sel.at > focusAt ? sel : today;
  const focusActive = !!focusEx && (!sel || sel.at <= (rehabFocus?.at ?? 0));
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const { view, completions, setEdit } = useRehab(astronaut, cur.day, cur.weekStart);

  if (!program || !view) {
    return <Panel id="rehab-empty" title="Rehabilitation" icon="check"><p className="text-sm text-amber-200">No rehabilitation program for this astronaut.</p></Panel>;
  }

  const firstWeek = weekStartOf(program.startMissionDay);
  const lastWeek = weekStartOf(view.programEnd);
  const goWeek = (delta: number) => {
    const ws = Math.min(lastWeek, Math.max(firstWeek, cur.weekStart + delta * 7));
    const sched = scheduleOf(astronaut, program).filter((s) => s.missionDay >= ws && s.missionDay < ws + 7);
    const day = DEMO_DAY >= ws && DEMO_DAY < ws + 7 ? DEMO_DAY : sched[0]?.missionDay ?? ws;
    setSel({ aid: astronaut.id, weekStart: ws, day, at: stamp() });
    setOpenInfo(null);
  };
  const pickDay = (day: number) => { setSel({ aid: astronaut.id, weekStart: cur.weekStart, day, at: stamp() }); setOpenInfo(null); };

  const s = view.selected.session;
  const doneCount = s ? s.assignments.filter((a) => completions[a.id]).length : 0;
  const future = view.selected.day > DEMO_DAY;
  const year = dayToDate(cur.weekStart + 6).getUTCFullYear();
  const t = view.totals;
  const scoreRows = view.scores.map((r) => ({ label: `W${r.programWeek}`, day: r.missionDay, recovery: r.recoveryIndex, readiness: r.readiness }));

  return (
    <div className="space-y-3">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Rehabilitation <span className="font-normal text-slate-300">&ndash; Exercise Plan</span></h1>
          <p className="text-xs text-slate-300">{astronaut.profile.displayName} &middot; {program.name} &middot; Demo date Day {DEMO_DAY} ({dayLabel(DEMO_DAY)}, {year})</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">Simulated Data</span>
      </header>

      {/* Top row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1.2fr_1fr_1fr_1fr]">
        <Panel id="r-status" title="Program Status" icon="check">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300" aria-hidden="true">&#10003;</span>
            <div>
              <p className="text-base font-semibold text-white">{program.name}</p>
              <p className="text-xs text-slate-300">Week {Math.max(1, Math.min(program.totalWeeks, view.selected.programWeek))} of {program.totalWeeks} &middot; <span className="text-emerald-300">{program.statusLabel}</span></p>
            </div>
          </div>
        </Panel>
        <Panel id="r-adh" title="Weekly Adherence" icon="chart">
          <div className="flex items-center gap-3">
            <GaugeRing value={view.weeklyAdherence.kind === "value" ? view.weeklyAdherence.pct : null} max={100} color={C.green} size="h-20 w-20" ariaLabel={`Weekly adherence ${pctText(view.weeklyAdherence)}`} />
            <div>
              <p className={`font-semibold tabular-nums ${view.weeklyAdherence.kind === "value" ? "text-3xl text-white" : "text-sm text-amber-200"}`}>{pctText(view.weeklyAdherence)}</p>
              {view.weeklyAdherence.kind === "value" && <p className="text-xs text-slate-300">({view.weeklyAdherence.num} / {view.weeklyAdherence.den} sessions)</p>}
              <p className="text-[10px] text-slate-400">Scope: sessions due this week up to Day {DEMO_DAY}</p>
            </div>
          </div>
        </Panel>
        <Panel id="r-sessions" title="Total Sessions" icon="timeline">
          <p className="text-3xl font-semibold tabular-nums text-white">{t.completedSessions}</p>
          <p className="text-[10px] text-slate-400">Completed in this program through {dayLabel(view.selected.day)}</p>
        </Panel>
        <Panel id="r-time" title="Total Time" icon="pulse">
          <p className="text-3xl font-semibold tabular-nums text-white">{t.minutes} <span className="text-sm font-normal text-slate-300">min</span></p>
          <p className={`text-[10px] ${t.missingDuration ? "text-amber-200" : "text-slate-400"}`}>
            {t.missingDuration ? `Partial: ${t.missingDuration} completed session${t.missingDuration > 1 ? "s" : ""} without a recorded duration` : "Recorded minutes of completed sessions"}
          </p>
        </Panel>
        <Panel id="r-rate" title="Completion Rate" icon="chart">
          <p className={`font-semibold tabular-nums ${view.completionRate.kind === "value" ? "text-3xl text-white" : "text-sm text-amber-200"}`}>{pctText(view.completionRate)}</p>
          {view.completionRate.kind === "value" && <p className="text-xs text-slate-300">{view.completionRate.num} / {view.completionRate.den} exercise items</p>}
          <p className="text-[10px] text-slate-400">Scope: whole program through {dayLabel(view.selected.day)}</p>
        </Panel>
      </div>

      {/* Main grid */}
      <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Panel id="r-plan" title={`${view.selected.isToday ? "Today's" : `${weekdayShort(view.selected.day)} ${dayLabel(view.selected.day)}`} Exercise Plan`} icon="walk" className="h-full"
          action={s ? <span className={`text-xs font-semibold ${doneCount === s.assignments.length ? "text-emerald-300" : "text-slate-200"}`}>({doneCount} / {s.assignments.length} Completed)</span> : undefined}>
          {!s ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-cyan-400/30 p-6 text-center">
              <p className="text-base font-semibold text-white">No plan for this day</p>
              <p className="text-xs text-slate-300">{weekdayShort(view.selected.day)} {dayLabel(view.selected.day)} is {view.week.find((d) => d.day === view.selected.day)?.status === "outside" ? "outside the program" : "a rest day"}.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {s.assignments.map((a, i) => {
                const ex = view.exercises[a.exerciseId];
                const done = completions[a.id] === true;
                const infoOpen = openInfo === a.id || (focusActive && focusEx === a.exerciseId && openInfo === null && view.selected.isToday);
                return (
                  <li key={a.id} id={`ex-${a.exerciseId}`} className={`glass flex items-stretch gap-3 rounded-md p-2 ${focusActive && focusEx === a.exerciseId && view.selected.isToday ? "ring-2 ring-cyan-300" : ""}`}>
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded bg-gradient-to-b from-[#0c2347] to-[#050d1f] sm:w-24"><ExerciseVisual id={a.exerciseId} hasImage={!!assets[a.exerciseId]} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-cyan-300/60 text-[11px]">{i + 1}</span>
                        {ex.name}
                        <button type="button" aria-expanded={infoOpen} aria-label={`About ${ex.name}`} onClick={() => setOpenInfo(infoOpen ? "none" : a.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-400/60 text-[11px] text-slate-200 hover:bg-white/10">i</button>
                      </p>
                      <p className="text-xs text-slate-300">{ex.prescription}</p>
                      {infoOpen && <p className="mt-1 text-[11px] text-slate-300">{ex.info} <span className="text-slate-500">(demo content)</span></p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-center gap-1">
                      {done ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-400/70 bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">&#10003; Completed</span>
                          <button type="button" onClick={() => setEdit(s.id, a.id, false)} className="text-[11px] text-slate-300 underline-offset-2 hover:underline" aria-label={`Undo ${ex.name}`}>Undo</button>
                        </>
                      ) : future ? (
                        <span className="rounded border border-slate-500/60 px-2 py-0.5 text-[11px] text-slate-300">Upcoming</span>
                      ) : (
                        <button type="button" onClick={() => setEdit(s.id, a.id, true)} aria-label={`Mark ${ex.name} complete`}
                          className="rounded border border-cyan-400/60 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-cyan-400/20">Mark complete</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-2 text-[10px] text-slate-500">Edits are saved in this browser per astronaut, session and exercise. Images: fallback pictograms where public/images/rehab/*.webp is missing.</p>
        </Panel>

        <div className="grid content-start gap-3">
          <Panel id="r-cal" title="Weekly Calendar" icon="timeline">
            <div className="mb-2 flex items-center justify-center gap-2">
              <button type="button" onClick={() => goWeek(-1)} disabled={cur.weekStart <= firstWeek} aria-label="Previous week" className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-100 disabled:opacity-40">&lsaquo;</button>
              <span className="min-w-[10rem] rounded border border-cyan-400/30 px-2 py-0.5 text-center text-xs text-white" aria-live="polite">{dayLabel(cur.weekStart)} &ndash; {dayLabel(cur.weekStart + 6)}, {year}</span>
              <button type="button" onClick={() => goWeek(1)} disabled={cur.weekStart >= lastWeek} aria-label="Next week" className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-100 disabled:opacity-40">&rsaquo;</button>
            </div>
            <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1">
              {view.week.map((d) => {
                const st = STATUS[d.status];
                const isSel = d.day === view.selected.day;
                return (
                  <button key={d.day} type="button" onClick={() => pickDay(d.day)} aria-pressed={isSel}
                    aria-label={`${weekdayShort(d.day)} ${dayLabel(d.day)}${d.day === DEMO_DAY ? ", today" : ""}: ${st.label}${d.total ? `, ${d.done} of ${d.total} exercises` : ""}`}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-md border px-0.5 py-1.5 ${isSel ? "border-cyan-300 bg-cyan-400/15" : "border-cyan-400/15 hover:bg-white/5"}`}>
                    <span className="text-[10px] text-slate-300">{weekdayShort(d.day)}</span>
                    <span className="text-sm font-semibold tabular-nums text-white">{dayToDate(d.day).getUTCDate()}</span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${st.cls}`} aria-hidden="true">{st.icon}</span>
                    <span className={`text-[9px] leading-none ${d.day === DEMO_DAY ? "text-cyan-200" : "text-transparent"}`}>Today</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-300">
              {(["completed", "pending", "incomplete", "unscheduled"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1"><span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold ${STATUS[k].cls}`}>{STATUS[k].icon}</span>{STATUS[k].label}</span>
              ))}
            </div>
          </Panel>
          <Panel id="r-trend" title="Recovery Trend" icon="chart">
            <figure className="rounded-md bg-black/35 p-2">
              <figcaption className="mb-1 text-[11px] text-slate-300">Simulated scores (%) per program week</figcaption>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 400, height: 190 }}>
                  <LineChart data={scoreRows} margin={{ top: 4, right: 12, bottom: 2, left: 0 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} />
                    <YAxis domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} tickFormatter={(x) => `${x}%`} tick={{ fill: AXIS, fontSize: 11 }} stroke={AXIS} width={40} />
                    <Tooltip cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }} content={({ active, payload }) => {
                      const r = payload?.[0]?.payload as (typeof scoreRows)[number] | undefined;
                      if (!active || !r) return null;
                      return <div className={TIP_CLASS}><p className="font-semibold text-white">{r.label} &middot; Day {r.day} ({dayLabel(r.day)})</p><p className="text-slate-300">Recovery Index <span className="font-semibold text-cyan-300">{r.recovery}%</span></p><p className="text-slate-300">Readiness <span className="font-semibold text-pink-300">{r.readiness}%</span></p></div>;
                    }} />
                    <Legend verticalAlign="top" align="right" height={22} iconType="circle" wrapperStyle={{ fontSize: 11, color: AXIS }} />
                    <Line name="Recovery Index" dataKey="recovery" stroke={C.cyan} strokeWidth={2} dot={{ r: 3, fill: C.cyan }} isAnimationActive={false} />
                    <Line name="Readiness" dataKey="readiness" stroke={C.magenta} strokeWidth={2} dot={{ r: 3, fill: C.magenta }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          </Panel>
        </div>

        <div className="grid content-start gap-3">
          <Panel id="r-recovery" title="Recovery & Readiness" icon="walk">
            {view.score ? (
              <>
                <div className="flex items-center gap-4">
                  <GaugeRing value={view.score.recoveryIndex} max={100} color={C.green} size="h-28 w-28" center={`${view.score.recoveryIndex}%`} centerSub="Recovery" ariaLabel={`Recovery index ${view.score.recoveryIndex} percent, simulated`} />
                  <dl className="flex-1 space-y-2 text-sm">
                    {([["Muscle Recovery", view.score.muscleRecovery], ["Joint Readiness", view.score.jointReadiness], ["Fatigue Index", view.score.fatigueIndex]] as const).map(([k, val]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-2 text-slate-200"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-[9px] text-emerald-300" aria-hidden="true">&#10003;</span>{k}</dt>
                        <dd className="tabular-nums text-white">{val}%</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Simulated scores dated Day {view.score.missionDay} (program week {view.score.programWeek}), same records as the trend.</p>
              </>
            ) : <p className="text-sm text-amber-200">Unavailable: no score on or before this date</p>}
          </Panel>
          <Panel id="r-progress" title="Program Progress" icon="chart">
            <div className="flex items-center gap-4">
              <GaugeRing value={view.progress.overall} max={100} color={C.green} size="h-28 w-28" center={`${view.progress.overall.toFixed(0)}%`} centerSub="Overall" ariaLabel={`Program progress ${view.progress.overall.toFixed(0)} percent, demo`} />
              <dl className="flex-1 space-y-1.5 text-sm">
                {([["Mobility", view.progress.mobility], ["Strength", view.progress.strength], ["Balance", view.progress.balance], ["Endurance", view.progress.endurance]] as const).map(([k, val]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-2 text-slate-200"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20 text-[9px] text-emerald-300" aria-hidden="true">&#10003;</span>{k}</dt>
                    <dd className="tabular-nums text-white">{val}%</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-2"><Chip>{program.statusLabel}</Chip></p>
            <p className="mt-1 text-[10px] text-slate-400">Demo progress scores (program fixture). Overall = mean of the four.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
