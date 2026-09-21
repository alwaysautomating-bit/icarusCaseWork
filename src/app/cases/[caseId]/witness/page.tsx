import Link from "next/link";
import { notFound } from "next/navigation";
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

  return <main className="witness-shell">
    <div className="witness-grid">
      <aside className="witness-list" aria-label="Witnesses by trial day">
        <form method="get" className="witness-search" role="search">
          <input name="q" defaultValue={filterText} placeholder="FIND WITNESS" aria-label="Find witness" autoComplete="off" />
          <button type="submit" aria-label="Find witness">→</button>
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
            <span className="witness-meta">TRIAL DAY {selectedRef.day} · {selectedRef.startDisplay} — {selectedRef.endDisplay}</span>
            <h1>{selectedRef.witness}</h1>
          </header>
          <PlainTextViewer
            title={`${selectedRef.witness}, trial day ${selectedRef.day}`}
            filename={`${witnessSlug(selectedRef)}.txt`}
            plainText={plainText}
            note=""
            iconActions
            findPlaceholder="FIND IN TESTIMONY"
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
