import { insightView, IREASON_TEXT, REDUCED_ROM_DEMO, type Finding, type InsightView } from "../insights";
import type { AstronautRecord, Sensor, Session } from "../demo/types";
import { SEVERITY_LABEL, type Alert, type Severity, type StatusSummary } from "./types";
import { GUIDANCE_SOURCE, demoGuidance, mmss } from "./guidance";
import { READINGS, ROM_MEANING } from "./glossary";

const n1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");
const signed = (v: number, unit = "") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n1(Math.abs(v))}${unit}`;

export const ROM_METRIC = READINGS.knee.technical;
export { ROM_MEANING };
const REVIEW = "Review this session";
const CHECK_SENSOR = "Check sensor connection";

const SENSOR_NAME: Partial<Record<Sensor["site"], string>> = { thigh: "Thigh", shank: "Shank" };

/** Priority for sorting: red, yellow, green; data issues come after health findings. */
const RANK: Record<Severity, number> = { action: 0, attention: 1, good: 2, neutral: 3 };
export function compareAlerts(a: Alert, b: Alert): number {
  const k = (a.kind === "health" ? 0 : 1) - (b.kind === "health" ? 0 : 1);
  if (k) return k;
  const r = RANK[a.severity] - RANK[b.severity];
  if (r) return r;
  // Then time: a whole-session item (null) comes first.
  const ta = a.tSec ?? -1;
  const tb = b.tSec ?? -1;
  if (ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

type Required = "id" | "key" | "kind" | "severity" | "label" | "title" | "metric" | "findingId" | "changed" | "action" | "why" | "explanation";
function base(a: AstronautRecord, s: Session, over: Pick<Alert, Required> & Partial<Alert>): Alert {
  return {
    astronautId: a.id, sessionId: s.id, sessionLabel: s.label, missionDay: s.missionDay,
    source: null, simulatedScenario: null, guidance: null, values: null, geminiEligible: false, tSec: null,
    ...over,
  };
}

const reviewAction = { label: REVIEW, kind: "review-session" as const, href: "/joint-analytics" };

/** Recorded data: an astronaut with no saved sessions. Nothing is evaluated and nothing is shown as normal. */
function emptyAlert(a: AstronautRecord, s: Session): Alert {
  return base(a, s, {
    id: `alert:no-sessions:${a.id}`, key: `alert:no-sessions:${a.id}`, kind: "data", severity: "neutral", label: "No Sessions Yet",
    title: "No knee sessions saved yet", metric: ROM_METRIC, findingId: null,
    changed: "No knee sessions are saved for this astronaut yet, so no status is given.",
    action: { label: "Add session", kind: "manage-records", href: "/patient-management" },
    why: ["Recorded mode only shows sessions that were saved in this app.", "Nothing is filled in from demo data, so there is nothing to evaluate until a session is added."],
    explanation: "No saved sessions, so no status is shown.",
  });
}

function romAlert(a: AstronautRecord, s: Session, v: InsightView, nextExercise: string): Alert {
  const rom = v.rom;
  const side = v.context.side;
  const rec = s.recorded;
  if (rec?.empty) return emptyAlert(a, s);
  // Recorded sessions are typed in by hand: there is no sensor to check. On request, only the minimal numeric input (never names or notes) goes to the AI service.
  const manage = { label: "Edit this session", kind: "manage-records" as const, href: "/patient-management" };
  const statusSource = { label: "Status check from this session", findingSource: "status" as const, side, tSec: null, sessionId: s.id };
  const reasonOf = (m: { kind: string; reason?: string }) => (m.kind === "unavailable" && m.reason ? IREASON_TEXT[m.reason] ?? m.reason : "");

  // 1. No usable reading.
  if (rom.current.kind !== "value") {
    return base(a, s, {
      id: `alert:rom-check:${s.id}`, key: `alert:rom-check:${s.id}`, kind: "data", severity: "neutral", label: "Data Unavailable",
      title: "Knee movement could not be read", metric: ROM_METRIC, findingId: null,
      changed: "This session has no usable knee reading, so no status is given.",
      action: rec ? manage : { label: CHECK_SENSOR, kind: "check-sensor", href: "/settings" },
      why: [ROM_MEANING, "This check needs a measured peak and minimum knee angle from the session.", `It is unavailable here (${(reasonOf(rom.current) || "measurement missing").toLowerCase()}), so the app does not guess a status.`],
      explanation: "No usable ROM reading, so no status is shown.", source: statusSource,
    });
  }
  const cur = rom.current.value;
  // 1b. This recorded session is itself the saved baseline: later sessions are compared with it, it is not compared with itself.
  if (rec?.isBaseline) {
    return base(a, s, {
      id: `alert:rom-check:${s.id}`, key: `alert:rom-check:${s.id}`, kind: "data", severity: "neutral", label: "Baseline Session",
      title: "This is your baseline session", metric: ROM_METRIC, findingId: null,
      changed: `Your knee moved ${n1(cur)}° in this session. Later sessions for the same knee and movement are compared with it.`,
      action: { label: "Add session", kind: "manage-records", href: "/patient-management" },
      why: [ROM_MEANING, `You chose this session as the baseline for the ${side} knee (${v.context.protocol}).`, "A session is never compared with itself, so no status is given here."],
      explanation: "This session is the saved baseline; it has no comparison of its own.",
      source: statusSource,
    });
  }
  // 2. No comparable baseline.
  if (rom.baseline.kind !== "value" || rom.diff.kind !== "value" || rom.pct.kind !== "value") {
    const why = reasonOf(rom.baseline) || "No comparable baseline";
    return base(a, s, {
      id: `alert:rom-check:${s.id}`, key: `alert:rom-check:${s.id}`, kind: "data", severity: "neutral", label: "Baseline Unavailable",
      title: "Knee movement has no baseline to compare with", metric: ROM_METRIC, findingId: null,
      changed: `Your knee moved ${n1(cur)}° in this session. There is no baseline session to compare it with, so no status is given.`,
      action: rec ? { label: "Choose a baseline", kind: "manage-records", href: "/patient-management" } : { label: REVIEW, kind: "review-session", href: "/joint-analytics" },
      why: [ROM_MEANING, `A comparison needs a baseline from the same knee (${side}) and the same movement (${v.context.protocol}).`, `Here: ${why.toLowerCase()}, so the app shows "Baseline Unavailable" instead of a green or yellow status.`],
      explanation: `Baseline Unavailable (${why.toLowerCase()}); ROM is not compared.`, source: statusSource,
    });
  }
  const b = rom.baseline.value;
  const d = rom.diff.value;
  const p = rom.pct.value;
  const values = { metricKey: "romDeg" as const, metricLabel: ROM_METRIC, unit: "degrees" as const, current: cur, baseline: b, diff: d, pctChange: p, baselineDay: v.baselineDay };
  const compared = `${n1(cur)}° compared with ${n1(b)}° on Day ${v.baselineDay}: ${signed(d, "°")} (${signed(p, "%")})`;
  // The rule compares with one baseline session, so the wording says "baseline session", never "usual range".
  const moved = `${n1(Math.abs(d))}° ${d < 0 ? "less" : "more"}`;
  const compareSentence = `Your knee moved ${moved} than in your baseline session (Day ${v.baselineDay}). Range of motion: ${compared}. Both were recorded on the same ${side} knee with the same movement.`;
  const calcSource = { label: "Calculated from measurements", findingSource: "calculated" as const, side, tSec: null, sessionId: s.id };

  if (v.romFlagged) {
    const sc = s.alertScenario;
    const finding = v.findings.find((f) => f.kind === "reduced-rom");
    const findingId = finding?.id ?? null;
    const severity: Severity = sc ? "action" : "attention";
    return base(a, s, {
      id: `alert:${findingId ?? `rom-flag:${s.id}`}`, key: findingId ?? `alert:rom-flag:${s.id}`, kind: "health", severity, label: SEVERITY_LABEL[severity],
      title: "Your knee moved less than usual", metric: ROM_METRIC, findingId,
      changed: "Your knee moved less than usual in this session.",
      action: reviewAction,
      why: [
        compareSentence,
        ROM_MEANING,
        `You see this because the change was ${signed(p, "%")} and the demo rule flags a change of ${REDUCED_ROM_DEMO.thresholdPct}% or lower. This is a demo setting, not a clinical limit.`,
        ...(sc ? [`It is shown as Action Required only because this session is a labelled simulated scenario: ${sc.label}.`] : []),
      ],
      explanation: `Your knee moved ${moved} than in your baseline session (${signed(p, "%")}), which meets the demo rule (${REDUCED_ROM_DEMO.thresholdPct}% or lower).`,
      source: calcSource,
      simulatedScenario: sc?.label ?? null,
      guidance: { items: demoGuidance("reduced-rom", v.baselineDay, nextExercise, null), sourceLabel: GUIDANCE_SOURCE, reviewed: false },
      values, geminiEligible: true,
    });
  }
  // 3. Evaluated and within the configured demo range.
  return base(a, s, {
    id: `alert:rom-check:${s.id}`, key: `alert:rom-check:${s.id}`, kind: "health", severity: "good", label: SEVERITY_LABEL.good,
    title: "Your knee movement is in line with your baseline session", metric: ROM_METRIC, findingId: null,
    changed: "Your knee moved about as far as in your baseline session.",
    action: { label: "Continue today's plan", kind: "continue-plan", href: "/rehabilitation" },
    why: [compareSentence, ROM_MEANING, `No finding was raised because the change (${signed(p, "%")}) does not reach the demo rule (${REDUCED_ROM_DEMO.thresholdPct}% or lower). This is a demo setting, not a clinical limit.`],
    explanation: `Your knee moved ${moved} than in your baseline session (${signed(p, "%")}), which is inside the demo range.`,
    source: calcSource, values, geminiEligible: true,
  });
}

function eventAlert(a: AstronautRecord, s: Session, v: InsightView, f: Finding, nextExercise: string): Alert {
  const t = f.tSec ?? 0;
  const measured = f.kind === "data-gap";
  const label = f.title;
  return base(a, s, {
    id: `alert:${f.id}`, key: f.id, kind: measured ? "data" : "health", severity: measured ? "neutral" : "attention",
    label: measured ? "Data Unavailable" : SEVERITY_LABEL.attention,
    title: measured ? "Gap in knee readings" : label, metric: f.metric, findingId: f.id,
    changed: measured ? f.text : `A simulated scenario flagged a movement pattern (${label.toLowerCase()}) at ${mmss(t)} in this session.`,
    action: measured ? { label: CHECK_SENSOR, kind: "check-sensor", href: "/settings" } : { ...reviewAction },
    why: measured
      ? ["A data gap means the knee sensor sent no readings for a stretch of the session.", "The app found it by looking for missing samples, so it is a measurement issue, not a health finding.", "Values inside the gap are not estimated."]
      : ["This event comes from the demo scenario itself, not from a measurement threshold.", `It marks a moment at ${mmss(t)} where the simulation shows the pattern "${label.toLowerCase()}".`, "It is shown so the review flow can be tried; it is not a clinical detection."],
    explanation: measured ? "Measured gap in the knee readings." : "Seeded demo scenario event, not detected from measurements.",
    source: { label: measured ? "Measured data gap" : "Seeded demo scenario event", findingSource: measured ? "measured" : "seeded", side: v.context.side, tSec: t, sessionId: s.id },
    guidance: { items: demoGuidance(f.kind, v.baselineDay, nextExercise, t), sourceLabel: GUIDANCE_SOURCE, reviewed: false },
    tSec: t,
  });
}

/** Simulated sensor state (Demo only; Recorded mode has no connected sensors): a disconnected or low IMU is a data issue with a Settings link. */
function sensorAlerts(a: AstronautRecord, s: Session): Alert[] {
  const out: Alert[] = [];
  for (const sn of a.sensors) {
    const name = SENSOR_NAME[sn.site];
    if (!name) continue; // knee checks use the thigh and shank IMUs only
    const off = sn.status === "offline";
    if (!off && sn.status !== "low-battery") continue;
    out.push(base(a, s, {
      id: `alert:sensor:${a.id}:${sn.id}:${off ? "offline" : "low"}`, key: `alert:sensor:${a.id}:${sn.id}`, kind: "data", severity: "neutral",
      label: "Data Unavailable", title: `${name} sensor ${off ? "is disconnected" : "battery is low"}`, metric: "Sensor status", findingId: null,
      changed: off ? `The ${name.toLowerCase()} sensor is disconnected, so its simulated knee data is unavailable. Saved sessions are not affected.` : `The ${name.toLowerCase()} sensor battery is at ${sn.battery}%.`,
      action: { label: CHECK_SENSOR, kind: "check-sensor", href: "/settings" },
      why: ["The knee checks use the thigh and shank motion sensors.", off ? "This sensor reports as offline right now (simulated status), which is separate from the saved session's readings." : "This sensor reports a low battery right now (simulated status).", "This is a data issue, not a health finding."],
      explanation: off ? "The simulated sensor is disconnected." : "The simulated sensor battery is low.",
    }));
  }
  return out;
}

/** All alerts for one astronaut and session, sorted: health by severity then time, then data issues. */
export function buildAlerts(a: AstronautRecord, s: Session, opts: { nextExercise?: string } = {}): Alert[] {
  const nextExercise = opts.nextExercise ?? "your current plan";
  const v = insightView(a, s);
  const alerts: Alert[] = [romAlert(a, s, v, nextExercise)];
  for (const f of v.findings) if (f.kind !== "reduced-rom") alerts.push(eventAlert(a, s, v, f, nextExercise));
  alerts.push(...sensorAlerts(a, s));
  return alerts.sort(compareAlerts);
}

/** What the Your Status card shows. Data issues are listed separately and never turn the status green or red. */
export function summarize(alerts: Alert[], s: Session): StatusSummary {
  const health = alerts.filter((x) => x.kind === "health");
  const data = alerts.filter((x) => x.kind === "data");
  const evaluated = health.find((x) => x.values !== null);
  const scope = s.recorded?.empty
    ? "No knee sessions are saved for this astronaut yet, so no status is given."
    : evaluated
    ? `Based on the checks available for ${s.label}: knee range of motion against your personal baseline${evaluated.values?.baselineDay ? ` (Day ${evaluated.values.baselineDay})` : ""}.`
    : `No check could be evaluated for ${s.label}, so no status is given.`;
  const primary = health[0] ?? data.find((x) => x.id.startsWith("alert:rom-check")) ?? data[0] ?? null;
  return { primary, scope, dataIssues: data.filter((x) => x !== primary), moreHealth: health.filter((x) => x !== primary) };
}
