"use client";

import { useState } from "react";
import Link from "next/link";
import { MonoLabel } from "@/app/casework-ui";
import { inlineMarkup } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";

export type EvidenceClaim = { title: string; fields: { label: string; text: string }[]; searchHref: string };

const fieldText = (claim: EvidenceClaim, label: string) => claim.fields.find((field) => field.label.toLowerCase() === label)?.text;

export function EvidenceWorkspace({ claims, dayNumber, dayHref }: { claims: EvidenceClaim[]; dayNumber: number; dayHref: string }) {
  const [selected, setSelected] = useState(0);
  const claim = claims[selected] ?? claims[0]!;
  const source = fieldText(claim, "source");
  const other = claim.fields.filter((field) => !["supporting evidence", "source"].includes(field.label.toLowerCase()));

  return <div className="ti-split ti-evidence">
    <ol className="ti-claim-list" aria-label="Claims and supporting evidence">
      {claims.map((item, index) => <li key={index}>
        <button type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}>
          <span className="ti-ref">CLAIM {index + 1}</span>
          <strong>{inlineMarkup(item.title)}</strong>
          {fieldText(item, "supporting evidence") ? <span className="ti-claim-support">{inlineMarkup(fieldText(item, "supporting evidence")!)}</span> : null}
        </button>
      </li>)}
    </ol>
    <aside className="ti-inspector" aria-live="polite">
      <MonoLabel>SOURCE / PROVENANCE · CLAIM {selected + 1} OF {claims.length}</MonoLabel>
      <h3>{inlineMarkup(claim.title)}</h3>
      <dl>
        {source ? <div><dt>Source</dt><dd>{inlineMarkup(source)}</dd></div> : null}
        {other.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{inlineMarkup(field.text)}</dd></div>)}
      </dl>
      <div className="ti-inspector-links">
        <Link href={claim.searchHref}>Search testimony database →</Link>
        <Link href={dayHref}>Open Day {dayNumber} testimony →</Link>
      </div>
    </aside>
  </div>;
}
