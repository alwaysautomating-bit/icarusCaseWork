"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { Icon } from "./research-ui";

export function ResearchLanding() {
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const screens = Array.from(stage.querySelectorAll<HTMLElement>(".rr-poster-screen"));
    const reveal = (screen: HTMLElement) => screen.querySelectorAll(".rr-reveal").forEach((node) => node.classList.add("in"));
    const check = () => screens.forEach((screen) => {
      if (screen.offsetTop - stage.scrollTop < stage.clientHeight * .82) reveal(screen);
    });
    stage.classList.add("rr-js");
    if (screens[0]) reveal(screens[0]);
    check();
    stage.addEventListener("scroll", check, { passive: true });
    const fallback = window.setTimeout(() => screens.forEach(reveal), 2200);
    return () => { clearTimeout(fallback); stage.removeEventListener("scroll", check); stage.classList.remove("rr-js"); };
  }, []);

  return <main className="rr-poster" ref={stageRef}>
    <section className="rr-poster-screen paper rr-poster-hero">
      <header><span><i>{"//"}</i> ICARUS · RESEARCH ROOM</span><span>ISSUE NO. 01<br/>PRIVATE BETA</span></header>
      <div className="rr-poster-orbit" aria-hidden="true"/>
      <div className="rr-poster-stack">
        <span className="rr-overline accent rr-reveal">NO ACTIVE SESSION FOUND.</span>
        <h1 className="rr-reveal">The record ends.<em>Questions don&apos;t.</em></h1>
        <p className="rr-reveal">The testimony ends. The filing stops. The exhibit gives you one piece. But the questions keep going. Icarus Research Room is where researchers follow them.</p>
        <div className="rr-poster-actions rr-reveal"><Link href="/login?next=/research-room" className="rr-button accent">Continue with Google <Icon name="arrow" size={18}/></Link><Link href="/join" className="rr-button ink">Request access</Link></div>
      </div>
      <footer><span>INVITE-ONLY // CASE-SCOPED</span><span>SCROLL <i>↓</i></span></footer>
    </section>

    <section className="rr-poster-screen night rr-poster-setup">
      <div className="rr-poster-photo photo-one" aria-hidden="true"/><div className="rr-poster-scrim"/>
      <header><span><i>{"//"}</i> THE SETUP</span><span>THE SOURCE IS PRESERVED</span></header>
      <div className="rr-poster-stack"><span className="rr-overline accent rr-reveal">THE EVIDENCE IS HERE.</span><h2 className="rr-reveal">Surrounded by<br/>questions that<br/><em>remain.</em></h2><p className="rr-reveal">Now you&apos;re in the collaborative case research layer, shoulder to shoulder with researchers examining the same record. Strangers — for now.</p></div>
      <footer><span>8 RESEARCHERS EXAMINING</span><span>STATUS: <i>ACTIVE</i></span></footer>
    </section>

    <section className="rr-poster-screen paper rr-poster-questions">
      <header><span><i>{"//"}</i> THE QUESTIONS</span><span>FIVE YOU CAN&apos;T ANSWER ALONE</span></header>
      <div className="rr-question-stack"><h2 className="rr-reveal">The record is open.<br/>No one&apos;s <em>collaborating.</em></h2>
        <div>{[
          "What does the testimony establish about the return-home timeline?",
          "Which sources independently establish the CVS timing?",
          "When was this proposition first introduced into the record?",
          "Do the witness accounts conflict on responder arrival?",
          "What remains unresolved by the available record?",
        ].map((question, index) => <article className="rr-reveal" key={question}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong></article>)}</div>
      </div>
      <footer><span>FIND THE QUESTION // FOLLOW THE SOURCE</span><span>SHOW YOUR WORK <i>→</i></span></footer>
    </section>

    <section className="rr-poster-screen night rr-poster-answer">
      <div className="rr-poster-photo photo-two" aria-hidden="true"/><div className="rr-poster-scrim"/>
      <header><span><i>{"//"}</i> THE METHOD</span><span>SEARCH · LINK · SHARE · EXAMINE</span></header>
      <div className="rr-poster-stack"><span className="rr-overline accent rr-reveal">FOLLOW THE SOURCE</span><h2 className="rr-reveal">Before, during,<br/>and after every<br/><em>court session.</em></h2><p className="rr-poster-tag rr-reveal">Collaborate with the minds behind the monitors</p></div>
      <footer><span>CONTRIBUTIONS ARE OPEN TO EXAMINATION</span><span>FLAGS ARE NOT VERIFICATION</span></footer>
    </section>

    <section className="rr-poster-screen night rr-poster-close">
      <div className="rr-poster-photo photo-three" aria-hidden="true"/><div className="rr-poster-scrim"/>
      <header><span><i>{"//"}</i> ICARUS</span><span>PRIVATE RESEARCH<br/>BY INVITATION</span></header>
      <div className="rr-poster-close-stack"><h2 className="rr-reveal">ICARUS</h2><span className="rr-reveal">THE COLLABORATIVE CASE RESEARCH LAYER</span><p className="rr-reveal">Search the record. Link the source. Share what you found. Let others examine it.</p><div className="rr-poster-actions rr-reveal"><Link href="/join" className="rr-button accent">Request access <Icon name="arrow" size={18}/></Link><Link href="/casework" className="rr-button outline">Open casework</Link></div></div>
      <footer><span>© 2026 ICARUS CASEWORK</span><span>RESEARCH ROOM // PRIVATE BETA</span></footer>
    </section>
  </main>;
}

export function RequestAccess() {
  return <div className="rr-access-page"><header><Link href="/" aria-label="Back to Icarus Research Room">←</Link><span>ICARUS · RESEARCH ROOM</span><span>INVITE-ONLY // CASE-SCOPED</span></header><main>
    <section><span className="rr-overline accent">REQUEST RESEARCH ROOM ACCESS</span><h1>Follow the question.<br/><em>Show your work.</em></h1><p>Icarus Research Room is a private collaborative space for examining court records, testimony, filings, sources, timelines, and unresolved questions.</p><div className="rr-access-principles"><article><b>01</b><strong>Case-scoped</strong><span>Research stays inside the case room where it belongs.</span></article><article><b>02</b><strong>Source-grounded</strong><span>Contributions point back to the material being examined.</span></article><article><b>03</b><strong>Noncompetitive</strong><span>No ranks, trust scores, or researcher leaderboards.</span></article></div></section>
    <AccessForm/>
  </main><footer><span>PRIVATE BETA // APPLICATIONS REVIEWED MANUALLY</span><Link href="/">BACK TO THE ENTRANCE</Link></footer></div>;
}

function AccessForm() {
  return <form className="rr-access-form" action="/success"><span className="rr-overline">RESEARCHER APPLICATION // 01</span><h2>Tell us how you work.</h2><label>Display name<input name="name" autoComplete="name" required placeholder="Mara Reyes"/></label><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="mara@example.com"/></label><label>Research context<textarea name="context" required rows={4} placeholder="What kinds of records, sources, or questions do you work with?"/></label><label>Anything weirdly specific you&apos;re good at?<input name="specific" placeholder="Reading pharmacy dispensing logs"/></label><label className="rr-check"><input type="checkbox" required/><span>I understand that Research Room contributions are submissions for examination, not verified findings.</span></label><button className="rr-button accent full" type="submit">Request access <Icon name="arrow" size={17}/></button><p>Access requests are reviewed manually. Submitting this form does not grant case access.</p></form>;
}

export function AccessSuccess() {
  return <div className="rr-success"><span className="rr-overline accent">APPLICATION RECEIVED // 2026</span><h1>THE QUESTION<br/>IS STILL OPEN.</h1><p>Your request to enter Icarus Research Room has been received. If there is a case-scoped fit, you&apos;ll receive an invitation by email.</p><div><strong>What happens next</strong><span>01 · Request reviewed manually</span><span>02 · Case scope confirmed</span><span>03 · Invitation sent</span></div><Link href="/" className="rr-button accent">Return to entrance <Icon name="arrow" size={17}/></Link><small>Community promotion is not verification. Research skills are self-reported context.</small></div>;
}
