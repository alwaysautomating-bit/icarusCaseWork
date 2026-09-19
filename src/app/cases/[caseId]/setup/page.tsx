import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { courtRecordHref, timelineHref, trialIndexHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

type Position = { point: string; cite: string };

const commonwealthPosition: Position[] = [
  { point: "Lindsay strangled each child with exercise bands in the basement while Patrick was out on a takeout and CVS errand — Dawson first, then Cora, then Callan.", cite: "41:47 · 48:02" },
  { point: "The killings were timed: she knew the errand’s route and length, and she overcame an interruption when Patrick called from CVS (a 14-second call).", cite: "47:21 · 58:15" },
  { point: "She was not psychotic that day. She acted “intentionally, rationally, and swiftly,” and interacted normally at the doctor’s office, on the phone, and with the children.", cite: "53:42 · 54:18" },
  { point: "Her history shows control, not collapse: scheduled days, withheld information from her husband and doctors, symptoms reported that did not match her daily activities.", cite: "54:56 · 56:21" },
  { point: "She manipulated her treatment — changed providers, changed medications after days, disengaged after four months when the plan did not suit her.", cite: "57:37 · 58:15" },
  { point: "Her account of a commanding male voice should be weighed for its source, timing and substance; the versions differ on when it spoke.", cite: "52:16 · 53:06" },
  { point: "Mental illness is not disputed, but it is not the end of the inquiry: she knew what she was doing and could control her conduct, so she is criminally responsible.", cite: "57:06 · 58:55 · 59:26" },
];

const defensePosition: Position[] = [
  { point: "Lindsay was psychotic when she went to the basement. She had no motive and loved her children.", cite: "1:32:25" },
  { point: "The illness was real and documented: months of insomnia, an adverse reaction to Zoloft, a possible bipolar disorder treated as depression, and a rapid run of medication changes across many providers.", cite: "1:09:36 · 1:19:00 · 1:23:39" },
  { point: "She sought help repeatedly rather than shopping for drugs — referred by her mother-in-law, a crisis-hotline call, the Aspire crisis team, Mass General, a Rhode Island program, and a McLean admission.", cite: "1:22:31 · 1:25:51 · 1:29:25" },
  { point: "Appearing functional was not evidence of health: friends, teachers and neighbors saw a mother who “put on a pretty good face.”", cite: "1:19:55 · 1:22:31" },
  { point: "The suicide attempt was genuine, not staged: the neck and wrist injuries, and a Jefferson fracture and shattered spine from the fall, left her paralyzed.", cite: "1:10:00 · 1:14:13" },
  { point: "The command-voice account did not originate with defense counsel or Dr. Zeisel; she reported it to a hospital chaplain when she woke, before she met either of them.", cite: "1:15:48 · 1:17:51" },
  { point: "The case is, in the defense’s words, a referendum on postpartum illness and how the medical system treated it.", cite: "1:03:04" },
];

const divergences: { question: string; commonwealth: string; defense: string }[] = [
  { question: "Her mental state on January 24", commonwealth: "Organized, deliberate and rational; not psychotic.", defense: "Psychotic, acting on command hallucinations and thoughts of harming the children." },
  { question: "Why she sought treatment", commonwealth: "To get quick fixes; she manipulated providers and disengaged.", defense: "Because she knew she was in trouble; she asked for the medication to stop and was told to stay the course." },
  { question: "The suicide attempt", commonwealth: "An attempt that failed, made after the killings to escape the consequences.", defense: "A sincere attempt; the defense expects the prosecution to call it faked or minor." },
  { question: "The voice", commonwealth: "Inconsistent in timing across her accounts; consider the source.", defense: "Reported first to a chaplain, unprompted; consistent with psychosis." },
  { question: "Motive", commonwealth: "Control and escape from a life she no longer liked.", defense: "None; she loved the children." },
];

const commonGround = [
  "Cora, Dawson and Callan Clancy died as a result of January 24, 2023 events at 47 Summer Street, Duxbury; Callan died January 27 at Boston Children’s Hospital.",
  "Lindsay had significant mental-health problems before January 24 — the Commonwealth says there is “no dispute” about that (57:06).",
  "Lindsay went out of the second-floor bedroom window and was found in the backyard; she is paralyzed.",
  "Patrick called 911 at about 6:11 p.m. and first responders reached the property within minutes.",
];

const researchThreads = [
  { title: "Patrick Clancy’s versions of the discovery", body: "The Commonwealth’s opening puts him in the basement, on the phone with 911, finding each child with a band still on. Compare that with each of his later accounts, and with where first responders say they saw him." },
  { title: "Patrick’s unaccounted-for intervals", body: "Track what each source says he was doing between the return home (about 6:00 p.m.) and the arrival of first responders, and between the 911 call and the children being reached." },
  { title: "The CPR claim", body: "Researcher note, to verify against testimony: Patrick has said he performed CPR, and no responder testimony reviewed so far attests to it. The first-responder timeline is where this gets tested." },
];

function PositionList({ items }: { items: Position[] }) {
  return <ol className="foundation-position-list">{items.map((item) => <li key={item.cite}><p>{item.point}</p><small>Opening · {item.cite}</small></li>)}</ol>;
}

function caseCaption(title: string) {
  return title.split(" — ")[0] || title;
}

export default async function FoundationPage({ params }: { params: Promise<{ caseId: string }> }) {
  const [actor, { caseId }] = await Promise.all([requireCaseActor(), params]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  return <main className="case-foundation-shell">
    <header className="case-foundation-hero">
      <MonoLabel>FOUNDATION · CASE ORIENTATION</MonoLabel>
      <h1>{caseCaption(currentCase.title)}</h1>
      <p>On January 24, 2023, in Duxbury, Massachusetts, Cora (5), Dawson (3) and Callan (8 months) Clancy were strangled with exercise bands. Their mother, Lindsay Clancy, is charged with three counts of murder. Neither opening argues that someone else was responsible; the dispute is whether she was criminally responsible given severe postpartum mental illness.</p>
    </header>

    <section className="foundation-boundary" aria-label="Evidence boundary">
      <MonoLabel>ATTRIBUTION BOUNDARY</MonoLabel>
      <p>Everything below summarizes what each side <em>said it would show</em> in opening statements. The court instructed the jury that openings are “roadmaps,” not evidence. Testimony and exhibits are indexed separately in the Trial Index.</p>
    </section>

    <section className="foundation-charges" aria-labelledby="foundation-charges-title">
      <h2 id="foundation-charges-title">The charges and the question</h2>
      <dl>
        <div><dt>Court</dt><dd>Plymouth Superior Court · Hon. William Sullivan</dd></div>
        <div><dt>Docket</dt><dd>2383CR00198 · offenses 001–003</dd></div>
        <div><dt>Charge</dt><dd>Murder ×3 (Cora, Dawson, Callan)</dd></div>
        <div><dt>Commonwealth’s theories</dt><dd>Deliberate premeditation and/or extreme atrocity or cruelty</dd></div>
        <div><dt>Prosecution</dt><dd>ADA Jennifer Sprague · ADA Shannon Buckingham</dd></div>
        <div><dt>Defense</dt><dd>Kevin Reddington</dd></div>
      </dl>
      <div className="foundation-question"><MonoLabel>THE CENTRAL QUESTION</MonoLabel><p>The Commonwealth must prove Lindsay was criminally responsible. A person is not criminally responsible if, because of a mental disease or defect, she lacked substantial capacity to appreciate the criminality or wrongfulness of her conduct, or to conform her conduct to the law. The defendant carries no burden to prove this.</p></div>
    </section>

    <section className="foundation-positions" aria-label="What each side argues">
      <article className="commonwealth">
        <header><MonoLabel>THE COMMONWEALTH ARGUES</MonoLabel><h2>Deliberate, controlled, responsible</h2></header>
        <PositionList items={commonwealthPosition} />
      </article>
      <article className="defense">
        <header><MonoLabel>THE DEFENSE ARGUES</MonoLabel><h2>Psychotic, undertreated, not responsible</h2></header>
        <PositionList items={defensePosition} />
      </article>
    </section>

    <section className="foundation-divergence" aria-labelledby="foundation-divergence-title">
      <header><MonoLabel>WHERE THE OPENINGS DIVERGE</MonoLabel><h2 id="foundation-divergence-title">The same facts, two readings</h2></header>
      <div className="foundation-divergence-table" role="table" aria-label="Where the Commonwealth and defense openings diverge">
        <div role="row" className="head"><span role="columnheader">Question</span><span role="columnheader">Commonwealth</span><span role="columnheader">Defense</span></div>
        {divergences.map((row) => <div role="row" key={row.question}><strong role="cell">{row.question}</strong><p role="cell" data-label="Commonwealth">{row.commonwealth}</p><p role="cell" data-label="Defense">{row.defense}</p></div>)}
      </div>
    </section>

    <section className="foundation-ground" aria-labelledby="foundation-ground-title">
      <header><MonoLabel>NOT IN DISPUTE</MonoLabel><h2 id="foundation-ground-title">Where the openings agree</h2></header>
      <ul>{commonGround.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>

    <section className="foundation-threads" aria-labelledby="foundation-threads-title">
      <header><MonoLabel>RESEARCH THREADS</MonoLabel><h2 id="foundation-threads-title">Open lines to test against the record</h2></header>
      <div>{researchThreads.map((thread) => <article key={thread.title}><h3>{thread.title}</h3><p>{thread.body}</p></article>)}</div>
    </section>

    <nav className="foundation-next" aria-label="Continue">
      <Link href={trialIndexHref(currentCase.id)}><strong>Trial Index</strong><span>Every day, witness and topic →</span></Link>
      <Link href={courtRecordHref(currentCase.id)}><strong>Court Record</strong><span>Search the testimony →</span></Link>
      <Link href={timelineHref(currentCase.id)}><strong>Timelines</strong><span>Sequence the events →</span></Link>
    </nav>
  </main>;
}
