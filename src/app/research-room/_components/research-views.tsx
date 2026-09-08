"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { contributions, researchers, researchSkills, rooms, timeline, type ContributionKind } from "../_data";
import { Avatar, Icon, ResearchShell, Stat, Status, TopBar, Wordmark } from "./research-ui";

function researcher(id: string) {
  return researchers.find((person) => person.id === id) ?? researchers[0];
}

export function ResearchHome() {
  const metrics = [
    { value: 24, label: "Open questions" },
    { value: 11, label: "Need verification" },
    { value: 8, label: "Active timelines" },
    { value: 37, label: "Recent research" },
  ];
  const links = [
    { href: "/research-room/activity", icon: "activity" as const, label: "Research Activity", description: "Contributions from the room" },
    { href: "/research-room/active", icon: "active" as const, label: "Active Research", description: "Questions moving right now" },
    { href: "/research-room/rooms", icon: "rooms" as const, label: "Case Rooms", description: "Case-scoped collaboration" },
    { href: "/research-room/profile", icon: "profile" as const, label: "Researcher Profile", description: "Your work and skills" },
  ];
  return <ResearchShell>
    <TopBar overline="COMMONWEALTH v. CLANCY // PRIVATE" title="Research Home" action={<Link className="rr-icon-button" href="/casework" aria-label="Open governed casework"><Icon name="source"/></Link>}/>
    <main className="rr-page rr-home">
      <span className="rr-overline accent">CASE RESEARCH ROOM // PLYMOUTH</span>
      <h2>Welcome back,<br/>Mara.</h2>
      <p className="rr-lede">The record is open. Follow the question, link the source, and show your work.</p>

      <Link href="/research-room/active" className="rr-live-card">
        <Status live>Research active</Status>
        <h3>January 24 timeline</h3>
        <p>8 researchers examining · 17 open questions</p>
        <span className="rr-link-label">Follow the active record <Icon name="arrow" size={16}/></span>
      </Link>

      <section className="rr-metric-grid" aria-label="Research summary">
        {metrics.map((metric) => <Stat key={metric.label} {...metric}/>) }
      </section>

      <section className="rr-hub-grid" aria-label="Research Room sections">
        {links.map((item) => <Link href={item.href} key={item.href}><Icon name={item.icon}/><strong>{item.label}</strong><span>{item.description}</span></Link>)}
      </section>
    </main>
  </ResearchShell>;
}

const contributionKinds: ContributionKind[] = [
  "I FOUND A SOURCE",
  "I FOUND SUPPORTING INFORMATION",
  "I FOUND CONFLICTING INFORMATION",
  "I NOTICED SOMETHING",
  "I HAVE RELEVANT EXPERTISE / CONTEXT",
  "I HAVE ANOTHER QUESTION",
];

export function ResearchActivity() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [kind, setKind] = useState<ContributionKind>(contributionKinds[0]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Array<{ body: string; kind: ContributionKind; source: string }>>([]);

  return <ResearchShell surface="paper">
    <TopBar light overline="CASE-SCOPED COLLABORATION" title="Research Activity"/>
    <main className="rr-page rr-feed">
      <section className="rr-composer">
        {!composerOpen ? <button className="rr-button accent full" onClick={() => setComposerOpen(true)}><Icon name="source" size={17}/>Add a research contribution</button> :
          <form onSubmit={(event) => { event.preventDefault(); if (!body.trim()) return; setSubmitted([{ body, kind, source: sourceReference }, ...submitted]); setBody(""); setSourceReference(""); setComposerOpen(false); }}>
            <header><div><span className="rr-overline accent">NEW CONTRIBUTION</span><h2>Show your work.</h2></div><button type="button" className="rr-icon-button light" onClick={() => setComposerOpen(false)} aria-label="Close contribution form"><Icon name="close"/></button></header>
            <label>Contribution type<select value={kind} onChange={(event) => setKind(event.target.value as ContributionKind)}>{contributionKinds.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label>What did you find?<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="State what you found, what source supports it, and what remains uncertain." rows={4}/></label>
            <label>Source reference<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="Testimony · Day 3 · 00:48:17"/></label>
            <p className="rr-form-note">Contributions are submissions for examination. Adding a source does not make a proposition verified.</p>
            <button className="rr-button accent" type="submit">Publish contribution <Icon name="arrow" size={16}/></button>
          </form>}
      </section>

      {submitted.map((item, index) => <article className="rr-contribution" key={`${item.body}-${index}`}>
        <header><Avatar name="Mara Reyes" color="#ac001e"/><div><strong>Mara Reyes</strong><span>@marareyes · NOW</span></div><Status>Needs verification</Status></header>
        <div className="rr-contribution-body"><span className="rr-overline accent">{item.kind}</span><p>{item.body}</p><div className="rr-source-line"><Icon name="source" size={17}/><span>{item.source || "Source reference pending"}</span></div></div>
      </article>)}

      {contributions.map((item) => {
        const author = researcher(item.authorId);
        const flagged = !!flags[item.id];
        const isSaved = !!saved[item.id];
        const flagCount = item.flags + (flagged ? 1 : 0);
        return <article className="rr-contribution" key={item.id}>
          <header>
            <Avatar name={author.name} color={author.color}/><div><strong>{author.name}</strong><span>{author.handle} · {item.time}</span></div><Status>{item.status}</Status>
          </header>
          <div className="rr-contribution-body">
            <span className="rr-overline accent">{item.kind}</span>
            <p>{item.body}</p>
            <span className="rr-context">{item.context}</span>
            <div className="rr-source-list">{item.sources.map((source) => <div key={source}><Icon name="source" size={17}/><span>{source}</span></div>)}</div>
            {flagCount >= 3 ? <div className="rr-promoted"><strong>Community promoted</strong><span>Multiple researchers think the case owner should examine this. It is not verified or accepted.</span></div> : null}
          </div>
          <footer>
            <button className={flagged ? "active" : ""} onClick={() => setFlags({ ...flags, [item.id]: !flagged })} aria-pressed={flagged}><Icon name="flag" size={18}/><span>Flag for review</span><b>{flagCount}</b></button>
            <button><Icon name="comment" size={18}/><span>Discussion</span><b>{item.discussions}</b></button>
            <button className={isSaved ? "active" : ""} onClick={() => setSaved({ ...saved, [item.id]: !isSaved })} aria-pressed={isSaved} aria-label={isSaved ? "Remove from saved research" : "Save research"}><Icon name="bookmark" size={18}/><b>{item.saved + (isSaved ? 1 : 0)}</b></button>
          </footer>
        </article>;
      })}
    </main>
  </ResearchShell>;
}

export function ActiveResearch() {
  const [selected, setSelected] = useState(1);
  return <ResearchShell>
    <TopBar overline="JANUARY 24 TIMELINE" title="Active Research"/>
    <main className="rr-page rr-active">
      <section className="rr-active-hero">
        <Status live>Research active</Status>
        <span className="rr-overline">COMMONWEALTH v. CLANCY</span>
        <h2>January 24<br/>timeline</h2>
        <p>8 researchers examining · 17 open questions</p>
        <div className="rr-avatar-stack" aria-label="Active researchers">{researchers.map((person) => <Avatar key={person.id} name={person.name} color={person.color} size={34}/>)}</div>
      </section>
      <section className="rr-timeline" aria-labelledby="timeline-heading">
        <header><div><span className="rr-overline accent">EVENT SEQUENCE</span><h3 id="timeline-heading">What the record currently shows</h3></div><span className="rr-meta">PROVISIONAL</span></header>
        {timeline.map((event, index) => <button key={event.time} className={selected === index ? "selected" : ""} onClick={() => setSelected(index)}>
          <time>{event.time}</time><div><strong>{event.title}</strong><p>{event.detail}</p><span>{event.state}</span></div>
        </button>)}
      </section>
      <section className="rr-live-discussion">
        <span className="rr-overline">RESEARCH DISCUSSION // 12</span>
        <article><Avatar name="Jonah Bell" color="#191c1e" size={36}/><p><strong>Jonah Bell</strong>The dispatch record may use call-received time while the testimony describes time from leaving the station. We should not treat those as the same interval yet.</p></article>
        <form onSubmit={(event) => event.preventDefault()}><label htmlFor="active-note">Add context or ask for verification</label><div><input id="active-note" placeholder="Write to this event…"/><button aria-label="Send discussion note"><Icon name="arrow"/></button></div></form>
      </section>
    </main>
  </ResearchShell>;
}

export function CaseRooms() {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => rooms.filter((room) => room.name.toLowerCase().includes(filter.toLowerCase())), [filter]);
  return <ResearchShell surface="paper">
    <TopBar light overline="INVITE-ONLY // CASE-SCOPED" title="Case Research Rooms"/>
    <main className="rr-page rr-rooms">
      <section className="rr-page-intro"><span className="rr-overline accent">YOUR RESEARCH ROOMS</span><h2>Follow the case.<br/>Find the question.</h2><p>Each room keeps research activity, sources, questions, and discussion inside a defined case scope.</p></section>
      <label className="rr-search"><Icon name="search"/><span className="sr-only">Filter case research rooms</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter case rooms"/></label>
      <div className="rr-room-list">
        {filtered.map((room) => <Link href={room.id === "clancy" ? "/research-room/rooms/clancy" : "/research-room/rooms"} key={room.id}>
          <span className="rr-overline">{room.label}</span><h3>{room.name}</h3><p>{room.description}</p>
          <div className="rr-room-stats"><span><b>{room.questions}</b> Open questions</span><span><b>{room.verification}</b> Need verification</span><span><b>{room.researchers}</b> Researchers</span></div>
        </Link>)}
      </div>
    </main>
  </ResearchShell>;
}

export function CaseRoomDetail() {
  const [tab, setTab] = useState("Activity");
  const room = rooms[0];
  return <ResearchShell surface="paper">
    <TopBar light back="/research-room/rooms" overline="CASE RESEARCH ROOM" title="Commonwealth v. Clancy"/>
    <main className="rr-page rr-room-detail">
      <section className="rr-room-hero"><span className="rr-overline accent">{room.label}</span><h2>{room.name}</h2><p>{room.description}</p><div className="rr-avatar-stack">{researchers.map((person) => <Avatar key={person.id} name={person.name} color={person.color} size={36}/>)}</div></section>
      <section className="rr-metric-grid light"><Stat value={room.questions} label="Open questions"/><Stat value={room.verification} label="Need verification"/><Stat value={room.timelines} label="Active timelines"/><Stat value={room.researchers} label="Researchers"/></section>
      <nav className="rr-tabs" aria-label="Case room sections">{["Activity", "Questions", "Timelines", "Sources"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <section className="rr-tab-content">
        {tab === "Activity" ? contributions.slice(0, 3).map((item) => <Link href="/research-room/activity" key={item.id}><span className="rr-overline accent">{item.status}</span><strong>{item.body}</strong><small>{item.sources[0]} · {item.discussions} discussions</small></Link>) : null}
        {tab === "Questions" ? ["What does the testimony establish about the return-home timeline?", "Which sources independently establish the CVS timing?", "Do the witness accounts conflict on responder arrival?"].map((question) => <article key={question}><Icon name="question"/><div><strong>{question}</strong><small>OPEN · NEEDS SOURCE REVIEW</small></div></article>) : null}
        {tab === "Timelines" ? <Link href="/research-room/events/january-24"><span className="rr-overline accent">RESEARCH ACTIVE</span><strong>January 24, 2023</strong><small>17 open questions · 8 researchers examining</small></Link> : null}
        {tab === "Sources" ? ["Testimony · Days 1–20", "Dispatch record", "Search warrant packet", "Medical record"].map((source) => <article key={source}><Icon name="source"/><div><strong>{source}</strong><small>SOURCE MATERIAL · CASE-SCOPED</small></div></article>) : null}
      </section>
    </main>
  </ResearchShell>;
}

export function TimelineDetail() {
  return <ResearchShell>
    <TopBar back="/research-room/rooms/clancy" overline="EVENT / TIMELINE" title="January 24, 2023"/>
    <main className="rr-page rr-event-detail">
      <section className="rr-event-title"><Status live>Research active</Status><h2>January 24,<br/>2023</h2><p>A provisional event sequence assembled from linked sources. Time assertions remain open to source comparison.</p></section>
      <section className="rr-metric-grid"><Stat value="17" label="Open questions"/><Stat value="9" label="Linked sources"/><Stat value="8" label="Researchers"/><Stat value="4" label="Need review"/></section>
      <section className="rr-timeline compact">{timeline.map((event, index) => <Link href="/research-room/active" key={event.time}><time>{event.time}</time><div><span className="rr-meta">{`${String(index + 1).padStart(2, "0")} // ${event.state}`}</span><strong>{event.title}</strong><p>{event.detail}</p></div></Link>)}</section>
    </main>
  </ResearchShell>;
}

export function ResearcherProfile() {
  const [tab, setTab] = useState("Research");
  return <ResearchShell surface="paper">
    <TopBar light overline="RESEARCHER PROFILE" title="Profile" action={<Link className="rr-icon-button light" href="/research-room/onboarding" aria-label="Edit researcher profile">✎</Link>}/>
    <main className="rr-page rr-profile">
      <section className="rr-profile-head"><Avatar name="Mara Reyes" color="#ac001e" size={76}/><div><h2>Mara Reyes</h2><span className="rr-meta">@MARAREYES</span></div></section>
      <p className="rr-profile-bio">Following source trails, comparing testimony to preserved records, and asking better questions about the January 24 timeline.</p>
      <section className="rr-metric-grid light"><Stat value="28" label="Contributions"/><Stat value="14" label="Sources found"/><Stat value="6" label="Promoted for review"/><Stat value="2" label="Cases"/></section>
      <div className="rr-profile-note"><Icon name="source"/><p><strong>Self-reported skills</strong>Skills help route questions. They are context, not verified credentials.</p></div>
      <nav className="rr-tabs" aria-label="Researcher profile sections">{["Research", "Skills", "Cases"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
      <section className="rr-tab-content">
        {tab === "Research" ? contributions.slice(0, 3).map((item) => <Link href="/research-room/activity" key={item.id}><span className="rr-overline accent">{item.kind}</span><strong>{item.body}</strong><small>{item.context}</small></Link>) : null}
        {tab === "Skills" ? <div className="rr-chip-list">{researchers[0].skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : null}
        {tab === "Cases" ? <Link href="/research-room/rooms/clancy"><span className="rr-overline accent">ACTIVE CASE ROOM</span><strong>Commonwealth v. Clancy</strong><small>28 contributions · 14 sources found</small></Link> : null}
      </section>
    </main>
  </ResearchShell>;
}

export function ResearcherOnboarding() {
  const steps = ["Identity", "Skills", "Specifics"];
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [specific, setSpecific] = useState("");
  const canContinue = step === 0 ? name.trim().length > 1 : step === 1 ? selected.length > 0 : specific.trim().length > 2;
  return <ResearchShell showNav={false}>
    <main className="rr-onboarding">
      <Wordmark light/>
      <span className="rr-meta">{`STEP ${step + 1} OF ${steps.length} // ${steps[step]}`}</span>
      <div className="rr-progress">{steps.map((_, index) => <i className={index <= step ? "active" : ""} key={index}/>)}</div>
      <section>
        {step === 0 ? <><span className="rr-overline accent">RESEARCHER PROFILE</span><h1>How should the room know you?</h1><p>Use a display name. Your case access remains governed separately.</p><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mara Reyes" autoFocus/></label></> : null}
        {step === 1 ? <><span className="rr-overline accent">SELF-REPORTED CONTEXT</span><h1>What can you help examine?</h1><p>Select practical research skills. These are not verified credentials.</p><div className="rr-chip-list dark">{researchSkills.map((skill) => <button className={selected.includes(skill) ? "active" : ""} onClick={() => setSelected(selected.includes(skill) ? selected.filter((item) => item !== skill) : [...selected, skill])} key={skill}>{skill}</button>)}</div></> : null}
        {step === 2 ? <><span className="rr-overline accent">ONE LAST THING</span><h1>Anything weirdly specific you&apos;re good at?</h1><p>The detail that seems too narrow may be exactly what another researcher needs.</p><label>Specific context<input value={specific} onChange={(event) => setSpecific(event.target.value)} placeholder="Reading pharmacy dispensing logs" autoFocus/></label></> : null}
      </section>
      <footer>{step > 0 ? <button className="rr-button outline" onClick={() => setStep(step - 1)}>Back</button> : <Link className="rr-button outline" href="/research-room/profile">Cancel</Link>}{step < steps.length - 1 ? <button className="rr-button accent full" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue <Icon name="arrow" size={16}/></button> : <Link className={`rr-button accent full${canContinue ? "" : " disabled"}`} aria-disabled={!canContinue} href={canContinue ? "/research-room/profile" : "#"}>Enter the room <Icon name="arrow" size={16}/></Link>}</footer>
    </main>
  </ResearchShell>;
}
