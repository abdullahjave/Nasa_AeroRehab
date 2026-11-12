import type { Alert } from "./types";

// Pure helpers for the optional Gemini explanation. They decide WHAT may be sent and whether a reply may be shown.
// Severity, the measured values, the primary action and the source link always come from the app, never from Gemini.

/** The only data Gemini receives. No names, ids, notes, dates or free text from records. */
export type GeminiInput = {
  /** Profile context, so the wording fits this person: the body area they are rehabbing (e.g. "left knee"), never a diagnosis. */
  rehabArea: string | null;
  missionDay: number | null;
  baselineDay: number | null;
  metric: string;
  unit: "degrees";
  currentValue: number;
  baselineValue: number | null;
  difference: number | null;
  percentChange: number | null;
  /** The status the APP assigned ("All Good", "Needs Attention", "Action Required"). The AI restates it and may not change it. */
  status: string;
  /** The app-approved next action, quoted so Gemini can build on it (it may not replace it). */
  actionText: string;
};

/** A recommendation the astronaut can act on. Status, numbers and the primary action stay the app's. */
export type GeminiExplanation = { summary: string; risk: string; actions: string[]; escalate: string };

/** null when the alert has no measured value to work from (data issues, scenario events). */
export function geminiInputFor(alert: Alert, ctx: { rehabFocus?: string; affectedLimb?: string; missionDay?: number } = {}): GeminiInput | null {
  if (!alert.geminiEligible || !alert.values) return null;
  const v = alert.values;
  // "Left knee, post-ACL reconstruction" -> "left knee": keep the body area only; the condition text is never sent.
  const area = (ctx.rehabFocus ?? "").split(",")[0].trim().toLowerCase();
  const rehabArea = /^[a-z ]{3,30}$/.test(area) ? area : ctx.affectedLimb ? `${ctx.affectedLimb} side` : null;
  const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
  return {
    rehabArea,
    missionDay: ctx.missionDay ?? null,
    baselineDay: v.baselineDay,
    metric: v.metricLabel,
    unit: v.unit,
    currentValue: r1(v.current) as number,
    baselineValue: r1(v.baseline),
    difference: r1(v.diff),
    percentChange: r1(v.pctChange),
    status: alert.label,
    actionText: alert.action.label,
  };
}

export const SYSTEM_INSTRUCTION = [
  "You are the rehabilitation assistant in a simulated astronaut mission dashboard (a hackathon prototype, not a clinical tool).",
  "You get one knee range-of-motion result (range of motion = how far the knee bends and straightens), the status the app gave it, and the app's next action.",
  "Write a short recommendation addressed to the astronaut, in plain English, using 'you'.",
  "Use only the numbers you are given; never add other numbers, thresholds, sets, reps or durations.",
  "Keep the app's status exactly as given. Never call it better, worse or more urgent than the app does.",
  "Do not diagnose, name conditions or injuries, mention medication or doses, or suggest surgery or imaging.",
  "Personalise with rehabArea and missionDay when given, but add no other facts about the person.",
  "Reply with JSON only:",
  "summary: one or two sentences on what the numbers show (current value against baseline, and the difference).",
  "risk: one or two sentences on what that status means for the astronaut right now, in plain words. Match the status: All Good means the knee is moving as far as the baseline so far; Needs Attention means movement is reduced and worth watching and following up; Action Required means the change is large enough to ask the flight surgeon before heavier exercise.",
  "actions: two or three short, concrete steps the astronaut can take next, most important first. The first step must be the app's next action (quote it). Other safe steps: repeat the same measurement to confirm, keep to the planned gentle rehabilitation and stop if movement hurts, tell the flight surgeon what you noticed.",
  "escalate: one sentence on when to tell the flight surgeon or crew medical officer (for example if movement keeps dropping, or the knee hurts, swells or feels unstable).",
].join(" ");

export function userPrompt(input: GeminiInput): string {
  return `Write the recommendation for this simulated measurement. Data: ${JSON.stringify(input)}`;
}

/** JSON Schema for the structured reply. */
export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", maxLength: 360 },
    risk: { type: "string", maxLength: 360 },
    actions: { type: "array", minItems: 2, maxItems: 3, items: { type: "string", maxLength: 240 } },
    escalate: { type: "string", maxLength: 300 },
  },
  required: ["summary", "risk", "actions", "escalate"],
} as const;

// Words that would turn a recommendation into a diagnosis, a prescription or an alarm. Plain advice ("should", "risk", "flight surgeon") is allowed.
const BANNED = /\b(diagnos\w*|prescrib\w*|medicat\w*|medicin\w*|drugs?|painkillers?|ibuprofen|dos(e|age)s?|surger\w*|disease\w*|fractur\w*|rupture\w*|ligament\w*|tear(s|ing)?|arthritis|emergenc\w*|life-threatening|dangerous)\b/i;

const n1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");
function allowedNumbers(i: GeminiInput): Set<string> {
  const out = new Set<string>();
  for (const v of [i.currentValue, i.baselineValue, i.difference, i.percentChange, i.missionDay, i.baselineDay]) {
    if (v === null) continue;
    const a = Math.abs(v);
    out.add(n1(a)); out.add(String(Math.round(a))); out.add(a.toFixed(1)); out.add(a.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  }
  return out;
}

export type Validation = { ok: true; value: GeminiExplanation } | { ok: false; reason: string };

function cleanText(v: unknown, key: string, max: number, allowed: Set<string>): { ok: true; t: string } | { ok: false; reason: string } {
  if (typeof v !== "string") return { ok: false, reason: `missing-${key}` };
  const t = v.replace(/\s+/g, " ").trim();
  if (t.length < 8 || t.length > max) return { ok: false, reason: `length-${key}` };
  if (BANNED.test(t)) return { ok: false, reason: `banned-word-${key}` };
  for (const m of t.match(/\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(m) && !allowed.has(n1(Number(m)))) return { ok: false, reason: `number-${key}` };
  return { ok: true, t };
}

/** Accepts only a short summary, risk line, 2-3 actions and an escalation line that use no numbers other than the given ones and no diagnosis or medication words. */
export function validateExplanation(raw: unknown, input: GeminiInput): Validation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not-an-object" };
  const o = raw as Record<string, unknown>;
  const allowed = allowedNumbers(input);
  const fields: Record<"summary" | "risk" | "escalate", string> = { summary: "", risk: "", escalate: "" };
  for (const [k, max] of [["summary", 360], ["risk", 360], ["escalate", 300]] as const) {
    const r = cleanText(o[k], k, max, allowed);
    if (!r.ok) return r;
    fields[k] = r.t;
  }
  if (!Array.isArray(o.actions) || o.actions.length < 2 || o.actions.length > 3) return { ok: false, reason: "actions-count" };
  const actions: string[] = [];
  for (let i = 0; i < o.actions.length; i++) {
    const r = cleanText(o.actions[i], `action-${i}`, 240, allowed);
    if (!r.ok) return r;
    actions.push(r.t);
  }
  return { ok: true, value: { ...fields, actions } };
}

/** Pulls JSON out of a model reply that may be wrapped in a code fence. */
export function parseModelJson(text: string | undefined): unknown {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { return null; }
}
