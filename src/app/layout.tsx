import type { Metadata } from "next";
import { Anybody, Be_Vietnam_Pro, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./testimony-reader.css";
import "./case-workspace.css";

const display = Hanken_Grotesk({ variable: "--font-display", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });
const researchDisplay = Anybody({ variable: "--font-research-display", subsets: ["latin"] });
const researchBody = Be_Vietnam_Pro({ variable: "--font-research-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = { title: { default: "Icarus Research Room", template: "%s · Icarus" }, description: "Private, case-scoped collaboration for examining court records, testimony, sources, timelines, and unresolved questions." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={`${display.variable} ${mono.variable} ${researchDisplay.variable} ${researchBody.variable}`}>{children}</body></html>;
}
