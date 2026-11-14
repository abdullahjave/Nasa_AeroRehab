"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** id of the button, so a <label htmlFor> can point at it. */
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** Extra classes for the wrapper (width, text size). */
  className?: string;
  /** Open the list aligned to the right edge of the button. */
  alignRight?: boolean;
};

/**
 * Custom select: a button that opens a listbox. Same keyboard model as a native select (arrows, Home, End, Enter, Space,
 * Escape, type to jump), with a smooth chevron and a list that matches the glass theme.
 */
export default function Select<T extends string>({ value, onChange, options, id, ariaLabel, ariaLabelledBy, className = "", alignRight = false }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIdx];

  // Close on outside press.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    // Scroll the list itself, never the page.
    const ul = list.current, li = ul?.children[active] as HTMLElement | undefined;
    if (!open || !ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop - 4;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight + 4;
  }, [open, active]);

  const show = () => { setActive(selectedIdx); setOpen(true); };
  const pick = (i: number) => { setOpen(false); if (options[i] && options[i].value !== value) onChange(options[i].value); };

  const onKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(last); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <div ref={root} className={`relative inline-block min-w-0 max-w-full align-middle ${className}`}>
      <button type="button" id={id} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}
        className={`select-btn flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-cyan-400/40 bg-navy-900 px-2.5 py-1 text-left text-white hover:border-cyan-300/80 ${open ? "border-cyan-300/80" : ""}`}>
        <span className="truncate">{current?.label ?? ""}</span>
        <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 text-cyan-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul ref={list} id={listId} role="listbox" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}
          className={`select-pop absolute z-50 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-lg border border-cyan-400/40 bg-[#041421] p-1 shadow-2xl shadow-black/60 ${alignRight ? "right-0" : "left-0"}`}>
          {options.map((o, i) => {
            const selected = i === selectedIdx;
            return (
              <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={selected}
                onPointerEnter={() => setActive(i)} onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${i === active ? "bg-cyan-400/15 text-white" : "text-slate-200"} ${selected ? "font-semibold text-white" : ""}`}>
                <span>{o.label}</span>
                <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 text-cyan-300 ${selected ? "" : "invisible"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
