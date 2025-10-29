"use client";
import { useEffect, useMemo, useState } from "react";

type Question = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    const raw = localStorage.getItem("quizy:current");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setQuestions(parsed?.questions || []);
      } catch {}
    }
  }, []);

  const score = useMemo(() => {
    return questions.reduce(
      (acc, q) => (answers[q.id] === q.correctAnswer ? acc + 1 : acc),
      0
    );
  }, [answers, questions]);

  const attempted = useMemo(() => Object.keys(answers).length, [answers]);

  function submit() {
    const payload = { score, total: questions.length, questions, answers };
    localStorage.setItem("quizy:results", JSON.stringify(payload));
    window.location.href = "/results";
  }

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-2xl font-semibold">No quiz found</h1>
        <p className="mt-2 text-zinc-400">Create a quiz first.</p>
        <a
          className="mt-4 inline-block rounded-full bg-neutral-300 px-5 py-2 text-black"
          href="/create"
        >
          Create
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6">
      <h1 className="text-3xl font-semibold">Quiz</h1>
      <div className="mt-6 space-y-6">
        {questions.map((q) => (
          <div
            key={q.id}
            className="rounded-xl border border-white/10 bg-white/5 p-5"
          >
            <p className="font-medium">{q.question}</p>
            <div className="mt-3 grid gap-2">
              {q.options.map((opt, idx) => {
                const selected = answers[q.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                    className={`rounded-md border px-4 py-2 text-left ${
                      selected
                        ? "border-brand-600 bg-neutral-300"
                        : "border-white/10 hover:bg-white/5"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-8 flex justify-end">
        <button
          onClick={submit}
          className="rounded-full  bg-neutral-300 px-6 py-3 text-black font-medium hover:bg-brand-700"
        >
          Submit ({attempted}/{questions.length})
        </button>
      </div>
    </div>
  );
}
