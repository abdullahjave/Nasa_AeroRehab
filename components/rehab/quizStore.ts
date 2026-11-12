"use client";

import { createLocalStore } from "@/components/settings/stores";
import { parseQuizStore, type QuizResult, type QuizStore } from "@/lib/quiz/questions";

// Own storage key: quiz results never touch rehab completions, alerts or scores.
export const QUIZ_KEY = "aerorehab.quiz.v1";
const store = createLocalStore<QuizStore>(QUIZ_KEY, {}, parseQuizStore);
export const useQuizStore = store.use;
export const saveQuizResult = (astronautId: string, r: QuizResult) => store.write({ ...store.read(), [astronautId]: r });
