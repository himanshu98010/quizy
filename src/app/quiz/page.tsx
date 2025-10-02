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
    let text = sessionStorage.getItem("iqpg:extracted-text") || "";
    
    // If no text is found, use sample text for demo purposes
    if (!text.trim()) {
      text = "Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines. Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed. Natural Language Processing (NLP) is another important area of AI that deals with the interaction between computers and human language. Deep learning uses neural networks with multiple layers to analyze and learn from large amounts of data.";
      sessionStorage.setItem("iqpg:extracted-text", text);
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
          
          // Check if it's an API key issue
          if (res.status === 500 && err?.error?.includes("GEMINI_API_KEY")) {
            throw new Error("API_KEY_MISSING");
          }
          
          throw new Error(err?.error || `Failed with status ${res.status}`);
        }
        
        const data = await res.json();
        
        setQuiz({
          questions: data.questions,
          totalQuestions: data.totalQuestions,
          timeLimit: data.timeLimit,
        });
        
        notifications.show({
          title: "AI Quiz Generated!",
          message: `Successfully created ${data.totalQuestions} questions from your text.`,
          color: "green",
        });
      } catch (e: any) {
        // Provide a fallback quiz instead of showing error
        
        // Generate questions based on the actual extracted text if possible
        const fallbackQuiz = {
          questions: text.includes("AI") || text.includes("Artificial Intelligence") ? [
            {
              id: 1,
              question: "Based on the text, what is Artificial Intelligence?",
              options: [
                "A branch of computer science that aims to create intelligent machines",
                "A type of computer hardware",
                "A programming language",
                "A database system"
              ],
              correctAnswer: 0,
              explanation: "According to the text, AI is a branch of computer science focused on creating intelligent machines."
            },
            {
              id: 2,
              question: "What is machine learning according to the text?",
              options: [
                "A type of computer",
                "A subset of AI that enables computers to learn from experience",
                "A programming tool",
                "A data storage method"
              ],
              correctAnswer: 1,
              explanation: "The text describes machine learning as a subset of AI that allows computers to learn and improve from experience."
            },
            {
              id: 3,
              question: "What does NLP stand for in the context of AI?",
              options: [
                "New Language Processing",
                "Network Link Protocol",
                "Natural Language Processing",
                "Numerical Logic Programming"
              ],
              correctAnswer: 2,
              explanation: "NLP stands for Natural Language Processing, which deals with computer-human language interaction."
            },
            {
              id: 4,
              question: "According to the text, what does deep learning use?",
              options: [
                "Simple algorithms",
                "Neural networks with multiple layers",
                "Basic databases",
                "Text files"
              ],
              correctAnswer: 1,
              explanation: "The text states that deep learning uses neural networks with multiple layers to analyze data."
            },
            {
              id: 5,
              question: "What is the main goal of the technologies mentioned in the text?",
              options: [
                "To replace humans",
                "To analyze and learn from data",
                "To create entertainment",
                "To store information"
              ],
              correctAnswer: 1,
              explanation: "All the mentioned technologies (AI, ML, NLP, Deep Learning) focus on analyzing and learning from data."
            }
          ] : [
            {
              id: 1,
              question: "What is the main purpose of OCR (Optical Character Recognition)?",
              options: [
                "To convert images to text",
                "To edit photos",
                "To compress files",
                "To create backups"
              ],
              correctAnswer: 0,
              explanation: "OCR technology extracts text from images, making it machine-readable."
            },
            {
              id: 2,
              question: "Which AI technology is commonly used for generating quiz questions?",
              options: [
                "Computer Vision",
                "Natural Language Processing",
                "Speech Recognition",
                "Image Processing"
              ],
              correctAnswer: 1,
              explanation: "NLP helps understand and generate human-like text for quiz questions."
            },
            {
              id: 3,
              question: "What file formats are typically supported for image upload?",
              options: [
                "Only PDF",
                "JPG, PNG, GIF, WebP",
                "Only JPG",
                "Text files only"
              ],
              correctAnswer: 1,
              explanation: "Most image formats including JPG, PNG, GIF, and WebP are supported."
            },
            {
              id: 4,
              question: "What is the recommended maximum file size for image upload?",
              options: [
                "1MB",
                "5MB",
                "10MB",
                "20MB"
              ],
              correctAnswer: 2,
              explanation: "10MB is typically the maximum recommended size for optimal processing."
            },
            {
              id: 5,
              question: "What happens after text is extracted from an image?",
              options: [
                "The image is deleted",
                "AI generates quiz questions",
                "Text is automatically printed",
                "Nothing happens"
              ],
              correctAnswer: 1,
              explanation: "After OCR extraction, AI processes the text to create relevant quiz questions."
            }
          ],
          totalQuestions: 5,
          timeLimit: 300
        };
        
        setQuiz(fallbackQuiz);
        
        const notificationMessage = e?.message === "API_KEY_MISSING" 
          ? "Demo quiz loaded! To use AI-generated quizzes, add your GEMINI_API_KEY to .env.local"
          : "Demo quiz loaded! Using fallback questions.";
          
        notifications.show({
          title: "Demo Quiz Loaded",
          message: notificationMessage,
          color: "yellow",
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
      <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        
        <Container size="xl" className="py-20 relative z-10">
          <div className="text-center">
            <div className="inline-block animate-spin text-6xl mb-6">🎯</div>
            <Text className="text-slate-200 text-2xl font-bold mb-4">Generating your quiz...</Text>
            <Text className="text-slate-400 text-lg">Our AI is crafting amazing questions just for you</Text>
          </div>
        </Container>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-orange-500/5 to-yellow-500/5" />
        
        <Container size="xl" className="py-20 relative z-10">
          <Card className="border border-red-500/30 bg-gradient-to-br from-red-900/20 to-orange-900/10 backdrop-blur-xl p-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-6xl mb-6">😕</div>
              <Text className="text-red-300 text-xl font-bold mb-4">{error}</Text>
              <Button
                component="a"
                href="/"
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3"
              >
                🏠 Go Back Home
              </Button>
            </div>
          </Card>
        </Container>
      </main>
    );
  }

  if (!quiz) return null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
      
      <Container size="xl" className="py-16 relative z-10">
        {!showResults && (
          <Card
            shadow="none"
            padding="xl"
            radius="xl"
            className="max-w-4xl mx-auto border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl hover-lift transition-all duration-500 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
            
            <Stack gap="xl" className="relative z-10">
              <div className="flex justify-between items-center">
                <Text size="2xl" className="font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  🎯 Question {currentQuestionIndex + 1} of {quiz.totalQuestions}
                </Text>
                <Badge
                  size="xl"
                  variant="light"
                  className="bg-gradient-to-r from-blue-900/40 to-purple-800/40 text-blue-300 border border-blue-500/30 px-6 py-3"
                >
                  {Math.round(
                    ((currentQuestionIndex + 1) / quiz.totalQuestions) * 100
                  )}
                  % Complete
                </Badge>
              </div>

              <div className="relative">
                <Progress
                  value={((currentQuestionIndex + 1) / quiz.totalQuestions) * 100}
                  size="xl"
                  radius="xl"
                  color="blue"
                  className="transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl opacity-50" />
              </div>

              <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 p-8 rounded-2xl backdrop-blur-sm">
                <Text size="xl" className="font-bold text-slate-100 mb-8 leading-relaxed">
                  {quiz.questions[currentQuestionIndex].question}
                </Text>
                <Stack gap="lg">
                  {quiz.questions[currentQuestionIndex].options.map(
                    (option, index) => (
                      <Button
                        key={index}
                        variant={
                          userAnswers[currentQuestionIndex] === index
                            ? "filled"
                            : "light"
                        }
                        size="xl"
                        className={`justify-start text-left h-auto p-6 transition-all duration-300 hover-lift ${
                          userAnswers[currentQuestionIndex] === index
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 border-blue-500/50 shadow-lg shadow-blue-500/25"
                            : "bg-slate-800/50 hover:bg-slate-700/60 border border-slate-600/50 hover:border-blue-500/50 text-slate-200"
                        }`}
                        onClick={() => handleAnswerSelect(index)}
                      >
                        <div className="flex items-start gap-4 w-full">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            userAnswers[currentQuestionIndex] === index 
                              ? "bg-white/20 text-white" 
                              : "bg-slate-700 text-slate-300"
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="text-left leading-relaxed">{option}</span>
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
                  size="xl"
                  className="bg-slate-800/50 hover:bg-slate-700/60 border border-slate-600/50 text-slate-200 px-8 py-4 text-lg"
                >
                  ⬅️ Previous
                </Button>
                {currentQuestionIndex === quiz.totalQuestions - 1 ? (
                  <Button
                    onClick={finishQuiz}
                    disabled={userAnswers[currentQuestionIndex] === undefined}
                    size="xl"
                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-8 py-4 text-lg font-bold shadow-xl hover-lift"
                  >
                    🏁 Finish Quiz
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
                    size="xl"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-bold shadow-xl hover-lift"
                  >
                    Next ➡️
                  </Button>
                )}
              </div>
            </Stack>
          </Card>
        )}

        {showResults && (
          <Card
            shadow="none"
            padding="xl"
            radius="xl"
            className="max-w-6xl mx-auto border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl hover-lift transition-all duration-500 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5" />
            
            <Stack gap="xl" className="relative z-10">
              <div className="text-center">
                <div className="text-8xl mb-6">
                  {score >= 80 ? "🎉" : score >= 60 ? "👏" : score >= 40 ? "💪" : "📚"}
                </div>
                <Text size="3xl" className="font-black bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-4">
                  Quiz Complete!
                </Text>
                <Text size="2xl" className="text-slate-200 mb-8 font-bold">
                  Your Score: <span className={`${score >= 70 ? "text-emerald-400" : score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {score}%
                  </span>
                </Text>

                {/* Performance message */}
                <Badge
                  size="xl"
                  variant="light"
                  className={`mb-8 px-8 py-4 text-lg font-bold ${
                    score >= 80 
                      ? "bg-gradient-to-r from-emerald-900/40 to-green-800/40 text-emerald-300 border border-emerald-500/30"
                      : score >= 60 
                      ? "bg-gradient-to-r from-yellow-900/40 to-orange-800/40 text-yellow-300 border border-yellow-500/30"
                      : score >= 40
                      ? "bg-gradient-to-r from-blue-900/40 to-indigo-800/40 text-blue-300 border border-blue-500/30"
                      : "bg-gradient-to-r from-red-900/40 to-pink-800/40 text-red-300 border border-red-500/30"
                  }`}
                >
                  {score >= 80 ? "🌟 Excellent Work!" : 
                   score >= 60 ? "🎯 Good Job!" : 
                   score >= 40 ? "💪 Keep Practicing!" : 
                   "📚 More Study Needed"}
                </Badge>

                <div className="space-y-6">
                  {quiz.questions.map((question, index) => (
                    <Card
                      key={index}
                      className="p-6 border border-slate-700/50 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm hover-lift transition-all duration-300"
                    >
                      <Text className="font-bold text-slate-100 mb-4 text-lg">
                        <span className="text-blue-400">Q{index + 1}:</span> {question.question}
                      </Text>
                      <div className="space-y-3">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className={`p-4 rounded-xl transition-all duration-300 ${
                              optionIndex === question.correctAnswer
                                ? "bg-gradient-to-r from-emerald-900/40 to-green-800/40 text-emerald-200 border border-emerald-500/30"
                                : userAnswers[index] === optionIndex &&
                                  optionIndex !== question.correctAnswer
                                ? "bg-gradient-to-r from-red-900/40 to-pink-800/40 text-red-200 border border-red-500/30"
                                : "bg-slate-800/40 text-slate-300 border border-slate-700/30"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                optionIndex === question.correctAnswer
                                  ? "bg-emerald-500/30 text-emerald-300"
                                  : userAnswers[index] === optionIndex && optionIndex !== question.correctAnswer
                                  ? "bg-red-500/30 text-red-300"
                                  : "bg-slate-700/50 text-slate-400"
                              }`}>
                                {String.fromCharCode(65 + optionIndex)}
                              </div>
                              <span className="flex-1">{option}</span>
                              {optionIndex === question.correctAnswer && (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ✓ Correct
                                </Badge>
                              )}
                              {userAnswers[index] === optionIndex &&
                                optionIndex !== question.correctAnswer && (
                                  <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">
                                    ✗ Your Answer
                                  </Badge>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {question.explanation && (
                        <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                          <Text size="sm" className="text-slate-300 italic">
                            💡 <strong>Explanation:</strong> {question.explanation}
                          </Text>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>

                <div className="flex flex-wrap gap-6 justify-center mt-12">
                  <Button
                    onClick={() => {
                      setShowResults(false);
                      setCurrentQuestionIndex(0);
                      setUserAnswers([]);
                    }}
                    size="xl"
                    className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white px-8 py-4 text-lg font-bold hover-lift"
                  >
                    🔄 Retake Quiz
                  </Button>
                  <Button
                    component="a"
                    href="/"
                    size="xl"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-bold shadow-xl hover-lift"
                  >
                    🏠 New Extraction
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
