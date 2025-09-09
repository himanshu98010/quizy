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
  MantineProvider,
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
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(
    process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
  );

  // Generate quiz from extracted text
  const generateQuiz = async (text: string) => {
    if (!text.trim()) return;

    setIsGeneratingQuiz(true);
    setProgressLabel("Generating quiz questions...");
    setProgress(0);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Based on the following text content, generate exactly 5 multiple choice questions (MCQs) that test understanding of the key concepts.

Text content:
${text}

IMPORTANT: Respond with ONLY valid JSON in this exact format (no additional text, explanations, or markdown):
{
  "questions": [
    {
      "id": 1,
      "question": "What is the main topic discussed in the text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "This is correct because..."
    },
    {
      "id": 2,
      "question": "Which statement best describes the concept?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "This is correct because..."
    },
    {
      "id": 3,
      "question": "What is the primary purpose mentioned?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 2,
      "explanation": "This is correct because..."
    },
    {
      "id": 4,
      "question": "Which of the following is true according to the text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 3,
      "explanation": "This is correct because..."
    },
    {
      "id": 5,
      "question": "What can be inferred from the information provided?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "This is correct because..."
    }
  ]
}

Requirements:
- Generate exactly 5 questions based on the text content
- Make questions clear and test understanding
- Ensure options are plausible and varied
- Correct answers should be distributed (0, 1, 2, 3)
- Provide helpful explanations
- Return ONLY the JSON object, no other text`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();

      // Clean up the response to ensure it's valid JSON
      let cleanResponse = responseText;

      // Remove any markdown formatting
      cleanResponse = cleanResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");

      // Remove any text before the first {
      const jsonStart = cleanResponse.indexOf("{");
      if (jsonStart > 0) {
        cleanResponse = cleanResponse.substring(jsonStart);
      }

      // Remove any text after the last }
      const jsonEnd = cleanResponse.lastIndexOf("}");
      if (jsonEnd > 0 && jsonEnd < cleanResponse.length - 1) {
        cleanResponse = cleanResponse.substring(0, jsonEnd + 1);
      }

      console.log("Cleaned response:", cleanResponse);

      let quizData;
      try {
        quizData = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Raw response:", responseText);
        console.error("Cleaned response:", cleanResponse);

        // Fallback: try to extract JSON from the response more aggressively
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            quizData = JSON.parse(jsonMatch[0]);
          } catch (secondError) {
            throw new Error(
              `Failed to parse JSON: ${
                secondError instanceof Error
                  ? secondError.message
                  : "Unknown error"
              }`
            );
          }
        } else {
          throw new Error("No valid JSON found in response");
        }
      }

      setQuiz({
        questions: quizData.questions,
        totalQuestions: quizData.questions.length,
        timeLimit: 300, // 5 minutes
      });

      setCurrentView("quiz");
      setProgress(1);
      setProgressLabel("Quiz generated successfully!");

      notifications.show({
        title: "Quiz Ready!",
        message: `Generated ${quizData.questions.length} questions from your content`,
        color: "green",
      });
    } catch (error) {
      console.error("Error generating quiz:", error);
      setProgressLabel("Failed to generate quiz");

      // Fallback: Generate a simple quiz manually
      const fallbackQuiz = {
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
            explanation:
              "The text appears to contain general information based on the content.",
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
      setProgressLabel("Fallback quiz generated");

      notifications.show({
        title: "Fallback Quiz Generated",
        message:
          "Using a basic quiz template due to API issues. Please try again later for AI-generated questions.",
        color: "yellow",
      });
    } finally {
      setIsGeneratingQuiz(false);
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
    <MantineProvider>
      <div className="min-h-screen bg-white">
        <Container size="xl" className="py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
              Quizy
            </h1>
            <p className="text-gray-500 text-xl max-w-2xl mx-auto">
              Upload any content image and instantly generate MCQ quizzes
            </p>
            <div className="flex justify-center gap-4 mt-6">
              <Badge
                size="lg"
                variant="light"
                className="bg-blue-50 text-blue-700"
              >
                📸 OCR Text Extraction
              </Badge>
              <Badge
                size="lg"
                variant="light"
                className="bg-green-50 text-green-700"
              >
                🤖 AI Quiz Generation
              </Badge>
              <Badge
                size="lg"
                variant="light"
                className="bg-purple-50 text-purple-700"
              >
                ⚡ Instant Evaluation
              </Badge>
            </div>
          </div>

          <Group align="flex-start" gap="xl" className="min-h-[600px]">
            {/* Left Column - Image Upload */}
            <Stack className="flex-1 max-w-2xl">
              <Card
                shadow="none"
                padding={0}
                radius="xl"
                className="relative border-2 border-gray-100 hover:border-gray-200 transition-all duration-300"
              >
                <Card.Section>
                  <Dropzone
                    onDrop={(files) => loadFile(files[0])}
                    accept={IMAGE_MIME_TYPE}
                    multiple={false}
                    className="border-0 bg-gray-50 hover:bg-gray-100 transition-all duration-300"
                    styles={{
                      root: {
                        minHeight: "280px",
                        borderRadius: "12px",
                      },
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
                          className="text-gray-600"
                          stroke={1.5}
                        />
                      </Dropzone.Accept>
                      <Dropzone.Reject>
                        <IconX
                          size={64}
                          className="text-red-500"
                          stroke={1.5}
                        />
                      </Dropzone.Reject>
                      <Dropzone.Idle>
                        <IconPhoto
                          size={64}
                          className="text-gray-400"
                          stroke={1.5}
                        />
                      </Dropzone.Idle>

                      <div className="text-center">
                        <Text
                          size="xl"
                          className="text-gray-700 font-semibold mb-2"
                        >
                          Drop your image here
                        </Text>
                        <Text size="sm" className="text-gray-500">
                          or click to browse • JPG, PNG, GIF, WebP • Max 10MB
                        </Text>
                      </div>
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
                  className="relative border-2 border-gray-100"
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
                        className="absolute top-3 right-3 shadow-lg"
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
                        className="bg-gray-100 text-gray-700"
                      >
                        {imageFile.name} (
                        {(imageFile.size / 1024 / 1024).toFixed(2)} MB)
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
                padding="lg"
                radius="xl"
                className="border-2 border-gray-100"
              >
                <Stack gap="lg">
                  <Button
                    onClick={handleExtract}
                    disabled={!imageData || !workerReady || isProcessing}
                    size="xl"
                    className={`
                    transition-all duration-300 transform bg-gray-900 hover:bg-gray-800 text-white font-semibold
                    ${
                      !imageData || !workerReady || isProcessing
                        ? "opacity-50"
                        : "hover:scale-105 shadow-xl"
                    }
                  `}
                    loading={isProcessing}
                    leftSection={<IconPhoto size={24} />}
                  >
                    {isProcessing ? "Processing..." : "Extract Text"}
                  </Button>

                  {ocrResult && !isAnimating && (
                    <Button
                      onClick={() => generateQuiz(ocrResult)}
                      disabled={isGeneratingQuiz}
                      size="xl"
                      className={`
                      transition-all duration-300 transform bg-blue-600 hover:bg-blue-700 text-white font-semibold
                      ${
                        isGeneratingQuiz
                          ? "opacity-50"
                          : "hover:scale-105 shadow-xl"
                      }
                    `}
                      loading={isGeneratingQuiz}
                      leftSection={<IconFileText size={24} />}
                    >
                      {isGeneratingQuiz
                        ? "Generating Quiz..."
                        : "Generate Quiz"}
                    </Button>
                  )}

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <Text size="sm" className="font-medium text-gray-600">
                      {progressLabel}
                    </Text>
                    {workerReady && (
                      <Badge
                        color="green"
                        variant="light"
                        className="bg-green-50 text-green-700"
                      >
                        Ready
                      </Badge>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(progress > 0 || isProcessing) && (
                    <div className="space-y-3">
                      <Progress
                        value={progress * 100}
                        size="lg"
                        radius="xl"
                        className="transition-all duration-300"
                        color="gray"
                        striped={isProcessing}
                        animated={isProcessing}
                      />
                      <Text
                        size="xs"
                        className="text-right text-gray-500 font-medium"
                      >
                        {Math.round(progress * 100)}% complete
                      </Text>
                    </div>
                  )}
                </Stack>
              </Card>

              {/* Results */}
              {ocrResult && (
                <Card
                  shadow="none"
                  padding="lg"
                  radius="xl"
                  className="flex-1 border-2 border-gray-100"
                >
                  <Stack gap="lg">
                    <Group justify="between" align="center">
                      <Text size="xl" className="font-bold text-gray-900">
                        Extracted Text
                        {isAnimating && (
                          <span className="ml-2 text-gray-500 pulse-slow">
                            ⚡
                          </span>
                        )}
                      </Text>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="gray"
                          onClick={handleCopyText}
                          size="lg"
                          title="Copy to clipboard"
                          className="hover:bg-gray-100"
                        >
                          <IconCopy size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="gray"
                          onClick={handleDownloadText}
                          size="lg"
                          title="Download as text file"
                          className="hover:bg-gray-100"
                        >
                          <IconFileText size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="gray"
                          onClick={handleDownloadPDF}
                          size="lg"
                          title="Download as PDF"
                          className="hover:bg-gray-100"
                        >
                          <IconFile size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="gray"
                          onClick={handleDownloadMarkdown}
                          size="lg"
                          title="Download as Markdown"
                          className="hover:bg-gray-100"
                        >
                          <IconMarkdown size={18} />
                        </ActionIcon>
                      </Group>
                    </Group>

                    <Card className="bg-gray-900 border-0 max-h-96 overflow-hidden rounded-xl">
                      <div className="max-h-80 overflow-y-auto p-4">
                        <Text
                          className="text-gray-100 font-mono text-sm whitespace-pre-wrap break-words leading-relaxed"
                          style={{ fontFamily: "Monaco, Consolas, monospace" }}
                        >
                          {displayedText}
                          {isAnimating && (
                            <span className="typewriter-cursor text-gray-400">
                              |
                            </span>
                          )}
                        </Text>
                      </div>
                    </Card>

                    <Text size="xs" className="text-gray-500 font-medium">
                      {displayedText.length} characters •{" "}
                      {displayedText.split("\n").length} lines
                      {isAnimating && (
                        <span className="ml-2 text-gray-400">
                          (Typing...{" "}
                          {Math.round(
                            (displayedText.length / ocrResult.length) * 100
                          )}
                          %)
                        </span>
                      )}
                    </Text>
                  </Stack>
                </Card>
              )}

              {/* Quiz Interface */}
              {currentView === "quiz" && quiz && (
                <Card
                  shadow="none"
                  padding="lg"
                  radius="xl"
                  className="flex-1 border-2 border-gray-100"
                >
                  <Stack gap="lg">
                    {/* Quiz Header */}
                    <div className="flex justify-between items-center">
                      <Text size="xl" className="font-bold text-gray-900">
                        Question {currentQuestionIndex + 1} of{" "}
                        {quiz.totalQuestions}
                      </Text>
                      <Badge
                        size="lg"
                        variant="light"
                        className="bg-blue-50 text-blue-700"
                      >
                        {Math.round(
                          ((currentQuestionIndex + 1) / quiz.totalQuestions) *
                            100
                        )}
                        % Complete
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <Progress
                      value={
                        ((currentQuestionIndex + 1) / quiz.totalQuestions) * 100
                      }
                      size="lg"
                      radius="xl"
                      color="blue"
                      className="transition-all duration-300"
                    />

                    {/* Question */}
                    <Card className="bg-gray-50 border-0 p-6 rounded-xl">
                      <Text
                        size="lg"
                        className="font-semibold text-gray-800 mb-6"
                      >
                        {quiz.questions[currentQuestionIndex].question}
                      </Text>

                      {/* Options */}
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

                    {/* Navigation */}
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
                        disabled={
                          userAnswers[currentQuestionIndex] === undefined
                        }
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

              {/* Results Interface */}
              {currentView === "results" && quiz && (
                <Card
                  shadow="none"
                  padding="lg"
                  radius="xl"
                  className="flex-1 border-2 border-gray-100"
                >
                  <Stack gap="lg">
                    <div className="text-center">
                      <Text size="2xl" className="font-bold text-gray-900 mb-2">
                        Quiz Complete!
                      </Text>
                      <Text size="xl" className="text-gray-600 mb-6">
                        Your Score: {score}%
                      </Text>

                      {/* Score Circle */}
                      <div className="relative w-32 h-32 mx-auto mb-6">
                        <div className="absolute inset-0 rounded-full border-8 border-gray-200"></div>
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
                          <Text size="2xl" className="font-bold text-gray-900">
                            {score}%
                          </Text>
                        </div>
                      </div>

                      {/* Detailed Results */}
                      <div className="space-y-4">
                        {quiz.questions.map((question, index) => (
                          <Card
                            key={index}
                            className="p-4 border border-gray-200 rounded-lg"
                          >
                            <Text className="font-semibold text-gray-800 mb-2">
                              Question {index + 1}: {question.question}
                            </Text>
                            <div className="space-y-2">
                              {question.options.map((option, optionIndex) => (
                                <div
                                  key={optionIndex}
                                  className={`p-2 rounded ${
                                    optionIndex === question.correctAnswer
                                      ? "bg-green-100 text-green-800"
                                      : userAnswers[index] === optionIndex &&
                                        optionIndex !== question.correctAnswer
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-50 text-gray-700"
                                  }`}
                                >
                                  {String.fromCharCode(65 + optionIndex)}.{" "}
                                  {option}
                                  {optionIndex === question.correctAnswer && (
                                    <span className="ml-2 text-green-600 font-semibold">
                                      ✓ Correct
                                    </span>
                                  )}
                                  {userAnswers[index] === optionIndex &&
                                    optionIndex !== question.correctAnswer && (
                                      <span className="ml-2 text-red-600 font-semibold">
                                        ✗ Your Answer
                                      </span>
                                    )}
                                </div>
                              ))}
                            </div>
                            {question.explanation && (
                              <Text
                                size="sm"
                                className="text-gray-600 mt-2 italic"
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
                          className="bg-gray-600 hover:bg-gray-700"
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
    </MantineProvider>
  );
};

export default Home;
