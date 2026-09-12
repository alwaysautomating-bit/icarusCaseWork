import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { CollapseDocument } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";
import { FileTabNav } from "@/app/cases/[caseId]/trial-index/_components/file-tab-nav";
import { requireCaseActor } from "@/lib/authority";
import { getCollapseTrialIndexDays } from "@/lib/collapse-trial-index";
import { getTrialIndexWorkspace } from "@/lib/trial-index";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string; section?: string }>;

const SHORT_SECTION_NAMES: Record<string, string> = {
  "Key Insights": "Insights",
  "Projects Discussed": "Projects",
  "Context Required For Future Work": "Context",
  "Open Questions": "Questions",
  "Next Actions": "Actions",
  "Memory Candidates": "Memory",
  "Features / Skills / Scripts / Code / Screens": "Assets",
  "Handoff Brief": "Handoff",
};

function indexHref(caseId: string, dayNumber: number, section?: string) {
  const query = new URLSearchParams({ day: String(dayNumber) });
  if (section) query.set("section", section);
  return `/cases/${encodeURIComponent(caseId)}/trial-index?${query}`;
}

export default async function TrialIndexPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const [actor, { caseId }, state, days] = await Promise.all([requireCaseActor(), params, searchParams, getCollapseTrialIndexDays()]);
  const workspace = await getTrialIndexWorkspace(actor.id, caseId, {});
  if (!workspace || days.length === 0) notFound();

  const requestedDay = /^\d+$/.test(state.day ?? "") ? Number(state.day) : 7;
  const selectedDay = days.find((day) => day.dayNumber === requestedDay) ?? days[0];
  const selectedSection = selectedDay.sections.find((section) => section.slug === state.section) ?? selectedDay.sections[0];
  if (!selectedSection) notFound();
  const selectedDayIndex = days.indexOf(selectedDay);
  const previousDay = selectedDayIndex > 0 ? days[selectedDayIndex - 1] : null;
  const nextDay = selectedDayIndex < days.length - 1 ? days[selectedDayIndex + 1] : null;

  return <main className="collapse-trial-index-shell">
    <nav className="trial-day-context" aria-label="Trial day">
      {previousDay ? <Link href={indexHref(caseId, previousDay.dayNumber)} aria-label={`Previous trial day, Day ${previousDay.dayNumber}`}>‹</Link> : <span aria-disabled="true">‹</span>}
      <details>
        <summary>Day {selectedDay.dayNumber} of {days.length}</summary>
        <div>{days.map((day) => <Link href={indexHref(caseId, day.dayNumber)} prefetch={false} aria-current={day.dayNumber === selectedDay.dayNumber ? "page" : undefined} key={day.dayNumber}>Day {day.dayNumber}</Link>)}</div>
      </details>
      {nextDay ? <Link href={indexHref(caseId, nextDay.dayNumber)} aria-label={`Next trial day, Day ${nextDay.dayNumber}`}>›</Link> : <span aria-disabled="true">›</span>}
      <strong>Supplied working material</strong>
    </nav>

    <details className="trial-purpose-disclosure">
      <summary>Day {selectedDay.dayNumber} purpose</summary>
      <CollapseDocument content={selectedDay.purpose} />
    </details>

    <section className="collapse-index-file">
      <FileTabNav
        ariaLabel={`Day ${selectedDay.dayNumber} sections`}
        className="collapse-section-tabs"
        tabs={selectedDay.sections.map((section) => ({ active: section.slug === selectedSection.slug, href: indexHref(caseId, selectedDay.dayNumber, section.slug), label: SHORT_SECTION_NAMES[section.name] ?? section.name }))}
      />

      <article className="collapse-section-panel">
        <header><div><MonoLabel>DAY {selectedDay.dayNumber} · SECTION {selectedDay.sections.indexOf(selectedSection) + 1} OF {selectedDay.sections.length}</MonoLabel><h1>{selectedSection.name}</h1></div></header>
        <CollapseDocument content={selectedSection.content} />
      </article>
    </section>
  </main>;
}
