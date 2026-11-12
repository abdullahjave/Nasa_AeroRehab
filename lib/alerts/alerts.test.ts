import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import type { AstronautRecord, Session } from "../demo/types";
import { buildAlerts, summarize } from "./build";
import { READINGS, NO_RULE_NOTE } from "./glossary";
import { geminiInputFor, parseModelJson, SYSTEM_INSTRUCTION, userPrompt, validateExplanation } from "./gemini";

const astro = (id: string) => ASTRONAUTS.find((a) => a.id === id)!;
const latest = (a: AstronautRecord) => a.sessions[a.sessions.length - 1];
// Seeded scenario events are cleared so the ROM check is the only alert being tested.
const withSession = (s: Session, patch: Partial<Session>): Session => ({ ...s, scenarioEvents: [], ...patch });

test("Chen Day 42: yellow 'Needs Attention' with plain copy, measured difference and the review action", () => {
  const a = astro("astro-chen");
  const alerts = buildAlerts(a, latest(a));
  const top = alerts[0];
  assert.equal(top.kind, "health");
  assert.equal(top.severity, "attention");
  assert.equal(top.label, "Needs Attention");
  assert.equal(top.changed, "Your knee moved less than usual in this session.");
  // The expanded explanation derives the number from the comparison and says "baseline session" (one baseline value).
  assert.match(top.why[0], /^Your knee moved 7° less than in your baseline session \(Day 30\)\./);
  assert.match(top.why[0], /114° compared with 121° on Day 30: −7° \(−5\.8%\)/);
  assert.ok(top.why.every((w) => !/usual range/i.test(w)));
  assert.equal(top.action.label, "Review this session");
  assert.equal(top.findingId, "find-sess-chen-042-b-reduced-rom");
  assert.equal(top.astronautId, "astro-chen");
  assert.equal(top.sessionId, "sess-chen-042-b");
  assert.equal(top.simulatedScenario, null);
  assert.equal(top.source?.side, "left");
});

test("red 'Action Required' appears only for the explicit simulated scenario and says so", () => {
  const o = astro("astro-okafor");
  const top = buildAlerts(o, latest(o))[0];
  assert.equal(top.severity, "action");
  assert.equal(top.label, "Action Required");
  assert.match(top.simulatedScenario ?? "", /Simulated scenario/);
  assert.ok(top.why.some((w) => /labelled simulated scenario/.test(w)));
  // No other fixture session is red.
  for (const a of ASTRONAUTS) for (const s of a.sessions) {
    const red = buildAlerts(a, s).some((x) => x.severity === "action");
    assert.equal(red, !!s.alertScenario, `${s.id}`);
  }
});

test("green only when ROM was evaluated against a comparable baseline and is inside the demo range", () => {
  const a = astro("astro-chen");
  const s = latest(a);
  const ok = withSession(s, { knee: { ...s.knee, romDeg: 120 } }); // -0.8% vs 121
  const alerts = buildAlerts(a, ok);
  assert.equal(alerts[0].severity, "good");
  assert.equal(alerts[0].label, "All Good");
  assert.ok(alerts[0].values);
  assert.equal(alerts[0].action.label, "Continue today's plan");
  // An improvement is also inside the range.
  assert.equal(buildAlerts(a, withSession(s, { knee: { ...s.knee, romDeg: 130 } }))[0].severity, "good");
  // Exactly at the inclusive threshold (-5%) is flagged; just above is not.
  const edge = 121 * 0.95; // 114.95
  assert.equal(buildAlerts(a, withSession(s, { knee: { ...s.knee, romDeg: edge } }))[0].severity, "attention");
  assert.equal(buildAlerts(a, withSession(s, { knee: { ...s.knee, romDeg: edge + 0.01 } }))[0].severity, "good");
});

test("missing reading -> neutral 'Data unavailable', never green", () => {
  const a = astro("astro-chen");
  const s = latest(a);
  const alerts = buildAlerts(a, withSession(s, { knee: { ...s.knee, romDeg: null } }));
  assert.equal(alerts[0].severity, "neutral");
  assert.equal(alerts[0].label, "Data Unavailable");
  assert.equal(alerts[0].kind, "data");
  assert.equal(alerts.some((x) => x.severity === "good"), false);
  const sum = summarize(alerts, s);
  assert.equal(sum.primary?.severity, "neutral");
  assert.match(sum.scope, /No check could be evaluated/);
});

test("missing or non-comparable baseline -> neutral 'Baseline unavailable' with the reason, never green", () => {
  const a = astro("astro-chen");
  const s = latest(a);
  const noBase = buildAlerts(a, withSession(s, { joint: { ...s.joint, baseline: null } }))[0];
  assert.equal(noBase.severity, "neutral");
  assert.equal(noBase.label, "Baseline Unavailable");
  assert.match(noBase.changed, /no baseline session to compare it with/);
  assert.equal(noBase.action.label, "Review this session");
  assert.equal(noBase.values, null); // nothing to explain or send anywhere
  // Chen Day 41 uses a different protocol, so the Day 30 baseline is not comparable.
  const d41 = a.sessions.find((x) => x.missionDay === 41)!;
  assert.equal(buildAlerts(a, d41)[0].label, "Baseline Unavailable");
});

test("empty alert list is never read as 'all good': a session with no usable check has no green", () => {
  for (const a of ASTRONAUTS) for (const s of a.sessions) {
    const alerts = buildAlerts(a, s);
    const green = alerts.filter((x) => x.severity === "good");
    for (const g of green) assert.ok(g.values && g.values.baseline !== null, `${s.id}: green without an evaluated comparison`);
  }
});

test("a disconnected sensor is a separate data issue with a Settings link and does not change the health status", () => {
  const a = astro("astro-chen");
  const s = latest(a);
  const off = { ...a, sensors: a.sensors.map((x) => (x.site === "thigh" ? { ...x, status: "offline" as const, battery: null } : x)) };
  const alerts = buildAlerts(off, s);
  const sensor = alerts.find((x) => x.title.includes("sensor"))!;
  assert.equal(sensor.label, "Data Unavailable");
  assert.equal(sensor.action.label, "Check sensor connection");
  assert.equal(sensor.kind, "data");
  assert.equal(sensor.action.href, "/settings");
  assert.match(sensor.changed, /disconnected/);
  assert.equal(alerts[0].kind, "health"); // health status is unchanged and sorted first
  const sum = summarize(alerts, s);
  assert.equal(sum.primary?.severity, "attention");
  assert.ok(sum.dataIssues.some((x) => x.title.includes("sensor")));
  // Insole problems do not create a knee alert.
  const insole = { ...a, sensors: a.sensors.map((x) => (x.site === "insole-left" ? { ...x, status: "offline" as const, battery: null } : x)) };
  assert.equal(buildAlerts(insole, s).some((x) => x.title.includes("sensor")), false);
});

test("data gaps stay data issues; seeded events are health 'Needs Attention'; order is severity then time", () => {
  const o = astro("astro-okafor");
  const alerts = buildAlerts(o, latest(o));
  const events = alerts.filter((x) => x.source?.findingSource === "seeded");
  assert.equal(events.length, 2);
  assert.ok(events.every((x) => x.severity === "attention" && x.kind === "health"));
  const order = alerts.filter((x) => x.kind === "health").map((x) => `${x.severity}:${x.tSec}`);
  assert.deepEqual(order, ["action:null", "attention:380", "attention:860"]);
  // data issues come after every health finding
  const firstData = alerts.findIndex((x) => x.kind === "data");
  if (firstData >= 0) assert.ok(alerts.slice(firstData).every((x) => x.kind === "data"));
});

test("every alert carries astronaut, session, metric, severity, copy and an action; ids are unique", () => {
  for (const a of ASTRONAUTS) for (const s of a.sessions) {
    const alerts = buildAlerts(a, s);
    assert.equal(new Set(alerts.map((x) => x.id)).size, alerts.length, s.id);
    for (const x of alerts) {
      assert.equal(x.astronautId, a.id); assert.equal(x.sessionId, s.id);
      assert.ok(x.metric && x.changed && x.explanation && x.action.label && x.action.href && x.why.length >= 3, `${s.id} ${x.id}`);
      assert.ok(x.label.length > 0);
      if (x.guidance) assert.equal(x.guidance.reviewed, false);
    }
  }
});

test("Gemini input contains only metric, unit, values and the action text", () => {
  const a = astro("astro-chen");
  const top = buildAlerts(a, latest(a))[0];
  const sess = latest(a);
  const input = geminiInputFor(top, { rehabFocus: a.profile.rehabFocus, affectedLimb: a.profile.affectedLimb, missionDay: sess.missionDay })!;
  assert.deepEqual(Object.keys(input).sort(), ["actionText", "baselineDay", "baselineValue", "currentValue", "difference", "metric", "missionDay", "percentChange", "rehabArea", "unit"]);
  assert.equal(input.rehabArea, "left knee");
  const blob = JSON.stringify(input) + userPrompt(input) + SYSTEM_INSTRUCTION;
  for (const forbidden of ["Chen", "Mei", "A-007", "astro-", "sess-", "ACL", "Artemis", "Mission Specialist"]) assert.equal(blob.includes(forbidden), false, forbidden);
  // Data issues and scenario events are not sent at all.
  const o = astro("astro-okafor");
  for (const x of buildAlerts(o, latest(o))) if (x.values === null) assert.equal(geminiInputFor(x), null);
});

test("Gemini reply validation: accepts a clean explanation, rejects advice, new numbers, bad shapes", () => {
  const a = astro("astro-chen");
  const input = geminiInputFor(buildAlerts(a, latest(a))[0])!;
  const good = { meaning: "Range of motion is how far your knee moved.", change: "It was 114 degrees, 7 degrees less than the 121 degree baseline.", relevance: "Reviewing the flagged session lets you see where the movement differed." };
  assert.equal(validateExplanation(good, input).ok, true);
  assert.equal(validateExplanation({ ...good, relevance: "You should rest and take medication." }, input).ok, false);
  assert.equal(validateExplanation({ ...good, change: "It dropped below the 5 percent limit." }, input).ok, false);
  assert.equal(validateExplanation({ ...good, meaning: "This could be a serious injury." }, input).ok, false);
  assert.equal(validateExplanation({ meaning: good.meaning }, input).ok, false);
  assert.equal(validateExplanation("text", input).ok, false);
  assert.equal(validateExplanation({ ...good, change: "x".repeat(400) }, input).ok, false);
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(parseModelJson("not json"), null);
  assert.equal(parseModelJson(undefined), null);
});

test("improvement wording says 'more', and the plain-language glossary covers the four main readings", () => {
  const a = astro("astro-chen");
  const s = latest(a);
  const better = buildAlerts(a, withSession(s, { knee: { ...s.knee, romDeg: 130 } }))[0];
  assert.match(better.why[0], /^Your knee moved 9° more than in your baseline session/);
  assert.equal(better.changed, "Your knee moved about as far as in your baseline session.");
  assert.deepEqual(Object.keys(READINGS).sort(), ["balance", "knee", "pressure", "walking"]);
  assert.equal(READINGS.knee.meaning, "How far your knee bends and straightens.");
  assert.equal(READINGS.balance.technical, "Postural sway");
  assert.match(NO_RULE_NOTE, /no status is given/);
});
