"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { useAstronaut } from "@/components/AstronautProvider";
import { useRecorded } from "@/components/recorded/store";
import { getSensorSummary } from "@/lib/demo";
import { fmt } from "@/lib/format";
import { usePlayback } from "@/components/settings/stores";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo.png" alt="AeroRehab logo" className="h-9 w-9 shrink-0 object-contain" />
      <span className="text-lg font-semibold tracking-wide text-white">Aero<span className="text-cyan-300">Rehab</span></span>
    </div>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="nav-link"
            >
              <Icon d={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ConnectionStatus() {
  const { astronaut, mission, hubConnected, dataMode } = useAstronaut();
  if (dataMode === "recorded") {
    return (
      <div className="space-y-1 rounded-md border border-cyan-400/20 bg-black/20 p-3 text-xs" aria-live="polite">
        <div className="flex items-center gap-2 text-slate-200"><span className="led led-off" aria-hidden="true" /><span>No sensors in recorded mode</span></div>
        <p className="text-slate-400">Sessions are entered by hand and saved in the local database.</p>
      </div>
    );
  }
  const sum = getSensorSummary(astronaut);
  const battery = sum.lowestBattery;
  const label = sum.state === "all" ? "Sensors connected" : sum.state === "partial" ? "Sensors partial" : "Sensors offline";
  return (
    <div className="space-y-2 rounded-md border border-cyan-400/20 bg-black/20 p-3 text-xs" aria-live="polite">
      <div className="flex items-center gap-2 text-slate-200">
        <span className={`led ${sum.state === "all" ? "" : sum.state === "partial" ? "led-warn" : "led-off"}`} aria-hidden="true" />
        <span>{label} ({sum.connected}/{sum.total})</span>
      </div>
      <p className="text-slate-300">{mission.hubId} <span className="text-slate-500">&middot; simulated{hubConnected ? "" : " · hub disconnected"}</span></p>
      <div className="flex items-center gap-2 text-slate-300">
        <span>Battery</span>
        <span className="relative h-3 w-8 rounded-[3px] border border-cyan-300/60 p-[1px]" role="img" aria-label={battery === null ? "Battery unavailable" : `Lowest sensor battery ${battery} percent`}>
          <span className={`block h-full rounded-[1px] ${battery !== null && battery < 25 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${battery ?? 0}%` }} />
          <span className="absolute -right-[3px] top-[3px] h-1 w-[2px] bg-cyan-300/60" />
        </span>
        <span>{battery === null ? "Unavailable" : fmt(battery, "%")}</span>
      </div>
      <p className="text-[12px] text-slate-500">Lowest sensor battery</p>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { astronauts, mission, selectedId, select, dataMode, setDataMode, recordedStatus, refreshRecorded } = useAstronaut();
  const { snapshot: recSnapshot, loadedAt: recLoadedAt } = useRecorded();
  const recordedStale = dataMode === "recorded" && recordedStatus === "error" && !!recSnapshot;
  // A failed first load must never look like an empty database or fall back to Demo values.
  const recordedUnavailable = dataMode === "recorded" && recordedStatus === "error" && !recSnapshot;
  const playback = usePlayback();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative z-10 flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="glass bar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 p-4 lg:flex">
        <Brand />
        <nav aria-label="Primary" className="flex-1 overflow-y-auto">
          <NavList pathname={pathname} />
        </nav>
        <ConnectionStatus />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass bar sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
          <button
            type="button"
            className="rounded-md border border-cyan-400/40 p-2 text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Open navigation menu"
            onClick={() => setOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="lg:hidden"><Brand /></span>
          <dl className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <dt><label htmlFor="astronaut-select" className="text-slate-400">Astronaut</label></dt>
              <dd>
                <select
                  id="astronaut-select"
                  value={selectedId}
                  onChange={(e) => select(e.target.value as typeof selectedId)}
                  className="rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-0.5 text-white"
                >
                  {astronauts.map((a) => (
                    <option key={a.id} value={a.id}>{a.profile.displayName}</option>
                  ))}
                </select>
              </dd>
            </div>
            <div className="flex gap-1.5"><dt className="text-slate-400">Mission</dt><dd className="text-white">{mission.name}</dd></div>
            <div className="flex gap-1.5"><dt className="text-slate-400">Mission day</dt><dd className="text-white">Day {mission.day}</dd></div>
            <div className="flex items-center gap-1.5">
              <dt><label htmlFor="data-mode-select" className="text-slate-400">Data</label></dt>
              <dd>
                <select id="data-mode-select" value={dataMode} onChange={(e) => setDataMode(e.target.value as "demo" | "recorded")}
                  className="rounded border border-cyan-400/40 bg-navy-900 px-1.5 py-0.5 text-white">
                  <option value="demo">Demo (simulated)</option>
                  <option value="recorded">Recorded (local)</option>
                </select>
              </dd>
            </div>
            <div>
              {dataMode === "recorded" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-300/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                  Recorded Data
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                  Simulated Data
                </span>
              )}
            </div>
          </dl>
          <div className="hidden items-center gap-3 text-xs text-slate-200 md:flex">
            {dataMode === "recorded" ? (
              <span className="flex items-center gap-1.5"><span className="led led-off" aria-hidden="true" />Manual entries (no live monitoring)</span>
            ) : (
              <>
                <span className="flex items-center gap-1.5" aria-live="polite"><span className={`led ${playback === "running" ? "" : "led-warn"}`} aria-hidden="true" />{playback === "running" ? "Simulated Monitoring" : "Simulated Monitoring paused"}</span>
                <span className="tabular-nums text-slate-300">UTC {mission.displayClockUtc}</span>
              </>
            )}
            <svg viewBox="0 0 20 16" className="h-4 w-5 text-emerald-400" fill="currentColor" role="img" aria-label="Link strength: simulated, full">
              <rect x="1" y="10" width="3" height="5" rx="0.5" /><rect x="6" y="7" width="3" height="8" rx="0.5" /><rect x="11" y="4" width="3" height="11" rx="0.5" /><rect x="16" y="1" width="3" height="14" rx="0.5" />
            </svg>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div id="mobile-nav" role="dialog" aria-modal="true" aria-label="Navigation menu" className="glass bar absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <Brand />
                <button type="button" aria-label="Close navigation menu" className="rounded-md border border-cyan-400/40 p-2 text-cyan-200" onClick={() => setOpen(false)} autoFocus>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <nav aria-label="Primary mobile" className="flex-1 overflow-y-auto">
                <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
              </nav>
              <ConnectionStatus />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {recordedUnavailable ? (
            <section role="alert" data-testid="recorded-unavailable" className="glass mx-auto max-w-2xl rounded-lg border border-amber-300/50 p-4">
              <h1 className="text-xl font-semibold text-white">Recorded mode is unavailable here</h1>
              <p className="mt-2 text-sm text-slate-100">The saved records could not be loaded, so nothing is shown and nothing can be saved. No Demo values are substituted.</p>
              <p className="mt-2 text-sm text-slate-300">Recorded mode stores data in a local database file on the machine running the app. A hosted deployment without persistent storage cannot provide it. Run the app locally to use Recorded mode.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={refreshRecorded} className="rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-2 text-sm text-white hover:bg-cyan-400/25">Retry</button>
                <button type="button" onClick={() => setDataMode("demo")} className="rounded-md border border-slate-400/50 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">Switch to Demo (simulated)</button>
              </div>
            </section>
          ) : (
            <>
              {recordedStale && (
                <p role="alert" data-testid="recorded-stale" className="mb-3 rounded-md border border-amber-300/60 bg-amber-300/10 p-2 text-sm text-amber-100">
                  Recorded data could not be refreshed. Showing the records last loaded{recLoadedAt ? ` at ${new Date(recLoadedAt).toISOString().slice(11, 19)} UTC` : ""}; they may be out of date, and changes made since then are not shown.{" "}
                  <button type="button" onClick={refreshRecorded} className="underline">Retry</button>
                </p>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
