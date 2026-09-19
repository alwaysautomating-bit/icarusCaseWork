export type FoundationEntry = {
  witness: string;
  role: string;
  testimony: string;
  contribution: string;
};

export type FoundationDay = {
  day: number;
  date?: string;
  summary: string;
  note?: string;
  entries: FoundationEntry[];
};

export const foundationDays: FoundationDay[] = [
  {
    day: 1,
    date: "Jul. 27",
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
    date: "Jul. 29",
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
    date: "Jul. 30",
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
    date: "Jul. 31",
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
    date: "Aug. 3",
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
    date: "Aug. 4",
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
    date: "Aug. 5",
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
    date: "Aug. 6",
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
  {
    day: 9,
    date: "Aug. 7",
    summary: "Psychiatric treatment history: two acquaintances on ordinary behavior, then Lindsay’s McLean admission and the start of Dr. Tufts’s treatment history.",
    note: "The reporting table dated this content Aug. 10; the date here follows the trial-index fixture and transcript-derived day file.",
    entries: [
      { witness: "Sarah Carney; Kimberlee Hardy", role: "Friends and childcare-related witnesses", testimony: "Lindsay’s behavior at events and drop-offs.", contribution: "Described ordinary behavior in parenting and social settings." },
      { witness: "Dr. Alia Goodheart", role: "McLean Hospital clinician", testimony: "Lindsay’s voluntary McLean admission for insomnia and anxiety.", contribution: "Lindsay denied any intent to harm herself or others." },
      { witness: "Dr. Jennifer Tufts", role: "Lindsay’s outpatient psychiatrist", testimony: "Initial treatment for anxiety.", contribution: "Observed no psychosis, mania, or homicidal thoughts." },
    ],
  },
  {
    day: 10,
    date: "Aug. 10",
    summary: "Dr. Tufts continued, with extensive defense cross-examination on her assessment; the first perinatal-program clinician began.",
    entries: [
      { witness: "Dr. Jennifer Tufts", role: "Lindsay’s outpatient psychiatrist", testimony: "Outpatient care and medication history: 14 telehealth visits from September 2022 through January 23, 2023.", contribution: "Did not observe psychosis; Lindsay denied active suicidal or homicidal plans. Defense cross focused on depression, insomnia, medication changes, hospitalization, and the adequacy of her assessment." },
      { witness: "Julie Paul", role: "Psychiatric nurse practitioner, South Shore perinatal program", testimony: "Her November 2022 assessments and the referral into the perinatal program.", contribution: "A contemporaneous clinical source: she screened for suicidal ideation, homicidal ideation, and hallucinations at every visit." },
    ],
  },
  {
    day: 11,
    date: "Aug. 11",
    summary: "Continuity-of-care and medication management through the South Shore Perinatal Behavioral Health clinic, with cross-examination on how fragmented treatment was.",
    note: "The reporting table listed a legal-argument day with no witnesses here; the day file shows Rebecca Jolotta testifying. The court also took up the defense’s attempt to add McLean social worker Emily Thorndike outside the jury’s presence.",
    entries: [
      { witness: "Rebecca Jolotta", role: "Psychiatric nurse practitioner, South Shore Perinatal Behavioral Health", testimony: "Lindsay’s presentation from late November through December 2022: insomnia, anxiety and depression, medication intolerance, concern for a possible bipolar-spectrum or mixed state, suicidal thoughts, repeated medication changes, and referral to higher levels of care.", contribution: "Said Lindsay was forthcoming; on cross, she had not spoken with Dr. Tufts, obtained her records, or learned the Women & Infants or McLean outcomes." },
    ],
  },
  {
    day: 12,
    date: "Aug. 12",
    summary: "The bridge between the clinical record, the physical investigation, and the cause-of-death evidence.",
    entries: [
      { witness: "Det. Sgt. Daniel Lawlor", role: "State Police investigator", testimony: "Crime-scene and search-warrant work, and Lindsay’s hospital custody.", contribution: "Scene and warrant provenance for the physical evidence." },
      { witness: "Latiesha Dukes", role: "Perinatal counselor", testimony: "Care for postpartum anxiety, insomnia, and passive suicidal ideation.", contribution: "Observed no psychosis, mania, or delusions." },
      { witness: "Dr. Barbara Olson; Dr. Renee Stonebridge", role: "Medical examiners", testimony: "Autopsy findings.", contribution: "Described ligature furrows and petechial hemorrhages; concluded Cora and Dawson died of asphyxia due to ligature strangulation." },
    ],
  },
  {
    day: 13,
    date: "Aug. 13",
    summary: "Device extraction, search history, and the provenance limits of what the devices and the house search can show.",
    note: "The reporting table dated this Aug. 14 and listed the same three witnesses.",
    entries: [
      { witness: "Kyle Pavao; Timothy Chiappini", role: "State Police digital forensic and mobile-device examiners", testimony: "Extraction of phones and computers, and online-search history.", contribution: "Searches about suicide methods, psychiatric drugs, mental health, and logistics on January 24 supported the prosecution’s planning theory; cross showed many more searches about postpartum depression, side effects, withdrawal, and parenting." },
      { witness: "Joshua McKelligan", role: "Case officer", testimony: "The house search and the medications found afterward.", contribution: "Established provenance limits for the medications found after the initial search." },
    ],
  },
  {
    day: 14,
    date: "Aug. 17",
    summary: "The Commonwealth rests after its Cellebrite expert; the defense begins with family, a former coworker, and the emergency physician.",
    entries: [
      { witness: "Ian Whiffin", role: "Cellebrite expert (Commonwealth)", testimony: "Apple Health, device usage, calls, Maps, searches, notes, and media from Lindsay’s iPhone.", contribution: "Apple Watch heart-rate records ending at 5:23 p.m. and stair climbs at 5:38 p.m." },
      { witness: "Margaret Hamp", role: "Former coworker", testimony: "Lindsay at work.", contribution: "Not yet summarized in the index source." },
      { witness: "Allison Ozga; Paula Musgrove", role: "Lindsay’s sister; Lindsay’s mother", testimony: "Anxiety, depression, suicidal thoughts, medication changes, and McLean treatment.", contribution: "Described a December statement by Lindsay about thoughts of harming the children." },
      { witness: "Dr. Michael Volfovich", role: "Emergency physician", testimony: "Lindsay’s condition on arrival.", contribution: "Severe fall injuries, hypothermia, lacerations, spinal fractures, and cardiac arrest." },
    ],
  },
  {
    day: 15,
    date: "Aug. 18",
    summary: "Defense case: family observations, medication history from the records, and the mechanics of the fall and the deaths, amid disputes over the scope of defense expert evidence.",
    note: "The reporting table also lists Paul Zeizel here (MMPI results showing no malingering); he does not appear in the transcript-derived day file, so he is not listed as a witness.",
    entries: [
      { witness: "Susan Clancy", role: "Patrick Clancy’s mother", testimony: "Lindsay’s distress and attempts to obtain treatment, with text messages.", contribution: "Contemporaneous family observations." },
      { witness: "Dr. Donald Condie", role: "Defense psychiatric expert", testimony: "Lindsay’s psychiatric treatment and medication course, reconstructed from the medical records.", contribution: "Medication effects and depression; framed at this stage as a treatment-history witness." },
      { witness: "Dr. Elizabeth Laposata", role: "Forensic pathologist (defense)", testimony: "The approximately 13-foot fall onto frozen ground, and the timing and mechanism of the children’s deaths.", contribution: "C1 fracture and hypothermia; the children’s ligature-strangulation deaths." },
    ],
  },
  {
    day: 16,
    date: "Aug. 19",
    summary: "Dr. Condie completes his testimony with an explicit criminal-responsibility opinion. Jurors were sent home early.",
    note: "Emily Thorndike was addressed outside the jury’s presence and did not testify; the relevant hospital records were allowed. The reporting table also lists Paul Zeizel on this date; see Day 15.",
    entries: [
      { witness: "Dr. Donald Condie", role: "Defense psychiatric expert", testimony: "Bipolar disorder with postpartum psychosis.", contribution: "Opined that Lindsay could not appreciate wrongfulness or conform her conduct to the law. Cross: no pre-incident documentation of command hallucinations, the day’s structured behavior, and gaps in the records." },
    ],
  },
  {
    day: 17,
    date: "Aug. 20",
    summary: "One witness on what Lindsay said after the deaths and what the hospital chaplain’s notes did and did not record, then a preliminary jury-instruction conference.",
    entries: [
      { witness: "Sheila Cavanaugh", role: "Hospital chaplain", testimony: "Lindsay’s presentation and statements from January 25, including a January 31 statement that she was glad the children were “safe.”", contribution: "Lindsay described a persistent male voice threatening the children. Cross: Cavanaugh’s contemporaneous notes never mention voices or hallucinations. Her notes were admitted." },
    ],
  },
  {
    day: 18,
    date: "Aug. 21",
    summary: "The defense completes its case and rests; the Commonwealth begins rebuttal.",
    entries: [
      { witness: "Dr. Phillip Resnick", role: "Forensic psychiatrist (defense)", testimony: "Bipolar II disorder and postpartum psychosis.", contribution: "Opined Lindsay could not conform her conduct to the law. Cross: alleged malingering indicators, stability after the event, and what she did not disclose to clinicians." },
      { witness: "Dr. Avram Mack", role: "Forensic psychiatrist (Commonwealth rebuttal)", testimony: "Lindsay’s diagnosis and criminal responsibility.", contribution: "Major depression, not psychosis or bipolar disorder; a mental disease but criminally responsible, citing methodical conduct and daily functioning." },
    ],
  },
  {
    day: 19,
    date: "Aug. 24",
    summary: "Rebuttal experts. The Commonwealth’s own experts diverge: Mack diagnoses major depression, Heilbrun bipolar II.",
    note: "Heilbrun did not finish direct examination: his testimony about Catholicism prompted a defense mistrial motion and a curative instruction.",
    entries: [
      { witness: "Dr. Avram Mack", role: "Forensic psychiatrist (Commonwealth rebuttal)", testimony: "Cross-examination and redirect completed.", contribution: "Maintained Lindsay retained capacity to recognize wrongfulness." },
      { witness: "Dr. Kirk Heilbrun", role: "Forensic psychologist (Commonwealth rebuttal)", testimony: "Diagnosis and an alternative account of the killings.", contribution: "Diagnosed bipolar II but characterized the conduct as a severe suicide attempt with “altruistic filicide,” and questioned whether the command hallucination was psychotic." },
    ],
  },
  {
    day: 20,
    date: "Aug. 25",
    summary: "Both sides now agree Lindsay was seriously ill; the dispute is what the illness did to her legal capacity and whether the command-hallucination account is credible.",
    entries: [
      { witness: "Dr. Kirk Heilbrun", role: "Forensic psychologist (Commonwealth rebuttal)", testimony: "Dissociation versus psychosis; the forensic assessment.", contribution: "Concluded she had a mental disease (bipolar II depressive symptoms worsened by sleep problems and probable medication reactions) and retained legal responsibility." },
      { witness: "Dr. Gregory Saathoff", role: "Forensic psychiatrist (Commonwealth rebuttal)", testimony: "Reliability of the reported command hallucination; testimony was still underway at adjournment.", contribution: "Said features were atypical, including its reported abrupt end after the deaths. Defense pointed to testing and expert work that did not indicate malingering." },
    ],
  },
  {
    day: 21,
    date: "Aug. 26",
    summary: "Final rebuttal testimony and cross-examination on criminal responsibility.",
    note: "Source: the reporting table only; there is no transcript-derived day file for Days 21–22 yet.",
    entries: [
      { witness: "Dr. Gregory Saathoff", role: "Forensic psychiatrist (final witness)", testimony: "Diagnosis and criminal responsibility.", contribution: "Agreed Lindsay had bipolar II precipitated by Zoloft-related insomnia but concluded she could appreciate wrongfulness and conform to the law, citing the controlled, sequential conduct. Defense pressed help-seeking, postpartum change, suicidal ideation, and the absence of malingering." },
    ],
  },
  {
    day: 22,
    date: "Aug. 27",
    summary: "Closing arguments, legal instructions, and the start of deliberations. No fact witnesses.",
    note: "Source: the reporting table only; there is no transcript-derived day file for Days 21–22 yet.",
    entries: [
      { witness: "Defense closing", role: "Argument, not evidence", testimony: "Severe psychosis and delusions caused by illness and medication effects.", contribution: "Argued Lindsay is not criminally responsible." },
      { witness: "Commonwealth closing", role: "Argument, not evidence", testimony: "Depression and mental illness do not eliminate intent or the ability to obey the law.", contribution: "Argued Lindsay knew her conduct was wrong and could conform it to the law." },
      { witness: "Hon. William Sullivan", role: "Presiding judge", testimony: "Instructions to the jury.", contribution: "Instructed the jury; deliberations began." },
    ],
  },
];
