import type { Severity } from "@/lib/alerts";

// Colour + icon + text together, so the status never depends on colour alone.
export const TONE: Record<Severity, { box: string; text: string; icon: string; solid: string }> = {
  good: { box: "border-emerald-400/60 bg-emerald-400/10", text: "text-emerald-200", icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM8 12l3 3 5-6", solid: "bg-emerald-400" },
  attention: { box: "border-amber-300/70 bg-amber-300/10", text: "text-amber-200", icon: "M12 3l10 18H2zM12 10v5M12 18v.5", solid: "bg-amber-300" },
  action: { box: "border-rose-400/70 bg-rose-500/15", text: "text-rose-200", icon: "M8 2h8l6 6v8l-6 6H8l-6-6V8zM12 7v6M12 16v.5", solid: "bg-rose-400" },
  neutral: { box: "border-slate-400/50 bg-slate-400/10", text: "text-slate-200", icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v.5M12 12v5", solid: "bg-slate-400" },
};

export function SeverityIcon({ severity, className = "h-5 w-5" }: { severity: Severity; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 ${TONE[severity].text}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TONE[severity].icon} />
    </svg>
  );
}

export default function AlertBadge({ severity, label, simulated = false }: { severity: Severity; label: string; simulated?: boolean }) {
  const t = TONE[severity];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t.box} ${t.text}`}>
        <SeverityIcon severity={severity} className="h-4 w-4" />
        {label}
      </span>
      {simulated && <span className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-2 py-0.5 text-[12px] font-medium text-cyan-100">Simulated scenario</span>}
    </span>
  );
}
