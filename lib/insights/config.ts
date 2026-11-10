/**
 * The single demo threshold used to raise a "Reduced ROM" finding.
 *
 * Comparison rule: a finding is raised when the baseline is comparable (same knee side, movement and protocol) and
 *   percentChange(ROM) = (current ROM - baseline ROM) / baseline ROM * 100  <=  thresholdPct   (inclusive).
 * Exactly -5.000% is flagged; -4.999% is not. This is a demo setting, not a clinical cut-off.
 */
export const REDUCED_ROM_DEMO = {
  id: "reduced-rom-demo",
  metric: "romDeg",
  thresholdPct: -5,
  label: "Reduced ROM vs personal baseline (demo threshold)",
} as const;

export type ReducedRomConfig = { thresholdPct: number };
