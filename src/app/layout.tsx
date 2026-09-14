import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./testimony-reader.css";
import "./case-workspace.css";

const display = Hanken_Grotesk({ variable: "--font-display", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-workbench-serif", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = { title: { default: "Icarus Casework", template: "%s · Icarus" }, description: "Private, case-scoped Casework for examining court records, testimony, sources, timelines, and unresolved questions." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={`${display.variable} ${mono.variable} ${serif.variable}`}>{children}</body></html>;
}
