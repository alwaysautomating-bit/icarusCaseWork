export type ChildrenFoundSourceSegment = {
  id: string;
  exact_text: string;
};

export type ChildrenFoundSource = {
  key: string;
  segmentId: string;
  proceeding: string;
  witness: string;
  basis: "Responder testimony" | "Emergency physician testimony" | "ICU physician testimony" | "Medical examiner testimony" | "Court stipulation";
  label: string;
  expectedText: string;
};

export type ChildrenFoundFinding = {
  key: string;
  phase: "Scene" | "Response and transport" | "Hospital" | "Outcome" | "Evidence distinction";
  title: string;
  text: string;
  status: "corroborated" | "source-linked" | "qualified";
  sourceKeys: string[];
};

export type ChildrenFoundSubject = {
  key: "dawson" | "cora" | "callan";
  name: string;
  summary: string;
  distinction: string;
  findings: ChildrenFoundFinding[];
};

const sources: ChildrenFoundSource[] = [
  { key: "dawson-field-state", segmentId: "4cf1beae-4407-53a0-a43e-639095e08a73", proceeding: "Day 3", witness: "Keith Nette", basis: "Responder testimony", label: "Initial EMT assessment", expectedText: "Blue, white, non-responsive, not breathing, no pulse" },
  { key: "dawson-field-treatment", segmentId: "8ff509fc-02f2-5ca2-ac96-57fd205fdbaa", proceeding: "Day 3", witness: "Keith Nette", basis: "Responder testimony", label: "Ambulance treatment", expectedText: "continued CPR" },
  { key: "dawson-transport-pulse", segmentId: "b170e5e7-27a3-5c70-a875-0796e414d245", proceeding: "Day 3", witness: "Keith Nette", basis: "Responder testimony", label: "No pulse during transport", expectedText: "No" },
  { key: "dawson-transport-breathing", segmentId: "a46c812f-f2af-517f-a397-1be9bd6db6ed", proceeding: "Day 3", witness: "Keith Nette", basis: "Responder testimony", label: "No spontaneous breathing during transport", expectedText: "No" },
  { key: "dawson-hospital-state", segmentId: "3a6ef73c-c8ed-5591-a96e-9d04c0619af1", proceeding: "Day 4", witness: "Dr. Mark Tenerowicz", basis: "Emergency physician testimony", label: "Condition on hospital arrival", expectedText: "CPR was in progress" },
  { key: "dawson-er-bruises", segmentId: "29701fb6-3d3f-5630-af26-63d56c037762", proceeding: "Day 4", witness: "Dr. Mark Tenerowicz", basis: "Emergency physician testimony", label: "ER facial vessels and leg bruises", expectedText: "old appearing bruises" },
  { key: "dawson-er-shin", segmentId: "319b6ae9-74a4-5450-a448-af699efe2015", proceeding: "Day 4", witness: "Dr. Mark Tenerowicz", basis: "Emergency physician testimony", label: "ER bruise location clarification", expectedText: "shin area" },
  { key: "dawson-no-rosc", segmentId: "1e158a73-5900-5e3f-a792-dae705bee90a", proceeding: "Day 4", witness: "Dr. Mark Tenerowicz", basis: "Emergency physician testimony", label: "No pulse or spontaneous breathing restored", expectedText: "not at any point" },
  { key: "dawson-pronounced", segmentId: "c90ce4f3-0c00-54bb-a521-1a9528bc37cb", proceeding: "Day 4", witness: "Dr. Mark Tenerowicz", basis: "Emergency physician testimony", label: "Pronouncement time", expectedText: "19:28" },
  { key: "dawson-autopsy-bruises", segmentId: "54037f2a-5ddd-5fb6-adf1-dff8c22ece24", proceeding: "Day 12", witness: "Dr. Barbara Olson", basis: "Medical examiner testimony", label: "Autopsy knee and leg findings", expectedText: "bruises" },
  { key: "dawson-autopsy-age", segmentId: "0cccf59a-cff5-5667-a887-9775802a20c2", proceeding: "Day 12", witness: "Dr. Barbara Olson", basis: "Medical examiner testimony", label: "Autopsy bruise-age description", expectedText: "more recent" },

  { key: "cora-scene-state", segmentId: "ece2fbc0-5b13-5047-ad72-bcee6dbbbb4a", proceeding: "Day 3", witness: "Patrick Dwyer", basis: "Responder testimony", label: "Scene appearance", expectedText: "pale, bluish" },
  { key: "cora-no-pulse", segmentId: "436544dc-3f44-54f8-a49f-faa4d8582904", proceeding: "Day 3", witness: "Patrick Dwyer", basis: "Responder testimony", label: "No pulse on assessment", expectedText: "No" },
  { key: "cora-no-breathing", segmentId: "7fc7b419-2028-5647-a354-b2fa2c7552a0", proceeding: "Day 3", witness: "Patrick Dwyer", basis: "Responder testimony", label: "Not breathing on assessment", expectedText: "No" },
  { key: "cora-facial-blood", segmentId: "f81dc218-d0d5-5212-a7c7-9b38a9783da6", proceeding: "Day 3", witness: "Brian Josephine", basis: "Responder testimony", label: "Dried blood and eye findings", expectedText: "dried blood around her mouth" },
  { key: "cora-wet-stain", segmentId: "6abb3ea9-1183-5cfc-a86b-c0865f4d28c7", proceeding: "Day 3", witness: "Brian Josephine", basis: "Responder testimony", label: "Large wet blood area", expectedText: "blood seeped through my pants" },
  { key: "cora-stain-exhibit", segmentId: "dad9507d-ab32-5162-a95e-267632f8dc03", proceeding: "Day 3", witness: "Brian Josephine", basis: "Responder testimony", label: "Exhibit 97 red-brown rug stain identification", expectedText: "Yes" },
  { key: "cora-field-care", segmentId: "561e8d13-045f-5da4-ab68-5fe0fe9f3ecd", proceeding: "Day 3", witness: "Brian Josephine", basis: "Responder testimony", label: "CPR and rescue breathing", expectedText: "bag valve mask" },
  { key: "cora-hospital-state", segmentId: "654563e2-ea3c-58a7-a899-7977bcb0790c", proceeding: "Day 5", witness: "Dr. Michael Snyder", basis: "Emergency physician testimony", label: "Hospital physical findings", expectedText: "small amount of blood coming from the nose" },
  { key: "cora-no-heartbeat", segmentId: "bab192d1-95d3-5d07-ae8c-d7e82a46eca4", proceeding: "Day 5", witness: "Dr. Michael Snyder", basis: "Emergency physician testimony", label: "No heartbeat on arrival", expectedText: "no heartbeat" },
  { key: "cora-unsuccessful", segmentId: "00c57cc2-c666-50cb-a983-8699d230da4f", proceeding: "Day 5", witness: "Dr. Michael Snyder", basis: "Emergency physician testimony", label: "Resuscitation unsuccessful", expectedText: "Correct" },
  { key: "cora-pronounced", segmentId: "678caed3-4686-5b89-adf4-c8bf2759b400", proceeding: "Day 5", witness: "Dr. Michael Snyder", basis: "Emergency physician testimony", label: "Pronounced at approximately 19:28", expectedText: "Yes" },
  { key: "cora-stain-dna", segmentId: "d7d060da-a895-5232-aa52-02b5c56c4df6", proceeding: "Day 7", witness: "Court stipulation", basis: "Court stipulation", label: "Red-brown stain A DNA comparison", expectedText: "Cora Clancy is included as a contributor" },

  { key: "callan-found", segmentId: "bd00578b-5d07-5bd4-a301-0fa679b9605f", proceeding: "Day 3", witness: "Jennifer Stratton", basis: "Responder testimony", label: "Basement location", expectedText: "Callan and Cora face up on the ground" },
  { key: "callan-stratton-pulse", segmentId: "bbac7e04-00d3-559d-a628-7feff43ef845", proceeding: "Day 3", witness: "Jennifer Stratton", basis: "Responder testimony", label: "Stratton pulse assessment and CPR", expectedText: "He did not have one" },
  { key: "callan-cahill-pulse", segmentId: "c047bf7d-d0ec-5a06-a129-39447411992f", proceeding: "Day 3", witness: "Vincent Cahill", basis: "Responder testimony", label: "Cahill pulse assessment", expectedText: "No" },
  { key: "callan-cpr", segmentId: "3d47d2c0-b362-5f55-a29a-c90398ebaed0", proceeding: "Day 3", witness: "Jennifer Stratton", basis: "Responder testimony", label: "Continued basement CPR", expectedText: "Continued CPR" },
  { key: "callan-oxygen", segmentId: "2aa9451e-fc30-53ab-aa93-1acc57574406", proceeding: "Day 3", witness: "Jennifer Stratton", basis: "Responder testimony", label: "Bag-mask oxygen", expectedText: "bag valve mask" },
  { key: "callan-home-state", segmentId: "bca1feec-1914-5ca7-a830-426414b26aee", proceeding: "Day 3", witness: "Jennifer Stratton", basis: "Responder testimony", label: "No pulse or breathing restored in the home", expectedText: "No, he did not" },
  { key: "callan-transport-state", segmentId: "fca69a91-c6cd-5eb5-a0ab-574b2302d05b", proceeding: "Day 3", witness: "Jennifer Stratton", basis: "Responder testimony", label: "No heartbeat or breathing restored during transport", expectedText: "No, he did not" },
  { key: "callan-hospital-arrest", segmentId: "daa84091-dac5-5093-aa03-85f0bdbba7fd", proceeding: "Day 4", witness: "Dr. Benjamin Kaufman", basis: "Emergency physician testimony", label: "Arrival in cardiac arrest", expectedText: "CPR was ongoing" },
  { key: "callan-rosc", segmentId: "28598280-a9fd-5d11-af24-f2710991a08c", proceeding: "Day 4", witness: "Dr. Benjamin Kaufman", basis: "Emergency physician testimony", label: "Cardiac activity restored", expectedText: "heart started beating" },
  { key: "callan-no-independent-breathing", segmentId: "7310dbf3-e44b-54e6-a707-93fa1c56b950", proceeding: "Day 4", witness: "Dr. Benjamin Kaufman", basis: "Emergency physician testimony", label: "No independent breathing at Beth Israel", expectedText: "No" },
  { key: "callan-transfer", segmentId: "6ef1b73c-ae48-56d3-aa6c-948e2cc57731", proceeding: "Day 4", witness: "Dr. Benjamin Kaufman", basis: "Emergency physician testimony", label: "Transfer to Boston Children’s", expectedText: "flown by helicopter" },
  { key: "callan-rare-breaths", segmentId: "068875df-0627-5e47-abd9-f7ed6f9c4762", proceeding: "Day 5", witness: "Dr. Andrew Capraro", basis: "Emergency physician testimony", label: "Ventilator dependence with rare triggered breaths", expectedText: "Occasionally" },
  { key: "callan-brain-injury", segmentId: "55c31e51-253d-5cfb-a65b-429c10148754", proceeding: "Day 5", witness: "Dr. David Casavant", basis: "ICU physician testimony", label: "Neurologic injury mechanism", expectedText: "lack of oxygen and blood flow" },
  { key: "callan-testing", segmentId: "829708a0-99cb-5935-a931-3eba2bd415c7", proceeding: "Day 5", witness: "Dr. David Casavant", basis: "ICU physician testimony", label: "Repeated neurologic testing protocol", expectedText: "repeated again 24 hours later" },
  { key: "callan-apnea", segmentId: "2cbc3154-5079-59cb-a769-81b2c1f38224", proceeding: "Day 5", witness: "Dr. David Casavant", basis: "ICU physician testimony", label: "Apnea-test results and repeat", expectedText: "repeated that piece of the test" },
  { key: "callan-neurologic-death", segmentId: "2b864d77-c525-5f73-a79f-cd7e27b86a84", proceeding: "Day 5", witness: "Dr. David Casavant", basis: "ICU physician testimony", label: "Death by neurologic criteria", expectedText: "death by neurologic criteria" },
  { key: "callan-support-ended", segmentId: "6854951e-4cd4-5020-a6e1-b8bc9e3d1f56", proceeding: "Day 5", witness: "Dr. David Casavant", basis: "ICU physician testimony", label: "Life support ended January 27", expectedText: "His heart is still beating" },
  { key: "callan-family-heart", segmentId: "78774c5b-ddda-5963-a0c7-6dd181e02434", proceeding: "Day 5", witness: "Dr. David Casavant", basis: "ICU physician testimony", label: "Family time, withdrawal, and cardiac cessation", expectedText: "exactly" },
];

export const childrenFoundSubjects: ChildrenFoundSubject[] = [
  {
    key: "dawson",
    name: "Dawson",
    summary: "Found without detectable pulse or breathing; resuscitation continued through transport and hospital care without return of cardiac activity.",
    distinction: "Dawson’s course remained a continuous unsuccessful resuscitation from the first documented responder assessment through his hospital pronouncement.",
    findings: [
      { key: "dawson-scene", phase: "Scene", title: "Initial responder condition", text: "Nette described Dawson as blue/white, unresponsive, not breathing, and without a pulse. CPR was underway when Nette joined the ambulance team.", status: "corroborated", sourceKeys: ["dawson-field-state", "dawson-field-treatment"] },
      { key: "dawson-transport", phase: "Response and transport", title: "CPR, airway support, and transport", text: "Responders continued CPR, attempted vascular access, administered epinephrine, and placed a breathing tube. Nette reported no pulse and no spontaneous breathing during transport to Beth Israel Deaconess Plymouth.", status: "corroborated", sourceKeys: ["dawson-field-treatment", "dawson-transport-pulse", "dawson-transport-breathing"] },
      { key: "dawson-hospital", phase: "Hospital", title: "No return of cardiac activity", text: "Tenerowicz testified that Dawson arrived with CPR in progress, a breathing tube in place, no spontaneous breathing, no pulse, and no response. Repeated checks and cardiac ultrasound showed no effective heartbeat.", status: "corroborated", sourceKeys: ["dawson-hospital-state", "dawson-no-rosc"] },
      { key: "dawson-injuries", phase: "Evidence distinction", title: "Facial-vessel and bruise descriptions stay source-specific", text: "The emergency physician recalled ruptured facial vessels and old-appearing leg bruises, later clarified to the shin area. The medical examiner separately documented knee and leg bruises and described the examined bruises as red/purple and more recent. These descriptions should not be silently merged into one age or location finding.", status: "qualified", sourceKeys: ["dawson-er-bruises", "dawson-er-shin", "dawson-autopsy-bruises", "dawson-autopsy-age"] },
      { key: "dawson-outcome", phase: "Outcome", title: "Pronounced deceased at approximately 19:28", text: "Hospital resuscitation did not restore cardiac activity. Tenerowicz testified that Dawson was pronounced deceased at approximately 7:28 PM on January 24.", status: "source-linked", sourceKeys: ["dawson-no-rosc", "dawson-pronounced"] },
    ],
  },
  {
    key: "cora",
    name: "Cora",
    summary: "Found without a pulse or breathing; uniquely associated in the reviewed scene record with an obvious wet red-brown blood deposit later linked to her by DNA evidence.",
    distinction: "Within the currently reviewed source set, Cora alone is associated with an obvious wet scene blood deposit. That comparison is bounded to the reviewed evidence and is not proof that no unrecorded blood existed elsewhere.",
    findings: [
      { key: "cora-scene", phase: "Scene", title: "Initial responder condition", text: "Dwyer described Cora as pale/bluish, without a pulse, and not breathing. Josephine described bloodshot eyes or popped vessels and dried blood around her mouth.", status: "corroborated", sourceKeys: ["cora-scene-state", "cora-no-pulse", "cora-no-breathing", "cora-facial-blood"] },
      { key: "cora-stain", phase: "Evidence distinction", title: "Wet red-brown stain at the scene", text: "Josephine described a relatively large area of blood that soaked through his pants during CPR and identified the red-brown rug stain shown in Exhibit 97 as the area he meant.", status: "corroborated", sourceKeys: ["cora-wet-stain", "cora-stain-exhibit"] },
      { key: "cora-dna", phase: "Evidence distinction", title: "DNA attribution", text: "A later court stipulation stated that the red-brown stain A from the basement floor produced a single-contributor DNA profile and included Cora as the contributor.", status: "source-linked", sourceKeys: ["cora-stain-dna"] },
      { key: "cora-field-care", phase: "Response and transport", title: "CPR and ventilation", text: "Josephine continued chest compressions while Cahill used a bag-valve mask for rescue breaths before Cora was removed from the basement.", status: "corroborated", sourceKeys: ["cora-field-care"] },
      { key: "cora-hospital", phase: "Hospital", title: "Cardiac arrest and documented physical findings", text: "Snyder testified that Cora had no heartbeat and was not breathing independently. He described cyanosis, neck bruising, petechial changes around the eyes, and a small amount of blood coming from her nose.", status: "corroborated", sourceKeys: ["cora-hospital-state", "cora-no-heartbeat"] },
      { key: "cora-outcome", phase: "Outcome", title: "Pronounced deceased at approximately 19:28", text: "Resuscitative efforts remained unsuccessful, and Snyder testified that Cora was pronounced deceased at approximately 7:28 PM on January 24.", status: "source-linked", sourceKeys: ["cora-unsuccessful", "cora-pronounced"] },
    ],
  },
  {
    key: "callan",
    name: "Callan",
    summary: "Found without a detectable pulse; cardiac activity was later restored, but he remained ventilator-dependent and ultimately met death-by-neurologic-criteria standards.",
    distinction: "Callan’s restored heartbeat must not be equated with restored independent breathing, consciousness, or neurologic recovery. His cardiac and neurologic courses require separate timeline states.",
    findings: [
      { key: "callan-scene", phase: "Scene", title: "Two responders found no detectable pulse", text: "Stratton found Callan face-up in the basement, checked for a pulse, found none, and began compressions. Cahill separately testified that he also checked Callan and found no pulse.", status: "corroborated", sourceKeys: ["callan-found", "callan-stratton-pulse", "callan-cahill-pulse"] },
      { key: "callan-field-care", phase: "Response and transport", title: "Continuous CPR and assisted ventilation", text: "CPR continued in the basement, with bag-mask oxygen added. Stratton reported no restored pulse or breathing in the home and no restored heartbeat or breathing during transport.", status: "corroborated", sourceKeys: ["callan-cpr", "callan-oxygen", "callan-home-state", "callan-transport-state"] },
      { key: "callan-rosc", phase: "Hospital", title: "Cardiac activity restored after arrival", text: "Kaufman testified that Callan arrived in cardiac arrest with CPR ongoing. After intubation, IV access, and epinephrine, his heart began beating; he did not regain the ability to breathe independently during Kaufman’s care.", status: "corroborated", sourceKeys: ["callan-hospital-arrest", "callan-rosc", "callan-no-independent-breathing"] },
      { key: "callan-transfer", phase: "Hospital", title: "Transferred to Boston Children’s while ventilator-dependent", text: "Callan was transferred by helicopter. At Boston Children’s, Capraro observed occasional rare breaths that triggered the ventilator, but testified that the ventilator performed the vast majority of breathing and was required to maintain ventilation.", status: "qualified", sourceKeys: ["callan-transfer", "callan-rare-breaths"] },
      { key: "callan-neurology", phase: "Hospital", title: "Profound neurologic injury and repeated testing", text: "Casavant attributed the brain injury to lack of oxygen and blood flow. Neurologic and apnea testing was performed under a strict protocol and repeated after at least 24 hours before death by neurologic criteria was determined.", status: "corroborated", sourceKeys: ["callan-brain-injury", "callan-testing", "callan-apnea", "callan-neurologic-death"] },
      { key: "callan-outcome", phase: "Outcome", title: "Life support ended January 27", text: "After Callan met death-by-neurologic-criteria standards, his heart continued beating with support. Casavant testified that the family was given time, support was later ended on January 27, and Callan’s heart then stopped.", status: "source-linked", sourceKeys: ["callan-neurologic-death", "callan-support-ended", "callan-family-heart"] },
    ],
  },
];

export const heldChildrenFoundDetails = [
  {
    key: "cora-stain-measurement",
    detail: "Exact 11-inch measurement for the Cora-associated rug stain",
    reason: "The uploaded lab-notes image includes a measurement scale and handwritten dimensional notation, but this copy does not securely establish an 11-inch finding. Confirm the number against the original exhibit or a clearer scan before promotion.",
  },
  {
    key: "cora-hand-blood",
    detail: "Blood specifically on Cora’s hands",
    reason: "Current hospital testimony describes cyanosis of the hands, not blood on the hands. Keep these propositions separate until an exact source is recovered.",
  },
];

export const childrenFoundSupportingImages = [
  {
    key: "basement-room-context",
    src: "/evidence/children-found/basement-room-context.png",
    width: 1170,
    height: 898,
    title: "Basement room context",
    description: "User-supplied image showing the room and visible red staining on the light-colored carpet.",
    boundary: "Corroborating copy with a social-media watermark; not treated as the native exhibit file.",
  },
  {
    key: "stain-a-lab-notes",
    src: "/evidence/children-found/stain-a-lab-examination-notes.png",
    width: 607,
    height: 757,
    title: "Stain A laboratory examination notes",
    description: "User-supplied image of a Massachusetts State Police Crime Laboratory examination-notes page showing Stain A, close views, and a measurement scale.",
    boundary: "Supports the stain’s documented examination. Exact handwritten dimensions remain held pending the original or a clearer scan.",
  },
];

export function childrenFoundSourceSegmentIds() {
  return sources.map((source) => source.segmentId);
}

export function childrenFoundSourceRequirements() {
  return sources.map((source) => ({ segmentId: source.segmentId, expectedText: source.expectedText, key: source.key }));
}

export function buildChildrenFoundReport(segments: ChildrenFoundSourceSegment[]) {
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const missingSourceKeys = sources.flatMap((source) => {
    const segment = segmentById.get(source.segmentId);
    return segment?.exact_text.includes(source.expectedText) ? [] : [source.key];
  });

  return {
    available: missingSourceKeys.length === 0,
    missingSourceKeys,
    sources: sources.map((source) => ({
      key: source.key,
      segmentId: source.segmentId,
      proceeding: source.proceeding,
      witness: source.witness,
      basis: source.basis,
      label: source.label,
    })),
    subjects: childrenFoundSubjects,
    supportingImages: childrenFoundSupportingImages,
    heldDetails: heldChildrenFoundDetails,
  };
}
