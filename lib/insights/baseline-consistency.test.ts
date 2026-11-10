import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { insightView } from "./records";
import { REDUCED_ROM_DEMO } from "./config";

// The Overview "Baseline Deviation" card and the AI "Reduced ROM" finding read the same comparison, so a session
// the card calls "Outside Baseline" (ROM change beyond the limit) must be the one that carries the finding.
test("Overview baseline status agrees with the Reduced ROM finding for every session", () => {
  const limit = Math.abs(REDUCED_ROM_DEMO.thresholdPct);
  let checked = 0;
  for (const a of ASTRONAUTS) {
    for (const s of a.sessions) {
      const v = insightView(a, s);
      if (v.rom.pct.kind !== "value") continue;
      checked++;
      const drop = v.rom.pct.value <= -limit;
      assert.equal(v.romFlagged, drop, `${s.id}: pct ${v.rom.pct.value}`);
      assert.equal(v.findings.some((f) => f.kind === "reduced-rom"), drop, `${s.id}: finding`);
    }
  }
  assert.ok(checked > 0);
});

test("Chen Day 42: ROM 114 vs baseline 121 is -5.8%, outside the +/-5% limit", () => {
  const chen = ASTRONAUTS.find((a) => a.id === "astro-chen")!;
  const v = insightView(chen, chen.sessions[chen.sessions.length - 1]);
  assert.equal(v.rom.pct.kind === "value" && Math.round(v.rom.pct.value * 10) / 10, -5.8);
});
