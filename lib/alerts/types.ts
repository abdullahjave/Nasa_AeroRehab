// Shared alert presentation model (Step 12). One Alert is built from the existing insight findings and measurement
// comparisons; Overview and AI Insights both render from the same list, so they cannot disagree.

/** good = green "All Good", attention = yellow "Needs Attention", action = red "Action Required", neutral = data issue. */
export type Severity = "good" | "attention" | "action" | "neutral";
export type AlertKind = "health" | "data";

export const SEVERITY_LABEL: Record<Severity, string> = {
  good: "All Good",
  attention: "Needs Attention",
  action: "Action Required",
  neutral: "Data Unavailable",
};

export type AlertAction = {
  /** Plain action text shown on the primary button. */
  label: string;
  /** "review-session" opens the source session (Joint Analytics) with side and time; others are plain links. */
  kind: "review-session" | "check-sensor" | "continue-plan" | "manage-records";
  href: string;
};

/** Numbers Gemini may be given for this alert (and nothing else). null for alerts without a measured value. */
export type AlertValues = {
  metricKey: "romDeg";
  metricLabel: string;
  unit: "degrees";
  current: number;
  baseline: number | null;
  diff: number | null;
  pctChange: number | null;
  baselineDay: number | null;
};

export type Alert = {
  /** Stable id: `alert:<finding id>` or `alert:<check>:<session id>` when no finding exists. */
  id: string;
  /** Provider selection key: the source finding id when there is one, else the alert id. */
  key: string;
  astronautId: string;
  sessionId: string;
  sessionLabel: string;
  missionDay: number;
  kind: AlertKind;
  severity: Severity;
  /** Text label shown with the colour and icon. Differs from SEVERITY_LABEL for data states ("Baseline Unavailable"). */
  label: string;
  title: string;
  metric: string;
  /** Source finding id (existing insight finding), or null when the alert is a status check with no finding. */
  findingId: string | null;
  /** What changed, in plain language, including the measured difference where one exists. */
  changed: string;
  action: AlertAction;
  /** Built-in explanation: "Why am I seeing this?" sentences (meaning, comparison, reason). */
  why: string[];
  /** One-line summary of the built-in explanation (used when Gemini is not used). */
  explanation: string;
  source: { label: string; findingSource: "calculated" | "measured" | "seeded" | "status"; side: "left" | "right"; tSec: number | null; sessionId: string } | null;
  /** Set only when the severity comes from an explicit simulated scenario. */
  simulatedScenario: string | null;
  /** Demo guidance for this alert. Never clinically reviewed in this build. */
  guidance: { items: string[]; sourceLabel: string; reviewed: boolean } | null;
  values: AlertValues | null;
  geminiEligible: boolean;
  /** Sort time in seconds (null = whole session). */
  tSec: number | null;
};

export type StatusSummary = {
  primary: Alert | null;
  /** What the status covers, e.g. "Checks available for this session: knee range of motion vs your Day 30 baseline." */
  scope: string;
  /** Data and sensor issues, kept separate from the health status. */
  dataIssues: Alert[];
  /** Health findings other than the primary one. */
  moreHealth: Alert[];
};
