import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { FilesCard } from "@/app/cases/[caseId]/_components/files-card";
import { PlainTextViewer } from "@/app/cases/[caseId]/record/plain-text-viewer";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { witnessDownloadHref, witnessHref } from "@/lib/case-routes";
import { getWitnessTestimony, listWitnessBlocks, matchesWitness, witnessPlainText, witnessSlug } from "@/lib/witness-testimony";

export const dynamic = "force-dynamic";

type SearchState = { day?: string; block?: string; witness?: string; q?: string; find?: string };

function formatBytes(value: number) {
  return value < 1_048_576 ? `${Math.max(1, Math.round(value / 1_024))} KB` : `${(value / 1_048_576).toFixed(1)} MB`;
}

export default async function WitnessTestimonyPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query] = await Promise.all([requireCaseActor(), params, searchParams]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const all = await listWitnessBlocks();
  const filterText = (query.q ?? "").trim();
  const listed = filterText ? all.filter((block) => matchesWitness(block, filterText)) : all;

  const requestedDay = Number(query.day);
  let selectedRef = all.find((block) => block.day === requestedDay && block.blockId === query.block);
  if (!selectedRef && query.witness) selectedRef = all.find((block) => matchesWitness(block, query.witness!));
  if (!selectedRef) selectedRef = listed[0] ?? all[0];
  const testimony = selectedRef ? await getWitnessTestimony(selectedRef.day, selectedRef.blockId) : null;

  const days = [...new Set(listed.map((block) => block.day))];
  const sameDay = selectedRef ? all.filter((block) => block.day === selectedRef!.day) : [];
  const plainText = testimony ? witnessPlainText(testimony.block, testimony.turns) : "";
  const speakerCount = testimony ? new Set(testimony.turns.map((turn) => turn.speaker)).size : 0;

  return <main className="witness-shell">
    <div className="witness-toolbar" role="note"><strong>Witness testimony</strong><span>Read-only · read from the preserved transcript files · separate from the testimony database</span></div>
    <div className="witness-grid">
      <aside className="witness-list" aria-label="Witnesses by trial day">
        <form method="get" className="court-search-panel-form">
          <MonoLabel>FIND A WITNESS</MonoLabel>
          <input name="q" defaultValue={filterText} placeholder="Josephine, Tufts, Dr. Olson…" aria-label="Witness name" />
          <button>Filter witnesses</button>
        </form>
        <p className="witness-count">{listed.length} witness block{listed.length === 1 ? "" : "s"}{filterText ? ` matching “${filterText}”` : ` across ${days.length} days`}</p>
        {days.map((day) => <section key={day}>
          <h2>Day {day}</h2>
          <ul>{listed.filter((block) => block.day === day).map((block) => <li key={`${block.day}-${block.blockId}`}>
            <Link href={witnessHref(caseId, { day: block.day, block: block.blockId, query: filterText })} aria-current={selectedRef?.day === block.day && selectedRef.blockId === block.blockId ? "page" : undefined} scroll={false}>
              <strong>{block.witness}</strong><span>{block.startDisplay} – {block.endDisplay}</span>
            </Link>
          </li>)}</ul>
        </section>)}
        {listed.length === 0 ? <p className="foundation-empty">No witness matches that name.</p> : null}
      </aside>

      <section className="witness-center" aria-label="Witness testimony">
        {selectedRef && testimony ? <>
          <header>
            <MonoLabel>TRIAL DAY {selectedRef.day} · {selectedRef.startDisplay} TO {selectedRef.endDisplay}</MonoLabel>
            <h1>{selectedRef.witness}</h1>
            <p className="witness-facts"><span>{testimony.turns.length} segments</span><span>{speakerCount} speakers</span><span>{selectedRef.oath ? "Oath detected" : "No oath detected"}</span><span>{selectedRef.excusal ? "Excusal detected" : "No excusal detected"}</span><span>Boundary confidence {selectedRef.confidence.toFixed(2)}</span></p>
            <p className="witness-caution">Witness boundaries are deterministic candidates from the intake compiler. They can include procedure before testimony begins or after it ends, and they need review. Timestamps are transcript positions, not event times.</p>
          </header>
          <PlainTextViewer
            title={`${selectedRef.witness}, trial day ${selectedRef.day}`}
            filename={`${witnessSlug(selectedRef)}.txt`}
            plainText={plainText}
            note={`${testimony.turns.length} segments · timestamps as recorded`}
            initialFind={query.find?.trim().slice(0, 80)}
            lines={testimony.turns.map((turn) => ({ id: `${turn.segment_index}`, time: turn.timestamp_display, speaker: turn.speaker, text: turn.text }))}
          />
        </> : <div className="witness-empty"><strong>No testimony selected.</strong><p>Choose a witness from the list.</p></div>}
      </section>

      <aside className="witness-files" aria-label="Files and links">
        {selectedRef && testimony ? <>
          <FilesCard title="Quick access" count={4} items={[
            { label: "Testimony as plain text", meta: `.txt · ${formatBytes(Buffer.byteLength(plainText))}`, href: witnessDownloadHref(caseId, selectedRef.day, selectedRef.blockId, "txt"), download: true },
            { label: "Witness block with segments", meta: ".json", href: witnessDownloadHref(caseId, selectedRef.day, selectedRef.blockId, "json"), download: true },
            { label: `Day ${selectedRef.day} transcript (source)`, meta: `${formatBytes(testimony.sourceBytes)}`, href: witnessDownloadHref(caseId, selectedRef.day, selectedRef.blockId, "source"), download: true },
            { label: `Day ${selectedRef.day} first pass`, meta: ".json", href: witnessDownloadHref(caseId, selectedRef.day, selectedRef.blockId, "first-pass"), download: true },
          ]} />
          {selectedRef.revUrl ? <FilesCard title="Original source" items={[{ label: "Transcript and video on Rev", href: selectedRef.revUrl, external: true }]} /> : null}
          <FilesCard title={`Day ${selectedRef.day} witnesses`} count={sameDay.length} items={sameDay.map((block) => ({ label: block.witness, meta: block.startDisplay, href: witnessHref(caseId, { day: block.day, block: block.blockId }) }))} />
        </> : null}
      </aside>
    </div>
  </main>;
}
