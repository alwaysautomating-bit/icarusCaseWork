import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./testimony-reader.css";
import "./case-workspace.css";
import "./design-system.css";
import "./specimen-parity.css";
import "./trial-index-layout.css";

// Icarus Casework design system (see design-system/ICARUS_CASEWORK_DESIGN_SYSTEM.md):
// the straighter component pairing. Playfair Display for headings and names, Inter for body and UI,
// JetBrains Mono for data, locators, timestamps, and eyebrows. Loaded once so every route shares them.
const sans = Inter({ variable: "--font-workbench-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-workbench-mono", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const serif = Playfair_Display({ variable: "--font-workbench-serif", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });

export const metadata: Metadata = { title: { default: "Icarus Casework", template: "%s · Icarus" }, description: "Private, case-scoped Casework for examining court records, testimony, sources, timelines, and unresolved questions." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={`${sans.variable} ${mono.variable} ${serif.variable}`}>{children}</body></html>;
}
