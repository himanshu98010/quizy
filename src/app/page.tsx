"use client";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div className="stars" />
      <div className="grid-overlay" />
      <section className="mx-auto flex min-h-[70dvh] w-full max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.8, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xs uppercase tracking-[0.3em] text-zinc-400"
        ></motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-semibold leading-tight md:text-7xl"
        >
          Quizy. Expanding how you study with AI.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="max-w-2xl text-balance text-zinc-400"
        >
          Upload course notes or images. We extract text with OCR and generate
          high‑quality MCQs using Gemini. Take the quiz and get instant
          feedback.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-2 flex items-center gap-3"
        >
          <a
            href="/create"
            className="rounded-full bg-neutral-300 px-6 py-3 text-black font-medium hover:bg-brand-700"
          >
            Launch
          </a>
          <a
            href="#how"
            className="rounded-full border border-white/20 px-6 py-3"
          >
            Learn more
          </a>
        </motion.div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Capture",
              desc: "Drop images or PDFs. OCR extracts the text accurately.",
            },
            {
              title: "Generate",
              desc: "Gemini creates varied MCQs with explanations.",
            },
            {
              title: "Practice",
              desc: "Answer, review, and export results as PDF.",
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: 0.1 * i }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h3 className="mb-2 text-lg font-medium">{card.title}</h3>
              <p className="text-sm text-zinc-400">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
