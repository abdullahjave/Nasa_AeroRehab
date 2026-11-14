import Link from "next/link";
import { ICONS, type IconName } from "@/lib/icons";

type Props = {
  id: string;
  title: string;
  icon?: IconName;
  /** Existing route this card links to. Omit for non-linked cards. */
  href?: string;
  linkLabel?: string;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

/** Dark glass dashboard card. The header link is the only interactive target besides inner controls. */
export default function Panel({ id, title, icon, href, linkLabel = "Details", className = "", action, children }: Props) {
  return (
    <section aria-labelledby={`${id}-title`} className={`glass flex min-w-0 flex-col rounded-lg p-3 ${className}`}>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 id={`${id}-title`} className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
          {icon && (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[icon]} />
            </svg>
          )}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {action}
          {href && (
            <Link href={href} aria-label={`${title}: ${linkLabel}`} className="rounded px-1 text-[13px] text-cyan-300 hover:text-white hover:underline">
              {linkLabel} &rarr;
            </Link>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Big number + unit. null renders as Unavailable, never 0. */
export function Stat({ label, value, unit, sub, digits, big = false }: { label: string; value: number | null; unit?: string; sub?: string; digits?: number; big?: boolean }) {
  const missing = value === null;
  const text = missing ? "Unavailable" : digits !== undefined ? value.toFixed(digits) : value.toLocaleString("en-US");
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-slate-300">{label}</p>
      <p className={`font-semibold tabular-nums ${missing ? "text-sm text-amber-200" : big ? "text-2xl text-white" : "text-xl text-white"}`}>
        {text}
        {!missing && unit && <span className="ml-1 text-xs font-normal text-slate-300">{unit}</span>}
      </p>
      {sub && <p className="text-[12px] text-slate-400">{sub}</p>}
    </div>
  );
}

export function Chip({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "cyan" }) {
  const t = tone === "green" ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300" : tone === "amber" ? "border-amber-300/70 bg-amber-300/10 text-amber-200" : "border-cyan-300/60 bg-cyan-300/10 text-cyan-200";
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}
