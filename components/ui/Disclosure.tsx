"use client";

import { useId, useState } from "react";

/** A collapsed section the reader opens on purpose, so secondary detail does not compete with the main story. */
export default function Disclosure({ title, hint, children, defaultOpen = false }: { title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="space-y-3">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="glass flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-white hover:bg-white/5">
        <span>{title}{hint && <span className="font-normal text-slate-400"> &middot; {hint}</span>}</span>
        <span aria-hidden="true" className={`shrink-0 text-cyan-300 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>&#9662;</span>
      </button>
      {open && <div id={id} className="reveal space-y-3">{children}</div>}
    </section>
  );
}
