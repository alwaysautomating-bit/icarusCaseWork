import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { buildWitnessAccountTimelines } from "@/lib/account-timeline";
import { requireCaseActor } from "@/lib/authority";
import { getCaseDigitalEvidenceTimeline } from "@/lib/case-digital-evidence";
import { getCaseReconstructionWorkspace } from "@/lib/case-reconstruction";
import { accountsHref, courtRecordHref, reconstructionHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

type SearchState = { account?: string; version?: string; view?: string };

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function incidentLabel(incidentAt: string | null) {
  if (!incidentAt) return "Incident timeline";
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(incidentAt)
    ? new Date(`${incidentAt}T12:00:00Z`)
    : new Date(incidentAt);
  return parsedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export default async function AccountsPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const actor = await requireCaseActor();
  const [{ caseId }, query] = await Promise.all([params, searchParams]);
  const [workspace, digitalTimeline] = await Promise.all([
    getCaseReconstructionWorkspace(actor.id, caseId),
    getCaseDigitalEvidenceTimeline(caseId),
  ]);
  if (!workspace) notFound();

  const version = workspace.versions.find((item) => item.id === query.version) ?? workspace.versions[0] ?? null;
  const accounts = version ? buildWitnessAccountTimelines(version.snapshot) : [];
  const requestedAccount = query.account ? accounts.find((account) => account.key === query.account) : null;
  const selected = requestedAccount
    ?? accounts.find((account) => account.witness.toLowerCase().includes("stephen hall"))
    ?? accounts[0]
    ?? null;
  const tensionByKey = new Map(version?.snapshot.tensions.map((tension) => [tension.key, tension]) ?? []);
  const selectedTensions = selected
    ? [...new Set(selected.items.flatMap((item) => item.tensionKeys))].flatMap((key) => {
      const tension = tensionByKey.get(key);
      return tension ? [tension] : [];
    })
    : [];
  const alignedAccounts = selected
    ? accounts.filter((account) => account.key !== selected.key && selected.items.some((item) => item.alignedWitnesses.includes(account.witness)))
    : [];
  const view = query.view === "compare" || query.view === "digital" ? query.view : "account";
  const currentLabel = view === "digital" ? "Digital evidence" : view === "compare" ? `${selected?.witness ?? "Witness account"} + digital` : selected?.witness ?? "No account available";
  const date = incidentLabel(workspace.currentCase.incident_at ?? version?.snapshot.incident_date ?? null);

  return <main className="accounts-shell">
    <header className="accounts-page-head">
      <div><MonoLabel>ACCOUNTS · TESTIMONY + DIGITAL</MonoLabel><h1>{date}</h1><p>Read attributed responder accounts, inspect testimony-established digital artifacts, or place both lanes in view without silently merging their evidentiary meaning.</p></div>
      <div className="accounts-head-meta"><span>Current view</span><strong>{currentLabel}</strong><small>{view === "digital" ? `${digitalTimeline.items.length} testimony-established artifacts` : view === "compare" ? `${version?.name ?? "Reconstruction"} · ${digitalTimeline.items.length} digital artifacts` : version ? `${version.name} · v${version.version}` : "No reconstruction version"}</small></div>
    </header>

    <details className="accounts-boundary-note">
      <summary>Interpretation boundary</summary>
      <p>Witness sequence positions come from the selected reconstruction proposal. Digital times are machine times described in examiner testimony, not automatic proof of physical-user identity, intent, or a surrounding event. The two lanes remain distinct and every item links back to its source.</p>
    </details>

    {!version || !selected ? <section className="accounts-empty"><MonoLabel>NO ACCOUNT TIMELINE</MonoLabel><h2>Publish a source-linked first-responder reconstruction first.</h2><p>Accounts are derived from immutable reconstruction versions; source-only testimony is not silently turned into an incident timeline.</p><Link href={reconstructionHref(caseId)}>Open Reconstruction →</Link></section> :
      <div className="accounts-panels">
        <div className="accounts-main-column">
          <nav className="accounts-view-switcher" aria-label="Timeline view">
            <Link href={accountsHref(caseId, { account: selected.key, versionId: version.id, view: "account" })} aria-current={view === "account" ? "page" : undefined}>Witness account</Link>
            <Link href={accountsHref(caseId, { account: selected.key, versionId: version.id, view: "compare" })} aria-current={view === "compare" ? "page" : undefined}>Account + digital</Link>
            <Link href={accountsHref(caseId, { account: selected.key, versionId: version.id, view: "digital" })} aria-current={view === "digital" ? "page" : undefined}>Digital only</Link>
          </nav>

          <div className={view === "compare" ? "accounts-combined-view" : ""}>
            {view !== "digital" && <section className="accounts-view-lane" aria-labelledby="selected-account-heading">
              <header className="accounts-timeline-head"><div><span>WITNESS ACCOUNT</span><h2 id="selected-account-heading">{selected.witness}</h2></div><dl><div><dt>Steps</dt><dd>{selected.items.length}</dd></div><div><dt>Sources</dt><dd>{selected.sourceSegmentCount}</dd></div></dl></header>
              <div className="accounts-legend" aria-label="Witness timeline legend"><span><i className="account-legend-dot account-dot-source" />Attributed testimony</span><span><i className="account-legend-dot account-dot-aligned" />Aligned with another account</span><span><i className="account-legend-dot account-dot-tension" />Unresolved tension</span></div>

              <div className="account-timeline">
                {selected.items.map((item, index) => {
                  const itemTensions = item.tensionKeys.flatMap((key) => {
                    const tension = tensionByKey.get(key);
                    return tension ? [tension] : [];
                  });
                  const state = itemTensions.length ? "tension" : item.alignedWitnesses.length ? "aligned" : "source";
                  return <article className="account-timeline-event" key={item.ref}>
                    <div className="account-step-column"><span>STEP</span><strong>{String(index + 1).padStart(2, "0")}</strong></div>
                    <div className="account-spine-column" aria-hidden="true"><i className={`account-timeline-dot ${state}`} /></div>
                    <div className="account-card-column">
                      <section className="account-event-card">
                        <header><span>{item.temporalLabel}</span><small>Proposed position {item.proposedPosition}</small></header>
                        <h3>{item.statement}</h3>
                        <p>{item.nodeSummary}</p>
                        <blockquote>“{item.sourceWording}”</blockquote>
                        <details className="account-event-details">
                          <summary><span>More details</span><small>{item.alignedWitnesses.length + itemTensions.length > 0 ? `${item.alignedWitnesses.length} alignment${item.alignedWitnesses.length === 1 ? "" : "s"} · ${itemTensions.length} tension${itemTensions.length === 1 ? "" : "s"}` : "Account metadata"}</small></summary>
                          <div className="account-event-details-body">
                            <dl className="account-event-meta"><div><dt>Account context</dt><dd>{item.nodeTitle}</dd></div><div><dt>Temporal wording</dt><dd>{item.rawTemporalLanguage}</dd></div><div><dt>Classification</dt><dd>{readable(item.eventClass)}</dd></div><div><dt>Precision</dt><dd>{readable(item.precision)} · {readable(item.qualification)}</dd></div></dl>
                            {item.alignedWitnesses.length > 0 && <div className="account-callout aligned"><strong>Cross-account alignment</strong><p>This proposed event also contains testimony from {item.alignedWitnesses.join(", ")}.</p></div>}
                            {itemTensions.map((tension) => <div className="account-callout tension" key={tension.key}><strong>{tension.title}</strong><p>{tension.note}</p></div>)}
                          </div>
                        </details>
                        <footer><Link href={courtRecordHref(caseId, { segmentId: item.sourceSegmentIds[0] })}>Open exact source →</Link><span>{item.sourceSegmentIds.length} segment{item.sourceSegmentIds.length === 1 ? "" : "s"}</span></footer>
                      </section>
                    </div>
                  </article>;
                })}
              </div>
            </section>}

            {view !== "account" && <section className="accounts-view-lane digital-evidence-lane" aria-labelledby="digital-evidence-heading">
              <header className="accounts-timeline-head digital-timeline-head"><div><span>DIGITAL EVIDENCE</span><h2 id="digital-evidence-heading">Phone artifact timeline</h2></div><dl><div><dt>Artifacts</dt><dd>{digitalTimeline.items.length}</dd></div><div><dt>Missing</dt><dd>{digitalTimeline.missingKeys.length}</dd></div></dl></header>
              <div className="accounts-legend digital-legend" aria-label="Digital timeline legend"><span><i className="account-legend-dot account-dot-digital" />Testimony-established digital artifact</span><span>24-hour device time · “--” means seconds not stated</span></div>

              {digitalTimeline.items.length === 0 ? <div className="digital-evidence-empty"><strong>No source-complete digital artifacts are available.</strong><p>The timeline will not display an artifact until every reviewed testimony segment in its source bundle is present.</p></div> : <div className="account-timeline digital-evidence-timeline">
                {digitalTimeline.items.map((item, index) => <article className="account-timeline-event digital-timeline-event" key={item.key}>
                  <div className="account-step-column"><span>ITEM</span><strong>D{String(index + 1).padStart(2, "0")}</strong></div>
                  <div className="account-spine-column" aria-hidden="true"><i className="account-timeline-dot digital" /></div>
                  <div className="account-card-column">
                    <section className="account-event-card digital-evidence-card">
                      <header><span>DIGITAL ARTIFACT · {item.artifactType}</span><time dateTime={item.occurredAt}>{item.displayTimestamp}</time></header>
                      <div className="digital-card-headline"><small>TESTIMONY-ESTABLISHED</small><h3>{item.headline}</h3></div>
                      <p>{item.summary}</p>
                      <div className="digital-recorded-value"><span>RECORDED VALUE</span><code>{item.recordedValue}</code></div>
                      <details className="account-event-details digital-event-details">
                        <summary><span>Artifact details</span><small>Timestamp · provenance · limits</small></summary>
                        <div className="account-event-details-body">
                          <dl className="account-event-meta"><div><dt>Artifact type</dt><dd>{item.artifactType}</dd></div><div><dt>Source system</dt><dd>{item.sourceSystem}</dd></div><div><dt>Device record</dt><dd>{item.device}</dd></div><div><dt>Time precision</dt><dd>{item.timestampPrecision}</dd></div></dl>
                          <div className="account-callout digital"><strong>Timestamp basis</strong><p>{item.timestampBasis}</p></div>
                          <div className="account-callout digital"><strong>Attribution boundary</strong><p>{item.attributionBoundary}</p></div>
                          <div className="account-callout tension"><strong>Interpretation boundary</strong><p>{item.interpretationBoundary}</p></div>
                        </div>
                      </details>
                      <footer><Link href={courtRecordHref(caseId, { segmentId: item.sourceSegmentIds[0] })}>Open testimony source →</Link><span>{item.sourceSegmentIds.length} segment{item.sourceSegmentIds.length === 1 ? "" : "s"}</span></footer>
                    </section>
                  </div>
                </article>)}
              </div>}
            </section>}
          </div>
        </div>

        <aside className="accounts-side-panel" aria-label="Account context">
          <section className="accounts-basis-card"><MonoLabel>TIMELINE BASIS</MonoLabel><h2>{view === "digital" ? <>Artifact first.<br />Interpretation second.</> : view === "compare" ? <>Two lanes.<br />No silent merge.</> : <>Account first.<br />Reconstruction second.</>}</h2><p>{view === "digital" ? "These cards represent device artifacts described by the examiner. Machine time, device association, physical-user attribution, and interpretation remain separate fields." : view === "compare" ? `The ${selected.witness} account and digital timeline share the screen, but no machine timestamp is assigned to a witness step unless the evidence supports that anchor.` : `This lane shows what ${selected.witness} supplied. Shared event placement is visible, but another witness’s testimony never becomes part of this account.`}</p><Link href={reconstructionHref(caseId, [version.id])}>Inspect full reconstruction →</Link></section>

          <section className="accounts-side-card"><header><span>Responder accounts</span><strong>{accounts.length}</strong></header><nav aria-label="Responder accounts">{accounts.map((account) => <Link href={accountsHref(caseId, { account: account.key, versionId: version.id, view: view === "digital" ? "compare" : view })} aria-current={account.key === selected.key ? "page" : undefined} key={account.key}><span>{account.witness}</span><small>{account.items.length} steps · {account.sourceSegmentCount} sources</small></Link>)}</nav></section>

          <section className="accounts-side-card"><header><span>Comparison lanes</span><strong>{alignedAccounts.length}</strong></header><div className="accounts-side-list">{alignedAccounts.length ? alignedAccounts.map((account) => <Link href={accountsHref(caseId, { account: account.key, versionId: version.id, view: "compare" })} key={account.key}><span>{account.witness}</span><small>Open with digital evidence</small></Link>) : <p>No other witness is grouped with the selected account’s current steps.</p>}</div></section>

          <section className="accounts-side-card"><header><span>Digital artifacts</span><strong>{digitalTimeline.items.length}</strong></header><div className="accounts-side-list"><Link href={accountsHref(caseId, { account: selected.key, versionId: version.id, view: "digital" })}><span>Phone artifact timeline</span><small>Machine time · testimony-sourced</small></Link><Link href={accountsHref(caseId, { account: selected.key, versionId: version.id, view: "compare" })}><span>Compare with {selected.witness}</span><small>Parallel lanes · no automatic alignment</small></Link></div></section>

          <section className="accounts-side-card"><header><span>{view === "digital" ? "Witness tensions" : "Open tensions"}</span><strong>{selectedTensions.length}</strong></header><div className="accounts-tension-list">{selectedTensions.length ? selectedTensions.map((tension) => <article key={tension.key}><span>{readable(tension.field)}</span><strong>{tension.title}</strong><p>{tension.note}</p></article>) : <p>No explicit tension is attached to this account in the selected version.</p>}</div></section>

          <section className="accounts-side-card"><header><span>Versions</span><strong>{workspace.versions.length}</strong></header><nav aria-label="Account source versions">{workspace.versions.slice(0, 8).map((item) => <Link href={accountsHref(caseId, { account: selected.key, versionId: item.id, view })} aria-current={item.id === version.id ? "page" : undefined} key={item.id}><span>{item.name} · v{item.version}</span><small>{new Date(item.createdAt).toLocaleDateString()}</small></Link>)}</nav></section>
        </aside>
      </div>}
  </main>;
}
