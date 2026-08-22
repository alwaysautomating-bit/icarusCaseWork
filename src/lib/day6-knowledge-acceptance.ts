import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import { compileTestimonyKnowledgeMap, type SemanticKnowledgeCandidate } from "@/lib/testimony-knowledge-mapper";

function requiredExchange(transcript: ParsedRevTranscript, pattern: RegExp) {
  const exchange = transcript.qaExchanges.find((item) => pattern.test(item.question));
  if (!exchange) throw new Error(`Day 6 acceptance exchange not found: ${pattern.source}`);
  return exchange;
}

export function buildDay6KnowledgeAcceptance(
  transcript: ParsedRevTranscript,
  identity: { caseId: string; proceedingId: string; sourceArtifactId: string },
) {
  const qa82 = requiredExchange(transcript, /82\.1 degrees/i);
  const qa95 = requiredExchange(transcript, /95\.2 degrees/i);
  const candidates: SemanticKnowledgeCandidate[] = [
    {
      key: "carpio-hypothermia-82-1",
      witnessBlockImportedId: "witness_001",
      unitKind: "qa_thread",
      segments: qa82.contextSegmentIds.map((segmentId) => ({
        segmentId,
        contextRole: segmentId === qa82.questionSegmentId ? "question" : qa82.answerSegmentIds.includes(segmentId) ? "answer" : "context",
      })),
      summary: "The examiner asked whether the patient had been identified as hypothermic to 82.1°F. Christina Carpio testified that, after reviewing her documentation, she remembered the patient was hypothermic; her answer did not independently repeat or affirm the numeric value.",
      unknowns: ["The time of the 82.1°F measurement is not stated.", "The answer does not independently affirm the 82.1°F number."],
      claims: [{
        key: "hypothermia-recalled", assertedByRaw: "Christina Carpio", assertedByEntityId: null, speakerCapacity: "witness",
        normalizedAssertion: "Christina Carpio testified that she remembered the patient was hypothermic after reviewing her documentation.",
        assertionStatus: "qualified", informationBasis: "READ_IN_RECORD", provenanceType: "trial_testimony",
        sourceSegmentIds: [qa82.questionSegmentId, ...qa82.answerSegmentIds], extractionConfidence: 0.99, propositionId: null,
      }],
      entityMentions: [{ key: "patient", rawMention: "the patient", normalizedCandidate: null, mentionType: "person", sourceSegmentIds: [qa82.questionSegmentId, ...qa82.answerSegmentIds] }],
      eventCandidates: [{
        key: "hypothermia-measurement-82-1",
        neutralDescription: "An examiner's question stated that the patient was identified as hypothermic to 82.1°F; the witness recalled hypothermia from her documentation without independently affirming the numeric value.",
        participantMentions: ["the patient", "Christina Carpio"], sourceClaimKeys: ["hypothermia-recalled"], extractionConfidence: 0.96,
      }],
      temporalAssertions: [{
        key: "measurement-time-82-1", eventCandidateKey: "hypothermia-measurement-82-1", sourceClaimKey: "hypothermia-recalled",
        rawTemporalLanguage: "while in the emergency department", assertedStart: null, assertedEnd: null, precision: "relative_only",
        assertedByRaw: "Shannon Buckingham / Christina Carpio Q&A", sourceSegmentIds: [qa82.questionSegmentId, ...qa82.answerSegmentIds], extractionConfidence: 0.99,
      }],
      relationships: [{
        key: "claim-describes-hypothermia", from: { type: "claim", ref: "hypothermia-recalled" }, relationType: "describes",
        to: { type: "event_candidate", ref: "hypothermia-measurement-82-1" }, sourceClaimKey: "hypothermia-recalled",
        assertionStatus: "qualified", extractionConfidence: 0.96,
      }],
      flags: [{
        key: "measurement-time-open-82-1", target: { type: "event_candidate", ref: "hypothermia-measurement-82-1" },
        flagType: "open_question", rationale: "The transcript locates the courtroom statement but does not state when the temperature was measured.",
        origin: "deterministic_rule", status: "proposed", sourceSegmentIds: [qa82.questionSegmentId, ...qa82.answerSegmentIds],
      }],
    },
    {
      key: "carpio-temperature-95-2",
      witnessBlockImportedId: "witness_001",
      unitKind: "qa_thread",
      segments: qa95.contextSegmentIds.map((segmentId) => ({
        segmentId,
        contextRole: segmentId === qa95.questionSegmentId ? "question" : qa95.answerSegmentIds.includes(segmentId) ? "answer" : "context",
      })),
      summary: "Christina Carpio answered yes when asked whether the patient's body temperature later reached 95.2°F. The exchange says only “at some point” and does not establish a measurement timestamp.",
      unknowns: ["The time of the 95.2°F measurement is not stated."],
      claims: [{
        key: "temperature-95-2-affirmed", assertedByRaw: "Christina Carpio", assertedByEntityId: null, speakerCapacity: "witness",
        normalizedAssertion: "Christina Carpio affirmed that the patient's body temperature came up to 95.2°F at an unspecified point.",
        assertionStatus: "asserted", informationBasis: "UNKNOWN_BASIS", provenanceType: "trial_testimony",
        sourceSegmentIds: [qa95.questionSegmentId, ...qa95.answerSegmentIds], extractionConfidence: 0.99, propositionId: null,
      }],
      entityMentions: [{ key: "patient", rawMention: "her", normalizedCandidate: null, mentionType: "person", sourceSegmentIds: [qa95.questionSegmentId, ...qa95.answerSegmentIds] }],
      eventCandidates: [{
        key: "temperature-measurement-95-2", neutralDescription: "The patient's body temperature was described in the Q&A as having come up to 95.2°F.",
        participantMentions: ["the patient", "Christina Carpio"], sourceClaimKeys: ["temperature-95-2-affirmed"], extractionConfidence: 0.98,
      }],
      temporalAssertions: [{
        key: "measurement-time-95-2", eventCandidateKey: "temperature-measurement-95-2", sourceClaimKey: "temperature-95-2-affirmed",
        rawTemporalLanguage: "at some point", assertedStart: null, assertedEnd: null, precision: "unknown",
        assertedByRaw: "Shannon Buckingham / Christina Carpio Q&A", sourceSegmentIds: [qa95.questionSegmentId, ...qa95.answerSegmentIds], extractionConfidence: 0.99,
      }],
      relationships: [{
        key: "claim-describes-95-2", from: { type: "claim", ref: "temperature-95-2-affirmed" }, relationType: "describes",
        to: { type: "event_candidate", ref: "temperature-measurement-95-2" }, sourceClaimKey: "temperature-95-2-affirmed",
        assertionStatus: "asserted", extractionConfidence: 0.98,
      }],
      flags: [{
        key: "measurement-time-open-95-2", target: { type: "event_candidate", ref: "temperature-measurement-95-2" },
        flagType: "open_question", rationale: "“At some point” does not provide a measurement timestamp or bounded interval.",
        origin: "deterministic_rule", status: "proposed", sourceSegmentIds: [qa95.questionSegmentId, ...qa95.answerSegmentIds],
      }],
    },
  ];

  return compileTestimonyKnowledgeMap({ ...identity, transcript, candidates, extractionMethod: "hybrid", modelName: null, modelVersion: null });
}
