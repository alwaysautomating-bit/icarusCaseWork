import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import { compileTestimonyReconstruction, type ReconstructionDefinition } from "@/lib/testimony-reconstruction";
import { compileTestimonyTimelineCandidates, type ReviewedTimelineUnit } from "@/lib/testimony-timeline-compiler";

const witnesses = {
  hall: { importedId: "witness_001", label: "Officer Stephen Hall", start: 19, end: 326 },
  josephine: { importedId: "witness_002", label: "Officer Brian Josephine", start: 327, end: 541 },
  hussey: { importedId: "witness_003", label: "PJ Hussey", start: 542, end: 707 },
  nudd: { importedId: "witness_004", label: "Loring Nudd", start: 708, end: 899 },
  nette: { importedId: "witness_005", label: "Keith Nette", start: 900, end: 1038 },
  dwyer: { importedId: "witness_006", label: "Patrick Dwyer", start: 1039, end: 1229 },
} as const;

type WitnessKey = keyof typeof witnesses;

function findOne(transcript: ParsedRevTranscript, witnessKey: WitnessKey, contains: string) {
  const witness = witnesses[witnessKey];
  const matches = transcript.segments.slice(witness.start, witness.end + 1).filter((segment) => segment.text.includes(contains));
  if (matches.length !== 1) throw new Error(`${witness.label}: expected one segment containing “${contains}”; found ${matches.length}.`);
  return matches[0];
}

function reviewedUnit(input: {
  transcript: ParsedRevTranscript;
  witnessKey: WitnessKey;
  key: string;
  contains: string;
  sourceWording: string;
  temporalWording: string;
  summary: string;
  normalizedAssertion: string;
  eventClass: string;
  participants: string[];
  unknowns?: string[];
  assertionStatus?: "asserted" | "qualified" | "corrected";
}) : ReviewedTimelineUnit {
  const witness = witnesses[input.witnessKey];
  const segment = findOne(input.transcript, input.witnessKey, input.contains);
  return {
    key: input.key,
    witnessBlockImportedId: witness.importedId,
    unitKind: "qa_thread",
    sourceSegmentIds: [segment.id],
    summary: input.summary,
    unknowns: input.unknowns ?? [],
    claim: {
      key: `${input.key}-claim`,
      assertedByRaw: witness.label,
      speakerCapacity: "witness",
      normalizedAssertion: input.normalizedAssertion,
      assertionStatus: input.assertionStatus ?? "asserted",
      informationBasis: "PERSONALLY_OBSERVED",
      sourceSegmentIds: [segment.id],
      extractionConfidence: 1,
    },
    entityMentions: [],
    events: [{
      key: input.key,
      neutralDescription: input.normalizedAssertion,
      eventClass: input.eventClass,
      sourceClaimKey: `${input.key}-claim`,
      sourceWording: input.sourceWording,
      sourceSegmentIds: [segment.id],
      temporalWording: input.temporalWording,
      temporalSourceSegmentIds: [segment.id],
      participantMentions: input.participants,
      extractionConfidence: 1,
    }],
  };
}

export function day3ResponderTimelineFixture(transcript: ParsedRevTranscript): ReviewedTimelineUnit[] {
  const unit = (input: Omit<Parameters<typeof reviewedUnit>[0], "transcript">) => reviewedUnit({ ...input, transcript });
  return [
    unit({ witnessKey: "hall", key: "hall-travel-duration", contains: "Seven to 10 minutes.", sourceWording: "Seven to 10 minutes.", temporalWording: "Seven to 10 minutes.", summary: "Hall estimated a seven-to-ten-minute response from Lincoln Street Fields.", normalizedAssertion: "Stephen Hall estimated that his response to 47 Summer Street took seven to ten minutes.", eventClass: "emergency_response_travel", participants: ["Stephen Hall", "47 Summer Street"], unknowns: ["No departure or arrival clock time is stated in this answer."], assertionStatus: "qualified" }),
    unit({ witnessKey: "hall", key: "hall-police-arrival", contains: "I arrived simultaneously with Officer Josephine.", sourceWording: "I arrived simultaneously with Officer Josephine.", temporalWording: "simultaneously with Officer Josephine", summary: "Hall placed his arrival at the same time as Josephine's.", normalizedAssertion: "Stephen Hall arrived at 47 Summer Street simultaneously with Brian Josephine.", eventClass: "arrival", participants: ["Stephen Hall", "Brian Josephine", "47 Summer Street"] }),
    unit({ witnessKey: "hall", key: "hall-lindsay-injuries", contains: "cuts to both wrists and to the left side of her neck", sourceWording: "She had cuts to both wrists and to the left side of her neck.", temporalWording: "She had cuts to both wrists and to the left side of her neck.", summary: "Hall described Lindsay's visible injuries in the backyard.", normalizedAssertion: "Hall observed cuts to both of Lindsay Clancy's wrists and the left side of her neck.", eventClass: "medical_observation", participants: ["Stephen Hall", "Lindsay Clancy"], unknowns: ["The incident clock time of the observation is not stated."] }),
    unit({ witnessKey: "hall", key: "hall-patrick-enters", contains: "he went inside to say he was going to check on his children", sourceWording: "At one point, he went inside to say he was going to check on his children.", temporalWording: "At one point", summary: "Hall recalled Patrick going inside to check the children.", normalizedAssertion: "Patrick Clancy went inside the house to check on the children.", eventClass: "movement", participants: ["Patrick Clancy", "the children", "47 Summer Street"] }),
    unit({ witnessKey: "hall", key: "hall-scream", contains: "I heard a loud scream from inside.", sourceWording: "I heard a loud scream from inside.", temporalWording: "I heard a loud scream from inside.", summary: "Hall heard a scream from inside after Patrick entered.", normalizedAssertion: "Stephen Hall heard a loud scream from inside the house.", eventClass: "auditory_observation", participants: ["Stephen Hall", "unidentified screamer"] }),
    unit({ witnessKey: "hall", key: "hall-return-left", contains: "We ran back down into the basement to check to see if we could find other children.", sourceWording: "We ran back down into the basement to check to see if we could find other children.", temporalWording: "back down into the basement", summary: "Hall returned to the basement to look for the other children.", normalizedAssertion: "Hall and Josephine returned to the basement to look for other children.", eventClass: "search", participants: ["Stephen Hall", "Brian Josephine", "the children"] }),

    unit({ witnessKey: "josephine", key: "josephine-travel-duration", contains: "anywhere from three to four minutes", sourceWording: "I would say anywhere from three to four minutes.", temporalWording: "anywhere from three to four minutes", summary: "Josephine estimated a three-to-four-minute response.", normalizedAssertion: "Brian Josephine estimated that his response to 47 Summer Street took three to four minutes.", eventClass: "emergency_response_travel", participants: ["Brian Josephine", "47 Summer Street"], assertionStatus: "qualified" }),
    unit({ witnessKey: "josephine", key: "josephine-lindsay-injuries", contains: "cuts to her right wrist, I believe", sourceWording: "There was cuts to her right wrist, I believe, and to the right side of her neck.", temporalWording: "There was cuts to her right wrist, I believe, and to the right side of her neck.", summary: "Josephine described Lindsay's visible injuries with a qualification.", normalizedAssertion: "Josephine observed cuts to Lindsay Clancy's right wrist and the right side of her neck.", eventClass: "medical_observation", participants: ["Brian Josephine", "Lindsay Clancy"], assertionStatus: "qualified" }),
    unit({ witnessKey: "josephine", key: "josephine-screams", contains: "we just started hearing loud screams", sourceWording: "Myself and Officer Hall were standing by that window and we just started hearing loud screams.", temporalWording: "started hearing loud screams", summary: "Josephine and Hall began hearing screams while standing by the window.", normalizedAssertion: "Josephine and Hall heard loud screams while standing by the basement window.", eventClass: "auditory_observation", participants: ["Brian Josephine", "Stephen Hall", "unidentified screamer"] }),
    unit({ witnessKey: "josephine", key: "josephine-patrick-statement", contains: "She killed the fucking kids", sourceWording: "She killed the fucking kids.", temporalWording: "at that point", summary: "Josephine attributed a statement to Patrick during the basement encounter.", normalizedAssertion: "Josephine heard Patrick Clancy scream that she had killed the children.", eventClass: "reported_statement", participants: ["Brian Josephine", "Patrick Clancy", "the children"] }),
    unit({ witnessKey: "josephine", key: "josephine-dawson-removal", contains: "I rushed over with Dawson and I put him on the stretcher", sourceWording: "I rushed over with Dawson and I put him on the stretcher", temporalWording: "The ambulance was backing up and had pretty much just parked", summary: "Josephine carried Dawson to the arriving ambulance and put him on the stretcher.", normalizedAssertion: "Brian Josephine carried Dawson to the ambulance and placed him on the stretcher as it finished parking.", eventClass: "patient_removal", participants: ["Brian Josephine", "Dawson Clancy", "Sergeant Homestead", "fire personnel"] }),
    unit({ witnessKey: "josephine", key: "josephine-callan-first", contains: "the baby was brought out first", sourceWording: "I think the baby was brought out first", temporalWording: "eventually. I think the baby was brought out first", summary: "Josephine qualified his recollection that Callan was removed before Cora.", normalizedAssertion: "Josephine believed Callan was removed from the left basement before Cora.", eventClass: "patient_removal", participants: ["Brian Josephine", "Callan Clancy", "Cora Clancy"], assertionStatus: "qualified" }),

    unit({ witnessKey: "hussey", key: "hussey-fire-arrival", contains: "police cruisers that were there already", sourceWording: "There was a couple police cruisers that were there already, just had just beat us in.", temporalWording: "were there already, just had just beat us in", summary: "Hussey placed police arrival immediately before fire personnel.", normalizedAssertion: "Police cruisers arrived shortly before the Duxbury fire response.", eventClass: "arrival", participants: ["Duxbury Police", "Duxbury Fire Department"] }),
    unit({ witnessKey: "hussey", key: "hussey-unwrapping", contains: "unwrapping something from a child's head", sourceWording: "After I heard the scream, I saw a male, older male gentleman now knowing it was Patrick Clancy unwrapping something from a child's head.", temporalWording: "After I heard the scream", summary: "Hussey saw Patrick unwrapping something from Dawson after the scream.", normalizedAssertion: "After hearing the scream, Hussey saw Patrick Clancy unwrapping something from Dawson's head.", eventClass: "visual_observation", participants: ["PJ Hussey", "Patrick Clancy", "Dawson Clancy"] }),
    unit({ witnessKey: "hussey", key: "hussey-mutual-aid", contains: "requested a Mutual Aid ambulance", sourceWording: "I also requested a Mutual Aid ambulance to respond to the scene.", temporalWording: "now we have another patient", summary: "Hussey requested mutual aid after recognizing another patient.", normalizedAssertion: "Hussey requested a mutual-aid ambulance after recognizing a second patient.", eventClass: "resource_request", participants: ["PJ Hussey", "mutual-aid ambulance"] }),
    unit({ witnessKey: "hussey", key: "hussey-parallel-care", contains: "we left a paramedic with Ms. Clancy", sourceWording: "we left a paramedic with Ms. Clancy, a paramedic with Dawson, and then two paramedics were with the two other kids in the other room", temporalWording: "when we found the other patients", summary: "Hussey described the parallel allocation of four paramedics.", normalizedAssertion: "Responders split into parallel care lanes for Lindsay, Dawson, Cora, and Callan.", eventClass: "parallel_medical_response", participants: ["Lindsay Clancy", "Dawson Clancy", "Cora Clancy", "Callan Clancy", "Duxbury paramedics"] }),

    unit({ witnessKey: "nudd", key: "nudd-travel-duration", contains: "I'm going to say four to five minutes.", sourceWording: "I'm going to say four to five minutes.", temporalWording: "four to five minutes", summary: "Nudd estimated a four-to-five-minute ambulance response.", normalizedAssertion: "Loring Nudd estimated that the ambulance response took four to five minutes.", eventClass: "emergency_response_travel", participants: ["Loring Nudd", "Duxbury Ambulance 1"], assertionStatus: "qualified" }),
    unit({ witnessKey: "nudd", key: "nudd-carrier-identity", contains: "Correct. It was Officer Homestead.", sourceWording: "Correct. It was Officer Homestead.", temporalWording: "Correct. It was Officer Homestead.", summary: "Nudd identified the officer carrying the child as Officer Homestead.", normalizedAssertion: "Nudd identified Officer Homestead as the officer who carried Dawson to the ambulance.", eventClass: "witness_identification", participants: ["Loring Nudd", "Officer Homestead", "Dawson Clancy"] }),
    unit({ witnessKey: "nudd", key: "nudd-dawson-cpr", contains: "So we were doing CPR", sourceWording: "So we were doing CPR and then he wanted to check the monitor", temporalWording: "then he wanted to check the monitor", summary: "Nudd described CPR followed by use of the monitor in the ambulance.", normalizedAssertion: "Responders performed CPR on Dawson in the ambulance before checking the monitor.", eventClass: "medical_treatment", participants: ["Loring Nudd", "Dawson Clancy", "ambulance crew"] }),

    unit({ witnessKey: "nette", key: "nette-arrives-during-cpr", contains: "Sergeant Homestead and Kevin Heath doing CPR on a child", sourceWording: "I saw an officer, Sergeant Homestead and Kevin Heath doing CPR on a child.", temporalWording: "I saw an officer, Sergeant Homestead and Kevin Heath doing CPR on a child.", summary: "Nette arrived after CPR on Dawson was already underway.", normalizedAssertion: "On arrival, Nette observed Sergeant Homestead and Kevin Heath already performing CPR on Dawson.", eventClass: "arrival_observation", participants: ["Keith Nette", "Sergeant Homestead", "Kevin Heath", "Dawson Clancy"] }),
    unit({ witnessKey: "nette", key: "nette-advanced-care", contains: "We tried to start an IV.", sourceWording: "We tried to start an IV. Then we also started an IO, which is kind of like an IV. Tried intubation, which is an advanced airway, medications and continued CPR.", temporalWording: "Then we also started an IO", summary: "Nette described IV/IO access, attempted intubation, medication, and continued CPR.", normalizedAssertion: "Nette and the ambulance team attempted vascular access and intubation, administered medication, and continued CPR on Dawson.", eventClass: "medical_treatment", participants: ["Keith Nette", "Kevin Heath", "Dawson Clancy"] }),

    unit({ witnessKey: "dwyer", key: "dwyer-travel-duration", contains: "A few minutes.", sourceWording: "A few minutes.", temporalWording: "A few minutes.", summary: "Dwyer described his travel time only as a few minutes.", normalizedAssertion: "Patrick Dwyer estimated that his response from Station 2 took a few minutes.", eventClass: "emergency_response_travel", participants: ["Patrick Dwyer", "Duxbury Engine 2"], assertionStatus: "qualified" }),
    unit({ witnessKey: "dwyer", key: "dwyer-left-basement-discovery", contains: "We saw two children on the ground", sourceWording: "We saw two children on the ground and the father sitting on the couch next to them.", temporalWording: "We saw two children on the ground", summary: "Dwyer found two children and Patrick in the left basement.", normalizedAssertion: "Dwyer observed Cora and Callan on the floor and Patrick seated nearby in the left basement.", eventClass: "victim_discovery", participants: ["Patrick Dwyer", "Cora Clancy", "Callan Clancy", "Patrick Clancy"] }),
    unit({ witnessKey: "dwyer", key: "dwyer-cora-cpr", contains: "We started CPR in cardiac arrest.", sourceWording: "We started CPR in cardiac arrest.", temporalWording: "We started CPR", summary: "Dwyer began CPR on Cora in the basement.", normalizedAssertion: "Dwyer and other responders began CPR on Cora in the left basement.", eventClass: "medical_treatment", participants: ["Patrick Dwyer", "Cora Clancy", "other responders"] }),
    unit({ witnessKey: "dwyer", key: "dwyer-cora-extraction", contains: "backboard up the bulkhead stairs", sourceWording: "We took her out of the basement on a backboard up the bulkhead stairs.", temporalWording: "out of the basement on a backboard", summary: "Cora was removed after more responders arrived.", normalizedAssertion: "Responders removed Cora from the basement on a backboard through the bulkhead stairs.", eventClass: "patient_removal", participants: ["Patrick Dwyer", "Cora Clancy", "Marshfield responders"] }),
  ];
}

export const day3ResponderReconstructionDefinition: ReconstructionDefinition = {
  title: "First-responder testimony reconstruction",
  description: "A candidate incident sequence assembled from six Day 3 witness accounts. Grouping and order are proposed analytical structure, not canonical fact.",
  lanes: [
    { key: "dispatch-arrival", label: "Dispatch & arrival" },
    { key: "backyard", label: "Backyard response" },
    { key: "right-basement", label: "Right basement / Dawson" },
    { key: "left-basement", label: "Left basement / Cora & Callan" },
    { key: "medical", label: "Parallel care & transport" },
  ],
  nodes: [
    { key: "response-travel", title: "Responder travel estimates", summary: "Witnesses supplied several approximate response durations that should not be forced into one exact arrival clock.", laneKey: "dispatch-arrival", temporalLabel: "After dispatch; duration estimates differ", assertionRefs: ["hall-travel-duration", "josephine-travel-duration", "nudd-travel-duration", "dwyer-travel-duration"] },
    { key: "police-fire-arrival", title: "Police arrive before fire", summary: "Hall places his arrival with Josephine; Hussey places police just ahead of fire.", laneKey: "dispatch-arrival", temporalLabel: "Early scene interval", assertionRefs: ["hall-police-arrival", "hussey-fire-arrival"] },
    { key: "lindsay-assessment", title: "Lindsay assessed in backyard", summary: "Hall and Josephine separately describe Lindsay's visible injuries, with unresolved differences in laterality and extent.", laneKey: "backyard", temporalLabel: "After police arrival", assertionRefs: ["hall-lindsay-injuries", "josephine-lindsay-injuries"] },
    { key: "patrick-enters-scream", title: "Patrick enters; screams heard", summary: "Hall places Patrick entering before the scream; Hall and Josephine independently describe hearing screams.", laneKey: "backyard", temporalLabel: "Sequence-only", assertionRefs: ["hall-patrick-enters", "hall-scream", "josephine-screams"] },
    { key: "dawson-right-basement", title: "Dawson encounter in right basement", summary: "Hussey's outside-window observation and Josephine's attributed statement sit within the same proposed basement episode.", laneKey: "right-basement", temporalLabel: "After scream", assertionRefs: ["hussey-unwrapping", "josephine-patrick-statement"] },
    { key: "dawson-to-ambulance", title: "Dawson removed to Ambulance 1", summary: "Josephine describes carrying Dawson; Nudd identifies the carrier differently. The grouping remains proposed and the identity tension remains open.", laneKey: "right-basement", temporalLabel: "Ambulance backing / just parked", assertionRefs: ["josephine-dawson-removal", "nudd-carrier-identity"] },
    { key: "left-basement-discovery", title: "Other children located in left basement", summary: "Hall returns to search; Dwyer describes observing Cora and Callan with Patrick nearby.", laneKey: "left-basement", temporalLabel: "After Dawson removal begins", assertionRefs: ["hall-return-left", "dwyer-left-basement-discovery"] },
    { key: "parallel-resuscitation", title: "Parallel pediatric resuscitation", summary: "Dawson CPR was underway as care expanded to Cora and Callan; Hussey describes the split of personnel.", laneKey: "medical", temporalLabel: "Overlapping interval", assertionRefs: ["nudd-dawson-cpr", "nette-arrives-during-cpr", "dwyer-cora-cpr", "hussey-parallel-care"] },
    { key: "resource-escalation", title: "Mutual aid requested", summary: "Hussey requested another ambulance after recognizing the additional patient load.", laneKey: "medical", temporalLabel: "After second patient recognized", assertionRefs: ["hussey-mutual-aid"] },
    { key: "advanced-care-removal", title: "Advanced care and child removals continue", summary: "Nette describes advanced airway care; Josephine and Dwyer describe later child removals.", laneKey: "medical", temporalLabel: "Later overlapping interval", assertionRefs: ["nette-advanced-care", "josephine-callan-first", "dwyer-cora-extraction"] },
  ],
  edges: [
    { from: "response-travel", to: "police-fire-arrival", relation: "before", basisAssertionRefs: ["hall-travel-duration", "hall-police-arrival"], rationale: "Travel precedes the witnesses' stated arrivals.", confidenceBasis: "cross-witness sequence" },
    { from: "police-fire-arrival", to: "lindsay-assessment", relation: "before", basisAssertionRefs: ["hussey-fire-arrival", "hall-lindsay-injuries"], rationale: "The backyard assessment follows initial arrival.", confidenceBasis: "witness sequence" },
    { from: "lindsay-assessment", to: "patrick-enters-scream", relation: "overlaps", basisAssertionRefs: ["hall-patrick-enters", "josephine-screams"], rationale: "Outside treatment continued while Patrick entered and the scream was heard.", confidenceBasis: "parallel witness lanes" },
    { from: "patrick-enters-scream", to: "dawson-right-basement", relation: "before", basisAssertionRefs: ["hall-scream", "hussey-unwrapping"], rationale: "Hussey explicitly places his observation after the scream.", confidenceBasis: "explicit relative wording" },
    { from: "dawson-right-basement", to: "dawson-to-ambulance", relation: "before", basisAssertionRefs: ["josephine-patrick-statement", "josephine-dawson-removal"], rationale: "The right-basement encounter precedes removal to the ambulance.", confidenceBasis: "same-witness sequence" },
    { from: "dawson-to-ambulance", to: "left-basement-discovery", relation: "overlaps", basisAssertionRefs: ["josephine-dawson-removal", "hall-return-left"], rationale: "The accounts place the return/search immediately around Dawson's transfer to the ambulance.", confidenceBasis: "cross-witness synchronization anchor" },
    { from: "left-basement-discovery", to: "parallel-resuscitation", relation: "before", basisAssertionRefs: ["dwyer-left-basement-discovery", "dwyer-cora-cpr"], rationale: "Discovery precedes CPR on the left-side children.", confidenceBasis: "same-witness sequence" },
    { from: "parallel-resuscitation", to: "resource-escalation", relation: "overlaps", basisAssertionRefs: ["hussey-parallel-care", "hussey-mutual-aid"], rationale: "Resource escalation occurred while simultaneous care was being organized.", confidenceBasis: "incident-command testimony" },
    { from: "parallel-resuscitation", to: "advanced-care-removal", relation: "overlaps", basisAssertionRefs: ["nette-arrives-during-cpr", "nette-advanced-care", "dwyer-cora-extraction"], rationale: "Advanced care and removals continued during the resuscitation interval.", confidenceBasis: "multi-witness sequence" },
  ],
  tensions: [
    { key: "response-duration", title: "Response duration estimates differ", field: "response_duration", assertionRefs: ["hall-travel-duration", "josephine-travel-duration", "nudd-travel-duration", "dwyer-travel-duration"], note: "The estimates are witness recollections from different origins and cannot be converted into one exact arrival time without an external dispatch clock." },
    { key: "lindsay-injury-description", title: "Lindsay injury laterality differs", field: "observed_injuries", assertionRefs: ["hall-lindsay-injuries", "josephine-lindsay-injuries"], note: "Hall described both wrists and the left neck; Josephine described the right wrist and right neck with an express qualification." },
    { key: "dawson-carrier", title: "Carrier identification differs", field: "actor_identity", assertionRefs: ["josephine-dawson-removal", "nudd-carrier-identity"], note: "Josephine described carrying Dawson; Nudd identified Officer Homestead. The system must preserve both attributed observations pending review." },
    { key: "right-basement-state", title: "Right-basement observations require ordering review", field: "observed_state", assertionRefs: ["hussey-unwrapping", "josephine-patrick-statement"], note: "Hussey observed unwrapping through the window, while Josephine described Patrick moving toward officers. Treating them as one instant would erase a potentially important sequence distinction." },
  ],
};

export function buildDay3ResponderReconstruction(transcript: ParsedRevTranscript, identity: { caseId: string; proceedingId: string; sourceArtifactId: string }, generatedAt?: string) {
  const reviewedUnits = day3ResponderTimelineFixture(transcript);
  const timeline = compileTestimonyTimelineCandidates({ ...identity, transcript, reviewedUnits });
  const eventRefs = reviewedUnits.flatMap((unit) => unit.events.map((event) => event.key));
  if (eventRefs.length !== timeline.event_candidates.length) throw new Error("Day 3 event-reference mapping is incomplete.");
  const eventCandidateIdByRef = new Map(eventRefs.map((ref, index) => [ref, String(timeline.event_candidates[index].id)]));
  const reconstruction = compileTestimonyReconstruction({ timeline, eventCandidateIdByRef, definition: day3ResponderReconstructionDefinition, generatedAt });
  return { reviewedUnits, timeline, reconstruction, eventCandidateIdByRef };
}

export const DAY3_RESPONDER_WITNESSES = witnesses;
