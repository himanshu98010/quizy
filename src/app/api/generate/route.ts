import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text: string = (body?.text || "").toString();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "Missing 'text' in request body" },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: GEMINI_API_KEY not set" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const preferred = process.env.GEMINI_MODEL;
    const candidates = (
      preferred && preferred.trim()
        ? [preferred.trim()]
        : [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-1.5-flash-8b",
            "gemini-2.5-pro-latest",
            "gemini-2.5-flash-latest",
          ]
    ) as string[];

    const prompt = `Based on the following text content, generate exactly 5 multiple choice questions (MCQs) that test understanding of the key concepts.

Text content:
${text}

IMPORTANT: Respond with ONLY valid JSON in this exact format (no additional text, explanations, or markdown):
{
  "questions": [
    {
      "id": 1,
      "question": "Question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct"
    }
  ]
}

Requirements:
- Generate few (3 to 8 based on the text content) questions based on the text content
- Make questions clear and test understanding
- Ensure options are plausible and varied
- Correct answers should be distributed (0, 1, 2, 3)
- Provide helpful explanations
- Return ONLY the JSON object, no other text`;

    let lastError: any = null;
    let responseText: string | null = null;
    for (const modelName of candidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        responseText = response.text().trim();
        break;
      } catch (err: any) {
        lastError = err;
      }
    }
    if (!responseText) {
      return NextResponse.json(
        {
          error:
            lastError?.message ||
            "All Gemini models failed. Check model availability/region and billing.",
        },
        { status: 502 }
      );
    }

    let cleanResponse = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");

    const jsonStart = cleanResponse.indexOf("{");
    if (jsonStart > 0) cleanResponse = cleanResponse.substring(jsonStart);
    const jsonEnd = cleanResponse.lastIndexOf("}");
    if (jsonEnd > 0 && jsonEnd < cleanResponse.length - 1) {
      cleanResponse = cleanResponse.substring(0, jsonEnd + 1);
    }

    let quizData: any;
    try {
      quizData = JSON.parse(cleanResponse);
    } catch {
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        quizData = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json(
          { error: "AI response did not contain valid JSON" },
          { status: 502 }
        );
      }
    }

    if (!quizData?.questions || !Array.isArray(quizData.questions)) {
      return NextResponse.json(
        { error: "AI returned unexpected format" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      questions: quizData.questions,
      totalQuestions: quizData.questions.length,
      timeLimit: 300,
      modelUsed: candidates.find((m) => true) || "",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
