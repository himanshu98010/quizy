"use client";
import { useEffect, useState } from "react";

type Result = {
  score: number;
  total: number;
  questions: {
    id: number;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }[];
  answers: Record<number, number>;
};

export default function ResultsPage() {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("quizy:results");
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {}
    }
  }, []);

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-2xl font-semibold">No results</h1>
        <p className="mt-2 text-zinc-400">Take a quiz first.</p>
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
      <h1 className="text-3xl font-semibold">Results</h1>
      <p className="mt-2 text-zinc-400">
        You scored {result.score} out of {result.total}.
      </p>
      <div className="mt-6 space-y-6">
        {result.questions.map((q) => {
          const chosen = result.answers[q.id];
          return (
            <div
              key={q.id}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <p className="font-medium">{q.question}</p>
              <div className="mt-3 grid gap-2">
                {q.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`rounded-md border px-4 py-2 ${
                      i === q.correctAnswer
                        ? "border-green-500/60 bg-green-500/10"
                        : i === chosen
                        ? "border-red-500/60 bg-red-500/10"
                        : "border-white/10"
                    }`}
                  >
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="mt-3 text-sm text-zinc-400">
                  Explanation: {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex gap-3">
        <a
          href="/create"
          className="rounded-full border border-white/20 px-5 py-2"
        >
          Create new
        </a>
        <a
          href="/quiz"
          className="rounded-full bg-neutral-300 px-5 py-2 text-black"
        >
          Retake
        </a>
      </div>
    </div>
  );
}
