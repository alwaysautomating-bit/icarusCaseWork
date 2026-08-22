import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getCaseReconstructionWorkspace, type ReconstructionSnapshot, type SavedReconstructionVersion } from "@/lib/case-reconstruction";
import { courtRecordHref, reconstructionHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

function VersionColumn({ caseId, version }: { caseId: string; version: SavedReconstructionVersion }) {
  const assertionByRef = new Map(version.snapshot.assertions.map((item) => [item.ref, item]));
  return <section className="reconstruction-version-column">
    <header><div><span>IMMUTABLE SNAPSHOT</span><h2>{version.name} · v{version.version}</h2></div><time>{new Date(version.createdAt).toLocaleString()}</time><code>{version.snapshotSha256.slice(0, 12)}</code></header>
    {version.snapshot.lanes.map((lane) => <section className="reconstruction-lane" key={lane.key}>
      <header><strong>{lane.label}</strong><span>{version.snapshot.nodes.filter((node) => node.laneKey === lane.key).length} nodes</span></header>
      {version.snapshot.nodes.filter((node) => node.laneKey === lane.key).map((node) => <article className="reconstruction-node" key={node.key}>
        <header><span>#{String(node.ordinal).padStart(2, "0")} · {node.status}</span><strong>{node.temporalLabel}</strong></header>
        <h3>{node.title}</h3><p>{node.summary}</p>
        <div className="reconstruction-assertions">{node.assertionRefs.map((ref) => {
          const assertion = assertionByRef.get(ref);
          if (!assertion) return null;
          return <article key={ref}><header><strong>{assertion.witness}</strong><span>{assertion.precision.replaceAll("_", " ")} · {assertion.qualification.replaceAll("_", " ")}</span></header><blockquote>{assertion.source_wording}</blockquote><Link href={courtRecordHref(caseId, { segmentId: assertion.source_segment_ids[0] })}>Open exact source →</Link></article>;
        })}</div>
      </article>)}
    </section>)}
    <section className="reconstruction-tensions"><header><strong>UNRESOLVED TENSIONS</strong><span>{version.snapshot.tensions.length}</span></header>{version.snapshot.tensions.map((tension) => <article key={tension.key}><span>{tension.field.replaceAll("_", " ")} · {tension.status}</span><h3>{tension.title}</h3><p>{tension.note}</p></article>)}</section>
  </section>;
}

export default async function ReconstructionPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireCaseActor();
  const [{ caseId }, query] = await Promise.all([params, searchParams]);
  const workspace = await getCaseReconstructionWorkspace(actor.id, caseId);
  if (!workspace) notFound();
  const requested = (Array.isArray(query.compare) ? query.compare : query.compare ? [query.compare] : []).slice(0, 4);
  const selected = (requested.length ? requested : workspace.versions[0] ? [workspace.versions[0].id] : []).map((id) => workspace.versions.find((version) => version.id === id)).filter((version): version is SavedReconstructionVersion => Boolean(version));
  const activeSnapshots: ReconstructionSnapshot[] = selected.map((version) => version.snapshot);
  return <main className="reconstruction-shell">
    <section className="reconstruction-heading"><div><MonoLabel>RECONSTRUCTION · TESTIMONY ASSERTIONS</MonoLabel><h1>Sequence without<br />false certainty.</h1><p>Compare immutable reconstruction proposals. Nodes group witness assertions; edges propose order or overlap; tensions remain unresolved. No view shown here is a canonical event timeline.</p></div><dl><div><dt>Saved versions</dt><dd>{workspace.versions.length}</dd></div><div><dt>Visible witnesses</dt><dd>{new Set(activeSnapshots.flatMap((snapshot) => snapshot.assertions.map((item) => item.witness))).size}</dd></div><div><dt>Open tensions</dt><dd>{activeSnapshots.reduce((count, snapshot) => count + snapshot.tensions.length, 0)}</dd></div></dl></section>
    {workspace.versions.length === 0 ? <section className="reconstruction-empty"><strong>NO SAVED RECONSTRUCTION</strong><p>Compile a reviewed candidate reconstruction before using this workspace. Source-only testimony is never turned into a timeline automatically.</p></section> : <>
      <section className="reconstruction-version-picker"><header><div><MonoLabel>VERSION COMPARISON</MonoLabel><h2>Pin up to four snapshots</h2></div><strong>{selected.length} / 4</strong></header><div>{workspace.versions.map((version) => {
        const isSelected = selected.some((item) => item.id === version.id);
        const next = isSelected ? selected.filter((item) => item.id !== version.id).map((item) => item.id) : [...selected.map((item) => item.id), version.id].slice(-4);
        return <article className={isSelected ? "selected" : ""} key={version.id}><strong>{version.name} · v{version.version}</strong><p>{version.description || "No version note."}</p><span>{version.snapshot.nodes.length} nodes · {version.snapshot.tensions.length} tensions</span><Link href={reconstructionHref(caseId, next)}>{isSelected ? "Remove" : "Compare"}</Link></article>;
      })}</div></section>
      <section className="reconstruction-compare-grid">{selected.map((version) => <VersionColumn caseId={caseId} version={version} key={version.id} />)}</section>
    </>}
  </main>;
}
