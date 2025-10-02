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
} from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // optional, if you want to use CSS variables
});

export const metadata: Metadata = {
  title: "Instant Question Paper Generator",
  description: "Extract text with OCR and generate MCQ question papers with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body
        className={`${inter.variable} antialiased bg-neutral-950 text-neutral-200`}
      >
        <MantineProvider defaultColorScheme="dark">
          <header className="border-b border-neutral-800">
            <Container size="xl" className="py-4">
              <Group justify="space-between">
                <Link href="/" className="no-underline">
                  <Text className="font-bold text-xl text-white">
                    Instant Question Paper Generator
                  </Text>
                </Link>
                <Group>
                  <Button
                    component={Link as any}
                    href="/quiz"
                    variant="subtle"
                    color="gray"
                  >
                    Open Quiz
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
