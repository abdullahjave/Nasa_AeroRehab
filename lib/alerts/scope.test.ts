import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { buildAlerts } from "./build";
import { NOT_ASSESSED } from "./scope";

// A status ("All Good" included) must never imply that walking, pressure or balance were assessed: no alert rule looks at them.

test("no alert for any astronaut or session mentions walking, pressure or balance (no rule exists, so they are 'Not assessed')", () => {
  let checked = 0;
  for (const a of ASTRONAUTS) {
    for (const s of a.sessions) {
      for (const alert of buildAlerts(a, s)) {
        checked++;
        // A knee measurement protocol id such as "balance-drill-knee-tracking" names the context of a KNEE reading; it is not a balance assessment.
        const text = [alert.title, alert.metric, alert.changed, alert.explanation, alert.label, ...alert.why].join(" \n ").replace(/\b[a-z]+(-[a-z]+)*-knee-(flexion|tracking)\b/g, "");
        for (const n of NOT_ASSESSED) {
          const m = n.pattern.exec(text);
          assert.equal(m, null, `${a.id} ${s.id} ${alert.id} mentions ${n.label}: "${m?.[0]}" near "${m ? text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " ") : ""}"`);
        }
        assert.ok(alert.values === null || alert.values.metricKey === "romDeg", "measured values are knee range of motion only");
      }
    }
  }
  assert.ok(checked >= 10, `only ${checked} alerts were checked`);
});

test("the Not-assessed list names exactly the three readings without an alert rule and links to their pages", () => {
  assert.deepEqual(NOT_ASSESSED.map((n) => n.label), ["Walking pace", "Load & pressure", "Balance"]);
  assert.deepEqual(NOT_ASSESSED.map((n) => n.href), ["/gait-analysis", "/load-pressure", "/stability-balance"]);
});

test("the one measured check that can read All Good is knee range of motion against a baseline, and says so in its scope", () => {
  const a = ASTRONAUTS[0];
  const good = a.sessions.flatMap((s) => buildAlerts(a, s)).filter((x) => x.severity === "good");
  for (const g of good) { assert.match(g.metric, /range of motion/i); assert.match(g.title + g.changed, /baseline/i); }
});
