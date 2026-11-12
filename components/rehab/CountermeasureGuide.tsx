"use client";

import { useId, useState } from "react";
import Panel from "@/components/ui/Panel";
import { COUNTERMEASURES, DISCLAIMER, INTRO, KIND_LABEL, STATUS_NOTE, sourceById, type CountermeasureKind } from "@/lib/countermeasures/content";

/**
 * NASA Countermeasure Guide: short, plain-language notes on ARED, COLBERT/T2 and CEVIS, each statement with its NASA source link.
 * Collapsed by default so Rehabilitation stays focused on the plan. Educational only: it never sets exercise type, load or intensity.
 */
export default function CountermeasureGuide() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CountermeasureKind | "all">("all");
  const bodyId = useId();
  const list = COUNTERMEASURES.filter((c) => kind === "all" || c.kind === kind);

  return (
    <Panel id="r-guide" title="NASA Countermeasure Guide" icon="check"
      action={
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)} data-testid="guide-toggle"
          className="rounded-md border border-cyan-300/60 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-50 hover:bg-cyan-400/20">
          {open ? "Hide guide" : "Show guide"}
        </button>
      }>
      <p className="text-xs text-slate-300">How astronauts exercise on the space station: ARED, COLBERT (T2) and CEVIS, with NASA sources.</p>
      <div id={bodyId} hidden={!open} data-testid="guide-body" className="mt-3 space-y-3">
        <p className="text-sm text-slate-100">{INTRO.text} <SourceLinks ids={INTRO.sources} /></p>

        <div role="group" aria-label="Filter by exercise type" className="flex flex-wrap gap-1.5">
          {(["all", "strength", "locomotion", "aerobic"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-cyan-300 bg-cyan-400/25 text-white" : "border-cyan-400/30 text-slate-300 hover:bg-white/10"}`}>
              {k === "all" ? "All" : KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {list.map((c) => (
            <article key={c.id} data-countermeasure={c.id} className="rounded-md border border-cyan-400/20 bg-black/20 p-3 text-sm">
              <header>
                <p className="flex flex-wrap items-center gap-2 font-semibold text-white">{c.name}
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-100">{KIND_LABEL[c.kind]}</span></p>
                <p className="text-xs text-slate-400">{c.fullName}</p>
                <p className="mt-1 text-slate-100">{c.tagline}</p>
              </header>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-slate-200">
                {c.facts.map((f) => <li key={f.text}>{f.text} <SourceLinks ids={f.sources} /></li>)}
              </ul>
              <p className="mt-2 rounded border border-slate-400/30 bg-slate-400/10 p-2 text-xs text-slate-300">{c.appNote}</p>
            </article>
          ))}
        </div>

        <p className="text-xs text-amber-100" data-testid="guide-status">{STATUS_NOTE.text} <SourceLinks ids={STATUS_NOTE.sources} /></p>
        <p className="text-xs text-slate-400">{DISCLAIMER}</p>
      </div>
    </Panel>
  );
}

/** Numbered-by-title links to the exact NASA pages that support a statement, with the date NASA shows on each page. */
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
