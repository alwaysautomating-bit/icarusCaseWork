import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoLabel } from "@/app/casework-ui";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { trialIndexHref } from "@/lib/case-routes";

export const dynamic = "force-dynamic";

type FoundationEntry = {
  witness: string;
  role: string;
  testimony: string;
  contribution: string;
};

type FoundationDay = {
  day: number;
  entries: FoundationEntry[];
};

const foundationDays: FoundationDay[] = [
  {
    day: 1,
    entries: [
      {
        witness: "Patrick Clancy",
        role: "Lindsay’s husband and the children’s father",
        testimony: "Her anxiety, insomnia, medication changes, suicidal thoughts, escalating treatment, McLean admission, and apparently improved condition on January 24.",
        contribution: "Established the mental-health timeline and last-known normal period used to frame planning versus psychiatric decline.",
      },
    ],
  },
  {
    day: 2,
    entries: [
      {
        witness: "Patrick Clancy",
        role: "Continued testimony",
        testimony: "The errand, his return, finding Lindsay outside and the children in the basement, and her reported male command voice.",
        contribution: "Established the errand window, discovery scene, and alleged command-voice statement.",
      },
      {
        witness: "Angela Krause",
        role: "CVS pharmacy manager",
        testimony: "Patrick’s CVS stop and Lindsay’s related telephone interaction.",
        contribution: "Corroborated the errand timing and described Lindsay as sounding coherent.",
      },
      {
        witness: "Saria Sweeney",
        role: "ThreeV Restaurant hostess",
        testimony: "The takeout order and pre-incident telephone interaction.",
        contribution: "Corroborated the restaurant timeline and described Lindsay as clear and coherent.",
      },
    ],
  },
  {
    day: 3,
    entries: [
      {
        witness: "Officer Stephen Hall",
        role: "Duxbury Police; first responder",
        testimony: "Lindsay in the yard, her injuries, Patrick’s distress, and the scene at 47 Summer Street.",
        contribution: "Introduced window and blood photographs relevant to the apparent fall and self-harm attempt.",
      },
      {
        witness: "Officer Brian Josephine",
        role: "Duxbury Police; first responder",
        testimony: "The initial response and observations of Lindsay and the residence.",
        contribution: "Documented Lindsay’s condition, the window area, and the first emergency-response minutes.",
      },
      {
        witness: "PJ Hussey",
        role: "Eyewitness at the discovery scene",
        testimony: "Seeing Patrick remove an item from Dawson’s head and neck area.",
        contribution: "Connected the discovery scene to the ligature evidence and Patrick’s rescue attempt.",
      },
      {
        witness: "Jennifer Stratton and other firefighters/paramedics",
        role: "Emergency medical responders",
        testimony: "CPR, ambulance care, the children’s condition, and the mark around Callan’s neck.",
        contribution: "Provided CPR records and observations of exercise bands and neck injuries.",
      },
    ],
  },
  {
    day: 4,
    entries: [
      {
        witness: "Detective Mark Anthony Maffeo",
        role: "Investigating detective",
        testimony: "The residence search and documentation of physical evidence.",
        contribution: "Presented blood and window photographs plus items collected from the bedroom and nightstand.",
      },
      {
        witness: "Dr. Mark Tenerowicz",
        role: "Emergency physician who treated Dawson",
        testimony: "Dawson’s cardiac arrest and hospital resuscitation efforts.",
        contribution: "Established that Dawson was declared dead at 7:28 p.m. after unsuccessful resuscitation.",
      },
      {
        witness: "Dr. Benjamin Kaufman",
        role: "Emergency physician who treated Callan",
        testimony: "Callan’s condition and emergency treatment.",
        contribution: "Explained his restored heartbeat, absent apparent brain function, and inability to breathe independently.",
      },
      {
        witness: "Hospital-overwatch officers and evidence custodians",
        role: "Custody and preservation witnesses",
        testimony: "Police presence while Lindsay was unconscious, sedated, and intubated.",
        contribution: "Established custody and transfer of blood and urine specimens for toxicology.",
      },
    ],
  },
];

function caseCaption(title: string) {
  return title.split(" — ")[0] || title;
}

export default async function FoundationPage({ params }: { params: Promise<{ caseId: string }> }) {
  const [actor, { caseId }] = await Promise.all([requireCaseActor(), params]);
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  return <main className="case-foundation-shell">
    <header className="case-foundation-hero">
      <MonoLabel>FOUNDATION · CASE OVERVIEW</MonoLabel>
      <h1>{caseCaption(currentCase.title)}</h1>
      <p>Commonwealth v. Lindsay M. Clancy concerns the January 24, 2023 deaths of her three children in Duxbury. The trial centers on criminal responsibility, with the Commonwealth alleging planning and the defense citing severe postpartum mental illness, insomnia, and medication changes. This page indexes who testified each day and the evidence or information each witness contributed.</p>
    </header>

    <section className="foundation-day-index" aria-label="Testimony by trial day">
      <div className="foundation-day-list">
        {foundationDays.map((day) => <section className="foundation-day" aria-labelledby={`foundation-day-${day.day}`} key={day.day}>
          <header>
            <span>DAY</span>
            <strong id={`foundation-day-${day.day}`}>{String(day.day).padStart(2, "0")}</strong>
            <Link href={trialIndexHref(currentCase.id, { dayNumber: day.day, section: "evidence" })} aria-label={`See Day ${day.day} evidence in the Trial Index`}>See more <span aria-hidden="true">→</span></Link>
          </header>
          <div className="foundation-witness-table" role="table" aria-label={`Day ${day.day} testimony index`}>
            <div className="foundation-witness-head" role="row">
              <span role="columnheader">Witness</span>
              <span role="columnheader">Spoke about</span>
              <span role="columnheader">Evidence or information contributed</span>
            </div>
            {day.entries.map((entry) => <article className="foundation-witness-row" role="row" key={entry.witness}>
              <div role="cell" data-label="Witness"><h3>{entry.witness}</h3><span>{entry.role}</span></div>
              <p role="cell" data-label="Spoke about">{entry.testimony}</p>
              <p role="cell" data-label="Evidence or information contributed">{entry.contribution}</p>
            </article>)}
          </div>
        </section>)}
      </div>
    </section>
  </main>;
}
