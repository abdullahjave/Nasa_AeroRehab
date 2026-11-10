import { METRIC_META, type Agg, type MetricKey, type Row } from "@/lib/reports";

/** Display only: rounds at the edge, keeps "mean" and the valid session count visible. */
export function fmtAgg(a: Agg, m: MetricKey) {
  if (a.kind !== "value") return "No comparable data";
  const meta = METRIC_META[m];
  return `${a.mean.toFixed(meta.digits)}${meta.unit}${a.n > 1 ? ` (mean, n=${a.n})` : " (n=1)"}`;
}

export function fmtChange(r: Row) {
  if (r.change === null) return "Unavailable";
  const meta = METRIC_META[r.metric];
  const sign = r.change > 0 ? "+" : r.change < 0 ? "−" : "±";
  const pct = r.changePct === null ? "" : ` (${r.changePct > 0 ? "+" : r.changePct < 0 ? "−" : ""}${Math.abs(r.changePct).toFixed(1)}%)`;
  return `${sign}${Math.abs(r.change).toFixed(meta.digits)}${meta.unit}${pct}`;
}

/** About `count` evenly spaced mission-day ticks, always including both ends. */
export function tickDays(start: number, end: number, count: number) {
  if (end <= start) return [start];
  const step = Math.max(1, Math.round((end - start) / (count - 1)));
  const out: number[] = [];
  for (let d = start; d < end; d += step) out.push(d);
  if (out[out.length - 1] !== end) out.push(end);
  return out;
}
