import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import {
  MantineProvider,
  ColorSchemeScript,
  Container,
  Group,
  Button,
  Text,
  createTheme,
} from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // optional, if you want to use CSS variables
});

const theme = createTheme({
  fontFamily: inter.style.fontFamily,
  primaryColor: 'blue',
  defaultColorScheme: 'dark',
});

export const metadata: Metadata = {
  title: "Quizy - Instant Question Paper Generator",
  description: "Transform any image into an interactive quiz with advanced OCR and AI-powered question generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body
        className={`${inter.variable} antialiased bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-slate-200`}
        suppressHydrationWarning
      >
        <MantineProvider theme={theme}>
          <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
            <Container size="xl" className="py-4">
              <Group justify="space-between">
                <Link href="/" className="no-underline hover-lift transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                      <Text className="font-black text-lg text-white">Q</Text>
                    </div>
                    <Text className="font-black text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      Quizy
                    </Text>
                  </div>
                </Link>
                <Group gap="md">
                  <Button
                    component={Link as any}
                    href="/quiz"
                    variant="light"
                    size="md"
                    className="bg-slate-800/50 hover:bg-blue-600/20 border border-slate-600/50 hover:border-blue-500/50 text-slate-200 hover:text-blue-300 transition-all duration-300"
                  >
                    🎯 Quiz
                  </Button>
                  <Button
                    component={Link as any}
                    href="/studio"
                    variant="light"
                    size="md"
                    className="bg-slate-800/50 hover:bg-purple-600/20 border border-slate-600/50 hover:border-purple-500/50 text-slate-200 hover:text-purple-300 transition-all duration-300"
                  >
                    🎨 Studio
                  </Button>
                </Group>
              </Group>
            </Container>
          </header>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
