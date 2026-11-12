"use client";

import Link from "next/link";
import { useState } from "react";
import { QUIZ, grade, type Answers } from "@/lib/quiz/questions";
import { saveQuizResult, useQuizStore } from "./quizStore";

/**
 * Optional three-question knowledge check. Collapsed until opened, skippable, and independent of the exercise plan and
 * alerts. Each answer gets plain feedback at once; "Try again" clears the answers.
 */
export default function KnowledgeCheck({ astronautId }: { astronautId: string }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const last = useQuizStore()[astronautId];
  const g = grade(answers);

  function choose(qid: string, oid: string) {
    if (answers[qid] !== undefined) return; // one answer per try; "Try again" resets
    const next = { ...answers, [qid]: oid };
    setAnswers(next);
    const res = grade(next);
    if (res.complete) saveQuizResult(astronautId, { correct: res.correct, total: res.total });
  }

  return (
    <section aria-labelledby="quiz-title" className="glass rounded-lg">
      <h2 id="quiz-title" className="text-[13px] font-semibold text-white">
        <button type="button" aria-expanded={open} aria-controls="quiz-body" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-white/5">
          <span>Optional knowledge check <span className="font-normal text-slate-400">&middot; 3 short questions, you can skip it{last ? ` · last result ${last.correct} of ${last.total}` : ""}</span></span>
          <span aria-hidden="true" className={`shrink-0 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`}>&#9662;</span>
        </button>
      </h2>
      {open && (
        <div id="quiz-body" className="space-y-3 px-3 pb-3">
          <p className="text-[13px] text-slate-400">Your answers are not part of any health score or exercise completion.</p>
          {QUIZ.map((q, i) => {
            const chosen = answers[q.id];
            return (
              <fieldset key={q.id} className="rounded-md border border-cyan-400/15 p-2">
                <legend className="px-1 text-sm font-semibold text-white">{i + 1}. {q.prompt}</legend>
                <div className="mt-1 flex flex-col gap-1.5">
                  {q.options.map((o) => {
                    const picked = chosen === o.id;
                    return (
                      <button key={o.id} type="button" aria-pressed={picked} disabled={chosen !== undefined && !picked} onClick={() => choose(q.id, o.id)}
                        className={`rounded-md border px-2.5 py-1.5 text-left text-sm ${picked ? (o.correct ? "border-emerald-400/70 bg-emerald-400/15 text-white" : "border-amber-300/70 bg-amber-300/10 text-white") : "border-slate-400/30 text-slate-100 hover:bg-white/5 disabled:opacity-50"}`}>
                        {o.text}
                      </button>
                    );
                  })}
                </div>
                <div role="status" aria-live="polite">
                  {chosen !== undefined && (
                    <p className="mt-1.5 text-xs text-slate-100">
                      <span aria-hidden="true">{q.options.find((o) => o.id === chosen)?.correct ? "\u2713 " : "\u2022 "}</span>
                      {q.options.find((o) => o.id === chosen)?.feedback}
                      {q.link && <> <Link href={q.link.href} className="text-cyan-300 hover:underline">{q.link.label} &rarr;</Link></>}
                    </p>
                  )}
                </div>
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            {g.complete && <p role="status" className="text-sm font-semibold text-white">You got {g.correct} of {g.total}.</p>}
            {g.answered > 0 && <button type="button" onClick={() => setAnswers({})} className="rounded-md border border-cyan-300/70 bg-cyan-400/15 px-3 py-1.5 text-sm text-white hover:bg-cyan-400/25">Try again</button>}
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-300 underline-offset-2 hover:underline">Skip for now</button>
          </div>
        </div>
      )}
    </section>
  );
}
