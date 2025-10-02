"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Card,
  Stack,
  Text,
  Button,
  Progress,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface Quiz {
  questions: Question[];
  totalQuestions: number;
  timeLimit?: number;
}

export default function QuizPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const text = sessionStorage.getItem("iqpg:extracted-text") || "";
    if (!text.trim()) {
      setLoading(false);
      setError(
        "No extracted text found. Please go back and extract text first."
      );
      return;
    }

    const run = async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Failed with status ${res.status}`);
        }
        const data = await res.json();
        setQuiz({
          questions: data.questions,
          totalQuestions: data.totalQuestions,
          timeLimit: data.timeLimit,
        });
      } catch (e: any) {
        setError(e?.message || "Failed to generate quiz");
        notifications.show({
          title: "Quiz Error",
          message: e?.message || "Failed to generate quiz",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handleAnswerSelect = (answerIndex: number) => {
    const next = [...userAnswers];
    next[currentQuestionIndex] = answerIndex;
    setUserAnswers(next);
  };

  const finishQuiz = () => {
    if (!quiz) return;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) correct++;
    });
    setScore(Math.round((correct / quiz.totalQuestions) * 100));
    setShowResults(true);
  };

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-72px)] bg-neutral-950">
        <Container size="xl" className="py-10">
          <Text className="text-neutral-300">Generating your quiz...</Text>
        </Container>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-72px)] bg-neutral-950">
        <Container size="xl" className="py-10">
          <Card className="border border-neutral-800 bg-neutral-900 p-6">
            <Text className="text-red-400 font-semibold mb-2">{error}</Text>
            <Button
              component="a"
              href="/"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Go back
            </Button>
          </Card>
        </Container>
      </main>
    );
  }

  if (!quiz) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-neutral-950">
      <Container size="xl" className="py-10">
        {!showResults && (
          <Card
            shadow="none"
            padding="lg"
            radius="xl"
            className="flex-1 border border-neutral-800 bg-neutral-900"
          >
            <Stack gap="lg">
              <div className="flex justify-between items-center">
                <Text size="xl" className="font-bold text-white">
                  Question {currentQuestionIndex + 1} of {quiz.totalQuestions}
                </Text>
                <Badge
                  size="lg"
                  variant="light"
                  className="bg-blue-900/30 text-blue-400"
                >
                  {Math.round(
                    ((currentQuestionIndex + 1) / quiz.totalQuestions) * 100
                  )}
                  % Complete
                </Badge>
              </div>

              <Progress
                value={((currentQuestionIndex + 1) / quiz.totalQuestions) * 100}
                size="lg"
                radius="xl"
                color="blue"
              />

              <Card className="bg-neutral-800 border-0 p-6 rounded-xl">
                <Text size="lg" className="font-semibold text-neutral-100 mb-6">
                  {quiz.questions[currentQuestionIndex].question}
                </Text>
                <Stack gap="md">
                  {quiz.questions[currentQuestionIndex].options.map(
                    (option, index) => (
                      <Button
                        key={index}
                        variant={
                          userAnswers[currentQuestionIndex] === index
                            ? "filled"
                            : "light"
                        }
                        color={
                          userAnswers[currentQuestionIndex] === index
                            ? "blue"
                            : "gray"
                        }
                        size="lg"
                        className="justify-start text-left h-auto p-4"
                        onClick={() => handleAnswerSelect(index)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-semibold text-sm">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <span className="text-left">{option}</span>
                        </div>
                      </Button>
                    )
                  )}
                </Stack>
              </Card>

              <div className="flex justify-between">
                <Button
                  onClick={() =>
                    setCurrentQuestionIndex(
                      Math.max(0, currentQuestionIndex - 1)
                    )
                  }
                  disabled={currentQuestionIndex === 0}
                  variant="light"
                  color="gray"
                  size="lg"
                >
                  Previous
                </Button>
                {currentQuestionIndex === quiz.totalQuestions - 1 ? (
                  <Button
                    onClick={finishQuiz}
                    disabled={userAnswers[currentQuestionIndex] === undefined}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Finish Quiz
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      setCurrentQuestionIndex(
                        Math.min(
                          quiz.totalQuestions - 1,
                          currentQuestionIndex + 1
                        )
                      )
                    }
                    disabled={userAnswers[currentQuestionIndex] === undefined}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Next
                  </Button>
                )}
              </div>
            </Stack>
          </Card>
        )}

        {showResults && (
          <Card
            shadow="none"
            padding="lg"
            radius="xl"
            className="flex-1 border border-neutral-800 bg-neutral-900"
          >
            <Stack gap="lg">
              <div className="text-center">
                <Text size="2xl" className="font-bold text-white mb-2">
                  Quiz Complete!
                </Text>
                <Text size="xl" className="text-neutral-300 mb-6">
                  Your Score: {score}%
                </Text>

                <div className="space-y-4">
                  {quiz.questions.map((question, index) => (
                    <Card
                      key={index}
                      className="p-4 border border-neutral-800 rounded-lg bg-neutral-800/60"
                    >
                      <Text className="font-semibold text-neutral-100 mb-2">
                        Question {index + 1}: {question.question}
                      </Text>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded ${
                              optionIndex === question.correctAnswer
                                ? "bg-green-900/30 text-green-300"
                                : userAnswers[index] === optionIndex &&
                                  optionIndex !== question.correctAnswer
                                ? "bg-red-900/30 text-red-300"
                                : "bg-neutral-900 text-neutral-300"
                            }`}
                          >
                            {String.fromCharCode(65 + optionIndex)}. {option}
                            {optionIndex === question.correctAnswer && (
                              <span className="ml-2 text-green-400 font-semibold">
                                ✓ Correct
                              </span>
                            )}
                            {userAnswers[index] === optionIndex &&
                              optionIndex !== question.correctAnswer && (
                                <span className="ml-2 text-red-400 font-semibold">
                                  ✗ Your Answer
                                </span>
                              )}
                          </div>
                        ))}
                      </div>
                      {question.explanation && (
                        <Text
                          size="sm"
                          className="text-neutral-300 mt-2 italic"
                        >
                          Explanation: {question.explanation}
                        </Text>
                      )}
                    </Card>
                  ))}
                </div>

                <div className="flex gap-4 justify-center mt-8">
                  <Button
                    onClick={() => {
                      setShowResults(false);
                      setCurrentQuestionIndex(0);
                      setUserAnswers([]);
                    }}
                    size="lg"
                    className="bg-neutral-700 hover:bg-neutral-600"
                  >
                    Retake
                  </Button>
                  <Button
                    component="a"
                    href="/"
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    New Extraction
                  </Button>
                </div>
              </div>
            </Stack>
          </Card>
        )}
      </Container>
    </main>
  );
}
