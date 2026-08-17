import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Wordmark } from "../casework-ui";
import { CompilerWorkbench } from "./workbench";
import { compileProceedingSource } from "@/lib/proceeding-compiler";

export const metadata: Metadata = {
  title: "Opening Statements · Testimony Compiler",
  description: "A provenance-preserving proceeding compiler for Icarus Casework.",
};

export const dynamic = "force-static";

export default async function CompilerPage() {
  const fixturePath = path.join(process.cwd(), "fixtures", "ma-v-lindsay-clancy-opening-statements.rev.txt");
  const source = await readFile(fixturePath, "utf8");
  const proceeding = compileProceedingSource({ provider: "rev", representation: "rev_plain_text", artifactName: path.basename(fixturePath), proceedingType: "opening_statements" }, source);

  return <main className="compiler-shell">
    <header className="compiler-masthead">
      <Wordmark />
      <div className="compiler-product"><span>TESTIMONY COMPILER</span><b>OPENING SLICE / 01</b></div>
      <Link className="compiler-back" href="/">ICARUS CASEWORK →</Link>
    </header>
    <CompilerWorkbench proceeding={proceeding} />
  </main>;
}
