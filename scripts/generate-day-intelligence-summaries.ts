import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { compilePreservedTranscriptManifest, compileUnifiedProceeding, type IntakeManifest } from "../src/lib/proceeding-compiler";
import type { ParsedTranscriptSegment, ProceedingPackageV1 } from "../src/lib/rev-testimony";

const caseId = "413d071f-6299-46ae-aa85-46390aca38a6";
const generatedAt = new Date().toISOString();
const sectionOrder = [
  "insights",
  "positions_working_conclusions",
  "evidence_chains",
  "relationships",
  "risks_tensions",
  "open_questions",
  "actions",
  "memory_candidates",
  "handoff",
] as const;

type SourceAnchor = { speaker?: string; terms?: string[] };
type DaySpec = {
  day: number;
  subtitle: string;
  oneLiner: string;
  purpose: string;
  whatChanged: string;
  topics: string[];
  coverage: string;
  position: string;
  chain: string;
  risk: string;
  question: string;
  action: string;
  handoff: string;
  anchors: SourceAnchor[];
};

const daySpecs: DaySpec[] = [
  {
    day: 1,
    subtitle: "Opening advocacy and Patrick Clancy's initial testimony",
    oneLiner: "The parties framed the trial around criminal responsibility, and Patrick Clancy began the family and treatment chronology.",
    purpose: "Separate the parties' opening positions from the first testimony and preserve the questions those positions said the evidence would answer.",
    whatChanged: "The central dispute was defined as legal responsibility in the setting of serious mental illness; Patrick then began supplying first-person family and treatment context.",
    topics: ["opening statements", "criminal responsibility", "family history", "mental-health treatment"],
    coverage: "The proceeding contains Commonwealth and defense opening advocacy followed by Patrick Clancy's initial testimony about the family, Lindsay's deterioration, treatment, and the morning of January 24.",
    position: "The Commonwealth and defense offered competing explanations of planning, mental illness, and criminal responsibility. Those statements are party positions, not evidence; Patrick's testimony occupies a separate evidentiary lane.",
    chain: "Opening theories identified anticipated proof; Patrick's personal observations began the testimonial record that later witnesses, records, and experts would support, qualify, or dispute.",
    risk: "Opening language can be repeated later as though it were established fact. Every proposition originating in an opening must remain labeled advocacy until independently supported by evidence.",
    question: "Which factual promises from each opening were later supported, qualified, contradicted, or left unproved by the trial record?",
    action: "Build a promise-to-proof checklist while reviewing later days; do not promote any opening assertion by repetition alone.",
    handoff: "Day 2 continues Patrick Clancy's account through the errand, discovery, basement, and 911 sequence, then adds pharmacy and restaurant witnesses.",
    anchors: [{ terms: ["clock starts"] }, { terms: ["postpartum psychosis"] }, { speaker: "Patrick Clancy" }],
  },
  {
    day: 2,
    subtitle: "Patrick Clancy, the 911 call, CVS, and ThreeV",
    oneLiner: "Patrick completed the discovery narrative while pharmacy and restaurant witnesses supplied independent context for the errand sequence.",
    purpose: "Preserve the first-person discovery account, the recorded emergency call, and the business-witness evidence without collapsing them into one source.",
    whatChanged: "The record moved from background history to the January 24 return-home, backyard, basement, and 911 sequence, with separate witnesses addressing CVS and ThreeV.",
    topics: ["Patrick Clancy", "911 call", "CVS", "ThreeV", "discovery sequence"],
    coverage: "Patrick Clancy continued through his return home and discovery of Lindsay and the children. Angela Krause and Saria Sweeney addressed the pharmacy and restaurant portions of the errand.",
    position: "Day 2 supplied a detailed firsthand narrative plus business-witness context, but each time, observation, call, receipt, and surveillance point retains its own provenance.",
    chain: "The takeout and medication errands preceded Patrick's return; his observations led to the basement discovery and 911 call. Later digital and business records can independently test parts of that sequence.",
    risk: "The preserved transcript contains publisher commentary outside the courtroom record. Commentary must not be treated as witness testimony or as an independent timeline source.",
    question: "Which departure, purchase, pickup, return, call, and discovery times are direct records, which are witness estimates, and which are later summaries?",
    action: "Reconcile Patrick's account with the 911 recording, receipts, surveillance, and device records while preserving separate source lineage.",
    handoff: "Day 3 shifts to police, fire, and paramedic witnesses who describe arrival, entry, the basement scene, and resuscitation efforts.",
    anchors: [{ speaker: "Patrick Clancy" }, { speaker: "Angela Krause" }, { speaker: "Saria Sweeney" }],
  },
  {
    day: 3,
    subtitle: "First responders, basement entry, and resuscitation",
    oneLiner: "Police, fire, and medical responders supplied overlapping but distinct accounts of arrival, scene access, the children, and emergency care.",
    purpose: "Organize the responder sequence while preserving each witness's vantage point, estimates, and actions as separate testimony.",
    whatChanged: "The record gained multiple firsthand accounts of the exterior and basement scenes, the children's locations and conditions, and resuscitation efforts.",
    topics: ["first responders", "47 Summer Street", "basement", "resuscitation", "arrival sequence"],
    coverage: "Duxbury police, fire, and paramedic witnesses described responding to 47 Summer Street, encountering Lindsay outside, entering the home and basement, locating the children, and attempting resuscitation.",
    position: "The responder testimony materially expands the observable scene record, but agreement among responders does not make their timing estimates one independent clock.",
    chain: "Dispatch and arrival led to exterior contact, entry, basement discovery, removal, and medical intervention; each link should be reconstructed from the witness who personally performed or observed it.",
    risk: "Scene descriptions, estimated durations, and remembered order may converge without sharing the same precision. A synthesized chronology must retain uncertainty and witness-specific vantage points.",
    question: "Where do responder accounts differ on arrival order, entry route, child location, movement, condition, and the timing of interventions?",
    action: "Compare testimony against dispatch/CAD, radio, EMS, and hospital records before accepting a minute-level responder timeline.",
    handoff: "Day 4 continues scene testimony, includes the jury view of the residence, and places crime-scene photographs before the jury.",
    anchors: [{ speaker: "Officer Stephen Hall" }, { speaker: "Brian Josephine" }, { speaker: "Daniel Dougherty" }, { speaker: "Vincent Cahill" }],
  },
  {
    day: 4,
    subtitle: "Jury view, scene photographs, and continued responder evidence",
    oneLiner: "The jury received spatial and visual context for the residence while responder and medical testimony continued.",
    purpose: "Preserve what the jury view and scene evidence added without treating visual context as a substitute for exact testimony or admitted exhibits.",
    whatChanged: "The physical layout and photographed condition of 47 Summer Street became central context for evaluating movement, discovery, and response testimony.",
    topics: ["jury view", "scene photographs", "residence layout", "medical response"],
    coverage: "The jury viewed 47 Summer Street, and police, fire, and medical witnesses continued describing the scene and emergency response while photographs were used in court.",
    position: "Day 4 strengthens spatial context for earlier responder accounts, but the jury view, photographs, and verbal descriptions are distinct sources with different limits.",
    chain: "Residence layout and scene photographs provide orientation; witness testimony supplies actions and observations; admitted-exhibit status determines what visual material is part of the evidentiary record.",
    risk: "A later reconstruction can accidentally fill gaps from photographs or a jury view that the transcript itself does not establish. Exhibit identity and scope must remain explicit.",
    question: "Which photographs were admitted, what did each depict, and which witness authenticated or interpreted each image?",
    action: "Link every spatial proposition to the exact testimony and, where available, the corresponding admitted photograph or jury-view record.",
    handoff: "Day 5 broadens the case from immediate response to medical care, crime-scene processing, and investigative collection.",
    anchors: [{ speaker: "Mark Anthony Maffeo" }, { speaker: "Tenerowicz" }, { speaker: "Benjamin Kaufman" }, { speaker: "Melissa Arcadipane" }],
  },
  {
    day: 5,
    subtitle: "Medical care, crime-scene processing, and investigative collection",
    oneLiner: "A long witness day connected hospital evidence concerning Lindsay and the children with crime-scene documentation and police searches.",
    purpose: "Organize the medical and investigative streams without combining clinical observations, expert opinions, and police collection into a single factual narrative.",
    whatChanged: "The prosecution added hospital witnesses, crime-scene personnel, and police witnesses who addressed injuries, care, scene documentation, and evidence collection.",
    topics: ["medical care", "injuries", "crime scene", "evidence collection", "hospital records"],
    coverage: "Medical witnesses including Drs. Michael Snyder, Andrew Capraro, David Casavant, Shah, and Biswas appeared alongside nurses, crime-scene personnel, and Duxbury and State Police witnesses.",
    position: "Day 5 tied clinical and physical-evidence lanes together procedurally, but the source of each injury description, treatment fact, photograph, and collected item remains witness-specific.",
    chain: "Emergency and hospital care generated observations and records; crime-scene processing documented the residence; police witnesses described searches and collection. Those streams later become premises for expert analysis.",
    risk: "The day covers different patients and several professional roles. Summaries must not transfer an observation, injury, or opinion from one patient or witness to another.",
    question: "For each medical and scene proposition, who personally observed it, which record or exhibit supports it, and was the statement fact testimony or expert opinion?",
    action: "Create patient-specific and artifact-specific source chains before using Day 5 material in a reconstruction or expert-premise audit.",
    handoff: "Day 6 continues trauma and forensic evidence, adds scene-collection testimony, and uses stipulations to streamline parts of the prosecution proof.",
    anchors: [{ speaker: "Michael Snyder" }, { speaker: "Rose Stoffers" }, { speaker: "Rachelle Amedee" }, { speaker: "John Santos" }],
  },
  {
    day: 6,
    subtitle: "Trauma care, forensic laboratory work, scene collection, and stipulations",
    oneLiner: "Clinical and forensic witnesses extended the injury and physical-evidence record while stipulations narrowed what required live proof.",
    purpose: "Preserve the boundaries among trauma testimony, laboratory work, scene collection, medication context, and stipulated facts.",
    whatChanged: "The record gained trauma-surgery testimony, Massachusetts State Police crime-lab and scene evidence, additional personal or medication context, and stipulated proof.",
    topics: ["trauma care", "crime laboratory", "scene collection", "stipulations", "medication context"],
    coverage: "Christina Carpio addressed trauma care; Maureen Hartnett and Sherri Crook addressed crime-lab work; State Police witnesses described scene documentation and collection; other witnesses supplied additional contextual evidence.",
    position: "Day 6 developed the provenance of physical evidence and medical observations while reducing some proof through stipulation rather than witness-by-witness testimony.",
    chain: "Hospital observations and scene collection produced records and physical items; forensic handling and stipulations defined how portions of that material entered the trial record.",
    risk: "A stipulation proves only its agreed text and scope. It should not be expanded into unstated conclusions or used to erase uncertainty in related testimony.",
    question: "What exact facts were stipulated, which exhibits or items did each stipulation cover, and what related propositions remained disputed?",
    action: "Index the stipulation text separately from witness summaries and link each collected item through its documented custody and examination steps.",
    handoff: "Day 7 moves through hospital, toxicology, and injury evidence before adding Elaine Rossi's family observations as the former nanny.",
    anchors: [{ speaker: "Christina Carpio" }, { speaker: "Maureen Hartnett" }, { speaker: "Jonathan O'Loughlin" }, { speaker: "Sherri Crook" }],
  },
  {
    day: 7,
    subtitle: "Hospital, toxicology, injury, and former-nanny testimony",
    oneLiner: "Medical and toxicology evidence was followed by Elaine Rossi's personal observations of the family and Lindsay.",
    purpose: "Keep technical medical evidence separate from a lay witness's longitudinal family observations while showing how both inform later expert disputes.",
    whatChanged: "The record added hospital and toxicology context, evidence concerning Lindsay's injuries, and Elaine Rossi's observations from her work with the family.",
    topics: ["hospital care", "toxicology", "injuries", "Elaine Rossi", "family observations"],
    coverage: "Eitan Negri, Nicholas Roberts, Dr. Jonathan Brower, and Katarina Stashyn addressed medical or related evidence; Elaine Rossi described her experience as the family's former nanny.",
    position: "Day 7 combines technical evidence with lay observation, creating different information bases that later experts may rely on but should not collapse into one source.",
    chain: "Clinical testing and injury evidence establish medical observations; Rossi's personal contact supplies behavioral context; later opinions must identify which premise came from which lane.",
    risk: "A lay witness can describe observations but not diagnose. Conversely, technical test results do not by themselves establish mental state or legal responsibility.",
    question: "Which later experts relied on each Day 7 witness, and did they accurately represent the witness's actual testimony and limits?",
    action: "Tag Day 7 sources by information basis: treatment, testing, injury observation, or lay family observation.",
    handoff: "Day 8 adds friends and relatives, restaurant-surveillance evidence, and litigation over proposed defense experts.",
    anchors: [{ speaker: "Eitan Negri" }, { speaker: "Jonathan Brower" }, { speaker: "Katarina Stashyn" }, { speaker: "Elaine Rossi" }],
  },
  {
    day: 8,
    subtitle: "Friends, relatives, surveillance evidence, and expert-disclosure litigation",
    oneLiner: "Personal witnesses described Lindsay and the family, a State Police witness addressed ThreeV surveillance, and the court heard disputes over defense experts.",
    purpose: "Separate lay observations, business-surveillance timing, and counsel's expert-disclosure arguments into their correct evidentiary and procedural lanes.",
    whatChanged: "The record gained observations from Amy Bevins, Christopher Clancy, and Kyle Carney, plus Andrew Chiachio's investigative testimony and a substantial procedural dispute about proposed defense experts.",
    topics: ["family observations", "friends", "ThreeV surveillance", "expert disclosure", "procedural argument"],
    coverage: "Amy Bevins, Christopher Clancy, and Kyle Carney supplied personal context. State Police witness Andrew Chiachio addressed follow-up investigation including restaurant surveillance; later argument concerned defense expert disclosures.",
    position: "Day 8 supplies both collateral observations and an independently recorded business timestamp, but counsel's descriptions of proposed expert opinions remain advocacy until the experts testify.",
    chain: "Personal witnesses provide behavioral context; surveillance can test part of the errand timeline; expert-disclosure argument identifies anticipated opinion evidence but does not itself establish those opinions.",
    risk: "Counsel's detailed proffer of a proposed expert can sound evidentiary. The proffer must remain a party position and should not be attributed to the expert as sworn testimony.",
    question: "Which proposed expert opinions were ultimately admitted and testified to, and how did the final opinions differ from the Day 8 proffers?",
    action: "Link the ThreeV surveillance segment to the Day 2 errand chronology and maintain a separate proffer-versus-testimony comparison for defense experts.",
    handoff: "Day 9 turns to personal observers and treating psychiatrists, with Dr. Jennifer Tufts beginning extensive treatment testimony.",
    anchors: [{ speaker: "Amy Bevins" }, { speaker: "Christopher Clancy" }, { speaker: "Kyle Carney" }, { speaker: "Andrew Chiachio" }],
  },
  {
    day: 9,
    subtitle: "Personal observers and treating-psychiatrist testimony",
    oneLiner: "Childcare and family-context witnesses preceded psychiatric testimony from Alia Goodheart and Jennifer Tufts.",
    purpose: "Preserve the transition from lay observations to treating-clinician evidence about symptoms, diagnosis, medication, and treatment decisions.",
    whatChanged: "The prosecution added Kimberlee Hardy and Sarah Carney's observations, then moved into psychiatric evidence through Alia Goodheart and Dr. Jennifer Tufts.",
    topics: ["lay observations", "psychiatric treatment", "diagnosis", "medication", "Jennifer Tufts"],
    coverage: "Kimberlee Hardy and Sarah Carney supplied personal or childcare context. Psychiatrist Alia Goodheart testified, and Dr. Jennifer Tufts began a lengthy account of treatment and clinical records.",
    position: "Day 9 establishes multiple observation windows around Lindsay's functioning and treatment, but later expert use must distinguish contemporaneous clinical judgment from retrospective forensic opinion.",
    chain: "Lay observations supply behavior in ordinary settings; treating clinicians supply reported symptoms, examinations, diagnoses, and treatment decisions; forensic experts later interpret those records for a different legal question.",
    risk: "Clinical notes may contain patient report, collateral report, clinician observation, and clinician assessment in the same entry. Those layers should not be treated as interchangeable facts.",
    question: "Which symptoms and concerns were directly observed, which were self-reported, which came from collateral sources, and how did treatment decisions respond to each?",
    action: "Build a dated treatment-source table that separates report, observation, assessment, medication decision, and follow-up plan.",
    handoff: "Day 10 continues Dr. Tufts's testimony and then adds psychiatric nurse practitioner Julie Paul.",
    anchors: [{ speaker: "Kimberlee Hardy" }, { speaker: "Sarah Carney" }, { speaker: "Alia Goodheart" }, { speaker: "Jennifer Tufts" }],
  },
  {
    day: 10,
    subtitle: "Dr. Jennifer Tufts continued; Julie Paul began",
    oneLiner: "The treatment record deepened through extended testimony about symptoms, medication regimens, clinical notes, and care decisions.",
    purpose: "Organize a dense clinician day around what was reported, observed, assessed, prescribed, and documented at each encounter.",
    whatChanged: "Dr. Tufts completed or substantially continued her account, and psychiatric mental-health nurse practitioner Julie Paul added another treatment perspective.",
    topics: ["Jennifer Tufts", "Julie Paul", "clinical notes", "medication regimens", "treatment decisions"],
    coverage: "Most of the day consisted of Dr. Jennifer Tufts's continued testimony. Julie Paul then testified as a psychiatric mental-health nurse practitioner.",
    position: "Day 10 is a core source for the pre-incident treatment chronology, but its evidentiary value depends on preserving dates, information source, medication changes, and the clinician's contemporaneous reasoning.",
    chain: "Reported symptoms and observed presentation informed clinical assessments; assessments informed medication and follow-up decisions; later experts used portions of that treatment record as opinion premises.",
    risk: "A medication appearing in a chart does not by itself prove ingestion, effect, adverse reaction, or causation. Prescription, adherence, timing, and observed response remain separate questions.",
    question: "For every medication change, what was the stated indication, dose, start/stop timing, reported adherence, observed effect, and follow-up assessment?",
    action: "Normalize Day 10 into an encounter-by-encounter medication and symptom chronology while retaining exact note and testimony provenance.",
    handoff: "Day 11 focuses on Rebecca Jollotta's several weeks of perinatal behavioral-health care and cross-examination of symptom and medication decisions.",
    anchors: [{ speaker: "Jennifer Tufts" }, { speaker: "Julie Paul" }],
  },
  {
    day: 11,
    subtitle: "Rebecca Jollotta and perinatal behavioral-health care",
    oneLiner: "Jollotta supplied a sustained treatment account, with cross-examination testing symptom recognition, risk assessment, and medication choices.",
    purpose: "Preserve the sequence and information basis of Jollotta's care without converting contested clinical judgment into canonical fact.",
    whatChanged: "The record gained a concentrated account of several weeks of perinatal psychiatric care and a detailed challenge to how symptoms and medication decisions were understood.",
    topics: ["Rebecca Jollotta", "perinatal care", "symptom recognition", "medication decisions", "risk assessment"],
    coverage: "Rebecca Jollotta was the principal witness and described her role, encounters, records, assessments, communications, and medication-related decisions during Lindsay's care.",
    position: "Day 11 is central to competing readings of the treatment trajectory: what clinicians knew contemporaneously, what was communicated, and whether later interpretations fairly reflect the record.",
    chain: "Patient and collateral communications informed Jollotta's documented assessments; those assessments informed treatment decisions; later experts used the resulting record to support different conclusions.",
    risk: "Cross-examination propositions are questions or party positions unless adopted by the witness. Short answers must remain linked to their full questions.",
    question: "Which material propositions did Jollotta affirm, reject, qualify, or say she could not recall, and what records were used for each?",
    action: "Extract the high-value Q/A exchanges with full question context and map them to the underlying clinical records.",
    handoff: "Day 12 moves from investigation and further clinical evidence to autopsy and neuropathology testimony.",
    anchors: [{ speaker: "Rebecca Jolotta" }],
  },
  {
    day: 12,
    subtitle: "Investigation, clinical evidence, and autopsy testimony",
    oneLiner: "Investigative and clinical witnesses were followed by medical-examiner and neuropathology evidence concerning the children.",
    purpose: "Keep investigative collection, clinical testimony, and postmortem medical opinions in distinct but traceable evidence chains.",
    whatChanged: "The prosecution added Daniel Lawler, Latiesha Dukes, and Cameron Daley before Drs. Renee Stonebridge and Barbara Vidal Olson addressed postmortem medical evidence.",
    topics: ["investigation", "clinical care", "autopsy", "neuropathology", "cause and manner"],
    coverage: "Daniel Lawler addressed investigation; Latiesha Dukes and Cameron Daley supplied additional evidence; Dr. Renee Stonebridge and Dr. Barbara Vidal Olson addressed medical-examiner and neuropathology subjects.",
    position: "Day 12 connects investigative provenance to specialized medical findings, but the observations, laboratory findings, cause opinions, and legal implications remain separate levels of analysis.",
    chain: "Investigators collected and documented material; clinicians supplied records and observations; autopsy and neuropathology witnesses interpreted postmortem findings within their disciplines.",
    risk: "Cause and manner opinions should be quoted and attributed precisely. They do not by themselves decide identity, intent, mental state, or criminal responsibility.",
    question: "Which findings were direct observations, which were tests, which were interpretive opinions, and what alternative explanations were addressed on cross-examination?",
    action: "Create child-specific medical evidence chains and link each opinion to its stated findings, records, and limitations.",
    handoff: "Day 13 turns to computer and device evidence, including the scope and attribution limits of digital searches and artifacts.",
    anchors: [{ speaker: "Dan Lawler" }, { speaker: "Latiesha Dukes" }, { speaker: "Renee Stonebridge" }, { speaker: "Barbara Olson" }],
  },
  {
    day: 13,
    subtitle: "Computer, phone, and digital-forensics evidence",
    oneLiner: "State Police witnesses explained forensic extraction and presented computer and device artifacts while acknowledging attribution limits.",
    purpose: "Preserve what the digital artifacts show, how they were extracted, and what the data cannot establish about user identity or meaning.",
    whatChanged: "The record gained forensic evidence from Kyle Pavao, Timothy Chiappini, and Joshua McKelligan concerning computers, phones, searches, and investigative handling.",
    topics: ["digital forensics", "Surface Pro", "phone extraction", "search history", "user attribution"],
    coverage: "Kyle Pavao explained forensic computer analysis, Timothy Chiappini addressed device evidence, and Joshua McKelligan supplied investigative context for the digital material.",
    position: "Day 13 provides independently testable digital anchors, but an artifact's presence or timestamp does not automatically identify the user, purpose, state of mind, or surrounding event.",
    chain: "Devices were seized or imaged; forensic tools parsed stored artifacts; witnesses selected and explained results; counsel then argued the significance and attribution of those results.",
    risk: "Search and browser artifacts can be overread. Device ownership, account, session, timezone, sync behavior, extraction method, and user attribution must be tested separately.",
    question: "For each relied-on artifact, what device and account produced it, what timestamp semantics apply, who could have used the device, and what surrounding artifacts qualify its meaning?",
    action: "Promote only validated digital timestamps into reconstruction and keep user identity and intent as separately sourced propositions.",
    handoff: "Day 14 completes the prosecution case, addresses Apple Watch and phone data, and begins the defense with lay and medical witnesses.",
    anchors: [{ speaker: "Pavao" }, { speaker: "Timothy Chiappini" }, { speaker: "Joshua McKelligan" }],
  },
  {
    day: 14,
    subtitle: "Prosecution rested; digital evidence and the defense case began",
    oneLiner: "Ian Whiffin addressed phone and Apple Watch data, the prosecution rested, and the defense began with personal and medical witnesses.",
    purpose: "Preserve the procedural transition and the distinct digital, lay-observation, and emergency-medicine evidence introduced that day.",
    whatChanged: "The prosecution closed its case; the required-finding motion was denied; the defense called Margaret Hamp, Allison Ozga, Paula Musgrove, and Dr. Michael Volfovich after Ian Whiffin's digital testimony.",
    topics: ["Apple Watch", "prosecution rests", "required finding", "defense case", "injury mechanism"],
    coverage: "Ian Whiffin addressed phone and Apple Watch data. After the prosecution rested and the court denied a required-finding motion, defense witnesses offered coworker, family, and medical evidence.",
    position: "Day 14 is both an evidentiary and procedural pivot: digital records complete a prosecution proof stream, while the defense begins developing personal-history and injury-mechanism themes.",
    chain: "Digital device data supplied time-linked measurements; the court resolved the midtrial sufficiency motion; lay witnesses supplied observations; Dr. Volfovich offered emergency-medicine evidence about injuries and treatment.",
    risk: "The denial of a required-finding motion is a procedural ruling on legal sufficiency, not a factual finding that the Commonwealth's evidence is true.",
    question: "Which Apple Watch metrics are technically reliable for the propositions asserted, and what assumptions did each side make when integrating them into the incident timeline?",
    action: "Audit device timestamps and physiological metrics separately, and preserve the exact scope and rationale of the required-finding ruling.",
    handoff: "Day 15 expands the defense case through Susan Clancy and medical, psychiatric, and psychological experts.",
    anchors: [{ speaker: "Ian Whiffin" }, { speaker: "Margaret Hamp" }, { speaker: "Paula Musgrove" }, { speaker: "Michael Volfovich" }],
  },
  {
    day: 15,
    subtitle: "Family observations and defense medical, psychiatric, and psychological experts",
    oneLiner: "Susan Clancy supplied family context while defense experts addressed injuries, treatment, medication, psychosis, and psychological assessment.",
    purpose: "Organize the defense's transition from family observations to expert opinion and preserve the premise chain for each discipline.",
    whatChanged: "Susan Clancy testified, followed by Dr. Elizabeth Laposata, Dr. Donald Condie, and Dr. Paul Zeizel across medical, psychiatric, and psychological subjects.",
    topics: ["Susan Clancy", "injury mechanics", "psychiatry", "psychosis", "psychological assessment"],
    coverage: "Susan Clancy described Lindsay and family concerns. Dr. Elizabeth Laposata addressed medical or pathology issues; Dr. Donald Condie addressed psychiatry; Dr. Paul Zeizel addressed clinical and forensic psychology.",
    position: "Day 15 begins the defense's integrated explanatory case, but family testimony, medical mechanism evidence, psychiatric diagnosis, and psychological testing have different methods and limits.",
    chain: "Family observations and treatment records became expert premises; medical evidence addressed injury; psychiatric and psychological experts interpreted symptoms, medication, psychosis, testing, and alternative explanations.",
    risk: "Experts may rely on the same underlying record and therefore are not automatically independent corroboration. Shared premises and derivative histories must be identified.",
    question: "For each defense expert conclusion, which sources were independently reviewed, which came through another expert or collateral account, and which contrary materials were considered?",
    action: "Build an expert-premise matrix separating shared records, unique interviews or tests, omitted sources, and discipline-specific conclusions.",
    handoff: "Day 16 continues Dr. Condie's testimony and litigates proposed testimony from former McLean clinician Emily Thorndike before an early adjournment.",
    anchors: [{ speaker: "Susan Clancy" }, { speaker: "Elizabeth Laposata" }, { speaker: "Donald Condie" }, { speaker: "Paul Zeizel" }],
  },
  {
    day: 16,
    subtitle: "Dr. Condie continued; McLean staffing evidence was litigated",
    oneLiner: "Dr. Condie's psychiatric testimony continued, and the court excluded Emily Thorndike's proposed testimony while allowing relevant McLean records.",
    purpose: "Preserve Condie's opinions and the separate evidentiary ruling concerning proposed testimony about McLean staffing and programming.",
    whatChanged: "The defense continued its psychiatric case through Dr. Condie; Emily Thorndike testified in a voir dire, after which the court denied the motion to call her before the jury but permitted specified records.",
    topics: ["Donald Condie", "psychiatric opinion", "Emily Thorndike", "McLean records", "voir dire"],
    coverage: "Dr. Donald Condie continued testifying. Emily Thorndike described her experience with the McLean unit during a voir dire; the court ruled her proposed jury testimony inadmissible while allowing specified staffing and program records.",
    position: "Day 16 materially narrows what may be used from the Thorndike episode: the voir-dire testimony is not jury evidence, while the permitted records retain their own evidentiary status and scope.",
    chain: "Condie's opinions continued through records and psychiatric analysis; the defense proffered Thorndike to contextualize McLean; voir dire tested foundation; the court chose records rather than her jury testimony.",
    risk: "Thorndike's voir-dire statements can be mistaken for admitted trial testimony. The ruling and the jury's absence must travel with every reference to that material.",
    question: "Which McLean records were actually admitted after the ruling, and what precise staffing or programming propositions do those records support?",
    action: "Flag every Thorndike segment as voir-dire context only and link any later McLean proposition to the admitted records rather than to excluded testimony.",
    handoff: "Day 17 features Sheila Cavanaugh's hospital conversations with Lindsay, including statements about a male voice and the children's safety.",
    anchors: [{ speaker: "Donald Condie" }, { speaker: "Emily Thorndike" }, { terms: ["deny the defendant's motion to call this witness"] }],
  },
  {
    day: 17,
    subtitle: "Sheila Cavanaugh and post-extubation conversations",
    oneLiner: "Cavanaugh described repeated hospital conversations and statements attributed to Lindsay about a male voice and the children's safety.",
    purpose: "Preserve the exact wording, sequence, circumstances, and transmission history of the hospital statements attributed to Lindsay.",
    whatChanged: "The defense added a direct listener's account of post-extubation conversations that later experts used when evaluating psychosis and a reported command hallucination.",
    topics: ["Sheila Cavanaugh", "hospital conversations", "male voice", "command hallucination", "statement provenance"],
    coverage: "Sheila Cavanaugh described visits and conversations with Lindsay after extubation, including statements concerning a male voice and concern for the children's safety. The jurors were re-sworn and the session ended early.",
    position: "Day 17 is a primary provenance source for a disputed voice account, but later paraphrases must be compared against Cavanaugh's exact words, timing, and recollection.",
    chain: "Hospital conversation led to Cavanaugh's recollection and testimony; clinicians, investigators, or experts may later repeat or reinterpret that account; each transmission step can alter wording and meaning.",
    risk: "Different formulations of the reported voice may share a common origin. Multiple repetitions do not necessarily constitute multiple independent sources.",
    question: "What exact words did Cavanaugh attribute to Lindsay in each conversation, when did each occur, who else was present, and when were the statements first documented?",
    action: "Construct a source-lineage table for every voice formulation before comparing expert characterizations of consistency or change.",
    handoff: "Day 18 presents Dr. Phillip Resnick's defense opinion, the defense rests, and Dr. Avram Mack begins Commonwealth rebuttal.",
    anchors: [{ speaker: "Sheila Cavanaugh" }],
  },
  {
    day: 18,
    subtitle: "Resnick's defense opinion and Mack's rebuttal",
    oneLiner: "The defense completed its criminal-responsibility case through Dr. Phillip Resnick, then the Commonwealth began rebuttal through Dr. Avram Mack.",
    purpose: "Place the opposing forensic opinions side by side while preserving their separate records, assumptions, methods, and legal conclusions.",
    whatChanged: "Resnick offered a defense opinion concerning psychosis, a command hallucination, control, and motive; the defense rested; Mack began disputing psychosis and addressing behavioral control.",
    topics: ["Phillip Resnick", "Avram Mack", "psychosis", "command hallucination", "criminal responsibility"],
    coverage: "Dr. Phillip Resnick testified for the defense on psychosis, command hallucination, control, and motive. After the defense rested, Dr. Avram Mack began Commonwealth rebuttal.",
    position: "Day 18 makes the expert disagreement explicit: the dispute concerns not only diagnosis but the reliability of the reported experience, retained capacities, and the meaning of behavior before and after the deaths.",
    chain: "Records, interviews, collateral accounts, and conduct formed expert premises; each expert interpreted those premises clinically; the opinions were then mapped to the legal tests for criminal responsibility.",
    risk: "Diagnostic disagreement, credibility assessment, and legal-capacity opinion are related but distinct. A summary should not treat one as automatically deciding the others.",
    question: "Which premises did Resnick and Mack share, which did they weight differently, and which material sources did either expert omit or treat as unreliable?",
    action: "Create a premise-by-premise comparison of Resnick and Mack rather than comparing only their ultimate conclusions.",
    handoff: "Day 19 completes Mack's rebuttal testimony and begins Dr. Kirk Heilbrun's Commonwealth rebuttal opinion.",
    anchors: [{ speaker: "Phillip Resnick" }, { speaker: "Avram Mack" }],
  },
  {
    day: 19,
    subtitle: "Mack concluded; Heilbrun began Commonwealth rebuttal",
    oneLiner: "The Commonwealth completed Dr. Mack's rebuttal and opened a second forensic opinion through Dr. Kirk Heilbrun.",
    purpose: "Preserve the handoff between Commonwealth rebuttal experts and identify the premises Heilbrun began using before his Day 20 continuation.",
    whatChanged: "Mack's cross-examination and rebuttal account concluded; Heilbrun was qualified and began describing his evaluation, materials, method, and criminal-responsibility framework.",
    topics: ["Avram Mack", "Kirk Heilbrun", "Commonwealth rebuttal", "expert methodology", "criminal responsibility"],
    coverage: "Dr. Avram Mack continued and concluded his rebuttal testimony. Dr. Kirk Heilbrun then began Commonwealth rebuttal testimony, including qualifications and the foundation for his forensic evaluation.",
    position: "Day 19 adds a second Commonwealth forensic framework. Similar ultimate opinions should not obscure whether Mack and Heilbrun used the same sources, reasoning, diagnostic formulation, or capacity analysis.",
    chain: "Mack's completed opinion was tested on cross; Heilbrun identified his professional framework and source review; Day 20 would continue the application of that framework to disputed facts and legal capacities.",
    risk: "Two prosecution experts may rely on overlapping records and accounts. Agreement can reflect shared inputs rather than independent corroboration.",
    question: "What sources and assumptions did Heilbrun identify on Day 19, and how do they compare with Mack's source set and Resnick's defense analysis?",
    action: "Freeze the Day 19 foundation separately from Day 20's completed opinions so later analysis can distinguish setup from conclusions.",
    handoff: "Day 20 remains a separate, already-generated artifact; it continues Heilbrun and begins Dr. Gregory Saathoff without being merged into this pass.",
    anchors: [{ speaker: "Avram Mack" }, { speaker: "Kirk Heilbrun" }],
  },
];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveAnchor(segments: ParsedTranscriptSegment[], anchor: SourceAnchor) {
  const speaker = anchor.speaker ? normalize(anchor.speaker) : null;
  const terms = (anchor.terms ?? []).map(normalize);
  const ranked = segments.map((segment) => {
    const normalizedSpeaker = normalize(segment.speaker);
    const normalizedText = normalize(segment.text);
    const speakerLabelMatch = !speaker || normalizedSpeaker.includes(speaker) || speaker.includes(normalizedSpeaker);
    const speakerMentionMatch = Boolean(speaker && normalizedText.includes(speaker));
    const speakerMatch = speakerLabelMatch || speakerMentionMatch;
    const termMatches = terms.filter((term) => normalizedText.includes(term)).length;
    const score = (speakerLabelMatch ? 200 : speakerMentionMatch ? 100 : 0) + termMatches * 20 + Math.min(segment.text.length, 500) / 1_000;
    return { segment, speakerMatch, termMatches, score };
  }).filter((candidate) => (!speaker || candidate.speakerMatch) && (terms.length === 0 || candidate.termMatches > 0)).sort((a, b) => b.score - a.score);
  const selected = ranked[0]?.segment;
  if (!selected) throw new Error(`No source anchor matched speaker=${anchor.speaker ?? "*"} terms=${(anchor.terms ?? []).join("|")}`);
  return selected;
}

async function loadPackage(day: number): Promise<ProceedingPackageV1> {
  if (day === 1) {
    const artifactPath = path.resolve("fixtures/ma-v-lindsay-clancy-opening-statements.rev.txt");
    const source = await readFile(artifactPath, "utf8");
    return compileUnifiedProceeding({ provider: "rev", representation: "rev_plain_text", artifactName: path.basename(artifactPath), sourceUrl: null, proceedingType: "opening_statements" }, source);
  }
  const files = await readdir(path.resolve("transcripts/manifests"));
  const filename = files.find((name) => name === `Lindsay-Clancy_Trial-Day-${String(day).padStart(2, "0")}_Intake-Manifest.json`);
  if (!filename) throw new Error(`Missing intake manifest for Day ${day}.`);
  const manifest = JSON.parse(await readFile(path.resolve("transcripts/manifests", filename), "utf8")) as IntakeManifest;
  const source = await readFile(path.resolve("transcripts/preserved", manifest.source.preserved_filename), "utf8");
  return compilePreservedTranscriptManifest(manifest, source);
}

function makeSource(segment: ParsedTranscriptSegment) {
  return {
    source_segment_id: segment.id,
    source_artifact_id: null,
    proceeding_id: null,
    speaker_name: segment.speaker,
    speaker_capacity: "transcript_speaker",
    examination_phase: null,
    locator: { type: "timestamp", value: segment.locator.timestampStart },
    role: "derived_from",
    source_status: "canonical",
  } as const;
}

function makeItems(spec: DaySpec, sources: ReturnType<typeof makeSource>[]) {
  const prefix = `day${String(spec.day).padStart(2, "0")}`;
  const linked = (section: string, epistemicClass: string, slug: string, title: string, content: string, importance: "high" | "medium" | "low") => ({
    item_id: `${prefix}-${slug}`,
    section,
    epistemic_class: epistemicClass,
    title,
    content,
    importance,
    extraction_confidence: 0.82,
    evidentiary_assessment: "derived",
    source_linkage_status: "source_linkage_incomplete",
    review_status: "needs_review",
    sources,
    tags: spec.topics,
    notes: ["Day-level synthesis linked to representative canonical transcript segments; human item review remains required."],
  });
  const analytical = (section: string, epistemicClass: string, slug: string, title: string, content: string, importance: "high" | "medium" | "low") => ({
    item_id: `${prefix}-${slug}`,
    section,
    epistemic_class: epistemicClass,
    title,
    content,
    importance,
    extraction_confidence: 0.78,
    evidentiary_assessment: "not_assessed",
    source_linkage_status: "source_linkage_incomplete",
    review_status: "needs_review",
    sources: [],
    tags: spec.topics,
    notes: ["Generated analytical work product; not a canonical fact and not eligible for automatic promotion."],
  });
  return [
    linked("insights", "analytical_inference", "coverage", "What the day covered", spec.coverage, "high"),
    linked("positions_working_conclusions", spec.day === 1 ? "party_position" : "working_conclusion", "working-position", "Working significance", spec.position, "high"),
    linked("evidence_chains", "evidence_chain", "evidence-chain", "Evidence chain", spec.chain, "high"),
    analytical("risks_tensions", "risk", "boundary-risk", "Boundary to preserve", spec.risk, "high"),
    analytical("open_questions", "research_question", "review-question", "Open review question", spec.question, "medium"),
    analytical("actions", "research_action", "next-action", "Next review action", spec.action, "medium"),
    analytical("handoff", "handoff_state", "handoff", "Handoff brief", spec.handoff, "medium"),
  ];
}

function itemCounts(items: Array<{ section: string }>) {
  return Object.fromEntries(sectionOrder.map((section) => [section, items.filter((item) => item.section === section).length]));
}

function contextMarkdown(spec: DaySpec, artifactSetId: string, sourceHash: string, items: ReturnType<typeof makeItems>) {
  const grouped = new Map(sectionOrder.map((section) => [section, items.filter((item) => item.section === section)]));
  const labels: Record<(typeof sectionOrder)[number], string> = {
    insights: "Key Insights",
    positions_working_conclusions: "Positions and Working Conclusions",
    evidence_chains: "Evidence Chains",
    relationships: "Relationships",
    risks_tensions: "Risks and Tensions",
    open_questions: "Open Questions",
    actions: "Next Actions",
    memory_candidates: "Memory Candidates",
    handoff: "Handoff Brief",
  };
  const blocks = sectionOrder.map((section) => {
    const entries = grouped.get(section) ?? [];
    if (entries.length === 0) return `## ${labels[section]}\n\nNone declared in this version.`;
    return `## ${labels[section]}\n\n${entries.map((item) => `### ${item.title}\n\n${item.content}\n\n- Class: \`${item.epistemic_class}\`\n- Review: \`${item.review_status}\`\n- Source linkage: \`${item.source_linkage_status}\``).join("\n\n")}`;
  });
  return `# ${spec.day === 1 ? "Opening Statements" : `Day ${spec.day}`} Intelligence\n\n> Generated analysis for reference only. This artifact is not canonical fact, does not write to the database, and excludes Scratchpad content.\n\n- Contract: \`day-intelligence/1.0\`\n- Artifact set: \`${artifactSetId}\`\n- Transcript SHA-256: \`${sourceHash}\`\n- Review status: \`needs_review\`\n\n## Day Purpose\n\n${spec.purpose}\n\n## What Changed\n\n${spec.whatChanged}\n\n${blocks.join("\n\n")}\n\n## Governance\n\nHuman review is required. Automatic action and cross-day promotion are prohibited. Exact transcript segments remain the evidentiary source of record.\n`;
}

async function generate(spec: DaySpec) {
  const transcript = await loadPackage(spec.day);
  const resolvedSegments = spec.anchors.map((anchor) => resolveAnchor(transcript.segments, anchor));
  const sources = [...new Map(resolvedSegments.map((segment) => [segment.id, makeSource(segment)])).values()];
  const items = makeItems(spec, sources);
  const dayId = `day-${String(spec.day).padStart(2, "0")}`;
  const artifactSetId = `lindsay-clancy-${dayId}-v1`;
  const title = spec.day === 1 ? "Opening Statements Intelligence" : `Day ${spec.day} Intelligence`;
  const summary = {
    title,
    subtitle: spec.subtitle,
    one_liner: spec.oneLiner,
    purpose: spec.purpose,
    what_changed: spec.whatChanged,
    primary_topics: spec.topics,
  };
  const authority = {
    evidentiary_source_of_record: "source_artifact + source_segments",
    canonical_analytical_representation: "context.md",
  } as const;
  const card = {
    id: `day-intelligence:${caseId}:${dayId}:v1`,
    profile: "legal_case_analysis",
    contract_version: "day-intelligence/1.0",
    artifact_set_id: artifactSetId,
    case_id: caseId,
    trial_day_id: dayId,
    day_number: spec.day,
    version: 1,
    ...summary,
    review_status: "needs_review",
    source_linkage_status: "partial",
    item_counts: itemCounts(items),
    generated_at: generatedAt,
    authority,
  };
  const configurationHash = sha256(JSON.stringify(spec));
  const agentPack = {
    version: "1.0.0",
    profile: "legal_case_analysis",
    contract_version: "day-intelligence/1.0",
    artifact_set_id: artifactSetId,
    case_id: caseId,
    trial_day_id: dayId,
    day_number: spec.day,
    artifact_version: 1,
    supersedes_artifact_set_id: null,
    source_record: {
      proceeding_ids: [],
      transcript_artifact_ids: [],
      input_hashes: { transcript: `sha256:${transcript.source.sha256}` },
      source_segment_namespace: "source_segments.id",
      source_record_complete: false,
    },
    generation: {
      created_at: generatedAt,
      collapse_skill: { name: "thread-collapse-handoff", version: "1.1.0-artifact", mode: "legal_evidentiary" },
      compiler: { name: "context-card-compiler", version: "1.1.0-artifact", profile: "legal_case_analysis" },
      model: { provider: "OpenAI", name: "Codex", version: "2026-08-26" },
      configuration_hash: `sha256:${configurationHash}`,
    },
    summary,
    items,
    limitations: [
      {
        code: "human_review_pending",
        severity: "material",
        description: "This day-level synthesis has not been accepted by a human reviewer and must remain reference-only analytical work product.",
        affected_item_ids: items.map((item) => item.item_id),
      },
      {
        code: "representative_segment_linkage",
        severity: "material",
        description: "Source-backed synthesis items link to representative exact transcript segments; item-level proposition and examination-phase review remains required.",
        affected_item_ids: items.filter((item) => item.sources.length > 0).map((item) => item.item_id),
      },
      {
        code: "database_identity_not_embedded",
        severity: "non_material",
        description: "This artifact-only build embeds deterministic source segment IDs and transcript hashes but does not persist or require proceeding and source-artifact database identities.",
        affected_item_ids: [],
      },
    ],
    governance: {
      human_review_required: true,
      auto_action_allowed: false,
      audit_log_required: true,
      analytical_acceptance_is_canonical_fact: false,
      cross_day_auto_promotion_allowed: false,
      scratchpad_input_allowed: false,
    },
    authority: { ...authority, generated_projection: "agent-pack.json" },
  };
  const relationships = {
    contract_version: "day-intelligence/1.0",
    artifact_set_id: artifactSetId,
    case_id: caseId,
    trial_day_id: dayId,
    day_number: spec.day,
    version: 1,
    relationships: [],
  };
  const output = path.resolve("generated/day-intelligence", dayId, "v1");
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, "context.md"), contextMarkdown(spec, artifactSetId, transcript.source.sha256, items), "utf8"),
    writeFile(path.join(output, "card.json"), `${JSON.stringify(card, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "agent-pack.json"), `${JSON.stringify(agentPack, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "relationships.json"), `${JSON.stringify(relationships, null, 2)}\n`, "utf8"),
  ]);
  return { day: spec.day, segments: transcript.segments.length, sources: sources.length, output };
}

const results = [];
for (const spec of daySpecs) results.push(await generate(spec));
console.log(JSON.stringify({ generatedAt, artifacts: results }, null, 2));
