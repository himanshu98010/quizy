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
      // Prefer stable model names; avoid "-latest" variants which may 404 in v1beta
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash-8b",
    ].filter(Boolean) as string[];

    const tried: { model: string; ok: boolean; error?: string }[] = [];
    let workingModel: string | null = null;
    for (const modelName of candidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("ping");
        // Read response once to confirm the model works
        void result.response.text();
        tried.push({ model: modelName, ok: true });
        workingModel = modelName;
        break;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        tried.push({ model: modelName, ok: false, error: message });
      }
    }

    if (!workingModel) {
      return NextResponse.json(
        { ok: false, error: "All models failed", tried },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, workingModel, tried });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
