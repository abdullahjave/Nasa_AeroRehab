import { READINGS } from "../alerts/glossary";

// Optional knowledge check about the app and its readings. Local data only. Results are kept apart from health scores and
// rehab completion: nothing here is read by alerts, readiness, adherence or the milestone.

export type QuizOption = { id: string; text: string; correct: boolean; feedback: string };
export type QuizQuestion = { id: string; prompt: string; options: QuizOption[]; /** Where to look in the app for this answer. */ link?: { href: string; label: string } };

export const QUIZ: QuizQuestion[] = [
  {
    id: "rom",
    prompt: "What does knee range of motion describe?",
    options: [
      { id: "a", text: READINGS.knee.meaning.replace(/\.$/, ""), correct: true, feedback: "Right. Range of motion (ROM) is how far your knee bends and straightens." },
      { id: "b", text: READINGS.walking.meaning.replace(/\.$/, ""), correct: false, feedback: "Not quite. That is walking pace. Range of motion is how far your knee bends and straightens." },
      { id: "c", text: READINGS.pressure.meaning.replace(/\.$/, ""), correct: false, feedback: "Not quite. That is foot pressure. Range of motion is how far your knee bends and straightens." },
    ],
  },
  {
    id: "why",
    prompt: "Where can you see why a reading was flagged?",
    options: [
      { id: "a", text: "Open \u201cWhy am I seeing this?\u201d on the alert", correct: true, feedback: "Right. That opens a short explanation straight away, with the source measurement." },
      { id: "b", text: "In the exercise plan", correct: false, feedback: "Not quite. The exercise plan is for your daily tasks. Use \u201cWhy am I seeing this?\u201d on the alert." },
      { id: "c", text: "In Settings", correct: false, feedback: "Not quite. Settings is for sensors and display. Use \u201cWhy am I seeing this?\u201d on the alert." },
    ],
    link: { href: "/ai-insights", label: "Open AI Insights" },
  },
  {
    id: "unavailable",
    prompt: "What does \u201cData Unavailable\u201d mean?",
    options: [
      { id: "a", text: "There is no usable reading, so the app gives no status", correct: true, feedback: "Right. The app does not guess. It shows no status and points you to check the sensor connection." },
      { id: "b", text: "Everything is fine", correct: false, feedback: "Not quite. Green \u201cAll Good\u201d needs a valid reading. \u201cData Unavailable\u201d means there is nothing to judge." },
      { id: "c", text: "Your knee has a problem", correct: false, feedback: "Not quite. It is a measurement issue, not a health finding." },
    ],
  },
];

export type Answers = Record<string, string>; // questionId -> chosen option id

export function grade(answers: Answers, quiz: QuizQuestion[] = QUIZ) {
  const answered = quiz.filter((q) => answers[q.id] !== undefined).length;
  const correct = quiz.filter((q) => q.options.find((o) => o.id === answers[q.id])?.correct).length;
  return { answered, correct, total: quiz.length, complete: answered === quiz.length };
}

export type QuizResult = { correct: number; total: number };
export type QuizStore = Record<string, QuizResult>; // astronautId -> last result

export function parseQuizStore(raw: unknown): QuizStore {
  const out: QuizStore = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as Partial<QuizResult> | null;
    if (r && Number.isInteger(r.correct) && Number.isInteger(r.total) && (r.total as number) > 0 && (r.correct as number) >= 0 && (r.correct as number) <= (r.total as number)) out[k] = { correct: r.correct as number, total: r.total as number };
  }
  return out;
}
