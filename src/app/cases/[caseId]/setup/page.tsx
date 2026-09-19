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
  summary: string;
  entries: FoundationEntry[];
};

const foundationDays: FoundationDay[] = [
  {
    day: 1,
    summary: "Opening statements set out the competing theories. Patrick Clancy began the family and mental-health timeline.",
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
    summary: "Patrick Clancy continued with the errand and discovery timeline; CVS and restaurant staff described related calls and purchases.",
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
    summary: "First responders described the residence, Lindsay’s injuries, the children’s condition, and emergency treatment.",
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
      {
        witness: "Patrick Dwyer",
        role: "Duxbury Fire firefighter/paramedic",
        testimony: "His dispatch to 47 Summer Street and emergency response with Jennifer Stratton.",
        contribution: "Described first-response timing and actions at the residence.",
      },
    ],
  },
  {
    day: 4,
    summary: "Investigators described the residence and collected items; clinicians addressed Dawson’s and Callan’s emergency care.",
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
        witness: "Richard Lippard",
        role: "Duxbury Police patrol officer",
        testimony: "His assignment to watch Lindsay at South Shore Hospital after the incident.",
        contribution: "Described her condition and police presence before her transfer to Brigham and Women’s Hospital.",
      },
      {
        witness: "Melissa Arcadipane",
        role: "South Shore Hospital specimen-processing supervisor",
        testimony: "How hospital blood and urine specimens were received, checked, and processed.",
        contribution: "Explained the laboratory handling steps for specimens collected during Lindsay’s treatment.",
      },
    ],
  },
  {
    day: 5,
    summary: "Hospital witnesses covered the children’s emergency and intensive care, Lindsay’s injuries and ICU treatment, and her psychiatric consultations. Officers described scene documentation and evidence collection.",
    entries: [
      {
        witness: "Dr. Michael Snyder",
        role: "Emergency physician at Beth Israel Deaconess",
        testimony: "Cora’s condition on arrival and attempted resuscitation.",
        contribution: "Described the emergency treatment and pronouncement of death.",
      },
      {
        witness: "Dr. Andrew Capraro",
        role: "Emergency physician at Boston Children’s",
        testimony: "Callan’s arrival, neck findings, and emergency treatment.",
        contribution: "Provided clinical observations from Callan’s initial hospital care.",
      },
      {
        witness: "Dr. David Casavant",
        role: "Intensive care physician at Boston Children’s",
        testimony: "Callan’s neurological condition and subsequent testing in intensive care.",
        contribution: "Explained the clinical assessment and determination of death by neurologic criteria.",
      },
      {
        witness: "Dr. Kelly McDonough",
        role: "Emergency physician at South Shore Hospital",
        testimony: "Lindsay’s condition after the fall, including suspected spinal injury and treatment in the emergency department.",
        contribution: "Documented her initial injuries, airway care, and transfer for further treatment.",
      },
      {
        witness: "Sgt. Rose Stoffers",
        role: "Massachusetts State Police Crime Scene Services",
        testimony: "Hospital documentation and processing related to Lindsay’s injuries.",
        contribution: "Described photographs and evidence handling at South Shore Hospital.",
      },
      {
        witness: "Rachelle Amedee",
        role: "Brigham and Women’s Hospital ICU nurse",
        testimony: "Lindsay’s sedation, treatment, and communication while hospitalized.",
        contribution: "Provided bedside observations from her ICU care.",
      },
      {
        witness: "Meghan Collins",
        role: "Brigham and Women’s Hospital ICU nurse",
        testimony: "Lindsay’s ICU course and communication as sedation was reduced.",
        contribution: "Described bedside care and observed changes in her alertness.",
      },
      {
        witness: "Dr. Sejal Shah",
        role: "Consultation-liaison psychiatrist",
        testimony: "Psychiatric evaluation during Lindsay’s hospitalization, including delirium and decision-making capacity.",
        contribution: "Discussed the assessment surrounding a change in health-care proxy.",
      },
      {
        witness: "Dr. Jhilam Biswas",
        role: "Consultation-liaison psychiatrist",
        testimony: "Psychiatric consultation while Lindsay was intubated and communicating with difficulty.",
        contribution: "Described the limits and findings of that hospital assessment.",
      },
      {
        witness: "Sgt. Robert Flynn",
        role: "Duxbury Police",
        testimony: "Police presence and observations at the residence.",
        contribution: "Helped establish scene security and the early investigative sequence.",
      },
      {
        witness: "Det. Mark Farioli",
        role: "Massachusetts State Police",
        testimony: "Collection of Lindsay’s blood and urine specimens at the hospital.",
        contribution: "Established how specimens entered the toxicology evidence chain.",
      },
      {
        witness: "Trooper John Santos",
        role: "Massachusetts State Police",
        testimony: "Search of the residence and collection of written and medication-related materials.",
        contribution: "Identified items recovered during the search.",
      },
      {
        witness: "Trooper Cory Melo",
        role: "Massachusetts State Police",
        testimony: "Search-warrant execution and review of collected materials.",
        contribution: "Described investigative handling of journals and other items.",
      },
    ],
  },
  {
    day: 6,
    summary: "Trauma care, residence searches, scene processing, toxicology, and bloodstain work were addressed. The court also heard stipulations, which are separate from witness testimony.",
    entries: [
      {
        witness: "Dr. Christina Carpio",
        role: "Trauma surgeon at South Shore Hospital",
        testimony: "Lindsay’s post-fall trauma care, spinal injury, wounds, and hypothermia.",
        contribution: "Provided medical observations from her initial hospital treatment.",
      },
      {
        witness: "Lt. Joseph Rabbitt",
        role: "Massachusetts State Police investigator",
        testimony: "Searches of the residence and recovery of physical evidence.",
        contribution: "Described where items were found and how the search was documented.",
      },
      {
        witness: "Maureen Hartnett",
        role: "Massachusetts State Police forensic scientist",
        testimony: "Processing of property and red-brown stains from the exterior scene.",
        contribution: "Explained collection and testing of potential blood evidence.",
      },
      {
        witness: "Jonathan O’Loughlin",
        role: "Massachusetts State Police Crime Scene Services",
        testimony: "Photography and documentation of the residence and collected items.",
        contribution: "Provided the scene record used to locate and assess physical evidence.",
      },
      {
        witness: "Hillary Griffiths",
        role: "Massachusetts State Police toxicology scientist",
        testimony: "Testing methods and results for Lindsay’s blood and urine specimens.",
        contribution: "Introduced the laboratory basis for medication findings.",
      },
      {
        witness: "Lisa Yelle",
        role: "Former Massachusetts State Police toxicology scientist",
        testimony: "Toxicology specimen testing and review.",
        contribution: "Explained laboratory handling and interpretation of test results.",
      },
      {
        witness: "Alicia Zimmermann",
        role: "Massachusetts State Police toxicology scientist",
        testimony: "Toxicology testing associated with the children.",
        contribution: "Addressed laboratory results and the related stipulations.",
      },
      {
        witness: "Sherri Crook",
        role: "Massachusetts State Police crime-scene supervisor",
        testimony: "Bloodstain patterns at the residence.",
        contribution: "Explained her bloodstain observations and analysis.",
      },
    ],
  },
  {
    day: 7,
    summary: "Medical and laboratory witnesses addressed Lindsay’s injuries, toxicology, and DNA evidence. Former nanny Elaine Rossi described her observations of the family.",
    entries: [
      {
        witness: "Eitan Negri",
        role: "Physician assistant at Brigham and Women’s Hospital",
        testimony: "Lindsay’s wounds, chest tube, and hospital treatment.",
        contribution: "Provided treatment observations after her transfer.",
      },
      {
        witness: "Nicholas Roberts",
        role: "Former Massachusetts State Police toxicology scientist",
        testimony: "Toxicology testing methods and results.",
        contribution: "Explained laboratory findings for medication-related specimens.",
      },
      {
        witness: "Justin Brower",
        role: "Forensic toxicologist at NMS Labs",
        testimony: "Additional toxicology analysis and interpretation.",
        contribution: "Addressed drug-testing results and their limits.",
      },
      {
        witness: "Katarina Stashyn",
        role: "Former Massachusetts State Police DNA analyst",
        testimony: "DNA testing of stains and exercise bands.",
        contribution: "Explained comparisons from exterior stains and mixed DNA samples.",
      },
      {
        witness: "Elaine Rossi",
        role: "Former nanny for the Clancy family",
        testimony: "Her firsthand observations of Lindsay, the children, and the family routine.",
        contribution: "Supplied personal context about parenting, sleep, and postpartum struggles.",
      },
    ],
  },
  {
    day: 8,
    summary: "Friends and family described Lindsay’s behavior and medication-related conversations. An investigator addressed surveillance and other follow-up evidence tied to the January 24 timeline.",
    entries: [
      {
        witness: "Amy Bevins",
        role: "Lindsay’s childhood friend",
        testimony: "Their conversations and texts about medication changes and troubling thoughts.",
        contribution: "Provided contemporaneous messages and personal observations.",
      },
      {
        witness: "Christopher Clancy",
        role: "Patrick Clancy’s father",
        testimony: "His observations of Lindsay’s parenting, sleep, and behavior.",
        contribution: "Added family context from visits and interactions.",
      },
      {
        witness: "Kyle Carney",
        role: "Family friend",
        testimony: "His interactions with the Clancy family and observations of Lindsay.",
        contribution: "Provided another firsthand account of family circumstances.",
      },
      {
        witness: "Andrew Chiachio",
        role: "Massachusetts State Police investigator",
        testimony: "Follow-up investigation, including ThreeV restaurant surveillance and digital evidence.",
        contribution: "Connected recorded and collected evidence to the January 24 errand timeline.",
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
          <p className="foundation-day-summary">{day.summary}</p>
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
