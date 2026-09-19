import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { CollapseDocument } from "@/app/cases/[caseId]/trial-index/_components/collapse-document";
import { DayWitnessTable } from "@/app/cases/[caseId]/trial-index/_components/day-witness-table";
import { DayCreatorGuide } from "@/app/cases/[caseId]/trial-index/_components/day-creator-guide";
import { ExpandCollapseAll } from "@/app/cases/[caseId]/trial-index/_components/expand-collapse-all";
import { FileTabNav } from "@/app/cases/[caseId]/trial-index/_components/file-tab-nav";
import { requireCaseActor } from "@/lib/authority";
import { getCollapseTrialIndexDays } from "@/lib/collapse-trial-index";
import { foundationDays } from "@/lib/foundation-day-index";
import { getTrialIndexWorkspace } from "@/lib/trial-index";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string; section?: string; view?: string }>;

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

const USER_TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "witnesses", label: "Witnesses" },
  { slug: "evidence", label: "Evidence" },
  { slug: "questions", label: "Open questions" },
  { slug: "creators", label: "Creators" },
] as const;

function indexHref(caseId: string, dayNumber: number, section?: string, asUser = false) {
  const query = new URLSearchParams({ day: String(dayNumber) });
  if (section) query.set("section", section);
  if (asUser) query.set("view", "user");
  return `/cases/${encodeURIComponent(caseId)}/trial-index?${query}`;
}

export default async function TrialIndexPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: SearchParams }) {
  const [actor, { caseId }, state, days] = await Promise.all([requireCaseActor(), params, searchParams, getCollapseTrialIndexDays()]);
  const workspace = await getTrialIndexWorkspace(actor.id, caseId, {});
  if (!workspace || days.length === 0) notFound();

  if (!/^\d+$/.test(state.day ?? "")) {
    const detailDayNumbers = new Set(days.map((day) => day.dayNumber));
    return <main className="case-foundation-shell">
      <header className="case-foundation-hero">
        <MonoLabel>TRIAL INDEX · TESTIMONY BY DAY</MonoLabel>
        <h1>Who testified, and what they added.</h1>
        <p>Each trial day, the witnesses who testified, what they spoke about, and the evidence or information they contributed. Open a day for its working detail. Days 9–13 follow the dated trial-index fixture and the transcript-derived day files; where the reporting table differed, the day carries a source note.</p>
      </header>
      <section className="foundation-day-index" aria-label="Testimony by trial day">
        <ExpandCollapseAll />
        <div className="foundation-day-list">
          {foundationDays.map((day) => <section className="foundation-day" aria-labelledby={`foundation-day-${day.day}`} key={day.day}>
            <header>
              <span>DAY</span>
              <strong id={`foundation-day-${day.day}`}>{String(day.day).padStart(2, "0")}</strong>
              {day.date ? <small>{day.date}</small> : null}
              {detailDayNumbers.has(day.day) ? <Link href={indexHref(caseId, day.day)} aria-label={`Open Day ${day.day} detail`}>Open day <span aria-hidden="true">→</span></Link> : null}
            </header>
            <details className="foundation-day-body">
              <summary>
                <span className="foundation-day-summary">{day.summary}</span>
                <span className="foundation-day-witnesses">{day.entries.map((entry) => entry.witness).join(" · ")}</span>
                <span className="foundation-day-toggle" aria-hidden="true" />
              </summary>
              {day.note ? <p className="foundation-day-note">{day.note}</p> : null}
              <DayWitnessTable caseId={caseId} day={day} />
            </details>
          </section>)}
        </div>
      </section>
    </main>;
  }

  const selectedDay = days.find((day) => day.dayNumber === Number(state.day));
  if (!selectedDay) notFound();
  const isOwner = workspace.currentCase.membershipRole === "owner";
  const viewAsUser = isOwner && state.view === "user";
  const isAdmin = isOwner && !viewAsUser;
  const href = (dayNumber: number, section?: string) => indexHref(caseId, dayNumber, section, viewAsUser);
  const selectedSection = selectedDay.sections.find((section) => section.slug === state.section) ?? selectedDay.sections[0];
  if (!selectedSection) notFound();
  const sectionContent = (slug: string) => selectedDay.sections.find((section) => section.slug === slug)?.content;
  const activeUserTab = USER_TABS.find((tab) => tab.slug === (state.section === "open-questions" ? "questions" : state.section)) ?? USER_TABS[0];
  const dayIndexEntry = foundationDays.find((day) => day.day === selectedDay.dayNumber);
  const selectedDayIndex = days.indexOf(selectedDay);
  const previousDay = selectedDayIndex > 0 ? days[selectedDayIndex - 1] : null;
  const nextDay = selectedDayIndex < days.length - 1 ? days[selectedDayIndex + 1] : null;

  return <main className="collapse-trial-index-shell">
    <nav className="trial-day-context" aria-label="Trial day">
      {previousDay ? <Link href={href(previousDay.dayNumber)} aria-label={`Previous trial day, Day ${previousDay.dayNumber}`}>‹</Link> : <span aria-disabled="true">‹</span>}
      <details>
        <summary>Day {selectedDay.dayNumber} of {days.length}</summary>
        <div>{days.map((day) => <Link href={href(day.dayNumber)} prefetch={false} aria-current={day.dayNumber === selectedDay.dayNumber ? "page" : undefined} key={day.dayNumber}>Day {day.dayNumber}</Link>)}</div>
      </details>
      {nextDay ? <Link href={href(nextDay.dayNumber)} aria-label={`Next trial day, Day ${nextDay.dayNumber}`}>›</Link> : <span aria-disabled="true">›</span>}
      <strong>Supplied working material</strong>
    </nav>

    {isOwner ? <nav className="view-as-toggle" aria-label="Preview as">
      <span>Viewing as</span>
      <Link href={indexHref(caseId, selectedDay.dayNumber, isAdmin ? selectedSection.slug : undefined)} aria-current={isAdmin ? "page" : undefined} prefetch={false}>Admin</Link>
      <Link href={indexHref(caseId, selectedDay.dayNumber, viewAsUser ? activeUserTab.slug : undefined, true)} aria-current={viewAsUser ? "page" : undefined} prefetch={false}>User</Link>
    </nav> : null}

    {isAdmin ? <>
    <details className="trial-purpose-disclosure">
      <summary>Day {selectedDay.dayNumber} purpose</summary>
      <CollapseDocument content={selectedDay.purpose} />
    </details>

    <section className="collapse-index-file">
      <FileTabNav
        ariaLabel={`Day ${selectedDay.dayNumber} sections`}
        className="collapse-section-tabs"
        tabs={selectedDay.sections.map((section) => ({ active: section.slug === selectedSection.slug, href: href(selectedDay.dayNumber, section.slug), label: SHORT_SECTION_NAMES[section.name] ?? section.name }))}
      />

      <article className="collapse-section-panel">
        <header><div><MonoLabel>DAY {selectedDay.dayNumber} · SECTION {selectedDay.sections.indexOf(selectedSection) + 1} OF {selectedDay.sections.length}</MonoLabel><h1>{selectedSection.name}</h1></div></header>
        <CollapseDocument content={selectedSection.content} />
      </article>
    </section>
    </> : <>
    <section className="collapse-index-file">
      <FileTabNav
        ariaLabel={`Day ${selectedDay.dayNumber} sections`}
        className="collapse-section-tabs"
        tabs={USER_TABS.map((tab) => ({ active: tab.slug === activeUserTab.slug, href: href(selectedDay.dayNumber, tab.slug), label: tab.label }))}
      />

      <article className="collapse-section-panel">
        <header><div><MonoLabel>DAY {selectedDay.dayNumber}{dayIndexEntry?.date ? ` · ${dayIndexEntry.date.toUpperCase()}` : ""}</MonoLabel><h1>{activeUserTab.label}</h1></div></header>
        {activeUserTab.slug === "overview" ? <>
          <CollapseDocument content={selectedDay.purpose} />
          {sectionContent("key-insights") ? <CollapseDocument content={sectionContent("key-insights")!} /> : null}
        </> : null}
        {activeUserTab.slug === "witnesses" ? (dayIndexEntry ? <DayWitnessTable caseId={caseId} day={dayIndexEntry} /> : <p className="foundation-empty">No witness index has been entered for this day yet.</p>) : null}
        {activeUserTab.slug === "evidence" ? (sectionContent("evidence") ? <CollapseDocument content={sectionContent("evidence")!} /> : <p className="foundation-empty">No evidence summary has been entered for this day yet.</p>) : null}
        {activeUserTab.slug === "creators" ? (dayIndexEntry ? <DayCreatorGuide day={dayIndexEntry} /> : <p className="foundation-empty">No creator guide is available for this day yet.</p>) : null}
        {activeUserTab.slug === "questions" ? (sectionContent("open-questions") ? <CollapseDocument content={sectionContent("open-questions")!} /> : <p className="foundation-empty">No open questions have been recorded for this day.</p>) : null}
      </article>
    </section>
    </>}
  </main>;
}
