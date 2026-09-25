import { createHash } from "node:crypto";

import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import { objectCode, stableUuid } from "@/lib/testimony-knowledge-mapper";
import {
  compileTestimonyTimelineCandidates,
  parseTestimonyTemporalLanguage,
  type ReviewedTimelineUnit,
} from "@/lib/testimony-timeline-compiler";
import {
  classifyAssertionForm,
  describesPriorState,
  parseDurationWording,
  wordingSupportsRelation,
  type TemporalAssertionForm,
  type TemporalRelation,
} from "@/lib/temporal-lexicon";

export const TEMPORAL_CONTEXT_COMPILER = "icarus-testimony-temporal-context-compiler";
export const TEMPORAL_CONTEXT_VERSION = "1.0.0";
export const TEMPORAL_CONTEXT_CONTRACT = "testimony-knowledge/1.0+timeline-candidate/1.0+temporal-context/1.0";

export type CandidateKind = "event" | "state_observation" | "knowledge_state";
export type AnchorClass = "CLOCK" | "ARRIVAL_DEPARTURE" | "SHARED_OBSERVATION" | "STATE" | "INFORMATION" | "TRANSITION";
export type AnchorRole = "occurrence" | "detail" | "prior_state_origin";
export type ConstraintDerivation = "sequence_wording" | "simultaneity_wording" | "state_observation" | "knowledge_flow";

type ReviewedEvent = ReviewedTimelineUnit["events"][number];

export type TemporalEventSpec = ReviewedEvent & {
  kind?: CandidateKind;
  /** Names the shared real-world happening this candidate may help synchronize. A proposal, never a merge. */
  anchor?: { family: string; class: AnchorClass; role?: AnchorRole; label?: string };
  /** A witness-observed condition used only to surface disagreement between accounts. */
  stateClaim?: { key: string; value: string };
  knowledge?: { holder: string; proposition: string };
};

export type TemporalStatement = Omit<ReviewedTimelineUnit, "events"> & { events: TemporalEventSpec[] };

export type TemporalRelationSpec = {
  key: string;
  /** Event key inside the account, or `anchor:<family>` for an implied origin. */
  from: string;
  relation: TemporalRelation;
  to: string;
  /** Exact witness wording that carries the sequence; verified against the cited testimony. */
  wording: string;
  sourceSegmentIds: string[];
  derivation: ConstraintDerivation;
};

export type TemporalAccount = {
  accountKey: string;
  witnessLabel: string;
  statements: TemporalStatement[];
  relations: TemporalRelationSpec[];
};

const inverse: Record<TemporalRelation, TemporalRelation> = {
  BEFORE: "AFTER", AFTER: "BEFORE", BEFORE_OR_AT: "AFTER_OR_AT", AFTER_OR_AT: "BEFORE_OR_AT",
  AT: "AT", OVERLAPS: "OVERLAPS", DURING: "DURING",
};

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export type ContextCandidate = {
  id: string; code: string; accountKey: string; witness: string; key: string; kind: CandidateKind;
  eventClass: string; description: string; sourceWording: string; sourceSegmentIds: string[];
  claimId: string; knowledgeItemId: string; anchorFamily: string | null; anchorRole: AnchorRole | null;
  stateClaim: { key: string; value: string } | null; knowledge: { holder: string; proposition: string } | null;
};

export type ContextAssertion = {
  id: string; code: string; accountKey: string; witness: string; eventCandidateId: string; eventCandidateCode: string;
  form: TemporalAssertionForm; precision: string; qualification: string; qualifierText: string | null;
  adoptedFromQuestion: boolean; wording: string; sourceSegmentIds: string[];
  durationSeconds: { min: number | null; max: number | null; vague: boolean } | null;
  hasClockValue: boolean;
};

export type NodeRef = { type: "event_candidate" | "anchor_candidate"; id: string; code: string; label: string };

export type ContextConstraint = {
  id: string; code: string; accountKey: string; witness: string; from: NodeRef; relation: TemporalRelation; to: NodeRef;
  derivation: ConstraintDerivation; wording: string; cue: string; sourceSegmentIds: string[]; reviewStatus: "pending";
};

export type ContextAnchor = {
  id: string; code: string; family: string; label: string; anchorClass: AnchorClass;
  members: Array<{ eventCandidateId: string; eventCandidateCode: string; accountKey: string; witness: string; role: AnchorRole; description: string }>;
  accounts: string[]; sharedAcrossAccounts: boolean; reviewStatus: "pending";
};

export type LinkType = "possible_shared_anchor" | "possible_same_event" | "possible_additional_detail";
export type ContextLink = {
  id: string; code: string; linkType: LinkType; from: NodeRef; to: NodeRef; reason: string; reviewStatus: "pending";
};

export type ConflictKind = "duration_ranges_disjoint" | "state_disagreement" | "order_disagreement" | "constraint_cycle";
export type ContextConflict = {
  id: string; code: string; kind: ConflictKind; summary: string; reviewStatus: "pending";
  parties: Array<{ accountKey: string; witness: string; ref: string; wording: string; sourceSegmentIds: string[] }>;
};

export type AnchorSlot = {
  anchorCode: string; family: string; accountKey: string; witness: string; memberCode: string;
  before: string[]; at: string[]; after: string[]; unplaced: string[];
};

function ancestors(start: string, edges: Map<string, Set<string>>) {
  const out = new Set<string>(); const stack = [start];
  while (stack.length) for (const next of edges.get(stack.pop()!) ?? []) if (!out.has(next)) { out.add(next); stack.push(next); }
  return out;
}

function hasCycle(nodes: string[], edges: Map<string, Set<string>>) {
  const state = new Map<string, 1 | 2>();
  const visit = (node: string): string[] | null => {
    state.set(node, 1);
    for (const next of edges.get(node) ?? []) {
      if (state.get(next) === 1) return [node, next];
      if (!state.has(next)) { const found = visit(next); if (found) return found; }
    }
    state.set(node, 2);
    return null;
  };
  for (const node of nodes) if (!state.has(node)) { const found = visit(node); if (found) return found; }
  return null;
}

export function compileTemporalContext(input: {
  caseId: string; proceedingId: string; sourceArtifactId: string;
  transcript: Pick<ParsedRevTranscript, "sourceSha256" | "segments">;
  accounts: TemporalAccount[];
}) {
  const segmentText = new Map(input.transcript.segments.map((segment) => [segment.id, segment.text]));
  const ordinalById = new Map(input.transcript.segments.map((segment) => [segment.id, segment.ordinal]));
  const candidates: ContextCandidate[] = [];
  const assertions: ContextAssertion[] = [];
  const constraints: ContextConstraint[] = [];
  const runs: Array<{ accountKey: string; witness: string; payload: ReturnType<typeof compileTestimonyTimelineCandidates> }> = [];
  const candidateByAccountKey = new Map<string, ContextCandidate>();

  for (const account of input.accounts) {
    const payload = compileTestimonyTimelineCandidates({
      caseId: input.caseId, proceedingId: input.proceedingId, sourceArtifactId: input.sourceArtifactId,
      transcript: input.transcript, reviewedUnits: account.statements as ReviewedTimelineUnit[],
      identityNamespace: `temporal-context/1.0:${account.accountKey}`,
    });
    runs.push({ accountKey: account.accountKey, witness: account.witnessLabel, payload });

    const events = account.statements.flatMap((statement) => statement.events.map((event) => ({ statement, event })));
    if (events.length !== payload.event_candidates.length) throw new Error(`${account.accountKey}: event mapping is incomplete.`);
    let assertionIndex = 0;
    events.forEach(({ statement, event }, index) => {
      const row = payload.event_candidates[index];
      const claim = payload.claims.find((item) => (row.source_claim_ids as string[]).includes(String(item.id)))!;
      const candidate: ContextCandidate = {
        id: String(row.id), code: String(row.object_code), accountKey: account.accountKey, witness: account.witnessLabel,
        key: event.key, kind: event.kind ?? "event", eventClass: event.eventClass, description: event.neutralDescription,
        sourceWording: event.sourceWording, sourceSegmentIds: event.sourceSegmentIds,
        claimId: String(claim.id), knowledgeItemId: String(row.knowledge_item_id),
        anchorFamily: event.anchor?.family ?? null, anchorRole: event.anchor ? event.anchor.role ?? "occurrence" : null,
        stateClaim: event.stateClaim ?? null, knowledge: event.knowledge ?? null,
      };
      if (candidate.kind === "knowledge_state" && !candidate.knowledge) throw new Error(`${event.key}: a knowledge-state change needs a holder and proposition.`);
      candidates.push(candidate);
      candidateByAccountKey.set(`${account.accountKey}:${event.key}`, candidate);

      const wordings = [
        { wording: event.temporalWording, segmentIds: event.temporalSourceSegmentIds, adopted: event.temporalAdoptedFromQuestion ?? false },
        ...(event.additionalTemporal ?? []).map((extra) => ({ wording: extra.wording, segmentIds: extra.sourceSegmentIds, adopted: extra.adoptedFromQuestion ?? false })),
      ];
      for (const item of wordings) {
        const row2 = payload.temporal_assertions[assertionIndex++];
        const parsed = parseTestimonyTemporalLanguage(item.wording);
        const duration = parseDurationWording(item.wording);
        assertions.push({
          id: String(row2.id), code: String(row2.object_code), accountKey: account.accountKey, witness: account.witnessLabel,
          eventCandidateId: candidate.id, eventCandidateCode: candidate.code,
          form: classifyAssertionForm(item.wording, parsed), precision: parsed.precision, qualification: parsed.qualification,
          qualifierText: parsed.qualifierText, adoptedFromQuestion: item.adopted, wording: item.wording, sourceSegmentIds: item.segmentIds,
          durationSeconds: duration ? { min: duration.minSeconds, max: duration.maxSeconds, vague: duration.vague } : null,
          hasClockValue: Boolean(parsed.assertedTimeOfDayStart || parsed.assertedDate),
        });
      }
      void statement;
    });
    if (assertionIndex !== payload.temporal_assertions.length) throw new Error(`${account.accountKey}: temporal assertion mapping is incomplete.`);
  }

  // ---- Anchors -------------------------------------------------------------------------------
  const anchorGroups = new Map<string, { anchorClass: AnchorClass; label: string; members: ContextAnchor["members"] }>();
  const specByCandidate = new Map<string, TemporalEventSpec>();
  for (const account of input.accounts) for (const statement of account.statements) for (const event of statement.events) {
    specByCandidate.set(candidateByAccountKey.get(`${account.accountKey}:${event.key}`)!.id, event);
  }
  for (const candidate of candidates) {
    const anchor = specByCandidate.get(candidate.id)!.anchor;
    if (!anchor) continue;
    const group = anchorGroups.get(anchor.family) ?? { anchorClass: anchor.class, label: anchor.label ?? anchor.family, members: [] };
    group.members.push({ eventCandidateId: candidate.id, eventCandidateCode: candidate.code, accountKey: candidate.accountKey, witness: candidate.witness, role: anchor.role ?? "occurrence", description: candidate.description });
    anchorGroups.set(anchor.family, group);
  }
  const anchors: ContextAnchor[] = [...anchorGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([family, group]) => {
    const id = stableUuid("temporal-anchor", `${input.caseId}:${family}`);
    const accounts = [...new Set(group.members.map((member) => member.accountKey))];
    return { id, code: objectCode("ANC", id), family, label: group.label, anchorClass: group.anchorClass, members: group.members, accounts, sharedAcrossAccounts: accounts.length > 1, reviewStatus: "pending" as const };
  });
  const anchorByFamily = new Map(anchors.map((anchor) => [anchor.family, anchor]));
  const anchorRef = (anchor: ContextAnchor): NodeRef => ({ type: "anchor_candidate", id: anchor.id, code: anchor.code, label: anchor.label });
  const eventRef = (candidate: ContextCandidate): NodeRef => ({ type: "event_candidate", id: candidate.id, code: candidate.code, label: candidate.description });

  // ---- Constraints ---------------------------------------------------------------------------
  const requireWording = (label: string, wording: string, segmentIds: string[]) => {
    const source = segmentIds.map((id) => segmentText.get(id) ?? "").join("\n");
    if (!source.includes(wording)) throw new Error(`${label}: wording is not an exact substring of its cited testimony: “${wording}”.`);
  };
  const addConstraint = (account: TemporalAccount, key: string, from: NodeRef, relation: TemporalRelation, to: NodeRef, derivation: ConstraintDerivation, wording: string, sourceSegmentIds: string[]) => {
    requireWording(`${account.accountKey}/${key}`, wording, sourceSegmentIds);
    const cue = wordingSupportsRelation(wording, relation) ?? wordingSupportsRelation(wording, inverse[relation]);
    if (!cue) throw new Error(`${account.accountKey}/${key}: the witness wording “${wording}” carries no cue supporting ${relation}.`);
    const id = stableUuid("temporal-constraint", `${input.caseId}:${account.accountKey}:${key}`);
    constraints.push({ id, code: objectCode("TCN", id), accountKey: account.accountKey, witness: account.witnessLabel, from, relation, to, derivation, wording, cue: cue.text, sourceSegmentIds, reviewStatus: "pending" });
  };

  for (const account of input.accounts) {
    const resolve = (ref: string): NodeRef => {
      if (ref.startsWith("anchor:")) {
        const anchor = anchorByFamily.get(ref.slice(7));
        if (!anchor) throw new Error(`${account.accountKey}: unknown anchor ${ref}.`);
        return anchorRef(anchor);
      }
      const candidate = candidateByAccountKey.get(`${account.accountKey}:${ref}`);
      if (!candidate) throw new Error(`${account.accountKey}: unknown event ${ref}.`);
      return eventRef(candidate);
    };
    for (const relation of account.relations) addConstraint(account, relation.key, resolve(relation.from), relation.relation, resolve(relation.to), relation.derivation, relation.wording, relation.sourceSegmentIds);
    // Observed prior state → reviewable constraint, kept separate from the source assertion.
    for (const statement of account.statements) for (const event of statement.events) {
      if (event.anchor?.role !== "prior_state_origin") continue;
      if (!describesPriorState(event.temporalWording)) throw new Error(`${account.accountKey}/${event.key}: wording does not describe an already-existing state.`);
      addConstraint(account, `${event.key}-prior-state`, anchorRef(anchorByFamily.get(event.anchor.family)!), "BEFORE_OR_AT", eventRef(candidateByAccountKey.get(`${account.accountKey}:${event.key}`)!), "state_observation", event.temporalWording, event.temporalSourceSegmentIds);
    }
  }

  // ---- Cross-account proposals (never resolutions) -------------------------------------------
  const links: ContextLink[] = [];
  const addLink = (linkType: LinkType, from: NodeRef, to: NodeRef, reason: string) => {
    const id = stableUuid("temporal-link", `${input.caseId}:${linkType}:${from.id}:${to.id}`);
    links.push({ id, code: objectCode("REL", id), linkType, from, to, reason, reviewStatus: "pending" });
  };
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const accountOrder = new Map(input.accounts.map((account, index) => [account.accountKey, index]));
  for (const anchor of anchors) {
    if (!anchor.sharedAcrossAccounts) continue;
    for (const member of anchor.members) addLink("possible_shared_anchor", eventRef(candidateById.get(member.eventCandidateId)!), anchorRef(anchor),
      `${member.witness} places “${anchor.label}” (${member.role.replaceAll("_", " ")}) in a family also described by ${anchor.accounts.length - 1} other account(s).`);
    const occurrences = anchor.members.filter((member) => member.role === "occurrence" && candidateById.get(member.eventCandidateId)!.kind === "event");
    for (const later of occurrences) for (const earlier of occurrences) {
      if ((accountOrder.get(earlier.accountKey) ?? 0) >= (accountOrder.get(later.accountKey) ?? 0)) continue;
      addLink("possible_same_event", eventRef(candidateById.get(later.eventCandidateId)!), eventRef(candidateById.get(earlier.eventCandidateId)!),
        `Both accounts describe “${anchor.label}”; identity remains a reviewer decision.`);
    }
    for (const detail of anchor.members.filter((member) => member.role === "detail")) for (const occurrence of occurrences) {
      if (occurrence.accountKey === detail.accountKey) continue;
      addLink("possible_additional_detail", eventRef(candidateById.get(detail.eventCandidateId)!), eventRef(candidateById.get(occurrence.eventCandidateId)!),
        `${detail.witness} adds detail about “${anchor.label}” described by ${occurrence.witness}.`);
    }
  }

  // ---- Conflicts (preserved; nothing averaged or chosen) --------------------------------------
  const conflicts: ContextConflict[] = [];
  const addConflict = (kind: ConflictKind, summary: string, parties: ContextConflict["parties"]) => {
    const id = stableUuid("temporal-conflict", `${input.caseId}:${kind}:${parties.map((party) => party.ref).sort().join(":")}`);
    conflicts.push({ id, code: objectCode("FLG", id), kind, summary, parties, reviewStatus: "pending" });
  };
  const eventOfAssertion = (assertion: ContextAssertion) => candidateById.get(assertion.eventCandidateId)!;
  const durationAssertions = assertions.filter((assertion) => assertion.form === "DURATION" && assertion.durationSeconds && !assertion.durationSeconds.vague && assertion.durationSeconds.min !== null);
  for (const [index, a] of durationAssertions.entries()) for (const b of durationAssertions.slice(index + 1)) {
    const ea = eventOfAssertion(a); const eb = eventOfAssertion(b);
    if (a.accountKey === b.accountKey || !ea.anchorFamily || ea.anchorFamily !== eb.anchorFamily) continue;
    const [aMin, aMax, bMin, bMax] = [a.durationSeconds!.min!, a.durationSeconds!.max!, b.durationSeconds!.min!, b.durationSeconds!.max!];
    if (aMax < bMin || bMax < aMin) addConflict("duration_ranges_disjoint", `“${a.wording}” (${a.witness}) and “${b.wording}” (${b.witness}) do not overlap.`,
      [a, b].map((item) => ({ accountKey: item.accountKey, witness: item.witness, ref: item.code, wording: item.wording, sourceSegmentIds: item.sourceSegmentIds })));
  }
  const withState = candidates.filter((candidate) => candidate.stateClaim);
  for (const [index, a] of withState.entries()) for (const b of withState.slice(index + 1)) {
    if (a.accountKey !== b.accountKey && a.stateClaim!.key === b.stateClaim!.key && a.stateClaim!.value !== b.stateClaim!.value) {
      addConflict("state_disagreement", `Accounts differ on ${a.stateClaim!.key}: ${a.witness} “${a.stateClaim!.value}”, ${b.witness} “${b.stateClaim!.value}”.`,
        [a, b].map((item) => ({ accountKey: item.accountKey, witness: item.witness, ref: item.code, wording: item.sourceWording, sourceSegmentIds: item.sourceSegmentIds })));
    }
  }
  // Order disagreement across accounts, compared at anchor-family level.
  const familyOfNode = (node: NodeRef) => node.type === "anchor_candidate" ? anchors.find((anchor) => anchor.id === node.id)?.family ?? null : candidateById.get(node.id)?.anchorFamily ?? null;
  const strict = constraints.filter((constraint) => constraint.relation === "BEFORE" || constraint.relation === "AFTER");
  const familyEdges = strict.flatMap((constraint) => {
    const [from, to] = constraint.relation === "BEFORE" ? [familyOfNode(constraint.from), familyOfNode(constraint.to)] : [familyOfNode(constraint.to), familyOfNode(constraint.from)];
    return from && to && from !== to ? [{ from, to, constraint }] : [];
  });
  for (const [index, a] of familyEdges.entries()) for (const b of familyEdges.slice(index + 1)) {
    if (a.constraint.accountKey !== b.constraint.accountKey && a.from === b.to && a.to === b.from) {
      addConflict("order_disagreement", `${a.constraint.witness} orders ${a.from} before ${a.to}; ${b.constraint.witness} orders ${b.from} before ${b.to}.`,
        [a, b].map((item) => ({ accountKey: item.constraint.accountKey, witness: item.constraint.witness, ref: item.constraint.code, wording: item.constraint.wording, sourceSegmentIds: item.constraint.sourceSegmentIds })));
    }
  }

  // ---- Per-account partial order + anchor slots ------------------------------------------------
  const slots: AnchorSlot[] = [];
  for (const account of input.accounts) {
    const mine = constraints.filter((constraint) => constraint.accountKey === account.accountKey);
    const nodes = [...new Set(mine.flatMap((constraint) => [constraint.from.id, constraint.to.id]))];
    const earlier = new Map<string, Set<string>>(); // node → nodes that come before it
    const later = new Map<string, Set<string>>();
    const same = new Map<string, Set<string>>();
    const link = (map: Map<string, Set<string>>, a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b));
    for (const constraint of mine) {
      const [a, b] = [constraint.from.id, constraint.to.id];
      if (constraint.relation === "BEFORE" || constraint.relation === "BEFORE_OR_AT") { link(earlier, b, a); link(later, a, b); }
      else if (constraint.relation === "AFTER" || constraint.relation === "AFTER_OR_AT") { link(earlier, a, b); link(later, b, a); }
      else { link(same, a, b); link(same, b, a); }
    }
    const cycle = hasCycle(nodes, later);
    if (cycle) addConflict("constraint_cycle", `${account.witnessLabel}'s reviewed constraints form a cycle.`, [{ accountKey: account.accountKey, witness: account.witnessLabel, ref: cycle.join("→"), wording: "", sourceSegmentIds: [] }]);
    const labels = new Map(mine.flatMap((constraint) => [[constraint.from.id, constraint.from.code], [constraint.to.id, constraint.to.code]] as const));
    for (const anchor of anchors) for (const member of anchor.members.filter((item) => item.accountKey === account.accountKey && item.role !== "detail")) {
      if (!nodes.includes(member.eventCandidateId)) continue;
      const before = ancestors(member.eventCandidateId, earlier); const after = ancestors(member.eventCandidateId, later);
      const at = same.get(member.eventCandidateId) ?? new Set<string>();
      const known = new Set([...before, ...after, ...at, member.eventCandidateId]);
      slots.push({
        anchorCode: anchor.code, family: anchor.family, accountKey: account.accountKey, witness: account.witnessLabel, memberCode: member.eventCandidateCode,
        before: [...before].map((id) => labels.get(id)!).sort(), at: [...at].map((id) => labels.get(id)!).sort(),
        after: [...after].map((id) => labels.get(id)!).sort(), unplaced: nodes.filter((id) => !known.has(id)).map((id) => labels.get(id)!).sort(),
      });
    }
  }

  // ---- Report --------------------------------------------------------------------------------
  const form = (name: TemporalAssertionForm) => assertions.filter((assertion) => assertion.form === name).length;
  const constrained = new Set(constraints.flatMap((constraint) => [constraint.from.id, constraint.to.id]));
  const clockBearing = new Set(assertions.filter((assertion) => assertion.hasClockValue).map((assertion) => assertion.eventCandidateId));
  const irregularities = runs.flatMap((run) => (run.payload.deterministic_qa.timestampRegressionDetails as Array<{ segmentId: string; deltaMs: number }>).map((item) => ({ ...item, accountKey: run.accountKey })));
  const accountOrdinals = new Map(input.accounts.map((account) => {
    const ordinals = account.statements.flatMap((statement) => statement.sourceSegmentIds).map((id) => ordinalById.get(id)!);
    return [account.accountKey, [Math.min(...ordinals), Math.max(...ordinals)] as const];
  }));
  const sourceIrregularitiesInCitedRange = irregularities.filter((item, index, all) => {
    const ordinal = ordinalById.get(item.segmentId)!; const range = accountOrdinals.get(item.accountKey)!;
    return ordinal >= range[0] && ordinal <= range[1] && all.findIndex((other) => other.segmentId === item.segmentId) === index;
  });
  const sameLinks = links.filter((item) => item.linkType === "possible_same_event");
  const runOf = (run: (typeof runs)[number], key: "testimony_units" | "knowledge_items" | "claims" | "event_candidates" | "temporal_assertions" | "entity_mentions") => run.payload[key].length;
  const sum = (key: Parameters<typeof runOf>[1]) => runs.reduce((total, run) => total + runOf(run, key), 0);

  const report = {
    schemaVersion: "testimony-temporal-context-acceptance/1.0",
    compiler: { name: TEMPORAL_CONTEXT_COMPILER, version: TEMPORAL_CONTEXT_VERSION, contract: TEMPORAL_CONTEXT_CONTRACT },
    accounts: input.accounts.map((account) => ({ accountKey: account.accountKey, witness: account.witnessLabel })),
    testimonyUnitsReviewed: sum("testimony_units"), knowledgeItemsCreated: sum("knowledge_items"), claimsCreated: sum("claims"),
    eventCandidatesCreated: sum("event_candidates"), temporalAssertionsCreated: sum("temporal_assertions"),
    assertionForms: {
      exactTimes: form("EXACT_DATETIME") + form("EXACT_TIME"), exactDates: form("EXACT_DATE"), approximateTimes: form("APPROXIMATE_TIME"),
      intervals: form("INTERVAL"), durations: form("DURATION"), relativeOnly: form("RELATIVE"), sequenceOnly: form("SEQUENCE_ONLY"),
      lowerBounds: form("LOWER_BOUND"), upperBounds: form("UPPER_BOUND"), unknownTime: form("UNKNOWN"),
    },
    qualifiedAssertions: assertions.filter((assertion) => assertion.qualification !== "asserted").length,
    adoptedFromQuestionAssertions: assertions.filter((assertion) => assertion.adoptedFromQuestion).length,
    stateObservations: candidates.filter((candidate) => candidate.kind === "state_observation").length,
    knowledgeStateChanges: candidates.filter((candidate) => candidate.kind === "knowledge_state").length,
    temporalConstraints: constraints.length,
    candidateAnchorsIdentified: anchors.length,
    possibleSharedAnchors: anchors.filter((anchor) => anchor.sharedAcrossAccounts).length,
    possibleSameEventLinks: sameLinks.length,
    temporalConflicts: conflicts.length,
    additionalAccountsOfExistingCandidates: new Set(sameLinks.map((item) => item.to.id)).size,
    additionalDetailsAttached: links.filter((item) => item.linkType === "possible_additional_detail").length,
    eventsWithSequencePositionButNoClock: [...constrained].filter((id) => candidateById.has(id) && !clockBearing.has(id)).length,
    unresolvedEntityMentions: sum("entity_mentions"),
    sourceIrregularities: { inCitedRanges: sourceIrregularitiesInCitedRange.length, wholeProceedingPreserved: new Set(irregularities.map((item) => item.segmentId)).size },
    canonicalEventsCreated: 0, automaticSameResolutions: 0,
  };

  const context = { candidates, assertions, constraints, anchors, links, conflicts, slots };
  return {
    contract: TEMPORAL_CONTEXT_CONTRACT,
    runs, ...context, report,
    contentSha256: sha({ candidates: candidates.map((c) => c.id), assertions: assertions.map((a) => a.id), constraints: constraints.map((c) => c.id), anchors: anchors.map((a) => a.id), links: links.map((l) => l.id), conflicts: conflicts.map((c) => c.id) }),
    boundary: { canonical_events_created: 0, same_resolutions_created: 0 },
  };
}

export type TemporalContextResult = ReturnType<typeof compileTemporalContext>;

/** Read-only projections. They join existing objects by reference and copy no testimony. */
export function projectTemporalContext(result: TemporalContextResult) {
  const candidateById = new Map(result.candidates.map((candidate) => [candidate.id, candidate]));
  const assertionsByEvent = new Map<string, ContextAssertion[]>();
  for (const assertion of result.assertions) assertionsByEvent.set(assertion.eventCandidateId, [...(assertionsByEvent.get(assertion.eventCandidateId) ?? []), assertion]);
  return {
    byWitness: (accountKey: string) => result.candidates.filter((candidate) => candidate.accountKey === accountKey).map((candidate) => ({
      candidate, assertions: assertionsByEvent.get(candidate.id) ?? [],
      constraints: result.constraints.filter((constraint) => constraint.from.id === candidate.id || constraint.to.id === candidate.id),
    })),
    byAnchor: (family: string) => ({ anchor: result.anchors.find((anchor) => anchor.family === family) ?? null, slots: result.slots.filter((slot) => slot.family === family) }),
    byEvent: (eventCandidateId: string) => ({
      candidate: candidateById.get(eventCandidateId) ?? null,
      accounts: result.links.filter((link) => link.linkType === "possible_same_event" && (link.from.id === eventCandidateId || link.to.id === eventCandidateId)),
      assertions: assertionsByEvent.get(eventCandidateId) ?? [],
    }),
    conflicts: () => result.conflicts,
    unknownClock: () => {
      const constrained = new Set(result.constraints.flatMap((constraint) => [constraint.from.id, constraint.to.id]));
      return result.candidates.filter((candidate) => constrained.has(candidate.id) && !(assertionsByEvent.get(candidate.id) ?? []).some((assertion) => assertion.hasClockValue));
    },
  };
}

/**
 * Database payload for `public.commit_temporal_context`.
 * Each account's base payload is the unchanged timeline-candidate payload; context objects reference it by deterministic ID.
 */
export function buildTemporalContextPayload(result: TemporalContextResult, identity: { caseId: string; proceedingId: string; sourceArtifactId: string }) {
  const runId = stableUuid("temporal-context-run", `${identity.proceedingId}:${result.contentSha256}`);
  const activityId = stableUuid("prov-activity", `${runId}:temporal-context`);
  const candidateById = new Map(result.candidates.map((candidate) => [candidate.id, candidate]));
  const nodeCandidate = (from: NodeRef, to: NodeRef) => candidateById.get(from.id) ?? candidateById.get(to.id)!;

  const constraints = result.constraints.map((item) => {
    const owner = nodeCandidate(item.from, item.to);
    return {
      id: item.id, object_code: item.code, account_key: item.accountKey, from_node_type: item.from.type, from_node_id: item.from.id,
      relation: item.relation, to_node_type: item.to.type, to_node_id: item.to.id, derivation: item.derivation,
      source_wording: item.wording, cue: item.cue, source_segment_ids: item.sourceSegmentIds,
      knowledge_item_id: owner.knowledgeItemId, source_claim_id: owner.claimId,
    };
  });
  const links = result.links.map((item) => {
    const from = candidateById.get(item.from.id)!;
    return { id: item.id, object_code: item.code, link_type: item.linkType, from_node_type: item.from.type, from_node_id: item.from.id, to_node_type: item.to.type, to_node_id: item.to.id, reason: item.reason, knowledge_item_id: from.knowledgeItemId, source_claim_id: from.claimId };
  });
  const conflicts = result.conflicts.map((item) => {
    const ref = item.parties[0]?.ref ?? "";
    const target = result.candidates.find((candidate) => candidate.code === ref) ?? result.assertions.find((assertion) => assertion.code === ref) ?? candidateById.get(ref.split("→")[0]);
    const targetId = target ? ("eventCandidateId" in target ? target.eventCandidateId : target.id) : null;
    return {
      id: item.id, object_code: item.code, kind: item.kind, summary: item.summary, target_event_candidate_id: targetId,
      parties: item.parties, source_segment_ids: [...new Set(item.parties.flatMap((party) => party.sourceSegmentIds))],
    };
  });
  const anchors = result.anchors.map((item) => ({ id: item.id, object_code: item.code, family: item.family, label: item.label, anchor_class: item.anchorClass, review_status: item.reviewStatus }));

  const generated = (type: string, id: string, key: string) => {
    const relationId = stableUuid("prov-relation", `${runId}:${key}:${id}`);
    return { id: relationId, object_code: objectCode("REL", relationId), from_node_type: type, from_node_id: id, relation_type: "was_generated_by", to_node_type: "provenance_activity", to_node_id: activityId, source_segment_ids: [] as string[] };
  };
  const derived = (type: string, id: string, segmentId: string) => {
    const relationId = stableUuid("prov-relation", `${runId}:derived:${id}:${segmentId}`);
    return { id: relationId, object_code: objectCode("REL", relationId), from_node_type: type, from_node_id: id, relation_type: "was_derived_from", to_node_type: "source_segment", to_node_id: segmentId, source_segment_ids: [segmentId] };
  };
  const usedRelations = result.runs.map((run) => {
    const relationId = stableUuid("prov-relation", `${runId}:used:${run.payload.run.id}`);
    return { id: relationId, object_code: objectCode("REL", relationId), from_node_type: "provenance_activity", from_node_id: activityId, relation_type: "used", to_node_type: "provenance_activity", to_node_id: stableUuid("prov-activity", `${run.payload.run.id}:knowledge`), source_segment_ids: [] as string[] };
  });

  return {
    schema_version: TEMPORAL_CONTEXT_CONTRACT,
    case_id: identity.caseId,
    proceeding_id: identity.proceedingId,
    runs: result.runs.map((run) => run.payload),
    context: {
      run: { id: runId, source_artifact_id: identity.sourceArtifactId, compiler_name: TEMPORAL_CONTEXT_COMPILER, compiler_version: TEMPORAL_CONTEXT_VERSION, extraction_method: "reviewed_import", extraction_contract_version: TEMPORAL_CONTEXT_CONTRACT, configuration_sha256: result.contentSha256 },
      candidate_context: result.candidates.map((item) => ({ event_candidate_id: item.id, candidate_kind: item.kind, anchor_family: item.anchorFamily, anchor_role: item.anchorRole, state_claim: item.stateClaim, knowledge_state: item.knowledge })),
      assertion_context: result.assertions.map((item) => ({
        temporal_assertion_id: item.id, assertion_form: item.form, adopted_from_question: item.adoptedFromQuestion,
        duration_min_seconds: item.durationSeconds?.min ?? null, duration_max_seconds: item.durationSeconds?.max ?? null, duration_vague: item.durationSeconds?.vague ?? false,
      })),
      anchors, constraints, links, conflicts,
      provenance_activities: [{ id: activityId, object_code: objectCode("ACT", activityId), activity_type: "temporal_context_compilation", compiler_name: TEMPORAL_CONTEXT_COMPILER, compiler_version: TEMPORAL_CONTEXT_VERSION, extraction_contract_version: TEMPORAL_CONTEXT_CONTRACT, configuration_sha256: result.contentSha256, system_agent: "reviewed_import" }],
      provenance_relations: [
        ...usedRelations,
        ...anchors.map((item) => generated("temporal_anchor_candidate", item.id, "anchor")),
        ...constraints.flatMap((item) => [generated("temporal_constraint", item.id, "constraint"), ...item.source_segment_ids.map((segmentId) => derived("temporal_constraint", item.id, segmentId))]),
        ...links.map((item) => generated("relationship", item.id, "link")),
        ...conflicts.flatMap((item) => [generated("flag", item.id, "conflict"), ...item.source_segment_ids.map((segmentId) => derived("flag", item.id, segmentId))]),
      ],
    },
    boundary: result.boundary,
  };
}
