import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ, grade, parseQuizStore } from "./questions";

test("three questions, each with exactly one correct option and plain feedback on every option", () => {
  assert.equal(QUIZ.length, 3);
  for (const q of QUIZ) {
    assert.equal(q.options.filter((o) => o.correct).length, 1, q.id);
    for (const o of q.options) assert.ok(o.feedback.length > 10, `${q.id}/${o.id}`);
  }
  assert.deepEqual(QUIZ.map((q) => q.prompt), [
    "What does knee range of motion describe?",
    "Where can you see why a reading was flagged?",
    "What does \u201cData Unavailable\u201d mean?",
  ]);
});

test("grading counts only answered and correct questions; retry is an empty answer set", () => {
  const right = Object.fromEntries(QUIZ.map((q) => [q.id, q.options.find((o) => o.correct)!.id]));
  assert.deepEqual(grade(right), { answered: 3, correct: 3, total: 3, complete: true });
  assert.deepEqual(grade({ rom: "b" }), { answered: 1, correct: 0, total: 3, complete: false });
  assert.deepEqual(grade({}), { answered: 0, correct: 0, total: 3, complete: false });
});

test("stored results are validated and kept per astronaut", () => {
  assert.deepEqual(parseQuizStore({ a: { correct: 2, total: 3 }, b: { correct: 9, total: 3 }, c: "x" }), { a: { correct: 2, total: 3 } });
  assert.deepEqual(parseQuizStore(null), {});
});
