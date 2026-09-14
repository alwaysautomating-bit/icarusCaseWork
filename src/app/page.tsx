import type { Metadata } from "next";
import Link from "next/link";
import "./vestibule.css";

export const metadata: Metadata = { title: "Threshold", description: "Icarus Casework — an operational control plane for evidence-bound decision making." };

export default function VestibulePage() {
  return <main className="vestibule-shell">
    <div className="vestibule-doctrine d-tl">Identity before action</div>
    <div className="vestibule-doctrine d-tr">Evidence before assertion</div>
    <div className="vestibule-doctrine d-right-vert">Provenance preserved</div>
    <div className="vestibule-doctrine d-bl-inverted">Permission &ne; readiness</div>

    <div className="vestibule-center">
      <svg className="vestibule-seal" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="37" />
        <circle className="core" cx="40" cy="18" r="1.6" />
        <line x1="40" x2="40" y1="24" y2="30" />
        <path d="M 40 32 L 20 46 M 40 32 L 60 46" />
        <path d="M 40 40 L 24 52 M 40 40 L 56 52" />
        <path d="M 40 48 L 28 58 M 40 48 L 52 58" />
      </svg>
      <div className="vestibule-subtitle-1">Operational control plane</div>
      <div className="vestibule-subtitle-2">For evidence-bound decision making</div>
    </div>

    <div className="vestibule-rule" />
    <Link className="vestibule-enter" href="/casework">Enter the record <span aria-hidden="true">→</span></Link>

    <div className="vestibule-wordmark-wrap" aria-hidden="true">
      <div className="vestibule-wordmark">ICARUS</div>
    </div>
  </main>;
}
