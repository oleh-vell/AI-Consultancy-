import type { Metadata } from "next";
import { Inter, Space_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Space Grotesk — the open twin of FK Grotesk (Perplexity's wordmark face)
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Editorial serif, scoped to the generated pitch deck so it reads like a real document
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Consultancy of London",
  description:
    "An AI consulting agency that runs itself — it calls leads, runs discovery, builds the pitch, and bills the client.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${grotesk.variable} ${newsreader.variable}`}
    >
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
