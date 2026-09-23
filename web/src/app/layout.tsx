import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "../providers/Web3Provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Bountra — Autonomous GitHub PR Auditor & Escrow",
  description: "Commit your code, get paid by AI in seconds — zero human review delay on BNB Chain.",
  keywords: ["BNB Chain", "AI Agent", "GitHub Bounty", "Escrow", "Gemini 2.0 Flash", "Web3", "Foundry"]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-surface-primary text-content-primary antialiased selection:bg-brand-primary selection:text-black">
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
