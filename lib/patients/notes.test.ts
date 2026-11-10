import test from "node:test";
import assert from "node:assert/strict";
import { mergeRecords, saveNote, validateNote, type ClinicalRecord } from "./notes";

const seed: ClinicalRecord[] = [
  { id: "rec-a-1", title: "Baseline Assessment", date: "2026-10-01", text: "Seed text", status: "Completed", seeded: true },
  { id: "rec-a-2", title: "Progress Evaluation", date: "2026-11-02", text: "Seed text 2", status: "Active", seeded: true },
];

test("validation: title, text and a real calendar date are required", () => {
  assert.deepEqual(validateNote({ title: "A", date: "2026-11-10", text: "B" }), {});
  assert.equal(validateNote({ title: "  ", date: "2026-11-10", text: "B" }).title, "Title is required.");
  assert.equal(validateNote({ title: "A", date: "2026-11-10", text: " " }).text, "Note text is required.");
  assert.equal(validateNote({ title: "A", date: "", text: "B" }).date, "Enter a valid date.");
  assert.equal(validateNote({ title: "A", date: "2026-02-31", text: "B" }).date, "Enter a valid date."); // not a real day
  assert.equal(validateNote({ title: "A", date: "10/11/2026", text: "B" }).date, "Enter a valid date.");
});

test("adding a note creates a new record; editing updates the same record", () => {
  let store = saveNote(seed, {}, { title: "Check-in", date: "2026-11-09", text: "All good" }, null, "note-1");
  let all = mergeRecords(seed, store);
  assert.equal(all.length, 3);
  assert.equal(all.find((r) => r.id === "note-1")?.status, "Note");
  // edit the added note
  store = saveNote(seed, store, { title: "Check-in v2", date: "2026-11-09", text: "Edited" }, "note-1", "ignored");
  all = mergeRecords(seed, store);
  assert.equal(all.length, 3); // not duplicated
  assert.equal(all.find((r) => r.id === "note-1")?.title, "Check-in v2");
  // edit a seeded record: same id, status and seeded flag kept
  store = saveNote(seed, store, { title: "Baseline (edited)", date: "2026-10-01", text: "New text" }, "rec-a-1", "ignored");
  all = mergeRecords(seed, store);
  assert.equal(all.length, 3);
  const e = all.find((r) => r.id === "rec-a-1")!;
  assert.deepEqual([e.title, e.status, e.seeded, e.text], ["Baseline (edited)", "Completed", true, "New text"]);
});

test("records are sorted newest first and trimmed on save", () => {
  const store = saveNote(seed, {}, { title: "  Padded  ", date: "2026-12-01", text: "  text  " }, null, "note-2");
  const all = mergeRecords(seed, store);
  assert.deepEqual(all.map((r) => r.id), ["note-2", "rec-a-2", "rec-a-1"]);
  assert.equal(all[0].title, "Padded");
  assert.equal(all[0].text, "text");
});

test("stores are per astronaut: one astronaut's store never touches another's", () => {
  const a = saveNote(seed, {}, { title: "Only A", date: "2026-11-09", text: "x" }, null, "note-1");
  const b: Record<string, never> = {};
  assert.equal(mergeRecords(seed, a).length, 3);
  assert.equal(mergeRecords(seed, b).length, 2);
});
