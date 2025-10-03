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
  IconDownload,
  IconCopy,
  IconPhoto,
  IconX,
  IconFileText,
  IconFile,
  IconMarkdown,
} from "@tabler/icons-react";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/notifications/styles.css";

import { createWorker } from "tesseract.js";
import jsPDF from "jspdf";
import Link from "next/link";

interface ProgressMessage {
  progress: number;
  status: string;
}

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

const Home = () => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Checking cache...");
  const [ocrResult, setOcrResult] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string>("checking");
  const [displayedText, setDisplayedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  // Quiz-related states
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [currentView, setCurrentView] = useState<
    "upload" | "text" | "quiz" | "results"
  >("upload");

  const workerRef = useRef<any>(null);

  // Landing delegates quiz generation to /quiz via sessionStorage

  const generateQuiz = async (text: string) => {
    if (!text.trim()) return;
    try {
      sessionStorage.setItem("iqpg:extracted-text", text);
      window.location.href = "/quiz";
    } catch (e) {
      notifications.show({
        title: "Navigation Error",
        message: "Could not open quiz page.",
        color: "red",
      });
    }
  };

  // Typewriter animation effect
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

  // Check if OCR files are cached
  const checkOCRCache = async () => {
    try {
      const cacheKey = "tesseract-cache-v1";
      const cached = localStorage.getItem(cacheKey);
      const lastUpdate = localStorage.getItem(cacheKey + "-timestamp");

      if (cached && lastUpdate) {
        const timeDiff = Date.now() - parseInt(lastUpdate);
        // Cache valid for 7 days
        if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
          setCacheStatus("cached");
          return true;
        }
      }
      setCacheStatus("not-cached");
      return false;
    } catch (error) {
      console.error("Cache check failed:", error);
      setCacheStatus("not-cached");
      return false;
    }
  };

  // Mark OCR files as cached
  const markOCRCached = () => {
    try {
      const cacheKey = "tesseract-cache-v1";
      localStorage.setItem(cacheKey, "true");
      localStorage.setItem(cacheKey + "-timestamp", Date.now().toString());
      setCacheStatus("cached");
    } catch (error) {
      console.error("Failed to mark cache:", error);
    }
  };

  // Initialize Tesseract worker with smart caching
  useEffect(() => {
    const initWorker = async () => {
      try {
        const isCached = await checkOCRCache();

        if (isCached) {
          setProgressLabel("Loading from cache...");
        } else {
          setProgressLabel("Downloading OCR engine (one-time setup)...");
        }

        const worker = await createWorker("eng", undefined, {
          logger: (message: any) => {
            console.log("OCR Progress:", message);
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

        console.log("Worker created and initialized...");

        workerRef.current = worker;
        setWorkerReady(true);
        setProgressLabel("Ready");
        setProgress(1);

        // Mark as cached after successful initialization
        if (!isCached) {
          markOCRCached();
        }

        console.log("OCR Worker initialized successfully");

        notifications.show({
          title: "OCR Ready",
          message: isCached
            ? "OCR engine loaded from cache!"
            : "OCR engine downloaded and cached for future use!",
          color: "green",
        });
      } catch (error) {
        console.error("Failed to initialize OCR worker:", error);
        setInitError("Failed to initialize OCR engine");
        setProgressLabel("Initialization failed");
        setWorkerReady(false);

        notifications.show({
          title: "Initialization Error",
          message:
            "Failed to initialize OCR engine. This might be due to network issues.",
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
    console.log("Loading file:", file.name, file.type, file.size);

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
      const imageDataUri = reader.result as string;
      setImageData(imageDataUri);
      setImageFile(file);
      setOcrResult("");
      console.log("Image loaded successfully");
    };

    reader.onerror = () => {
      notifications.show({
        title: "File Error",
        message: "Failed to read the selected file",
        color: "red",
      });
    };

    reader.readAsDataURL(file);
  }, []);

  const handleExtract = async () => {
    console.log("Extract button clicked", {
      imageData: !!imageData,
      workerReady,
      isProcessing,
    });

    if (!imageData || !workerRef.current || !workerReady) {
      const message = !imageData
        ? "Please upload an image first"
        : !workerReady
        ? "Please wait for the OCR engine to initialize"
        : "OCR engine not ready";

      notifications.show({
        title: "Not Ready",
        message,
        color: "yellow",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressLabel("Extracting text...");

    try {
      const worker = workerRef.current;
      console.log("Starting OCR recognition...");

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

      // Start typewriter animation
      typewriterEffect(extractedText);

      notifications.show({
        title: "Success",
        message: `Text extracted successfully! ${extractedText.length} characters found.`,
        color: "green",
      });

      console.log(
        "OCR completed successfully:",
        extractedText.length,
        "characters"
      );
    } catch (error) {
      console.error("OCR Error:", error);
      setProgressLabel("Error occurred");
      setOcrResult("Error: Could not process image. Please try again.");

      notifications.show({
        title: "Extraction Failed",
        message: "Could not extract text from image. Please try again.",
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
      console.error("Copy failed:", error);
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

  // Quiz handling functions
  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (quiz?.totalQuestions || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Quiz completed
      setQuizCompleted(true);
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
      if (userAnswers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });

    setScore(Math.round((correctAnswers / quiz.totalQuestions) * 100));
  };

  const resetQuiz = () => {
    setQuiz(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizCompleted(false);
    setShowResults(false);
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
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        
        <Container size="xl" className="py-16 relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block mb-8">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-1 rounded-2xl shadow-2xl hover-lift">
                <div className="bg-slate-950 px-8 py-4 rounded-xl">
                  <h1 className="text-7xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 tracking-tight">
                    Quizy
                  </h1>
                  <p className="text-slate-400 text-sm font-medium tracking-wider uppercase">
                    Instant Question Paper Generator
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-slate-300 text-2xl max-w-4xl mx-auto leading-relaxed mb-12 font-light">
              Transform any image into an interactive quiz with our advanced OCR technology and AI-powered question generation
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 mb-12">
              <Badge
                size="xl"
                variant="light"
                className="bg-gradient-to-r from-blue-900/40 to-blue-800/40 text-blue-300 border border-blue-500/20 px-6 py-3 hover-lift"
              >
                <span className="text-2xl mr-3">📸</span>
                OCR Text Extraction
              </Badge>
              <Badge
                size="xl"
                variant="light"
                className="bg-gradient-to-r from-emerald-900/40 to-green-800/40 text-emerald-300 border border-emerald-500/20 px-6 py-3 hover-lift"
              >
                <span className="text-2xl mr-3">🤖</span>
                AI Quiz Generation
              </Badge>
              <Badge
                size="xl"
                variant="light"
                className="bg-gradient-to-r from-purple-900/40 to-pink-800/40 text-purple-300 border border-purple-500/20 px-6 py-3 hover-lift"
              >
                <span className="text-2xl mr-3">⚡</span>
                Instant Evaluation
              </Badge>
            </div>
            
            <div className="flex justify-center gap-6">
              <Button
                component={Link as any}
                href="/quiz"
                size="xl"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl hover-lift px-8 py-4 text-lg font-semibold"
              >
                Start Creating Quizzes
              </Button>
              <Button
                component={Link as any}
                href="/studio"
                variant="light"
                size="xl"
                className="bg-slate-800/50 hover:bg-slate-700/60 border border-slate-600/50 text-slate-200 hover-lift px-8 py-4 text-lg font-semibold"
              >
                Open Studio
              </Button>
            </div>
          </div>

          <Group align="flex-start" gap="xl" className="min-h-[700px]">
            {/* Left Column - Image Upload */}
            <Stack className="flex-1 max-w-2xl">
              <Card
                shadow="none"
                padding={0}
                radius="xl"
                className="relative border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl hover-lift transition-all duration-500 overflow-hidden"
              >
                {/* Card glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 hover:opacity-100 transition-opacity duration-500" />
                
                <Card.Section className="relative z-10">
                  <Dropzone
                    onDrop={(files) => loadFile(files[0])}
                    accept={IMAGE_MIME_TYPE}
                    multiple={false}
                    className="border-0 bg-transparent"
                    styles={{
                      root: {
                        minHeight: "320px",
                        borderRadius: "12px",
                      },
                      inner: { pointerEvents: "all" },
                    }}
                  >
                    <Group
                      justify="center"
                      gap="xl"
                      className="min-h-[280px] pointer-events-none"
                    >
                      <Dropzone.Accept>
                        <div className="text-center animate-bounce">
                          <IconPhoto
                            size={80}
                            className="text-blue-400 mx-auto mb-4"
                            stroke={1.5}
                          />
                          <Text className="text-blue-300 font-semibold">
                            Perfect! Drop it here
                          </Text>
                        </div>
                      </Dropzone.Accept>
                      
                      <Dropzone.Reject>
                        <div className="text-center animate-pulse">
                          <IconX
                            size={80}
                            className="text-red-400 mx-auto mb-4"
                            stroke={1.5}
                          />
                          <Text className="text-red-300 font-semibold">
                            Invalid file type
                          </Text>
                        </div>
                      </Dropzone.Reject>
                      
                      <Dropzone.Idle>
                        <div className="text-center">
                          <div className="relative mb-6">
                            <IconPhoto
                              size={80}
                              className="text-slate-400 mx-auto transition-all duration-300 hover:text-blue-400 hover:scale-110"
                              stroke={1.5}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl scale-150 opacity-0 hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          <Text
                            size="xl"
                            className="text-slate-200 font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                          >
                            Drop your image here
                          </Text>
                          <Text size="md" className="text-slate-400 font-medium">
                            or click to browse
                          </Text>
                          <Text size="sm" className="text-slate-500 mt-2">
                            Supports JPG, PNG, GIF, WebP • Max 10MB
                          </Text>
                        </div>
                      </Dropzone.Idle>
                    </Group>
                  </Dropzone>
                </Card.Section>
              </Card>

              {/* Image Preview */}
              {imageData && (
                <Card
                  shadow="none"
                  padding="lg"
                  radius="xl"
                  className="relative border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl hover-lift transition-all duration-500 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5" />
                  
                  <Card.Section className="relative z-10">
                    <div className="relative group">
                      <Image
                        src={imageData}
                        alt="Uploaded image"
                        className="max-h-96 w-full object-contain rounded-lg transition-all duration-300 group-hover:scale-[1.02]"
                        fit="contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                      <ActionIcon
                        variant="filled"
                        size="xl"
                        className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-600 backdrop-blur-sm border border-red-400/50 shadow-xl transition-all duration-300 hover:scale-110"
                        onClick={clearImage}
                      >
                        <IconX size={20} />
                      </ActionIcon>
                    </div>
                  </Card.Section>

                  {imageFile && (
                    <div className="mt-4 relative z-10">
                      <Badge
                        variant="light"
                        size="lg"
                        className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 text-slate-200 border border-slate-600/50 px-4 py-2"
                      >
                        <span className="font-medium">{imageFile.name}</span>
                        <span className="ml-2 text-slate-400">
                          ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </Badge>
                    </div>
                  )}
                </Card>
              )}
            </Stack>

            {/* Right Column - Controls and Results */}
            <Stack className="flex-1 max-w-2xl">
              {/* Control Panel */}
              <Card
                shadow="none"
                padding="xl"
                radius="xl"
                className="border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl hover-lift transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
                
                <Stack gap="xl" className="relative z-10">
                  <Button
                    onClick={handleExtract}
                    disabled={!imageData || !workerReady || isProcessing}
                    size="xl"
                    className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-2xl transition-all duration-300 hover:shadow-emerald-500/25 hover-lift py-4 text-lg font-bold"
                    loading={isProcessing}
                    leftSection={<IconPhoto size={28} />}
                  >
                    {isProcessing ? "✨ Processing Magic..." : "🚀 Extract Text"}
                  </Button>

                  {ocrResult && !isAnimating && (
                    <Button
                      onClick={() => generateQuiz(ocrResult)}
                      size="xl"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-2xl transition-all duration-300 hover:shadow-purple-500/25 hover-lift py-4 text-lg font-bold"
                      leftSection={<IconFileText size={28} />}
                    >
                      🎯 Generate Quiz
                    </Button>
                  )}

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <Text size="md" className="font-semibold text-slate-300">
                      {progressLabel}
                    </Text>
                    {workerReady && (
                      <Badge
                        size="lg"
                        variant="light"
                        className="bg-gradient-to-r from-emerald-900/40 to-green-800/40 text-emerald-300 border border-emerald-500/30 px-4 py-2"
                      >
                        ✅ Ready
                      </Badge>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(progress > 0 || isProcessing) && (
                    <div className="space-y-4">
                      <div className="relative">
                        <Progress
                          value={progress * 100}
                          size="xl"
                          radius="xl"
                          className="transition-all duration-500"
                          color="blue"
                          striped={isProcessing}
                          animated={isProcessing}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl opacity-50" />
                      </div>
                      <Text
                        size="sm"
                        className="text-right text-slate-400 font-semibold"
                      >
                        ⚡ {Math.round(progress * 100)}% complete
                      </Text>
                    </div>
                  )}
                </Stack>
              </Card>

              {/* Results */}
              {ocrResult && (
                <Card
                  shadow="none"
                  padding="xl"
                  radius="xl"
                  className="flex-1 border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl hover-lift transition-all duration-500 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5" />
                  
                  <Stack gap="lg" className="relative z-10">
                    <Group justify="between" align="center">
                      <Text size="xl" className="font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                        📄 Extracted Text
                        {isAnimating && (
                          <span className="ml-3 text-yellow-400 animate-pulse">⚡</span>
                        )}
                      </Text>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          onClick={handleCopyText}
                          size="xl"
                          title="Copy to clipboard"
                          className="bg-slate-800/50 hover:bg-blue-600/20 border border-slate-600/50 hover:border-blue-500/50 text-slate-300 hover:text-blue-300 transition-all duration-300 hover-lift"
                        >
                          <IconCopy size={20} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          onClick={handleDownloadText}
                          size="xl"
                          title="Download as text file"
                          className="bg-slate-800/50 hover:bg-emerald-600/20 border border-slate-600/50 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 transition-all duration-300 hover-lift"
                        >
                          <IconFileText size={20} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          onClick={handleDownloadPDF}
                          size="xl"
                          title="Download as PDF"
                          className="bg-slate-800/50 hover:bg-purple-600/20 border border-slate-600/50 hover:border-purple-500/50 text-slate-300 hover:text-purple-300 transition-all duration-300 hover-lift"
                        >
                          <IconFile size={20} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          onClick={handleDownloadMarkdown}
                          size="xl"
                          title="Download as Markdown"
                          className="bg-slate-800/50 hover:bg-pink-600/20 border border-slate-600/50 hover:border-pink-500/50 text-slate-300 hover:text-pink-300 transition-all duration-300 hover-lift"
                        >
                          <IconMarkdown size={20} />
                        </ActionIcon>
                      </Group>
                    </Group>

                    <Card className="bg-gradient-to-br from-slate-950/80 to-slate-900/80 border border-slate-700/50 max-h-96 overflow-hidden rounded-xl backdrop-blur-sm">
                      <div className="max-h-80 overflow-y-auto p-6">
                        <Text
                          className="text-slate-100 font-mono text-sm whitespace-pre-wrap break-words leading-relaxed selection:bg-blue-500/30"
                          style={{ fontFamily: "JetBrains Mono, Monaco, Consolas, monospace" }}
                        >
                          {displayedText}
                          {isAnimating && (
                            <span className="typewriter-cursor text-blue-400 animate-pulse">|</span>
                          )}
                        </Text>
                      </div>
                    </Card>

                    <div className="flex items-center justify-between">
                      <Text size="sm" className="text-slate-400 font-medium">
                        📊 {displayedText.length} characters • {displayedText.split("\n").length} lines
                      </Text>
                      {isAnimating && (
                        <Badge
                          size="md"
                          variant="light"
                          className="bg-gradient-to-r from-yellow-900/40 to-orange-800/40 text-yellow-300 border border-yellow-500/30 animate-pulse"
                        >
                          ⌨️ Typing... {Math.round((displayedText.length / ocrResult.length) * 100)}%
                        </Badge>
                      )}
                    </div>
                  </Stack>
                </Card>
              )}

              {/* Quiz UI moved to /quiz */}

              {/* Results Interface */}
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

                      {/* Score Circle */}
                      <div className="relative w-32 h-32 mx-auto mb-6">
                        <div className="absolute inset-0 rounded-full border-8 border-neutral-700"></div>
                        <div
                          className="absolute inset-0 rounded-full border-8 border-blue-600"
                          style={{
                            clipPath: `polygon(50% 50%, 50% 0%, ${
                              50 +
                              50 *
                                Math.cos(((score * 3.6 - 90) * Math.PI) / 180)
                            }% ${
                              50 +
                              50 *
                                Math.sin(((score * 3.6 - 90) * Math.PI) / 180)
                            }%)`,
                          }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Text size="2xl" className="font-bold text-white">
                            {score}%
                          </Text>
                        </div>
                      </div>

                      {/* Detailed Results */}
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

                      {/* Action Buttons */}
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
      </div>
  );
};

export default Home;
