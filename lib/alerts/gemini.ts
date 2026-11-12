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
  /** The app-approved next action, quoted so Gemini can explain why it is relevant (it may not add another). */
  actionText: string;
};

export type GeminiExplanation = { meaning: string; change: string; relevance: string };

/** null when the alert has no measured value to explain (data issues, scenario events). */
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
    actionText: alert.action.label,
  };
}

export const SYSTEM_INSTRUCTION = [
  "You explain one simulated measurement from a rehabilitation dashboard demo to the astronaut, in plain English.",
  "Personalise the wording using rehabArea (the body area this person is rehabbing) and missionDay when given, but add no other facts about them.",
  "Use only the numbers in the data you are given. Do not add other numbers, thresholds or limits.",
  "Do not diagnose, name conditions, give treatment, exercise or medical advice, or say what the person should do.",
  "Do not say whether the result is good or bad or urgent. The app shows that separately.",
  "Reply with JSON only, in three short plain sentences or fewer per field:",
  "meaning: what the metric means in everyday words (range of motion is how far the knee moved).",
  "change: what changed, using the given current value, baseline and difference.",
  "relevance: why the given action text is a relevant thing to do next. Quote that action; do not add any other action.",
].join(" ");

export function userPrompt(input: GeminiInput): string {
  return `Explain this simulated measurement. Data: ${JSON.stringify(input)}`;
}

/** JSON Schema for the structured reply. */
export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meaning: { type: "string", maxLength: 320 },
    change: { type: "string", maxLength: 320 },
    relevance: { type: "string", maxLength: 320 },
  },
  required: ["meaning", "change", "relevance"],
} as const;

// Words that would turn an explanation into advice, a diagnosis or an urgency claim.
const BANNED = /\b(diagnos\w*|prescrib\w*|treat\w*|therap\w*|medicat\w*|dos(e|age)s?|surger\w*|injur\w*|pain\w*|disease\w*|symptom\w*|should|must|recommend\w*|doctor\w*|physician\w*|urgent\w*|emergenc\w*|risk\w*|dangerous|serious)\b/i;

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

/** Accepts only three short strings that use no numbers other than the given ones and contain no advice words. */
export function validateExplanation(raw: unknown, input: GeminiInput): Validation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not-an-object" };
  const o = raw as Record<string, unknown>;
  const out: Partial<GeminiExplanation> = {};
  const allowed = allowedNumbers(input);
  for (const k of ["meaning", "change", "relevance"] as const) {
    const v = o[k];
    if (typeof v !== "string") return { ok: false, reason: `missing-${k}` };
    const t = v.replace(/\s+/g, " ").trim();
    if (t.length < 8 || t.length > 320) return { ok: false, reason: `length-${k}` };
    if (BANNED.test(t)) return { ok: false, reason: `banned-word-${k}` };
    for (const m of t.match(/\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(m) && !allowed.has(n1(Number(m)))) return { ok: false, reason: `number-${k}` };
    out[k] = t;
  }
  return { ok: true, value: out as GeminiExplanation };
}

/** Pulls JSON out of a model reply that may be wrapped in a code fence. */
export function parseModelJson(text: string | undefined): unknown {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { return null; }
}
