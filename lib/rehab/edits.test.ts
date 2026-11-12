import test from "node:test";
import assert from "node:assert/strict";
import { REHAB_KEYS, effectiveEdits, flatten, importLegacy, legacyCount, parseEditsStore, parseMigrated, setEntry, type EditsStore } from "./edits";

const E: EditsStore = {};
const legacy: EditsStore = { "astro-chen": { s1: { "s1:a": true, "s1:b": false } }, "astro-okafor": { o1: { "o1:a": true } } };

test("storage keys carry the explicit mode; the legacy key is unchanged", () => {
  assert.equal(REHAB_KEYS.legacy, "aerorehab.rehab.edits.v1");
  assert.match(REHAB_KEYS.demo, /\.demo\.v1$/); assert.match(REHAB_KEYS.recorded, /\.recorded\.v1$/);
  assert.equal(new Set(Object.values(REHAB_KEYS)).size, 4);
});

test("Recorded never reads legacy or Demo entries; Demo reads legacy as a baseline under its own entries", () => {
  const s = { legacy, demo: setEntry(E, "astro-chen", "s1", "s1:c", true), recorded: setEntry(E, "astro-chen", "s1", "s1:z", true) };
  assert.deepEqual(effectiveEdits("recorded", s, "astro-chen"), { "s1:z": true });
  assert.deepEqual(effectiveEdits("demo", s, "astro-chen"), { "s1:a": true, "s1:b": false, "s1:c": true });
  // Demo's own undo overrides a legacy tick, without touching legacy.
  const undone = setEntry(s.demo, "astro-chen", "s1", "s1:a", false);
  assert.equal(effectiveEdits("demo", { ...s, demo: undone }, "astro-chen")["s1:a"], false);
  assert.equal(legacy["astro-chen"].s1["s1:a"], true);
});

test("a write in one mode leaves the other mode unchanged, in both directions (and never mutates its input)", () => {
  const demo0 = setEntry(E, "astro-chen", "s1", "s1:a", true);
  const rec0 = setEntry(E, "astro-chen", "s1", "s1:a", true);
  const before = JSON.stringify({ demo0, rec0 });
  const rec1 = setEntry(rec0, "astro-chen", "s1", "s1:a", false);         // undo in Recorded
  assert.equal(JSON.stringify({ demo0, rec0 }), before);
  assert.equal(effectiveEdits("demo", { legacy: E, demo: demo0, recorded: rec1 }, "astro-chen")["s1:a"], true);
  const demo1 = setEntry(demo0, "astro-chen", "s1", "s1:b", true);         // tick in Demo
  assert.equal("s1:b" in effectiveEdits("recorded", { legacy: E, demo: demo1, recorded: rec1 }, "astro-chen"), false);
  assert.equal(effectiveEdits("recorded", { legacy: E, demo: demo1, recorded: rec1 }, "astro-chen")["s1:a"], false);
});

test("astronauts are isolated inside each mode", () => {
  const rec = setEntry(E, "astro-chen", "s1", "s1:a", true);
  assert.deepEqual(effectiveEdits("recorded", { legacy, demo: E, recorded: rec }, "astro-okafor"), {});
  assert.deepEqual(flatten(legacy, "astro-okafor"), { "o1:a": true });
  assert.equal(legacyCount(legacy, "astro-chen"), 2);
  assert.equal(legacyCount(legacy, "astro-alvarez"), 0);
});

test("explicit legacy import copies one astronaut's entries, keeps Recorded's own entries, and leaves legacy intact", () => {
  const rec = setEntry(E, "astro-chen", "s1", "s1:b", true);             // Recorded already has s1:b (true) while legacy says false
  const beforeLegacy = JSON.stringify(legacy);
  const next = importLegacy(legacy, rec, "astro-chen");
  assert.deepEqual(flatten(next, "astro-chen"), { "s1:a": true, "s1:b": true });   // a copied; b kept as Recorded had it
  assert.deepEqual(flatten(next, "astro-okafor"), {});                              // other astronaut not imported
  assert.equal(JSON.stringify(legacy), beforeLegacy);                               // nothing deleted from legacy
  assert.deepEqual(flatten(rec, "astro-chen"), { "s1:b": true });                   // input not mutated
});

test("parsing drops malformed entries instead of failing, and keeps explicit un-ticks (false)", () => {
  const p = parseEditsStore({ "astro-chen": { s1: { a: true, b: false, c: "yes", d: 1 }, s2: "bad" }, x: [], y: null });
  assert.deepEqual(p, { "astro-chen": { s1: { a: true, b: false } } });
  assert.deepEqual(parseEditsStore("nope"), {});
  assert.deepEqual(parseMigrated({ "astro-chen": true, b: false, c: "x" }), { "astro-chen": true });
});
