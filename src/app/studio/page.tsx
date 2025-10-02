"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Group,
  Stack,
  Text,
  Image,
  Progress,
  Button,
  Container,
  Card,
  Badge,
  ActionIcon,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import {
  IconCopy,
  IconPhoto,
  IconX,
  IconFileText,
  IconFile,
  IconMarkdown,
} from "@tabler/icons-react";
import "@mantine/dropzone/styles.css";
import "@mantine/notifications/styles.css";

import { createWorker } from "tesseract.js";
import jsPDF from "jspdf";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

export default function StudioPage() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Checking cache...");
  const [ocrResult, setOcrResult] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string>("checking");
  const [displayedText, setDisplayedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [currentView, setCurrentView] = useState<
    "upload" | "text" | "quiz" | "results"
  >("upload");

  const workerRef = useRef<any>(null);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  const genAI = new GoogleGenerativeAI(apiKey);

  const generateQuiz = async (text: string) => {
    if (!text.trim()) return;

    setIsGeneratingQuiz(true);
    setProgressLabel("Generating quiz questions...");
    setProgress(0);

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
      setCurrentView("quiz");
      setProgress(1);
      setProgressLabel("Quiz generated successfully!");
      notifications.show({
        title: "Quiz Ready!",
        message: `Generated ${data.totalQuestions} questions.`,
        color: "green",
      });
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      setProgressLabel("Failed to generate quiz");
      notifications.show({
        title: "AI Error",
        message: error?.message || "Unable to generate quiz.",
        color: "red",
      });

      const fallbackQuiz: Quiz = {
        questions: [
          {
            id: 1,
            question: "What is the main topic of the extracted text?",
            options: [
              "General information",
              "Technical details",
              "Historical facts",
              "Personal opinions",
            ],
            correctAnswer: 0,
            explanation: "The text appears to contain general information.",
          },
          {
            id: 2,
            question: "How would you categorize this content?",
            options: ["Educational", "Entertainment", "News", "Fiction"],
            correctAnswer: 0,
            explanation: "The content seems educational in nature.",
          },
          {
            id: 3,
            question: "What type of information is most prominent?",
            options: [
              "Facts and data",
              "Opinions and views",
              "Instructions",
              "Stories",
            ],
            correctAnswer: 0,
            explanation: "The text contains factual information and data.",
          },
          {
            id: 4,
            question: "Which best describes the text's purpose?",
            options: ["To inform", "To persuade", "To entertain", "To sell"],
            correctAnswer: 0,
            explanation: "The primary purpose appears to be informative.",
          },
          {
            id: 5,
            question: "What level of detail is provided?",
            options: [
              "High detail",
              "Medium detail",
              "Low detail",
              "Mixed detail",
            ],
            correctAnswer: 1,
            explanation: "The text provides a moderate level of detail.",
          },
        ],
        totalQuestions: 5,
        timeLimit: 300,
      };

      setQuiz(fallbackQuiz);
      setCurrentView("quiz");
      setProgress(1);
      notifications.show({
        title: "Fallback Quiz",
        message: "Using a basic quiz template.",
        color: "yellow",
      });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const typewriterEffect = useCallback((text: string, speed: number = 10) => {
    setIsAnimating(true);
    setDisplayedText("");
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        setIsAnimating(false);
      }
    }, speed);
    return () => clearInterval(timer);
  }, []);

  const checkOCRCache = async () => {
    try {
      const cacheKey = "tesseract-cache-v1";
      const cached = localStorage.getItem(cacheKey);
      const lastUpdate = localStorage.getItem(cacheKey + "-timestamp");
      if (cached && lastUpdate) {
        const timeDiff = Date.now() - parseInt(lastUpdate);
        if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
          setCacheStatus("cached");
          return true;
        }
      }
      setCacheStatus("not-cached");
      return false;
    } catch {
      setCacheStatus("not-cached");
      return false;
    }
  };

  const markOCRCached = () => {
    try {
      const cacheKey = "tesseract-cache-v1";
      localStorage.setItem(cacheKey, "true");
      localStorage.setItem(cacheKey + "-timestamp", Date.now().toString());
      setCacheStatus("cached");
    } catch {}
  };

  useEffect(() => {
    const initWorker = async () => {
      try {
        const isCached = await checkOCRCache();
        setProgressLabel(
          isCached
            ? "Loading from cache..."
            : "Downloading OCR engine (one-time setup)..."
        );

        const worker = await createWorker("eng", undefined, {
          logger: (message: any) => {
            if (message.progress !== undefined) {
              setProgress(message.progress);
              if (!isCached && message.progress > 0.5) {
                setProgressLabel(
                  "First-time setup... (will be faster next time)"
                );
              } else if (message.status) {
                setProgressLabel(message.status);
              }
            }
          },
        });

        workerRef.current = worker;
        setWorkerReady(true);
        setProgressLabel("Ready");
        setProgress(1);
        if (!isCached) markOCRCached();
        notifications.show({
          title: "OCR Ready",
          message: isCached ? "Loaded from cache" : "Downloaded and cached",
          color: "green",
        });
      } catch (error) {
        setProgressLabel("Initialization failed");
        setWorkerReady(false);
        notifications.show({
          title: "Initialization Error",
          message: "Failed to initialize OCR engine.",
          color: "red",
        });
      }
    };

    const timer = setTimeout(initWorker, 100);
    return () => {
      clearTimeout(timer);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      notifications.show({
        title: "Invalid File",
        message: "Please select a valid image file",
        color: "red",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notifications.show({
        title: "File Too Large",
        message: "Please select an image smaller than 10MB",
        color: "red",
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageData(reader.result as string);
      setImageFile(file);
      setOcrResult("");
    };
    reader.onerror = () =>
      notifications.show({
        title: "File Error",
        message: "Failed to read the selected file",
        color: "red",
      });
    reader.readAsDataURL(file);
  }, []);

  const handleExtract = async () => {
    if (!imageData || !workerRef.current || !workerReady) {
      const message = !imageData
        ? "Please upload an image first"
        : !workerReady
        ? "Please wait for the OCR engine to initialize"
        : "OCR engine not ready";
      notifications.show({ title: "Not Ready", message, color: "yellow" });
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setProgressLabel("Extracting text...");
    try {
      const worker = workerRef.current;
      const response = await worker.recognize(imageData, {
        rectangle: undefined,
        pdfTitle: "OCR Extracted Text",
        pdfTextOnly: true,
        rotateAuto: true,
      });
      const extractedText = response.data.text.trim();
      setOcrResult(extractedText);
      setProgressLabel("Extraction complete");
      setProgress(1);
      typewriterEffect(extractedText);
      notifications.show({
        title: "Success",
        message: `Text extracted! ${extractedText.length} characters.`,
        color: "green",
      });
    } catch (error) {
      setProgressLabel("Error occurred");
      setOcrResult("Error: Could not process image. Please try again.");
      notifications.show({
        title: "Extraction Failed",
        message: "Could not extract text from image.",
        color: "red",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async () => {
    if (!ocrResult) return;
    try {
      await navigator.clipboard.writeText(ocrResult);
      notifications.show({
        title: "Copied",
        message: "Text copied to clipboard",
        color: "blue",
      });
    } catch (error) {
      notifications.show({
        title: "Copy Failed",
        message: "Could not copy text to clipboard",
        color: "red",
      });
    }
  };

  const handleDownloadText = () => {
    if (!ocrResult) return;
    const blob = new Blob([ocrResult], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted-text-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!ocrResult) return;
    const pdf = new jsPDF();
    const lines = pdf.splitTextToSize(ocrResult, 180);
    pdf.text(lines, 10, 10);
    pdf.save(`extracted-text-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleDownloadMarkdown = () => {
    if (!ocrResult) return;
    const blob = new Blob([ocrResult], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted-text-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (quiz?.totalQuestions || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      calculateScore();
      setCurrentView("results");
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateScore = () => {
    if (!quiz) return;
    let correctAnswers = 0;
    quiz.questions.forEach((question, index) => {
      if (userAnswers[index] === question.correctAnswer) correctAnswers++;
    });
    setScore(Math.round((correctAnswers / quiz.totalQuestions) * 100));
  };

  const resetQuiz = () => {
    setQuiz(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setScore(0);
    setCurrentView("upload");
  };

  const clearImage = () => {
    setImageData(null);
    setImageFile(null);
    setOcrResult("");
    setDisplayedText("");
    setIsAnimating(false);
    setProgress(workerReady ? 1 : 0);
    setProgressLabel(workerReady ? "Ready" : "Loading...");
    resetQuiz();
  };

  const clearCache = () => {
    try {
      localStorage.removeItem("tesseract-cache-v1");
      localStorage.removeItem("tesseract-cache-v1-timestamp");
      setCacheStatus("not-cached");
      notifications.show({
        title: "Cache Cleared",
        message: "OCR cache cleared. Refresh the page to re-download.",
        color: "blue",
      });
    } catch {}
  };

  return (
    <main className="min-h-[calc(100vh-72px)] bg-neutral-950">
      <Container size="xl" className="py-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold mb-2 text-white tracking-tight">
            Studio
          </h1>
          <p className="text-neutral-400">
            Upload an image, extract text, and generate a quiz.
          </p>
        </div>

        <Group align="flex-start" gap="xl" className="min-h-[600px]">
          <Stack className="flex-1 max-w-2xl">
            <Card
              shadow="none"
              padding={0}
              radius="xl"
              className="relative border border-neutral-800 bg-neutral-900"
            >
              <Card.Section>
                <Dropzone
                  onDrop={(files) => loadFile(files[0])}
                  accept={IMAGE_MIME_TYPE}
                  multiple={false}
                  className="border-0"
                  styles={{
                    root: { minHeight: "280px", borderRadius: "12px" },
                    inner: { pointerEvents: "all" },
                  }}
                >
                  <Group
                    justify="center"
                    gap="xl"
                    className="min-h-[180px] pointer-events-none"
                  >
                    <Dropzone.Accept>
                      <IconPhoto
                        size={64}
                        className="text-neutral-200"
                        stroke={1.5}
                      />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                      <IconX size={64} className="text-red-500" stroke={1.5} />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                      <IconPhoto
                        size={64}
                        className="text-neutral-500"
                        stroke={1.5}
                      />
                    </Dropzone.Idle>

                    <div className="text-center">
                      <Text
                        size="xl"
                        className="text-neutral-200 font-semibold mb-2"
                      >
                        Drop your image here
                      </Text>
                      <Text size="sm" className="text-neutral-500">
                        or click to browse • JPG, PNG, GIF, WebP • Max 10MB
                      </Text>
                    </div>
                  </Group>
                </Dropzone>
              </Card.Section>
            </Card>

            {imageData && (
              <Card
                shadow="none"
                padding="lg"
                radius="xl"
                className="relative border border-neutral-800 bg-neutral-900"
              >
                <Card.Section>
                  <div className="relative">
                    <Image
                      src={imageData}
                      alt="Uploaded image"
                      className="max-h-96 w-full object-contain rounded-lg"
                      fit="contain"
                    />
                    <ActionIcon
                      variant="filled"
                      color="red"
                      size="lg"
                      className="absolute top-3 right-3"
                      onClick={clearImage}
                    >
                      <IconX size={18} />
                    </ActionIcon>
                  </div>
                </Card.Section>
                {imageFile && (
                  <div className="mt-4">
                    <Badge
                      variant="light"
                      color="gray"
                      size="lg"
                      className="bg-neutral-800 text-neutral-200"
                    >
                      {imageFile.name} (
                      {(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                    </Badge>
                  </div>
                )}
              </Card>
            )}
          </Stack>

          <Stack className="flex-1 max-w-2xl">
            <Card
              shadow="none"
              padding="lg"
              radius="xl"
              className="border border-neutral-800 bg-neutral-900"
            >
              <Stack gap="lg">
                <Button
                  onClick={handleExtract}
                  disabled={!imageData || !workerReady || isProcessing}
                  size="lg"
                  className="bg-white text-black hover:bg-neutral-200"
                >
                  {isProcessing ? "Processing..." : "Extract Text"}
                </Button>

                {ocrResult && !isAnimating && (
                  <Button
                    onClick={() => generateQuiz(ocrResult)}
                    disabled={isGeneratingQuiz}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isGeneratingQuiz ? "Generating Quiz..." : "Generate Quiz"}
                  </Button>
                )}

                <div className="flex items-center justify-between">
                  <Text size="sm" className="font-medium text-neutral-400">
                    {progressLabel}
                  </Text>
                  {workerReady && (
                    <Badge
                      color="green"
                      variant="light"
                      className="bg-green-900/30 text-green-400"
                    >
                      Ready
                    </Badge>
                  )}
                </div>

                {(progress > 0 || isProcessing) && (
                  <div className="space-y-3">
                    <Progress
                      value={progress * 100}
                      size="lg"
                      radius="xl"
                      color="gray"
                    />
                    <Text
                      size="xs"
                      className="text-right text-neutral-500 font-medium"
                    >
                      {Math.round(progress * 100)}% complete
                    </Text>
                  </div>
                )}
              </Stack>
            </Card>

            {ocrResult && (
              <Card
                shadow="none"
                padding="lg"
                radius="xl"
                className="flex-1 border border-neutral-800 bg-neutral-900"
              >
                <Stack gap="lg">
                  <Group justify="between" align="center">
                    <Text size="xl" className="font-bold text-white">
                      Extracted Text{" "}
                      {isAnimating && (
                        <span className="ml-2 text-neutral-400">⚡</span>
                      )}
                    </Text>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="gray"
                        onClick={handleCopyText}
                        size="lg"
                        title="Copy to clipboard"
                        className="hover:bg-neutral-800"
                      >
                        <IconCopy size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="gray"
                        onClick={handleDownloadText}
                        size="lg"
                        title="Download as text file"
                        className="hover:bg-neutral-800"
                      >
                        <IconFileText size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="gray"
                        onClick={handleDownloadPDF}
                        size="lg"
                        title="Download as PDF"
                        className="hover:bg-neutral-800"
                      >
                        <IconFile size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="gray"
                        onClick={handleDownloadMarkdown}
                        size="lg"
                        title="Download as Markdown"
                        className="hover:bg-neutral-800"
                      >
                        <IconMarkdown size={18} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  <Card className="bg-black border-0 max-h-96 overflow-hidden rounded-xl">
                    <div className="max-h-80 overflow-y-auto p-4">
                      <Text
                        className="text-neutral-100 font-mono text-sm whitespace-pre-wrap break-words leading-relaxed"
                        style={{ fontFamily: "Monaco, Consolas, monospace" }}
                      >
                        {displayedText}
                        {isAnimating && (
                          <span className="typewriter-cursor text-neutral-500">
                            |
                          </span>
                        )}
                      </Text>
                    </div>
                  </Card>

                  <Text size="xs" className="text-neutral-500 font-medium">
                    {displayedText.length} characters •{" "}
                    {displayedText.split("\n").length} lines
                  </Text>
                </Stack>
              </Card>
            )}

            {currentView === "quiz" && quiz && (
              <Card
                shadow="none"
                padding="lg"
                radius="xl"
                className="flex-1 border border-neutral-800 bg-neutral-900"
              >
                <Stack gap="lg">
                  <div className="flex justify-between items-center">
                    <Text size="xl" className="font-bold text-white">
                      Question {currentQuestionIndex + 1} of{" "}
                      {quiz.totalQuestions}
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
                    value={
                      ((currentQuestionIndex + 1) / quiz.totalQuestions) * 100
                    }
                    size="lg"
                    radius="xl"
                    color="blue"
                  />

                  <Card className="bg-neutral-800 border-0 p-6 rounded-xl">
                    <Text
                      size="lg"
                      className="font-semibold text-neutral-100 mb-6"
                    >
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
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      variant="light"
                      color="gray"
                      size="lg"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={handleNextQuestion}
                      disabled={userAnswers[currentQuestionIndex] === undefined}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {currentQuestionIndex === quiz.totalQuestions - 1
                        ? "Finish Quiz"
                        : "Next"}
                    </Button>
                  </div>
                </Stack>
              </Card>
            )}

            {currentView === "results" && quiz && (
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

                    <div className="relative w-32 h-32 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-8 border-neutral-700"></div>
                      <div
                        className="absolute inset-0 rounded-full border-8 border-blue-600"
                        style={{
                          clipPath: `polygon(50% 50%, 50% 0%, ${
                            50 +
                            50 * Math.cos(((score * 3.6 - 90) * Math.PI) / 180)
                          }% ${
                            50 +
                            50 * Math.sin(((score * 3.6 - 90) * Math.PI) / 180)
                          }%)`,
                        }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Text size="2xl" className="font-bold text-white">
                          {score}%
                        </Text>
                      </div>
                    </div>

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
                                {String.fromCharCode(65 + optionIndex)}.{" "}
                                {option}
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
                        onClick={resetQuiz}
                        size="lg"
                        className="bg-neutral-700 hover:bg-neutral-600"
                      >
                        Take Another Quiz
                      </Button>
                      <Button
                        onClick={() => setCurrentView("upload")}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Upload New Image
                      </Button>
                    </div>
                  </div>
                </Stack>
              </Card>
            )}
          </Stack>
        </Group>
      </Container>
    </main>
  );
}
