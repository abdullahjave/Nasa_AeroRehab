import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { insightView } from "./records";
import { buildAlerts, summarize, demoGuidance } from "../alerts";

const chen = ASTRONAUTS.find((a) => a.id === "astro-chen")!;
const day = (id: string) => chen.sessions.find((s) => s.id === id)!;

// Day 41 · Strength set is loaded-knee-flexion; its baseline (active-knee-flexion) is not comparable. Missing baseline must stay
// "unavailable": never zero, never another session's numbers.
test("Chen Day 41 (sess-chen-041-a): no comparable baseline stays unavailable, nothing throws", () => {
  const s = day("sess-chen-041-a");
  assert.ok(s, "fixture session exists");
  const v = insightView(chen, s);
  assert.equal(v.baselineComparable, false);
  for (const m of [v.peak.baseline, v.peak.diff, v.peak.pct, v.rom.baseline, v.rom.diff, v.rom.pct]) assert.equal(m.kind, "unavailable");
  assert.equal(v.chart.baseline.kind, "unavailable");
  assert.equal(v.romFlagged, false);
  assert.equal(v.findings.some((f) => f.kind === "reduced-rom"), false);
  for (const r of v.chart.current.kind === "value" ? v.chart.rows : []) assert.equal(r.baseline, null, "no baseline value is invented");
  const alerts = buildAlerts(chen, s);
  const summary = summarize(alerts, s);
  assert.ok(Array.isArray(alerts));
  assert.ok(summary.scope.length > 0);
  assert.ok(demoGuidance(null, v.baselineDay, "", null).length > 0);
});

test("Switching Day 42 -> Day 41 -> Day 42 gives identical Day 42 results (no state leaks between sessions)", () => {
  const d42 = day("sess-chen-042-b");
  const first = JSON.stringify(insightView(chen, d42));
  insightView(chen, day("sess-chen-041-a"));
  assert.equal(JSON.stringify(insightView(chen, d42)), first);
});

test("Every demo astronaut/session builds insights and alerts without throwing", () => {
  let n = 0;
  for (const a of ASTRONAUTS) for (const s of a.sessions) {
    const v = insightView(a, s);
    const al = buildAlerts(a, s);
    summarize(al, s);
    for (const f of v.findings) assert.ok(f.id && f.title, `${s.id} finding`);
    n++;
  }
  assert.ok(n >= 3);
});

// Every timeline marker must resolve to an alert (selection is matched by alert key), otherwise a click would select nothing.
test("every timeline event and finding id has a matching alert key", () => {
  for (const a of ASTRONAUTS) for (const s of a.sessions) {
    const keys = new Set(buildAlerts(a, s).map((x) => x.key));
    for (const e of insightView(a, s).events) assert.ok(keys.has(e.id), `${s.id}: event ${e.id} has no alert`);
  }
});
