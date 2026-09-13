export type AccountAssertion = {
  ref: string;
  witness: string;
  neutral_description: string;
  event_class: string;
  source_wording: string;
  raw_temporal_language: string;
  precision: string;
  qualification: string;
  source_segment_ids: string[];
};

export type AccountReconstructionSnapshot = {
  assertions: AccountAssertion[];
  nodes: Array<{
    key: string;
    title: string;
    summary: string;
    temporalLabel: string;
    assertionRefs: string[];
    ordinal: number;
    status: string;
  }>;
  tensions: Array<{
    key: string;
    title: string;
    field: string;
    assertionRefs: string[];
    note: string;
    status: string;
  }>;
};

export type AccountTimelineItem = {
  ref: string;
  proposedPosition: number;
  nodeKey: string;
  nodeTitle: string;
  nodeSummary: string;
  nodeStatus: string;
  temporalLabel: string;
  statement: string;
  eventClass: string;
  sourceWording: string;
  rawTemporalLanguage: string;
  precision: string;
  qualification: string;
  sourceSegmentIds: string[];
  alignedWitnesses: string[];
  tensionKeys: string[];
};

export type WitnessAccountTimeline = {
  key: string;
  witness: string;
  items: AccountTimelineItem[];
  sourceSegmentCount: number;
  tensionCount: number;
};

export function witnessAccountKey(witness: string) {
  return witness.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildWitnessAccountTimelines(snapshot: AccountReconstructionSnapshot): WitnessAccountTimeline[] {
  const assertionByRef = new Map(snapshot.assertions.map((assertion) => [assertion.ref, assertion]));
  const tensionsByRef = new Map<string, string[]>();
  for (const tension of snapshot.tensions) {
    for (const ref of tension.assertionRefs) {
      tensionsByRef.set(ref, [...(tensionsByRef.get(ref) ?? []), tension.key]);
    }
  }

  const itemsByWitness = new Map<string, AccountTimelineItem[]>();
  for (const node of [...snapshot.nodes].sort((a, b) => a.ordinal - b.ordinal)) {
    const nodeAssertions = node.assertionRefs.flatMap((ref) => {
      const assertion = assertionByRef.get(ref);
      return assertion ? [assertion] : [];
    });

    for (const assertion of nodeAssertions) {
      const alignedWitnesses = [...new Set(nodeAssertions
        .map((item) => item.witness)
        .filter((witness) => witness !== assertion.witness))];
      const item: AccountTimelineItem = {
        ref: assertion.ref,
        proposedPosition: node.ordinal,
        nodeKey: node.key,
        nodeTitle: node.title,
        nodeSummary: node.summary,
        nodeStatus: node.status,
        temporalLabel: node.temporalLabel,
        statement: assertion.neutral_description,
        eventClass: assertion.event_class,
        sourceWording: assertion.source_wording,
        rawTemporalLanguage: assertion.raw_temporal_language,
        precision: assertion.precision,
        qualification: assertion.qualification,
        sourceSegmentIds: assertion.source_segment_ids,
        alignedWitnesses,
        tensionKeys: tensionsByRef.get(assertion.ref) ?? [],
      };
      itemsByWitness.set(assertion.witness, [...(itemsByWitness.get(assertion.witness) ?? []), item]);
    }
  }

  return [...itemsByWitness.entries()]
    .map(([witness, items]) => ({
      key: witnessAccountKey(witness),
      witness,
      items,
      sourceSegmentCount: new Set(items.flatMap((item) => item.sourceSegmentIds)).size,
      tensionCount: new Set(items.flatMap((item) => item.tensionKeys)).size,
    }))
    .sort((a, b) => {
      const firstA = a.items[0]?.proposedPosition ?? Number.MAX_SAFE_INTEGER;
      const firstB = b.items[0]?.proposedPosition ?? Number.MAX_SAFE_INTEGER;
      return firstA - firstB || a.witness.localeCompare(b.witness);
    });
}
