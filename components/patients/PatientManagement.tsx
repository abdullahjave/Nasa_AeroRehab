"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAstronaut } from "@/components/AstronautProvider";
import Panel, { Chip } from "@/components/ui/Panel";
import CrewPortrait from "@/components/graphics/CrewPortrait";
import { useNotes } from "./useNotes";
import { ASTRONAUTS, getSensorSummary, type AstronautRecord, type Sensor, type Session } from "@/lib/demo";
import { getPressureAnalysis } from "@/lib/pressure";
import { balanceView } from "@/lib/balance";
import { dayLabel, dayToDate } from "@/lib/rehab";
import { mergeRecords, validateNote, type ClinicalRecord, type NoteDraft, type NoteErrors } from "@/lib/patients/notes";
import { SEED_RECORDS } from "@/lib/patients/seed";

const fmtDate = (isoDate: string) => new Date(isoDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const todayIso = (day: number) => dayToDate(day).toISOString().slice(0, 10);

function sensorLabel(s: Sensor, kneeSide: string) {
  const side = kneeSide === "left" ? "L" : "R";
  if (s.site === "thigh") return `Thigh IMU (${side})`;
  if (s.site === "shank") return `Shank IMU (${side})`;
  return s.site === "insole-left" ? "Insole (L)" : "Insole (R)";
}
const STATUS_TEXT: Record<Sensor["status"], string> = { online: "Connected", "low-battery": "Low battery", offline: "Offline" };
const LED: Record<Sensor["status"], string> = { online: "", "low-battery": "led-warn", offline: "led-off" };

const EMPTY_DRAFT: NoteDraft = { title: "", date: "", text: "" };
const NO_SEED: ClinicalRecord[] = [];

export default function PatientManagement() {
  const { astronaut, astronauts, mission, session, select, selectSession, selectKneeSide, selectBalanceSide } = useAstronaut();
  const [query, setQuery] = useState("");
  const [missionFilter, setMissionFilter] = useState("all");
  const missions = useMemo(() => [...new Map(ASTRONAUTS.map((a) => [a.missionId, mission.name])).entries()], [mission.name]);

  const q = query.trim().toLowerCase();
  const filtered = astronauts.filter(
    (a) => (missionFilter === "all" || a.missionId === missionFilter) && (!q || a.profile.fullName.toLowerCase().includes(q) || a.profile.displayName.toLowerCase().includes(q) || a.profile.crewCode.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)),
  );
  const outside = !filtered.some((a) => a.id === astronaut.id);

  return (
    <div className="space-y-2">
      <header className="glass flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1.5">
        <div>
          <h1 className="text-base font-semibold text-white sm:text-lg">Patient Management <span className="font-normal text-slate-300">&ndash; Astronaut Roster &amp; Clinical Profile</span></h1>
          <p className="text-[10px] text-slate-300">{astronauts.length} astronauts on record &middot; fictional demo data</p>
        </div>
        <span className="rounded-full border border-amber-300/60 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">Simulated Data</span>
      </header>

      <div className="grid gap-2 text-[11px] [&_.text-xs]:!text-[10.5px] [&_.text-sm]:!text-xs [&_.text-xl]:!text-base xl:grid-cols-[200px_1.25fr_1fr_170px]">
        <div className="xl:row-span-2">
          <Roster filtered={filtered} total={astronauts.length} query={query} setQuery={setQuery} missions={missions} missionFilter={missionFilter} setMissionFilter={setMissionFilter}
            selectedId={astronaut.id} onSelect={select} />
        </div>
        <Profile a={astronaut} missionName={mission.name} missionDay={mission.day} outside={outside} />
        <Sensors a={astronaut} session={session} />
        <aside aria-label="Astronaut portrait" className="glass relative hidden items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-[#0c2347]/60 to-transparent p-2 xl:row-span-2 xl:flex">
          <div className="absolute bottom-3 left-1/2 h-6 w-4/5 -translate-x-1/2 rounded-[50%] border border-cyan-300/70 bg-cyan-400/20 shadow-[0_0_24px_rgba(34,211,238,0.6)]" aria-hidden="true" />
          <CrewPortrait profile={astronaut.profile} fill className="relative h-full max-h-[560px] w-full text-6xl" />
        </aside>
        <Records a={astronaut} />
        <Assessments a={astronaut} session={session} onOpen={(kneeSide, balanceSide) => { selectSession(session.id); if (kneeSide) selectKneeSide(kneeSide); if (balanceSide) selectBalanceSide(balanceSide); }} />
      </div>
    </div>
  );
}

function Roster({ filtered, total, query, setQuery, missions, missionFilter, setMissionFilter, selectedId, onSelect }: {
  filtered: AstronautRecord[]; total: number; query: string; setQuery: (v: string) => void; missions: [string, string][];
  missionFilter: string; setMissionFilter: (v: string) => void; selectedId: string; onSelect: (id: AstronautRecord["id"]) => void;
}) {
  return (
    <Panel id="pm-roster" title={`Astronaut Roster (${filtered.length}${filtered.length !== total ? ` of ${total}` : ""})`} icon="user" className="h-full">
      <div className="mb-2 flex flex-col gap-1.5">
        <input type="search" aria-label="Search astronauts by name or ID" placeholder="Search astronaut…" value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-full min-w-0 rounded border border-cyan-400/40 bg-navy-900 px-2 py-1 text-xs text-white placeholder:text-slate-500" />
        <select aria-label="Filter by mission" value={missionFilter} onChange={(e) => setMissionFilter(e.target.value)} className="w-full rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-1 text-xs text-white">
          <option value="all">All missions</option>
          {missions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-cyan-400/30 p-3 text-xs text-slate-300" role="status">
          <p className="font-semibold text-white">No astronauts match</p>
          <p>No one matches &ldquo;{query}&rdquo;{missionFilter !== "all" ? " in this mission" : ""}. Clear the search or the filter.</p>
          <button type="button" onClick={() => { setQuery(""); setMissionFilter("all"); }} className="mt-2 rounded border border-cyan-400/50 px-2 py-0.5 text-cyan-100 hover:bg-white/10">Clear filters</button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((a) => {
            const sel = a.id === selectedId;
            return (
              <li key={a.id}>
                <button type="button" aria-pressed={sel} onClick={() => onSelect(a.id)}
                  className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left ${sel ? "border-cyan-300 bg-cyan-400/15" : "border-cyan-400/15 hover:bg-white/5"}`}>
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#0c2347] to-[#050d1f] ring-1 ring-cyan-400/40"><CrewPortrait profile={a.profile} zoom className="h-full w-full text-[11px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight text-white">{a.profile.displayName}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">{a.profile.crewCode}<span className="flex items-center gap-1 text-emerald-300"><span className="led" aria-hidden="true" />{a.profile.status}</span></span>
                  </span>
                                  </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Profile({ a, missionName, missionDay, outside }: { a: AstronautRecord; missionName: string; missionDay: number; outside: boolean }) {
  const p = a.profile;
  const sum = getSensorSummary(a);
  const nominal = sum.state === "all";
  return (
    <Panel id="pm-profile" title="Clinical Profile" icon="user" className="h-full">
      {outside && <p role="status" className="mb-2 rounded border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-100">{p.displayName} is selected but hidden by the current search or mission filter.</p>}
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#0c2347] to-[#050d1f] ring-1 ring-cyan-400/30"><CrewPortrait profile={p} className="h-full w-full text-3xl" /></div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xl font-semibold text-white">{p.displayName}<span className="flex items-center gap-1 text-xs font-normal text-emerald-300"><span className="led" aria-hidden="true" />{p.status}</span></p>
          <p className="text-xs text-slate-300">{p.fullName}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-slate-400">ID</dt><dd className="text-white">{p.crewCode} ({a.id})</dd>
            <dt className="text-slate-400">Role</dt><dd className="text-white">{p.role}</dd>
            <dt className="text-slate-400">Mission</dt><dd className="text-white">{missionName}</dd>
            <dt className="text-slate-400">Mission day</dt><dd className="text-white">Day {missionDay}</dd>
            <dt className="text-slate-400">Age</dt><dd className="text-white">{p.ageYears} y &middot; {p.heightCm} cm &middot; {p.massKg} kg</dd>
            <dt className="text-slate-400">Rehab focus</dt><dd className="text-white">{p.rehabFocus}</dd>
            <dt className="text-slate-400">Demo status</dt><dd className={nominal ? "text-emerald-300" : "text-amber-200"}>{nominal ? "Nominal (all sensors connected)" : sum.state === "partial" ? `Check sensors (${sum.connected}/${sum.total} connected)` : "Sensors offline"}</dd>
          </dl>
        </div>
      </div>
      <Link href="/" className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-cyan-400/60 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/20">View Dashboard &rarr;</Link>
    </Panel>
  );
}

function Sensors({ a, session }: { a: AstronautRecord; session: Session }) {
  const knee = session.joint.measurement.side;
  return (
    <Panel id="pm-sensors" title="Sensor Assignments" icon="chip" className="h-full">
      <ul className="space-y-1.5">
        {a.sensors.map((s) => {
          const has = s.battery !== null;
          return (
            <li key={s.id} className="flex items-center gap-2 rounded border border-cyan-400/15 px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate text-white">{sensorLabel(s, knee)}</span>
              <span className={`flex items-center gap-1 ${s.status === "online" ? "text-emerald-300" : s.status === "low-battery" ? "text-amber-300" : "text-slate-400"}`}><span className={`led ${LED[s.status]}`} aria-hidden="true" />{STATUS_TEXT[s.status]}</span>
              {has ? (
                <span className="flex items-center gap-1.5" role="img" aria-label={`Battery ${s.battery} percent`}>
                  <span className="relative h-3 w-9 rounded-[3px] border border-cyan-300/60 p-[1px]"><span className={`block h-full rounded-[1px] ${(s.battery as number) < 25 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${s.battery}%` }} /></span>
                  <span className="w-8 text-right tabular-nums text-white">{s.battery}%</span>
                </span>
              ) : <span className="w-[5.3rem] text-right text-amber-200">Unavailable</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-slate-400">Same sensor records as the sidebar status. Thigh and shank IMUs are on the {knee} knee used in this session.</p>
    </Panel>
  );
}

function Records({ a }: { a: AstronautRecord }) {
  const seed = SEED_RECORDS[a.id] ?? NO_SEED;
  const { stored, save } = useNotes(a.id, seed);
  const records = useMemo(() => mergeRecords(seed, stored), [seed, stored]);
  const { mission } = useAstronaut();
  const [form, setForm] = useState<{ aid: string; id: string | null; draft: NoteDraft } | null>(null);
  const [errors, setErrors] = useState<NoteErrors>({});
  const open = form && form.aid === a.id ? form : null; // a form never carries over to another astronaut

  const start = (r: ClinicalRecord | null) => { setErrors({}); setForm({ aid: a.id, id: r?.id ?? null, draft: r ? { title: r.title, date: r.date, text: r.text } : { ...EMPTY_DRAFT, date: todayIso(mission.day) } }); };
  const submit = () => {
    if (!open) return;
    const e = validateNote(open.draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    save(open.draft, open.id);
    setForm(null);
  };
  const upd = (k: keyof NoteDraft, v: string) => open && setForm({ ...open, draft: { ...open.draft, [k]: v } });
  const field = "w-full rounded border border-cyan-400/40 bg-navy-900 px-2 py-1 text-xs text-white";

  return (
    <Panel id="pm-records" title="Clinical Records" icon="check" className="h-full"
      action={<button type="button" onClick={() => start(null)} className="rounded border border-cyan-400/50 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-white/10">Add note</button>}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400"><tr className="border-b border-cyan-400/20"><th className="py-1 pr-2 font-normal">Record</th><th className="pr-2 font-normal">Date</th><th className="pr-2 font-normal">Status</th><th className="font-normal"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-cyan-400/10 align-middle">
                <th scope="row" className="py-1.5 pr-2 font-normal text-white">{r.title}<span className="block text-[10px] text-slate-400">{r.text}</span></th>
                <td className="whitespace-nowrap pr-2 tabular-nums text-slate-200">{fmtDate(r.date)}</td>
                <td className="pr-2"><Chip tone={r.status === "Note" ? "cyan" : "green"}>{r.status}</Chip></td>
                <td><button type="button" onClick={() => start(r)} aria-label={`Edit ${r.title}`} className="rounded px-1 text-cyan-300 hover:text-white hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <form className="mt-3 space-y-2 rounded-md border border-cyan-400/30 bg-black/25 p-2" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate aria-label={open.id ? "Edit note" : "Add note"}>
          <p className="text-xs font-semibold text-white">{open.id ? "Edit record" : "Add demo note"} <span className="font-normal text-slate-400">({a.profile.displayName})</span></p>
          <label className="block text-[11px] text-slate-300">Title
            <input value={open.draft.title} onChange={(e) => upd("title", e.target.value)} className={field} aria-invalid={!!errors.title} aria-describedby={errors.title ? "pm-e-title" : undefined} />
            {errors.title && <span id="pm-e-title" role="alert" className="text-amber-200">{errors.title}</span>}
          </label>
          <label className="block text-[11px] text-slate-300">Date
            <input type="date" value={open.draft.date} onChange={(e) => upd("date", e.target.value)} className={`${field} [color-scheme:dark]`} aria-invalid={!!errors.date} />
            {errors.date && <span role="alert" className="text-amber-200">{errors.date}</span>}
          </label>
          <label className="block text-[11px] text-slate-300">Note
            <textarea rows={3} value={open.draft.text} onChange={(e) => upd("text", e.target.value)} className={field} aria-invalid={!!errors.text} />
            {errors.text && <span role="alert" className="text-amber-200">{errors.text}</span>}
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-cyan-500/80 px-3 py-1 text-xs font-semibold text-[#031022] hover:bg-cyan-400">Save</button>
            <button type="button" onClick={() => { setForm(null); setErrors({}); }} className="rounded border border-cyan-400/50 px-3 py-1 text-xs text-cyan-100 hover:bg-white/10">Cancel</button>
          </div>
        </form>
      )}
      <p className="mt-2 text-[10px] text-slate-500">Fictional records. Notes are saved in this browser per astronaut and record ID.</p>
    </Panel>
  );
}

function Assessments({ a, session, onOpen }: { a: AstronautRecord; session: Session; onOpen: (knee: "left" | "right" | null, balance: "left" | "right" | null) => void }) {
  const pa = getPressureAnalysis(session);
  const peak = pa && pa.session.peakKpa.overall.kind === "value" ? pa.session.peakKpa.overall.value : null;
  // Balance: use a side that has a trial in this session, so the link opens a real trial.
  const balSide = (["left", "right"] as const).find((s) => balanceView(a, session, s).trial) ?? null;
  const idx = balSide ? balanceView(a, session, balSide).fixtures?.index ?? null : null;
  const rows: { type: string; value: string | null; href: string; knee?: "left" | "right"; bal?: "left" | "right" | null }[] = [
    { type: "Joint Analytics", value: session.knee.romDeg === null ? null : `ROM ${session.knee.romDeg.toFixed(0)}°`, href: "/joint-analytics", knee: session.joint.measurement.side },
    { type: "Gait Analysis", value: session.gait?.speedMs == null ? null : `Speed ${session.gait.speedMs.toFixed(2)} m/s`, href: "/gait-analysis" },
    { type: "Load & Pressure", value: peak === null ? null : `Peak ${peak.toFixed(0)} kPa`, href: "/load-pressure" },
    { type: "Stability & Balance", value: idx === null ? null : `Index ${idx} / 100`, href: "/stability-balance", bal: balSide },
  ];
  return (
    <Panel id="pm-assess" title="Recent Assessments" icon="chart" className="h-full">
      <p className="mb-1 text-[11px] text-slate-300">{session.label} &middot; {dayLabel(session.missionDay)}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400"><tr className="border-b border-cyan-400/20"><th className="py-1 pr-2 font-normal">Assessment</th><th className="pr-2 font-normal">Value</th><th className="font-normal">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.type} className="border-b border-cyan-400/10">
                <th scope="row" className="py-1.5 pr-2 font-normal">
                  <Link href={r.href} onClick={() => onOpen(r.knee ?? null, r.bal ?? null)} className="text-cyan-200 hover:text-white hover:underline" aria-label={`Open ${r.type} for ${a.profile.displayName}, ${session.label}`}>{r.type} &rarr;</Link>
                </th>
                <td className={`pr-2 tabular-nums ${r.value ? "text-white" : "text-amber-200"}`}>{r.value ?? "Unavailable"}</td>
                <td>{r.value ? <span className="text-emerald-300">&#10003; Recorded</span> : <span className="text-amber-200">! No data</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Values come from the same session records as the analytics pages. Simulated.</p>
    </Panel>
  );
}
