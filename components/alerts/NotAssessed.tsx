import Link from "next/link";
import { NOT_ASSESSED } from "@/lib/alerts/scope";

/**
 * The readings that have NO alert rule. A status on this page covers only the checks that exist (knee range of motion against a personal baseline),
 * so these are listed as "Not assessed": an "All Good" never means they were looked at. Their values stay visible under Measurement details, without a status.
 */
export default function NotAssessed() {
  return (
    <div className="mt-2 rounded-md border border-slate-400/30 bg-slate-400/5 px-2 py-1.5 text-xs text-slate-300" data-testid="not-assessed">
      <span className="font-medium text-slate-200">Not assessed (no alert rule):</span>{" "}
      {NOT_ASSESSED.map((n, i) => (
        <span key={n.label}>{i > 0 && " · "}<Link href={n.href} className="text-cyan-300 hover:underline">{n.label}</Link></span>
      ))}
      . These readings are shown without a status, so no status on this page covers them.
    </div>
  );
}
