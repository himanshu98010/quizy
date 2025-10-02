import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidates = [
      process.env.GEMINI_MODEL?.trim(),
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash-latest",
    ].filter(Boolean) as string[];

    const tried: { model: string; ok: boolean; error?: string }[] = [];
    let workingModel: string | null = null;
    for (const modelName of candidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("ping");
        const text = result.response.text();
        tried.push({ model: modelName, ok: true });
        workingModel = modelName;
        break;
      } catch (e: any) {
        tried.push({ model: modelName, ok: false, error: e?.message });
      }
    }

    if (!workingModel) {
      return NextResponse.json(
        { ok: false, error: "All models failed", tried },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, workingModel, tried });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
