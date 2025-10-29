import "./globals.css";
import { ReactNode } from "react";
import Link from "next/link";
import { LenisProvider } from "@/components/LenisProvider";

export const metadata = {
  title: "Quizy",
  description: "AI-powered quiz generator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body className="min-h-dvh antialiased selection:bg-neutral-300 selection:text-foreground">
        <LenisProvider>
          <nav className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-6xl px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-black/30">
            <div className="flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight text-xl">
                Instant Question Paper Generator
              </Link>
              <div className="flex items-center gap-4 py-[8px] text-sm">
                <Link href="/" className="opacity-80 hover:opacity-100">
                  Home
                </Link>
                <Link href="/create" className="opacity-80 hover:opacity-100">
                  Create
                </Link>
                <Link href="/quiz" className="opacity-80 hover:opacity-100">
                  Quiz
                </Link>
                <Link href="/results" className="opacity-80 hover:opacity-100">
                  Results
                </Link>
                <Link
                  href="/create"
                  className="rounded-full bg-neutral-300 px-4 py-2 text-black font-medium hover:bg-brand-700"
                >
                  Launch
                </Link>
              </div>
            </div>
          </nav>
          <main className="pt-24">{children}</main>
        </LenisProvider>
      </body>
    </html>
  );
}
