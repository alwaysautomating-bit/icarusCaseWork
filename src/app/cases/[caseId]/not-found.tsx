import Link from "next/link";

export default function CaseNotFound() {
  return <main className="case-route-state forbidden-state"><strong>Case unavailable</strong><p>The case does not exist or the signed-in user does not have permission to retrieve it. No case or source metadata was disclosed.</p><Link href="/">Return to case selection</Link></main>;
}
