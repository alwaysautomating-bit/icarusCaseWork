import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import "@/app/temporal-context.css";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { temporalContextTimelineHref, timelineHref, type TemporalContextView } from "@/lib/case-routes";
import { assertedOrder, getTemporalContext, type TemporalContextArtifact } from "@/lib/temporal-context-view";

export const dynamic = "force-dynamic";

type SearchState = { view?: string; witness?: string };
type Candidate = TemporalContextArtifact["candidates"][number];

const VIEWS: Array<{ key: TemporalContextView; label: string; hint: string }> = [
  { key: "witness", label: "By witness", hint: "The sequence each witness describes" },
  { key: "anchor", label: "By anchor", hint: "What comes before, at, and after a shared moment" },
  { key: "event", label: "By event", hint: "Accounts that may describe the same happening" },
  { key: "conflicts", label: "Conflicts", hint: "Incompatible statements, kept side by side" },
  { key: "unknown", label: "No clock time", hint: "Sequence position without a stated time" },
];

const FORM_LABEL: Record<string, string> = {
  EXACT_DATETIME: "Exact date + time", EXACT_DATE: "Exact date", EXACT_TIME: "Exact time", APPROXIMATE_TIME: "Approximate time",
  INTERVAL: "Interval", DURATION: "Duration", RELATIVE: "Relative", SEQUENCE_ONLY: "Sequence only", LOWER_BOUND: "Lower bound",
  UPPER_BOUND: "Upper bound", UNKNOWN: "Time unknown",
};
const RELATION_LABEL: Record<string, string> = {
  BEFORE: "before", BEFORE_OR_AT: "before or at", AT: "at the same time as", AFTER_OR_AT: "after or at", AFTER: "after", OVERLAPS: "overlaps", DURING: "during",
};
const KIND_LABEL: Record<string, string> = { event: "Event", state_observation: "Observed state", knowledge_state: "Knowledge change" };

function Source({ data, ids }: { data: TemporalContextArtifact; ids: string[] }) {
  return <>{ids.map((id) => {
    const source = data.sources[id];
    if (!source) return null;
    return <blockquote className="tc-source" key={id}>
      <p>{source.text}</p>
      <footer>{source.speaker} · Day 3 · <a href={source.deepLink} target="_blank" rel="noreferrer">{source.timestamp}</a> <small>testimony timestamp, not event time</small></footer>
    </blockquote>;
  })}</>;
}

function CandidateCard({ data, candidate, showConstraints = true }: { data: TemporalContextArtifact; candidate: Candidate; showConstraints?: boolean }) {
  const assertions = data.assertions.filter((item) => item.eventCandidateId === candidate.id);
  const constraints = data.constraints.filter((item) => item.from.id === candidate.id || item.to.id === candidate.id);
  return <article className={`tc-card kind-${candidate.kind}`}>
    <header>
      <span className="tc-kind">{KIND_LABEL[candidate.kind]}</span>
      <code>{candidate.code}</code>
      {candidate.anchorFamily ? <span className="tc-anchor-tag">{data.anchors.find((anchor) => anchor.family === candidate.anchorFamily)?.label ?? candidate.anchorFamily}</span> : null}
    </header>
    <h3>{candidate.description}</h3>
    {candidate.knowledge ? <p className="tc-knowledge">{candidate.knowledge.holder} came to hold: “{candidate.knowledge.proposition}” — this records what was known, not whether it is true.</p> : null}
    <ul className="tc-times">{assertions.map((assertion) => <li key={assertion.code}>
      <span className={`tc-form form-${assertion.form.toLowerCase()}`}>{FORM_LABEL[assertion.form]}</span>
      <q>{assertion.wording}</q>
      {assertion.qualification !== "asserted" ? <em>{assertion.qualifierText ?? assertion.qualification.replaceAll("_", " ")}</em> : null}
      {assertion.adoptedFromQuestion ? <em title="The time was stated in the question and affirmed by the witness.">counsel’s premise, affirmed</em> : null}
    </li>)}</ul>
    <Source data={data} ids={candidate.sourceSegmentIds} />
    {showConstraints && constraints.length ? <details className="tc-constraints"><summary>{constraints.length} sequence constraint{constraints.length === 1 ? "" : "s"}</summary><ul>
      {constraints.map((constraint) => <li key={constraint.code}>
        <span>{constraint.from.type === "anchor_candidate" ? `Implied “${constraint.from.label}”` : constraint.from.label}</span>
        <b>{RELATION_LABEL[constraint.relation]}</b>
        <span>{constraint.to.label}</span>
        <small>from the witness’s words “{constraint.cue}” · {constraint.derivation.replaceAll("_", " ")} · pending review</small>
      </li>)}
    </ul></details> : null}
  </article>;
}

export default async function TemporalContextPage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<SearchState> }) {
  const [actor, { caseId }, query, data] = await Promise.all([requireCaseActor(), params, searchParams, getTemporalContext()]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  const view = VIEWS.find((item) => item.key === query.view)?.key ?? "witness";
  const account = data.accounts.find((item) => item.accountKey === query.witness) ?? data.accounts[0]!;
  const ordinalOf = (candidate: Candidate) => Math.min(...candidate.sourceSegmentIds.map((id) => data.sources[id]?.ordinal ?? Number.MAX_SAFE_INTEGER));
  const r = data.report;
  const byCode = new Map(data.candidates.map((candidate) => [candidate.code, candidate.description]));
  const describe = (code: string) => byCode.get(code) ?? code;

  return <main className="responder-shell tc-shell">
    <header className="responder-head">
      <div className="responder-crumbs"><Link href={timelineHref(caseId)}>← All timelines</Link><MonoLabel>TESTIMONY → TEMPORAL CONTEXT · V{data.compilerVersion}</MonoLabel></div>
      <h1>{data.title}</h1>
      <p>Each witness’s account is kept whole and in their own order. Sequence appears only where a witness’s wording supports it; clock times appear only where they were said. Where accounts may meet — a scream, an arrival, an ambulance — the compiler proposes an anchor for you to review, and never merges the accounts.</p>
      <dl>
        <div><dt>Event candidates</dt><dd>{r.eventCandidatesCreated}</dd></div>
        <div><dt>Shared anchors</dt><dd>{r.possibleSharedAnchors}</dd></div>
        <div><dt>Conflicts</dt><dd>{r.temporalConflicts}</dd></div>
        <div><dt>Canonical events</dt><dd>{r.canonicalEventsCreated}</dd></div>
      </dl>
    </header>

    <details className="responder-method"><summary>Boundary and how to read this</summary><ul>
      <li>{data.boundary}</li>
      <li>The order shown for a witness is a navigation order built from that witness’s own sequence wording. Events without a sequence cue are listed apart, unplaced.</li>
      <li>“Possible same event” and “shared anchor” are proposals awaiting review. Both original accounts stay intact either way.</li>
      <li>Read-only: this page shows compiler output and does not record review decisions.</li>
    </ul></details>

    <nav className="tc-tabs" aria-label="Temporal context views">{VIEWS.map((item) => <Link key={item.key} href={temporalContextTimelineHref(caseId, { view: item.key, witness: item.key === "witness" ? account.accountKey : undefined })} aria-current={item.key === view ? "page" : undefined}><strong>{item.label}</strong><small>{item.hint}</small></Link>)}</nav>

    {view === "witness" ? (() => {
      const mine = data.candidates.filter((candidate) => candidate.accountKey === account.accountKey);
      const { ordered, unplaced } = assertedOrder(mine, data.constraints.filter((constraint) => constraint.accountKey === account.accountKey), ordinalOf);
      return <section className="tc-section">
        <div className="tc-witness-tabs">{data.accounts.map((item) => <Link key={item.accountKey} href={temporalContextTimelineHref(caseId, { view: "witness", witness: item.accountKey })} aria-current={item.accountKey === account.accountKey ? "page" : undefined}>{item.witness}</Link>)}</div>
        <h2>The sequence {account.witness} describes</h2>
        <p className="tc-note">{ordered.length} placed, {unplaced.length} with no sequence cue. Placement is derived only from this witness’s wording.</p>
        <ol className="tc-list">{ordered.map((candidate) => <li key={candidate.id}><CandidateCard data={data} candidate={candidate} /></li>)}</ol>
        {unplaced.length ? <><h2>No sequence position</h2><p className="tc-note">The witness gave these without wording that orders them against the others.</p><ul className="tc-list">{unplaced.map((candidate) => <li key={candidate.id}><CandidateCard data={data} candidate={candidate} /></li>)}</ul></> : null}
      </section>;
    })() : null}

    {view === "anchor" ? <section className="tc-section">
      <h2>Candidate anchors</h2>
      <p className="tc-note">An anchor needs no clock time. It is a shared moment that lets separate accounts be lined up, if you agree the descriptions refer to it.</p>
      {[...data.anchors].sort((a, b) => Number(b.sharedAcrossAccounts) - Number(a.sharedAcrossAccounts) || a.label.localeCompare(b.label)).map((anchor) => <article className="tc-anchor" key={anchor.id}>
        <header><span className="tc-kind">{anchor.anchorClass.replaceAll("_", " ")}</span><code>{anchor.code}</code><span className={anchor.sharedAcrossAccounts ? "tc-shared" : "tc-single"}>{anchor.sharedAcrossAccounts ? `Shared by ${anchor.accounts.length} accounts` : "One account"}</span></header>
        <h3>{anchor.label}</h3>
        <div className="tc-slots">{data.accounts.map((item) => {
          const slots = data.slots.filter((slot) => slot.anchorCode === anchor.code && slot.accountKey === item.accountKey);
          const members = anchor.members.filter((member) => member.accountKey === item.accountKey);
          return <div key={item.accountKey}>
            <strong>{item.witness}</strong>
            {members.length ? members.map((member) => <p key={member.eventCandidateCode}><code>{member.eventCandidateCode}</code> {member.description} <small>({member.role.replaceAll("_", " ")})</small></p>) : <p className="tc-none">No account of this.</p>}
            {slots.map((slot) => <dl key={slot.memberCode}>
              {([["Before", slot.before], ["At", slot.at], ["After", slot.after]] as const).map(([label, codes]) => <div key={label}><dt>{label}</dt><dd>{codes.length ? <ul>{codes.map((code) => <li key={code}>{describe(code)} <code>{code}</code></li>)}</ul> : "—"}</dd></div>)}
              {slot.unplaced.length ? <div><dt>Not ordered against it</dt><dd>{slot.unplaced.length} other event(s) from this witness have no stated sequence relation to it.</dd></div> : null}
            </dl>)}
          </div>;
        })}</div>
      </article>)}
    </section> : null}

    {view === "event" ? <section className="tc-section">
      <h2>Accounts that may describe the same happening</h2>
      <p className="tc-note">Each row below keeps every witness’s own event candidate. The link between them is a proposal for review.</p>
      {data.anchors.filter((anchor) => anchor.sharedAcrossAccounts).map((anchor) => {
        const members = anchor.members.map((member) => data.candidates.find((candidate) => candidate.id === member.eventCandidateId)!);
        const same = data.links.filter((link) => link.linkType === "possible_same_event" && members.some((member) => member.id === link.from.id));
        return <article className="tc-group" key={anchor.id}>
          <header><h3>{anchor.label}</h3><code>{anchor.code}</code></header>
          {same.length ? <p className="tc-proposal">Proposed: {same.length} possible same-event link{same.length === 1 ? "" : "s"} — pending review.</p> : <p className="tc-proposal">Proposed: shared anchor only — the accounts describe different parts of it.</p>}
          <div className="tc-columns">{members.map((candidate) => <div key={candidate.id}><MonoLabel>{candidate.witness.toUpperCase()}</MonoLabel><CandidateCard data={data} candidate={candidate} showConstraints={false} /></div>)}</div>
        </article>;
      })}
    </section> : null}

    {view === "conflicts" ? <section className="tc-section">
      <h2>Conflicting statements</h2>
      <p className="tc-note">Nothing here is averaged, ranked, or resolved. The disagreement is itself part of the temporal context.</p>
      {data.conflicts.map((conflict) => <article className="tc-conflict" key={conflict.id}>
        <header><span className="tc-kind">{conflict.kind.replaceAll("_", " ")}</span><code>{conflict.code}</code></header>
        <h3>{conflict.summary}</h3>
        <div className="tc-columns">{conflict.parties.map((party) => <div key={party.ref}><MonoLabel>{party.witness.toUpperCase()}</MonoLabel><blockquote className="tc-source"><p>{party.wording}</p></blockquote><Source data={data} ids={party.sourceSegmentIds} /></div>)}</div>
      </article>)}
      {data.conflicts.length === 0 ? <p className="tc-note">No conflicts were detected.</p> : null}
    </section> : null}

    {view === "unknown" ? (() => {
      const withClock = new Set(data.assertions.filter((assertion) => assertion.hasClockValue).map((assertion) => assertion.eventCandidateId));
      const positioned = new Set(data.constraints.flatMap((constraint) => [constraint.from.id, constraint.to.id]));
      const rows = data.candidates.filter((candidate) => positioned.has(candidate.id) && !withClock.has(candidate.id));
      return <section className="tc-section">
        <h2>Sequence position, no clock time</h2>
        <p className="tc-note">{rows.length} of {data.candidates.length} candidates sit in a witness’s sequence without any stated clock time. They stay that way unless another source supplies one.</p>
        {data.accounts.map((item) => <div key={item.accountKey}><h3>{item.witness}</h3><ul className="tc-list">{rows.filter((candidate) => candidate.accountKey === item.accountKey).sort((a, b) => ordinalOf(a) - ordinalOf(b)).map((candidate) => <li key={candidate.id}><CandidateCard data={data} candidate={candidate} showConstraints={false} /></li>)}</ul></div>)}
      </section>;
    })() : null}

    <footer className="tc-foot">Source: {data.source.title} · {data.source.segments.toLocaleString()} committed segments · generated {data.generatedAt.slice(0, 10)}</footer>
  </main>;
}
