"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./reports.module.css";

export type ReportCategory = "analysis" | "reference";

export type ReportLibraryEntry = {
  id: string;
  category: ReportCategory;
  kind: string;
  title: string;
  summary: string;
  source: string;
  meta: string;
  status: string;
  statusTone: "reviewed" | "neutral";
  href: string;
  actionLabel: string;
  detail: string;
  download?: string;
  checksum?: string;
};

type FilterId = "all" | ReportCategory;

const filterLabels: Record<FilterId, string> = {
  all: "ALL",
  analysis: "CASE REPORTS",
  reference: "REFERENCE MATERIAL",
};

export function ReportLibrary({ entries }: { entries: ReportLibraryEntry[] }) {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const counts = entries.reduce<Record<FilterId, number>>((result, entry) => {
    result.all += 1;
    result[entry.category] += 1;
    return result;
  }, { all: 0, analysis: 0, reference: 0 });
  const visibleEntries = activeFilter === "all"
    ? entries
    : entries.filter((entry) => entry.category === activeFilter);

  return (
    <section className={styles.library} aria-label="Case report library">
      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Filter reports by kind" role="group">
          {(Object.keys(filterLabels) as FilterId[]).map((filterId) => (
            <button
              aria-pressed={activeFilter === filterId}
              className={styles.filterButton}
              key={filterId}
              onClick={() => setActiveFilter(filterId)}
              type="button"
            >
              {filterLabels[filterId]} <span>({counts[filterId]})</span>
            </button>
          ))}
        </div>
        <p className={styles.count} aria-live="polite">{visibleEntries.length} {visibleEntries.length === 1 ? "DOCUMENT" : "DOCUMENTS"}</p>
      </div>

      <div className={styles.documentList}>
        {visibleEntries.map((entry) => (
          <article className={styles.document} key={entry.id}>
            <span className={`${styles.kindTag} ${entry.kind === "MD" ? styles.kindAccent : ""}`}>{entry.kind}</span>
            <div className={styles.documentBody}>
              <div className={styles.documentHeading}>
                <h2>
                  {entry.download
                    ? <a download={entry.download} href={entry.href}>{entry.title}</a>
                    : <Link href={entry.href}>{entry.title}</Link>}
                </h2>
                <span className={`${styles.statusTag} ${entry.statusTone === "reviewed" ? styles.statusReviewed : styles.statusNeutral}`}>{entry.status}</span>
              </div>
              <p className={styles.summary}>{entry.summary}</p>
              <div className={styles.metadata}>
                <span>SOURCE: {entry.source}</span>
                <span>{entry.meta}</span>
              </div>
              <div className={styles.documentFooter}>
                <span className={styles.detail}>{entry.detail}</span>
                {entry.download
                  ? <a className={styles.action} download={entry.download} href={entry.href}>{entry.actionLabel} <span aria-hidden="true">↓</span></a>
                  : <Link className={styles.action} href={entry.href}>{entry.actionLabel} <span aria-hidden="true">→</span></Link>}
              </div>
              {entry.checksum ? <code className={styles.checksum}>SHA-256 · {entry.checksum}</code> : null}
            </div>
          </article>
        ))}
        {visibleEntries.length === 0 ? <p className={styles.empty}>No documents in this category.</p> : null}
      </div>
    </section>
  );
}
