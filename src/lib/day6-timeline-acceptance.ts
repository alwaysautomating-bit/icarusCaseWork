import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import {
  compileTestimonyTimelineCandidates,
  type ReviewedTimelineUnit,
} from "@/lib/testimony-timeline-compiler";

export const DAY6_TIMELINE_WITNESS = {
  importedId: "witness_003",
  witnessLabel: "Maureen Hartnett",
  startOrdinal: 609,
  endOrdinal: 1096,
  segmentCount: 488,
} as const;

function ids(transcript: ParsedRevTranscript, ...ordinals: number[]) {
  return ordinals.map((ordinal) => {
    const segment = transcript.segments[ordinal];
    if (!segment || segment.ordinal !== ordinal) throw new Error(`Missing Day 6 source segment ordinal ${ordinal}.`);
    return segment.id;
  });
}

function mention(key: string, rawMention: string, mentionType: string, sourceSegmentIds: string[]) {
  return { key, rawMention, mentionType, sourceSegmentIds };
}

export function day6TimelineAcceptanceFixture(transcript: ParsedRevTranscript): ReviewedTimelineUnit[] {
  const block = transcript.segments.slice(DAY6_TIMELINE_WITNESS.startOrdinal, DAY6_TIMELINE_WITNESS.endOrdinal + 1);
  if (block.length !== DAY6_TIMELINE_WITNESS.segmentCount || !block.every((segment) =>
    segment.ordinal >= DAY6_TIMELINE_WITNESS.startOrdinal && segment.ordinal <= DAY6_TIMELINE_WITNESS.endOrdinal)) {
    throw new Error("Day 6 Hartnett acceptance block is incomplete.");
  }

  const reviewedUnits: ReviewedTimelineUnit[] = [
    {
      key: "hartnett-training-duration", witnessBlockImportedId: "witness_003", unitKind: "substantive_thread",
      sourceSegmentIds: ids(transcript, 630, 631),
      summary: "Maureen Hartnett described her education and approximately nine months of crime-laboratory training.",
      unknowns: [],
      claim: { key: "training-duration", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Maureen Hartnett received approximately nine months of training in the crime laboratory.", assertionStatus: "qualified", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 631), extractionConfidence: 1 },
      entityMentions: [mention("crime-lab", "the crime laboratory", "organization", ids(transcript, 631))],
      events: [{ key: "training", neutralDescription: "Maureen Hartnett received training in the crime laboratory.", eventClass: "training", sourceClaimKey: "training-duration", sourceWording: "I received approximately nine months of training in the crime laboratory as well.", sourceSegmentIds: ids(transcript, 631), temporalWording: "approximately nine months", temporalSourceSegmentIds: ids(transcript, 631), participantMentions: ["Maureen Hartnett", "the crime laboratory"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-recurring-proficiency", witnessBlockImportedId: "witness_003", unitKind: "substantive_thread",
      sourceSegmentIds: ids(transcript, 632, 633),
      summary: "Maureen Hartnett testified that she takes multiple proficiency tests yearly.", unknowns: [],
      claim: { key: "yearly-tests", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Maureen Hartnett takes multiple proficiency tests yearly.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 633), extractionConfidence: 1 },
      entityMentions: [],
      events: [{ key: "proficiency-tests", neutralDescription: "Maureen Hartnett takes multiple proficiency tests.", eventClass: "recurring_proficiency_test", sourceClaimKey: "yearly-tests", sourceWording: "Yearly, I also take multiple proficiency tests", sourceSegmentIds: ids(transcript, 633), temporalWording: "Yearly", temporalSourceSegmentIds: ids(transcript, 633), participantMentions: ["Maureen Hartnett"], recurrencePattern: { frequency: "yearly", sourceWording: "Yearly" }, extractionConfidence: 1 }],
    },
    {
      key: "hartnett-january-24-hospital", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665),
      summary: "On January 24, 2023, Hartnett responded to South Shore Hospital, observed Lindsay Clancy, and collected hand samples.", unknowns: ["The exact clock time of the hospital response is not stated."],
      claim: { key: "hospital-response", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett responded to South Shore Hospital and collected samples from Lindsay Clancy's hands on January 24, 2023.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 654, 655, 656, 657, 660, 661, 662, 663, 664, 665), extractionConfidence: 1 },
      entityMentions: [
        mention("south-shore", "South Shore Hospital", "organization", ids(transcript, 657)),
        mention("lindsay", "Lindsay Clancy", "person", ids(transcript, 660, 661)),
        mention("rostauffers", "Trooper Rostauffers", "person", ids(transcript, 658, 659)),
      ],
      events: [{ key: "hospital-response", neutralDescription: "Maureen Hartnett responded to South Shore Hospital and collected samples from Lindsay Clancy's hands.", eventClass: "crime_scene_response", sourceClaimKey: "hospital-response", sourceWording: "I responded to South Shore Hospital, the emergency department.", sourceSegmentIds: ids(transcript, 657), temporalWording: "January 24th of 2023", temporalSourceSegmentIds: ids(transcript, 654), participantMentions: ["Maureen Hartnett", "South Shore Hospital", "Lindsay Clancy", "Trooper Rostauffers"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-qualified-clothing-source", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 666, 667, 668, 669, 670, 671),
      summary: "Hartnett returned collected clothing to the crime laboratory and qualified her recollection that she received it from Trooper Dan Lawler.",
      unknowns: ["The testimony does not state when the clothing was received or returned."],
      claim: { key: "clothing-source", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett believed she received the clothing from Trooper Dan Lawler and returned it to the crime laboratory.", assertionStatus: "qualified", informationBasis: "RECALLED", sourceSegmentIds: ids(transcript, 669, 670, 671), extractionConfidence: 1 },
      entityMentions: [mention("dan-lawler", "Trooper Dan Lawler", "person", ids(transcript, 671)), mention("crime-lab", "the crime laboratory", "organization", ids(transcript, 669))],
      events: [{ key: "clothing-received", neutralDescription: "Maureen Hartnett received collected clothing from a person she believed was Trooper Dan Lawler.", eventClass: "evidence_transfer", sourceClaimKey: "clothing-source", sourceWording: "I believe it was Trooper Dan Lawler.", sourceSegmentIds: ids(transcript, 671), temporalWording: "I believe it was Trooper Dan Lawler.", temporalSourceSegmentIds: ids(transcript, 671), participantMentions: ["Maureen Hartnett", "Trooper Dan Lawler"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-after-hospital-home", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 672, 673, 674, 675, 676, 677),
      summary: "After South Shore Hospital, Hartnett responded to 47 Summer Street with an unnamed forensic scientist trainee and entered the main floor before the basement.", unknowns: ["The forensic scientist trainee is not named."],
      claim: { key: "home-response", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "After the hospital response, Hartnett responded to 47 Summer Street with a forensic scientist trainee and entered the main floor before the basement.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 672, 673, 674, 675, 676, 677), extractionConfidence: 1 },
      entityMentions: [mention("home", "47 Summer Street in Duxbury", "location", ids(transcript, 672, 676, 677)), mention("trainee", "a forensic scientist trainee", "person", ids(transcript, 675)), mention("south-shore", "South Shore Hospital", "organization", ids(transcript, 672))],
      events: [{ key: "home-response", neutralDescription: "Maureen Hartnett responded to 47 Summer Street with a forensic scientist trainee and entered the main floor before proceeding to the basement.", eventClass: "crime_scene_response", sourceClaimKey: "home-response", sourceWording: "I first entered the home through the main floor and then was directed into the basement of the home.", sourceSegmentIds: ids(transcript, 677), temporalWording: "At some point after being at South Shore Hospital", temporalSourceSegmentIds: ids(transcript, 672), participantMentions: ["Maureen Hartnett", "a forensic scientist trainee", "47 Summer Street", "South Shore Hospital"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-january-25-hospital", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 814, 815, 816, 817, 818, 819),
      summary: "On January 25, 2023, Hartnett went to Brigham and Women's Hospital and collected fingernail swabbings from Lindsay Clancy.", unknowns: ["The exact clock time of collection is not stated."],
      claim: { key: "fingernail-swabs", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett collected swabbings from underneath Lindsay Clancy's fingernails at Brigham and Women's Hospital on January 25, 2023.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 814, 815, 816, 817, 818, 819), extractionConfidence: 1 },
      entityMentions: [mention("brigham", "the Brigham and Women's Hospital", "organization", ids(transcript, 814)), mention("lindsay", "Lindsay Clancy", "person", ids(transcript, 814))],
      events: [{ key: "fingernail-swabs", neutralDescription: "Maureen Hartnett collected swabbings from underneath Lindsay Clancy's fingernails at Brigham and Women's Hospital.", eventClass: "evidence_collection", sourceClaimKey: "fingernail-swabs", sourceWording: "I collected samples of swabbings from underneath her fingernails.", sourceSegmentIds: ids(transcript, 819), temporalWording: "January 25th of 2023", temporalSourceSegmentIds: ids(transcript, 814), participantMentions: ["Maureen Hartnett", "Lindsay Clancy", "Brigham and Women's Hospital"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-june-15-shingles", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 894, 895, 896, 897, 902, 903, 908, 909),
      summary: "On June 15, 2023, Hartnett collected shingles and swabs from the rear of the house and returned the shingles to the crime laboratory.", unknowns: ["The exact clock time of collection is not stated."],
      claim: { key: "shingle-collection", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett collected shingles and swabs at the house on June 15, 2023 and returned the shingles to the Massachusetts State Police Crime Lab.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 894, 895, 896, 897, 902, 903, 908, 909), extractionConfidence: 1 },
      entityMentions: [mention("house", "the home", "location", ids(transcript, 894)), mention("state-lab", "the Massachusetts State Police Crime Lab", "organization", ids(transcript, 908))],
      events: [{ key: "shingle-collection", neutralDescription: "Maureen Hartnett collected shingles and swabs at the rear of the house.", eventClass: "evidence_collection", sourceClaimKey: "shingle-collection", sourceWording: "I also collected swabs at the scene from each of those shingles in addition to collecting the shingles themselves.", sourceSegmentIds: ids(transcript, 909), temporalWording: "June 15th of 2023", temporalSourceSegmentIds: ids(transcript, 894, 902), participantMentions: ["Maureen Hartnett", "the home", "Massachusetts State Police Crime Lab"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-qualified-confirmatory-testing", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 912, 913, 914, 915),
      summary: "Hartnett performed confirmatory testing on some home swabs but qualified that she believed they came from Stain A and would need to check her notes.", unknowns: ["The testimony does not state when the confirmatory testing occurred.", "The specific tested stains remain qualified by the witness's notes."],
      claim: { key: "confirmatory-testing", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett performed confirmatory testing on some swabs and qualified her recollection that they were from Stain A.", assertionStatus: "qualified", informationBasis: "RECALLED", sourceSegmentIds: ids(transcript, 912, 913, 914, 915), extractionConfidence: 1 },
      entityMentions: [mention("home", "the home at 47 Summer Street", "location", ids(transcript, 912))],
      events: [{ key: "confirmatory-testing", neutralDescription: "Maureen Hartnett performed confirmatory testing on some swabs she believed were collected from Stain A.", eventClass: "forensic_testing", sourceClaimKey: "confirmatory-testing", sourceWording: "I performed confirmatory testing on some of the swabs that were collected from the home.", sourceSegmentIds: ids(transcript, 915), temporalWording: "I believe those swabs collected from Stain A. I would have to check my notes specifically for the stains.", temporalSourceSegmentIds: ids(transcript, 915), participantMentions: ["Maureen Hartnett", "Stain A", "47 Summer Street"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-early-morning-entry", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 987, 988, 989, 990, 991, 992, 995, 996),
      summary: "Hartnett testified that she entered 47 Summer Street in the early morning hours of January 25 and moved through the basement and upstairs bedroom areas.", unknowns: ["No exact clock time is stated."],
      claim: { key: "early-entry", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett entered 47 Summer Street during the early morning hours of January 25 and moved through multiple areas of the house.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 987, 988, 989, 990, 991, 992, 995, 996), extractionConfidence: 1 },
      entityMentions: [mention("home", "47 Summer Street", "location", ids(transcript, 987)), mention("trainee", "somebody that was learning underneath you", "person", ids(transcript, 989, 990))],
      events: [{ key: "early-entry", neutralDescription: "Maureen Hartnett entered 47 Summer Street and moved through the basement and upstairs bedroom areas.", eventClass: "crime_scene_examination", sourceClaimKey: "early-entry", sourceWording: "It was the early morning hours, January 25th.", sourceSegmentIds: ids(transcript, 988), temporalWording: "the early morning hours, January 25th", temporalSourceSegmentIds: ids(transcript, 988), participantMentions: ["Maureen Hartnett", "47 Summer Street", "unnamed trainee"], extractionConfidence: 1 }],
    },
    {
      key: "hartnett-screen-then-confirm", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031),
      summary: "Hartnett screened a bedroom-floor stain at the scene and later confirmed the single collected stain as blood at the laboratory.", unknowns: ["Neither the scene-screening time nor the laboratory-confirmation time is stated."],
      claim: { key: "screen-confirm", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett screened a bedroom-floor stain at the scene and then confirmed the collected stain as blood at the laboratory.", informationBasis: "PERSONALLY_OBSERVED", sourceSegmentIds: ids(transcript, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031), extractionConfidence: 1 },
      entityMentions: [mention("lab", "the lab", "organization", ids(transcript, 1025)), mention("bedroom", "the bedroom", "location", ids(transcript, 1024))],
      events: [
        { key: "scene-screening", neutralDescription: "Maureen Hartnett screened a collected bedroom-floor stain at the scene.", eventClass: "forensic_screening", sourceClaimKey: "screen-confirm", sourceWording: "I screened it at the scene", sourceSegmentIds: ids(transcript, 1025), temporalWording: "at the scene", temporalSourceSegmentIds: ids(transcript, 1025), participantMentions: ["Maureen Hartnett", "the bedroom", "the scene"], extractionConfidence: 1 },
        { key: "lab-confirmation", neutralDescription: "Maureen Hartnett confirmed the collected bedroom-floor stain as blood at the laboratory.", eventClass: "forensic_confirmation", sourceClaimKey: "screen-confirm", sourceWording: "confirmed it back at the lab", sourceSegmentIds: ids(transcript, 1025), temporalWording: "then, I'm sorry, confirmed it back at the lab", temporalSourceSegmentIds: ids(transcript, 1025), participantMentions: ["Maureen Hartnett", "the lab"], extractionConfidence: 1 },
      ],
    },
    {
      key: "hartnett-unknown-decision-time", witnessBlockImportedId: "witness_003", unitKind: "qa_thread",
      sourceSegmentIds: ids(transcript, 1062, 1063),
      summary: "When asked whether investigators decided five months later to remove shingles, Hartnett testified that she did not know when the decision was made and knew only the day she was requested to go out.", unknowns: ["The investigators' decision time is unknown; the attorney's five-month premise is not normalized as witness testimony."],
      claim: { key: "decision-time-unknown", assertedByRaw: "Maureen Hartnett", speakerCapacity: "witness", normalizedAssertion: "Hartnett did not know when the decision to request the shingle work was made.", assertionStatus: "qualified", informationBasis: "RECALLED", sourceSegmentIds: ids(transcript, 1062, 1063), extractionConfidence: 1 },
      entityMentions: [mention("state-police-investigators", "the state police investigators", "group", ids(transcript, 1062))],
      events: [{ key: "shingle-decision", neutralDescription: "State police investigators made a decision related to requesting shingle work at an unknown time.", eventClass: "investigative_decision", sourceClaimKey: "decision-time-unknown", sourceWording: "I don't know when that decision was made", sourceSegmentIds: ids(transcript, 1063), temporalWording: "I don't know when that decision was made", temporalSourceSegmentIds: ids(transcript, 1063), participantMentions: ["state police investigators", "Maureen Hartnett"], extractionConfidence: 1 }],
    },
  ];
  return reviewedUnits;
}

export function buildDay6TimelineAcceptance(
  transcript: ParsedRevTranscript,
  identity: { caseId: string; proceedingId: string; sourceArtifactId: string },
) {
  return compileTestimonyTimelineCandidates({ ...identity, transcript, reviewedUnits: day6TimelineAcceptanceFixture(transcript) });
}
