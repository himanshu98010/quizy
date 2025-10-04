"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";

export default function CreatePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [preview, setPreview] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      localStorage.setItem("quizy:current", JSON.stringify(data));
      window.location.href = "/quiz";
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setError(null);
    setOcrProgress(0);
    setPreview(URL.createObjectURL(file));
    try {
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && m.progress != null) {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      const extracted = (data?.text || "").trim();
      if (extracted) {
        setInput((prev) => (prev ? prev + "\n\n" + extracted : extracted));
      } else {
        setError("Could not extract text from image");
      }
    } catch (e: any) {
      setError(e?.message || "OCR failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6">
      <motion.h1
        className="text-3xl font-semibold"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Create
      </motion.h1>
      <p className="mt-2 text-zinc-400">
        Paste text or upload an image. We will OCR it and generate an MCQ quiz.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_280px]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste text here..."
          className="h-64 w-full resize-vertical rounded-xl border border-white/10 bg-white/5 p-4 outline-none"
        />

        <div className="space-y-3">
          <label className="block rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <span className="block font-medium">Upload image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFilesSelected(e.target.files)}
              className="mt-2 block w-full text-xs"
            />
            {ocrProgress > 0 && ocrProgress < 100 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded bg-white/10">
                <div
                  className="h-full bg-neutral-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            )}
          </label>

          {preview && (
            <img
              src={preview}
              alt="preview"
              className="h-40 w-full rounded-lg object-cover"
            />
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={generate}
          disabled={loading || !input.trim()}
          className="rounded-full bg-neutral-300 px-6 py-3 text-black font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate quiz"}
        </button>
        <a href="/quiz" className="text-sm opacity-80 hover:opacity-100">
          Go to quiz
        </a>
      </div>
    </div>
  );
}
