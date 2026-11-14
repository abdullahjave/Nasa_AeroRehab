"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS, PRIMARY_HREFS, isActive } from "@/lib/nav";
import { RECORDED_ENABLED } from "@/lib/features";
import Select from "@/components/ui/Select";
import { useAstronaut } from "@/components/AstronautProvider";
import { useRecorded } from "@/components/recorded/store";

const SHORT_LABEL: Record<string, string> = { "/": "Overview", "/joint-analytics": "Joint", "/ai-insights": "Insights", "/rehabilitation": "Rehab", "/reports": "Reports" };

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

function NavItems({ items, pathname, onNavigate }: { items: typeof NAV_ITEMS; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className="nav-link">
              <Icon d={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const primary = NAV_ITEMS.filter((i) => PRIMARY_HREFS.includes(i.href));
  const more = NAV_ITEMS.filter((i) => !PRIMARY_HREFS.includes(i.href));
  const inMore = more.some((i) => isActive(pathname, i.href));
  return (
    <div className="stagger space-y-3">
      <NavItems items={primary} pathname={pathname} onNavigate={onNavigate} />
      <details open={inMore || undefined} className="group">
        <summary className="cursor-pointer list-none px-3 text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200">
          More <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">&#9662;</span>
        </summary>
        <div className="reveal mt-1.5"><NavItems items={more} pathname={pathname} onNavigate={onNavigate} /></div>
      </details>
    </div>
  );
}

function ConnectionStatus() {
  const { dataMode } = useAstronaut();
  if (dataMode !== "recorded") return null;
  return (
    <div className="space-y-1 rounded-md border border-cyan-400/20 bg-black/20 p-3 text-xs" aria-live="polite">
      <div className="flex items-center gap-2 text-slate-200"><span className="led led-off" aria-hidden="true" /><span>No sensors in recorded mode</span></div>
      <p className="text-slate-300">Sessions are entered by hand and saved in the local database.</p>
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
        <header className="glass bar sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm sm:gap-x-4 sm:px-4">
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
          <span className="hidden sm:block lg:hidden"><Brand /></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="AeroRehab" className="h-8 w-8 shrink-0 object-contain sm:hidden" />
          <dl className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:justify-start sm:gap-x-4 sm:text-sm">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only sm:not-sr-only"><label htmlFor="astronaut-select" className="text-slate-400">Astronaut</label></dt>
              <dd>
                <Select id="astronaut-select" value={selectedId} onChange={select}
                  options={astronauts.map((a) => ({ value: a.id, label: a.profile.displayName }))} />
              </dd>
            </div>
            <div className="hidden gap-1.5 sm:flex"><dt className="text-slate-400">Mission</dt><dd className="text-white">{mission.name}</dd></div>
            <div className="hidden gap-1.5 sm:flex"><dt className="text-slate-400">Mission day</dt><dd className="text-white">Day {mission.day}</dd></div>
            {RECORDED_ENABLED && <div className="flex items-center gap-1.5">
              <dt className="sr-only sm:not-sr-only"><label htmlFor="data-mode-select" className="text-slate-400">Data</label></dt>
              <dd>
                <Select id="data-mode-select" value={dataMode} onChange={setDataMode}
                  options={[{ value: "demo", label: "Demo (simulated)" }, { value: "recorded", label: "Recorded (local)" }]} />
              </dd>
            </div>}
            <div>
              {dataMode === "recorded" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-300/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                  Recorded Data
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                  <span className="sm:hidden">Demo</span><span className="hidden sm:inline">Simulated demo</span>
                </span>
              )}
            </div>
          </dl>
          <div className="hidden items-center gap-3 text-xs text-slate-200 md:flex">
            {dataMode === "recorded" ? (
              <span className="flex items-center gap-1.5"><span className="led led-off" aria-hidden="true" />Manual entries (no live monitoring)</span>
            ) : (
              <span className="tabular-nums text-slate-300">UTC {mission.displayClockUtc}</span>
            )}
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

        <main className="min-w-0 flex-1 p-3 pb-24 sm:p-6 lg:pb-6">
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
              {/* Keyed on the route so each page rises in once when you navigate. */}
              <div key={pathname} className="page-enter">{children}</div>
            </>
          )}
        </main>

        {/* Phone and tablet: the five main pages stay one tap away. The menu button still opens everything else. */}
        <nav aria-label="Quick navigation" className="tabbar glass bar fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 lg:hidden">
          {NAV_ITEMS.filter((i) => PRIMARY_HREFS.includes(i.href)).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="tab-link">
                <Icon d={item.icon} />
                <span>{SHORT_LABEL[item.href] ?? item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
