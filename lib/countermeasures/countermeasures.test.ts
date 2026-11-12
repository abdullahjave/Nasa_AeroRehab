import test from "node:test";
import assert from "node:assert/strict";
import { COUNTERMEASURES, DISCLAIMER, INTRO, SOURCES, STATUS_NOTE, sourceById, type Fact } from "./content";

const facts: Fact[] = [INTRO, STATUS_NOTE, ...COUNTERMEASURES.flatMap((c) => c.facts)];
const words = (t: string) => t.trim().split(/\s+/).length;

test("the guide covers ARED, COLBERT/T2 and CEVIS, each with its NASA full name", () => {
  assert.deepEqual(COUNTERMEASURES.map((c) => c.id), ["ared", "colbert", "cevis"]);
  assert.equal(COUNTERMEASURES[0].fullName, "Advanced Resistive Exercise Device");
  assert.equal(COUNTERMEASURES[1].fullName, "Combined Operational Load Bearing External Resistance Treadmill");
  assert.equal(COUNTERMEASURES[2].fullName, "Cycle Ergometer with Vibration Isolation and Stabilization System");
  assert.deepEqual(COUNTERMEASURES.map((c) => c.kind), ["strength", "locomotion", "aerobic"]);
});

test("every statement cites at least one existing NASA source and carries its supporting NASA wording", () => {
  for (const f of facts) {
    assert.ok(f.sources.length >= 1, f.text);
    for (const id of f.sources) assert.ok(sourceById(id), `${id} exists`);
    assert.ok(f.evidence.length > 10 && words(f.evidence) <= 40, f.evidence);
  }
});

test("sources are official NASA pages (https, nasa.gov or ntrs.nasa.gov), unique, and record when they were read", () => {
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.equal(new Set(SOURCES.map((s) => s.url)).size, SOURCES.length);
  for (const s of SOURCES) {
    const u = new URL(s.url);
    assert.equal(u.protocol, "https:");
    assert.match(u.hostname, /(^|\.)nasa\.gov$/);
    assert.equal(s.publisher, "NASA");
    assert.match(s.retrievedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  const used = new Set(facts.flatMap((f) => f.sources));
  for (const s of SOURCES) assert.ok(used.has(s.id), `${s.id} is used`);
});

test("text is short and plain, and never prescribes exercise or claims current equipment status without a dated source", () => {
  for (const f of facts) assert.ok(f.text.length <= 240, `${f.text.length}: ${f.text}`);
  for (const c of COUNTERMEASURES) { assert.ok(c.tagline.length <= 90); assert.ok(c.appNote.length <= 200); assert.match(c.appNote, /not a NASA statement/); }
  const all = [...facts.map((f) => f.text), ...COUNTERMEASURES.flatMap((c) => [c.tagline, c.appNote]), DISCLAIMER].join(" \n ");
  // No load, intensity, volume, duration or advice wording.
  assert.doesNotMatch(all, /\b\d+\s?(sets?|reps?|repetitions?|minutes?|mins?|hours?|watts?|kg|lbs?|bpm)\b/i);
  assert.doesNotMatch(all, /\b(you should|you must|aim for|target heart|at \d+ ?%|per week|times a week)\b/i);
  // "current/currently/now" only inside the dated status statement.
  for (const f of facts.filter((x) => x !== STATUS_NOTE)) assert.doesNotMatch(f.text, /\b(currently|right now|today|is in use)\b/i, f.text);
  assert.match(STATUS_NOTE.text, /May 2024/); assert.match(STATUS_NOTE.text, /does not confirm what is in use today/);
  assert.match(DISCLAIMER, /not a prescription/);
});

test("the CEVIS replacement is reported as a dated 2023 statement, not as current hardware", () => {
  const f = COUNTERMEASURES[2].facts.find((x) => /Teal/.test(x.text))!;
  assert.match(f.text, /2023 NASA poster/); assert.match(f.text, /was to replace/);
});
