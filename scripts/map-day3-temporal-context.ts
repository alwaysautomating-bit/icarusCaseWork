import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildDay3TemporalContext } from "../src/lib/day3-temporal-context-acceptance";
import { loadDay3Transcript } from "../src/lib/day3-transcript-loader";
import { TEMPORAL_CONTEXT_CONTRACT, TEMPORAL_CONTEXT_VERSION } from "../src/lib/temporal-context";

/**
 * Testimony → Temporal Context Compiler acceptance, offline.
 * Pass 1 processes Officer Hall alone. Pass 2 adds Officer Josephine and must leave Hall's account untouched.
 */
const { transcript, sourceSha256 } = await loadDay3Transcript();
assert.equal(transcript.segments.length, 1_873);

const identity = {
  caseId: "00000000-0000-4000-8000-00000000d3c0",
  proceedingId: "00000000-0000-4000-8000-00000000d3c1",
  sourceArtifactId: "00000000-0000-4000-8000-00000000d3c2",
};

const pass1 = buildDay3TemporalContext(transcript, identity, { accounts: ["hall"] });
const pass2 = buildDay3TemporalContext(transcript, identity);
const replay = buildDay3TemporalContext(transcript, identity);

const hall = (result: typeof pass1) => result.candidates.filter((item) => item.accountKey === "day3-hall");
const proof = {
  hallRunUnchangedAfterSecondWitness: JSON.stringify(pass1.runs[0].payload) === JSON.stringify(pass2.runs[0].payload),
  hallCandidatesUnchanged: JSON.stringify(hall(pass1)) === JSON.stringify(hall(pass2)),
  hallConstraintsUnchanged: JSON.stringify(pass1.constraints) === JSON.stringify(pass2.constraints.filter((item) => item.accountKey === "day3-hall")),
  rerunIdempotent: replay.contentSha256 === pass2.contentSha256,
  newEventCandidatesFromSecondWitness: pass2.candidates.length - pass1.candidates.length,
  newTemporalAssertionsFromSecondWitness: pass2.assertions.length - pass1.assertions.length,
  possibleSharedAnchorsAfterSecondWitness: pass2.report.possibleSharedAnchors,
  possibleSameEventLinksAfterSecondWitness: pass2.report.possibleSameEventLinks,
  conflictsPreserved: pass2.conflicts.map((item) => item.kind),
};
assert.ok(proof.hallRunUnchangedAfterSecondWitness && proof.hallCandidatesUnchanged && proof.hallConstraintsUnchanged && proof.rerunIdempotent);
assert.equal(pass2.report.canonicalEventsCreated, 0);
assert.equal(pass2.report.automaticSameResolutions, 0);

const cited = new Set([
  ...pass2.candidates.flatMap((item) => item.sourceSegmentIds), ...pass2.assertions.flatMap((item) => item.sourceSegmentIds),
  ...pass2.constraints.flatMap((item) => item.sourceSegmentIds), ...pass2.conflicts.flatMap((item) => item.parties.flatMap((party) => party.sourceSegmentIds)),
]);
const sources = Object.fromEntries(transcript.segments.filter((segment) => cited.has(segment.id)).map((segment) => [segment.id, {
  ordinal: segment.ordinal, speaker: segment.speaker, timestamp: segment.locator.timestampStart, deepLink: segment.deepLink, text: segment.text,
}]));

const generatedAt = new Date().toISOString();
const artifact = {
  schemaVersion: "temporal-context-view/1.0",
  contract: TEMPORAL_CONTEXT_CONTRACT,
  compilerVersion: TEMPORAL_CONTEXT_VERSION,
  title: "Day 3 first responders — temporal context (Hall, then Josephine)",
  generatedAt,
  source: { title: "MA v. Lindsay Clancy Day 3", sha256: sourceSha256, segments: transcript.segments.length },
  boundary: "Every event, time, and link here is a reviewable candidate. Nothing is canonical, no witnesses are merged, and testimony timestamps are locators, never event times.",
  accounts: pass2.report.accounts,
  report: pass2.report,
  proof,
  candidates: pass2.candidates, assertions: pass2.assertions, constraints: pass2.constraints,
  anchors: pass2.anchors, links: pass2.links, conflicts: pass2.conflicts, slots: pass2.slots,
  sources,
};

await mkdir(path.resolve("content/timelines/temporal"), { recursive: true });
await writeFile(path.resolve("content/timelines/temporal/day3-first-responders.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const r = pass2.report;
const md = `# Testimony → Temporal Context Compiler — Day 3 acceptance

Generated: ${generatedAt}
Compiler: \`${TEMPORAL_CONTEXT_CONTRACT}\` v${TEMPORAL_CONTEXT_VERSION}
Source: MA v. Lindsay Clancy Day 3, ${transcript.segments.length} committed segments (sha256 \`${sourceSha256.slice(0, 16)}…\`)
Accounts: **${r.accounts.map((account) => account.witness).join("**, then **")}**

## Second-pass proof

| Check | Result |
|---|---|
| Hall's account after Josephine is processed: pipeline payload byte-identical | ${proof.hallRunUnchangedAfterSecondWitness ? "PASS" : "FAIL"} |
| Hall's event candidates and constraints unchanged | ${proof.hallCandidatesUnchanged && proof.hallConstraintsUnchanged ? "PASS" : "FAIL"} |
| Rerun is idempotent (identical content hash) | ${proof.rerunIdempotent ? "PASS" : "FAIL"} |
| New event candidates added by the second witness | ${proof.newEventCandidatesFromSecondWitness} |
| New temporal assertions added | ${proof.newTemporalAssertionsFromSecondWitness} |
| Possible shared anchors proposed | ${proof.possibleSharedAnchorsAfterSecondWitness} |
| Possible same-event links proposed (pending review) | ${proof.possibleSameEventLinksAfterSecondWitness} |
| Conflicts preserved | ${proof.conflictsPreserved.join(", ")} |

## Compiler report

| Measure | Count |
|---|---|
| Testimony units reviewed | ${r.testimonyUnitsReviewed} |
| Knowledge items created | ${r.knowledgeItemsCreated} |
| Claims created | ${r.claimsCreated} |
| Event candidates created | ${r.eventCandidatesCreated} |
| Temporal assertions created | ${r.temporalAssertionsCreated} |
| — exact times | ${r.assertionForms.exactTimes} |
| — exact dates | ${r.assertionForms.exactDates} |
| — approximate times | ${r.assertionForms.approximateTimes} |
| — intervals | ${r.assertionForms.intervals} |
| — durations | ${r.assertionForms.durations} |
| — relative-only | ${r.assertionForms.relativeOnly} |
| — sequence-only | ${r.assertionForms.sequenceOnly} |
| — lower / upper bounds | ${r.assertionForms.lowerBounds} / ${r.assertionForms.upperBounds} |
| — unknown time | ${r.assertionForms.unknownTime} |
| Qualified assertions (witness wording) | ${r.qualifiedAssertions} |
| Assertions adopted from a question's premise | ${r.adoptedFromQuestionAssertions} |
| State observations | ${r.stateObservations} |
| Knowledge-state changes | ${r.knowledgeStateChanges} |
| Temporal constraints | ${r.temporalConstraints} |
| Candidate anchors identified | ${r.candidateAnchorsIdentified} |
| Possible shared anchors | ${r.possibleSharedAnchors} |
| Possible same-event links | ${r.possibleSameEventLinks} |
| Temporal conflicts | ${r.temporalConflicts} |
| Additional accounts of existing candidates | ${r.additionalAccountsOfExistingCandidates} |
| Additional details attached | ${r.additionalDetailsAttached} |
| Events with sequence position but no clock time | ${r.eventsWithSequencePositionButNoClock} |
| Unresolved entity mentions | ${r.unresolvedEntityMentions} |
| Source irregularities in cited ranges | ${r.sourceIrregularities.inCitedRanges} |
| Source irregularities preserved (whole proceeding) | ${r.sourceIrregularities.wholeProceedingPreserved} |
| **Canonical events created** | **${r.canonicalEventsCreated}** |
| **Automatic SAME resolutions** | **${r.automaticSameResolutions}** |

## Preserved conflicts

${pass2.conflicts.map((item) => `- **${item.kind.replaceAll("_", " ")}** — ${item.summary}`).join("\n")}

Neither side of a conflict was averaged, chosen, or rewritten.

## Candidate anchors

${pass2.anchors.map((anchor) => `- \`${anchor.code}\` **${anchor.label}** (${anchor.anchorClass}) — ${anchor.sharedAcrossAccounts ? "shared by " + anchor.accounts.length + " accounts" : "one account"}`).join("\n")}

## Boundaries

- The 6:11 PM dispatch time appears as **counsel's premise that each officer affirmed**; it is stored as approximate and flagged \`adopted-question-premise\`, not as the officers' own recollection.
- Response-travel durations remain two separate assertions (7–10 min vs 3–4 min). The dispatch clock plus either duration would imply different arrival times; no arrival time was computed.
- Josephine's uncertainty about whether dispatch spoke of the basement is retained as an additional detail on Hall's radio-relay candidate. It is not used to reorder the relay and scream, because her wording carries no sequence cue.
- Testimony timestamps are source locators only and were not used as event time.
- Constraints exist only where the witness's own wording carries a matching sequence, simultaneity, or state cue.
`;
await mkdir(path.resolve("reports"), { recursive: true });
await writeFile(path.resolve("reports/day3-temporal-context.md"), md, "utf8");
await writeFile(path.resolve("reports/day3-temporal-context.json"), `${JSON.stringify({ generatedAt, report: r, proof, conflicts: pass2.conflicts, anchors: pass2.anchors.map(({ members, ...rest }) => ({ ...rest, memberCount: members.length })) }, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ report: r, proof })}\n`);
