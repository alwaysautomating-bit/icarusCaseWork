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
  const actor = await requireCaseActor();
  const [{ caseId }, state, days] = await Promise.all([params, searchParams, getCollapseTrialIndexDays()]);
  const workspace = await getTrialIndexWorkspace(actor.id, caseId, {});
  if (!workspace || days.length === 0) notFound();

  const requestedDay = /^\d+$/.test(state.day ?? "") ? Number(state.day) : 7;
  const selectedDay = days.find((day) => day.dayNumber === requestedDay) ?? days[0];
  const selectedSection = selectedDay.sections.find((section) => section.slug === state.section) ?? selectedDay.sections[0];
  if (!selectedSection) notFound();

  return <main className="collapse-trial-index-shell">
    <FileTabNav
      ariaLabel="Trial day files"
      className="collapse-file-tabs"
      tabs={days.map((day) => ({ active: day.dayNumber === selectedDay.dayNumber, href: indexHref(caseId, day.dayNumber), label: `Day ${day.dayNumber}` }))}
    />

    <section className="collapse-purpose-card">
      <header>
        <div><MonoLabel>TRIAL INDEX · DAY {selectedDay.dayNumber}</MonoLabel><h1>Purpose</h1></div>
        <div className="collapse-purpose-meta"><span>SUPPLIED WORKING MATERIAL</span><strong>{selectedDay.sections.length} SECTIONS</strong></div>
      </header>
      <CollapseDocument content={selectedDay.purpose} />
    </section>

    <section className="collapse-index-file">
      <FileTabNav
        ariaLabel={`Day ${selectedDay.dayNumber} sections`}
        className="collapse-section-tabs"
        tabs={selectedDay.sections.map((section) => ({ active: section.slug === selectedSection.slug, href: indexHref(caseId, selectedDay.dayNumber, section.slug), label: SHORT_SECTION_NAMES[section.name] ?? section.name }))}
      />

      <article className="collapse-section-panel">
        <header><div><MonoLabel>DAY {selectedDay.dayNumber} · SECTION</MonoLabel><h2>{selectedSection.name}</h2></div><span>{selectedDay.sections.indexOf(selectedSection) + 1} / {selectedDay.sections.length}</span></header>
        <CollapseDocument content={selectedSection.content} />
      </article>
    </section>
  </main>;
}
