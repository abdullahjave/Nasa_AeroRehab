"use client";

import Panel from "@/components/ui/Panel";
import { COUNTERMEASURES, DISCLAIMER, EQUIPMENT_NOTE, INTRO, KIND_LABEL, STATUS_NOTE, sourceById, type Countermeasure } from "@/lib/countermeasures/content";

// Labelled equipment ICONS (simple original line drawings, not photographs). No licensed photo of ARED, T2 or CEVIS is bundled with the app.
const ICON_PATH: Record<Countermeasure["id"], React.ReactNode> = {
  ared: <><path d="M4 12h16M6 8v8M9 9v6M15 9v6M18 8v8" /><path d="M12 12v7M9 19h6" /></>,
  colbert: <><path d="M3 17h15l3-4" /><path d="M7 17l3-6h4l-1 6" /><circle cx="11" cy="6" r="1.6" /><path d="M5 20h14" /></>,
  cevis: <><circle cx="7" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M7 16l4-7h5l2 7M11 9L9 6H7M14 9v-3h2" /></>,
};

/**
 * Spaceflight Exercise: equipment information from NASA public pages (ARED, T2, CEVIS), each statement with its NASA source link.
 * This is information, NOT an assignment: it has no completion state, no count and no tick, and it does not say the astronaut has access to any device.
 * It is shown once, in the Spaceflight Exercise context only.
 */
export default function CountermeasureGuide() {
  return (
    <Panel id="r-guide" title="Spaceflight equipment guide" icon="check">
      <p className="rounded-md border border-slate-400/40 bg-slate-400/10 px-3 py-2 text-sm text-slate-100" data-testid="guide-note">
        <strong className="text-white">Equipment information, not assigned work.</strong> {EQUIPMENT_NOTE}
      </p>
      <p className="mt-3 text-sm text-slate-100">{INTRO.text} <SourceLinks ids={INTRO.sources} /></p>

      <div className="mt-3 grid gap-3 lg:grid-cols-3" data-testid="guide-body">
        {COUNTERMEASURES.map((c) => (
          <article key={c.id} data-countermeasure={c.id} className="flex flex-col rounded-md border border-cyan-400/20 bg-black/20 p-3 text-sm">
            <div className="flex items-start gap-3">
              <figure className="m-0 shrink-0 text-center">
                <svg viewBox="0 0 24 24" className="h-14 w-14 rounded-md border border-cyan-400/30 bg-[#06142b] p-2 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={`${c.name} equipment icon (drawing, not a photo)`}>
                  {ICON_PATH[c.id]}
                </svg>
                <figcaption className="mt-0.5 text-xs text-slate-400">Icon, not a photo</figcaption>
              </figure>
              <div className="min-w-0">
                <h3 className="font-semibold text-white">{c.name}</h3>
                <p className="text-xs text-slate-300">{c.fullName}</p>
                <span className="mt-1 inline-block rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-100">{KIND_LABEL[c.kind]} equipment</span>
              </div>
            </div>
            <p className="mt-2 text-slate-100">{c.tagline}</p>
            <p className="mt-1 text-slate-200"><span className="font-semibold text-white">Used for: </span>{c.facts[0].text} <SourceLinks ids={c.facts[0].sources} /></p>
            {c.facts.length > 1 && (
              <details className="mt-2 text-slate-200">
                <summary className="cursor-pointer text-xs font-medium text-cyan-200">More from NASA</summary>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-4">
                  {c.facts.slice(1).map((f) => <li key={f.text}>{f.text} <SourceLinks ids={f.sources} /></li>)}
                </ul>
              </details>
            )}
            <p className="mt-auto pt-2 text-xs text-amber-100">Not an assignment: no work from this device is scheduled for this astronaut.</p>
          </article>
        ))}
      </div>

      <p className="mt-3 text-xs text-amber-100" data-testid="guide-status">{STATUS_NOTE.text} <SourceLinks ids={STATUS_NOTE.sources} /></p>
      <p className="mt-1 text-xs text-slate-400">{DISCLAIMER}</p>
    </Panel>
  );
}

/** Links to the exact NASA pages that support a statement, with the date NASA shows on each page. */
function SourceLinks({ ids }: { ids: string[] }) {
  return (
    <span className="text-xs text-slate-400">
      (Source{ids.length > 1 ? "s" : ""}:{" "}
      {ids.map((id, i) => {
        const s = sourceById(id);
        if (!s) return null;
        return (
          <span key={id}>{i > 0 && "; "}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline hover:text-white" aria-label={`${s.title}, NASA${s.pageDate ? `, ${s.pageDate}` : ""} (opens in a new tab)`}>{s.title}</a>
            {s.pageDate ? ` · ${s.pageDate}` : ""}
          </span>
        );
      })})
    </span>
  );
}
