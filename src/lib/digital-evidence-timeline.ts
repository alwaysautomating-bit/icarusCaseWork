export type DigitalEvidenceSourceSegment = {
  id: string;
  ordinal: number;
  exact_text: string;
};

export type DigitalEvidenceTimelineItem = {
  key: string;
  displayTimestamp: string;
  occurredAt: string;
  artifactType: string;
  sourceSystem: string;
  device: string;
  headline: string;
  summary: string;
  recordedValue: string;
  timestampPrecision: "minute" | "second";
  timestampBasis: string;
  attributionBoundary: string;
  interpretationBoundary: string;
  sourceSegmentIds: string[];
  sourceExcerpt: string;
};

type DigitalEvidenceDefinition = Omit<DigitalEvidenceTimelineItem, "sourceExcerpt"> & {
  expectedPrimaryText: string;
};

const definitions: DigitalEvidenceDefinition[] = [
  {
    key: "threev-apple-maps",
    displayTimestamp: "16:13:--",
    occurredAt: "2023-01-24T16:13:00-05:00",
    artifactType: "map activity",
    sourceSystem: "Apple Maps",
    device: "iPhone extraction",
    headline: "ThreeV Restaurant appears in Apple Maps.",
    summary: "The examiner confirmed that the extraction displayed ThreeV Restaurant in Apple Maps at 4:13 PM.",
    recordedValue: "ThreeV Restaurant",
    timestampPrecision: "minute",
    timestampBasis: "Timestamp displayed in the phone-extraction report as described in testimony.",
    attributionBoundary: "The record is linked to the extracted phone. This card does not independently identify the physical user.",
    interpretationBoundary: "A Maps artifact does not by itself prove that a route was started, followed, or used for a particular purpose.",
    sourceSegmentIds: ["8a854678-0466-5f3f-a6b0-5fdf49655a24", "071e5c2c-94ba-5148-af53-6700e1027595"],
    expectedPrimaryText: "ThreeV Restaurant at 4:13 PM",
  },
  {
    key: "threev-menu-1643",
    displayTimestamp: "16:43:--",
    occurredAt: "2023-01-24T16:43:00-05:00",
    artifactType: "web search",
    sourceSystem: "Cellebrite parsed data",
    device: "iPhone extraction",
    headline: "A search for the ThreeV menu is recorded.",
    summary: "The examiner agreed that repeated rows at the same time represented one search parsed into multiple categories.",
    recordedValue: "ThreeV menu",
    timestampPrecision: "minute",
    timestampBasis: "Timestamp displayed in the extraction report; seconds were not stated in this testimony passage.",
    attributionBoundary: "The artifact is associated with the extracted phone; physical-user identity remains a separate proposition.",
    interpretationBoundary: "Duplicate Cellebrite categories are not counted as separate searches.",
    sourceSegmentIds: ["3e8f1a85-e408-5829-ad8d-91a8e24c6478", "01d2105a-6120-54fe-aa1b-c02605782b3d", "166da9a0-af7b-544a-a572-ac2eeec4e074", "e5d29385-b31b-581c-ac2f-0d4afbab858a"],
    expectedPrimaryText: "4:43 PM on January 24th",
  },
  {
    key: "miralax-search-164655",
    displayTimestamp: "16:46:55",
    occurredAt: "2023-01-24T16:46:55-05:00",
    artifactType: "web search",
    sourceSystem: "Cellebrite parsed data",
    device: "iPhone extraction",
    headline: "A search for MiraLAX for kids is recorded.",
    summary: "The examiner explained that identical rows across categories reflected a single underlying search.",
    recordedValue: "MiraLAX for kids",
    timestampPrecision: "second",
    timestampBasis: "Second-level timestamp displayed in the extraction report as described in testimony.",
    attributionBoundary: "The artifact is device-linked; this view does not silently convert device association into user identity.",
    interpretationBoundary: "Multiple parsed rows with this timestamp are treated as one artifact, not repeated activity.",
    sourceSegmentIds: ["de63109f-e3ef-554f-ab16-d73e6cb4c8f8", "33ed0935-99aa-545a-a9c9-96be02ed0aec"],
    expectedPrimaryText: "MiraLAX for kids, 4:46:55",
  },
  {
    key: "cvs-web-artifact-164704",
    displayTimestamp: "16:47:04",
    occurredAt: "2023-01-24T16:47:04-05:00",
    artifactType: "web artifact",
    sourceSystem: "Cellebrite parsed data",
    device: "iPhone extraction",
    headline: "A CVS website artifact is recorded.",
    summary: "The examiner confirmed a parsed CVS website artifact and cautioned that the tool categorized it in multiple places.",
    recordedValue: "CVS website",
    timestampPrecision: "second",
    timestampBasis: "Second-level timestamp displayed in the extraction report as described in testimony.",
    attributionBoundary: "The artifact is associated with the extracted phone, not an independently authenticated physical user.",
    interpretationBoundary: "The testimony establishes a parsed web artifact, not the duration or purpose of the visit.",
    sourceSegmentIds: ["86372a35-8e4d-521d-a26b-9031662c0d29", "31d1d34a-2263-561c-ae45-6e9e30fdfa8a"],
    expectedPrimaryText: "CVS website here at 4:47:04",
  },
  {
    key: "cvs-outgoing-call-164821",
    displayTimestamp: "16:48:21",
    occurredAt: "2023-01-24T16:48:21-05:00",
    artifactType: "call record",
    sourceSystem: "Phone call history",
    device: "iPhone extraction",
    headline: "An outgoing call to Kingston CVS is recorded.",
    summary: "The examiner confirmed the number as CVS at 189 Summer Street in Kingston and the record as outgoing from the phone.",
    recordedValue: "Outgoing · 781-585-6581 · Kingston CVS",
    timestampPrecision: "second",
    timestampBasis: "Second-level call-history timestamp described in testimony.",
    attributionBoundary: "Direction and device association are recorded; the card does not independently prove who spoke on the call.",
    interpretationBoundary: "The call record does not establish whether the call connected, its content, or its purpose.",
    sourceSegmentIds: ["e2ff4b2d-ecfa-5b4d-a836-35917f20d08a", "6a9e38ae-1b4d-5b49-ac92-3dae2bb66b8e", "a61c4dc4-78e5-5232-a6b9-f25348eed1b1", "d0ea57db-5e5c-59f0-a306-44938924ed4f"],
    expectedPrimaryText: "outgoing phone call at 4:48:21",
  },
  {
    key: "threev-message-165309",
    displayTimestamp: "16:53:09",
    occurredAt: "2023-01-24T16:53:09-05:00",
    artifactType: "message",
    sourceSystem: "Messages",
    device: "iPhone extraction",
    headline: "An outgoing ThreeV takeout message is recorded.",
    summary: "The extraction displayed message 80 as outgoing from the phone to Patrick Clancy; the examiner confirmed its content.",
    recordedValue: "Any chance you want to do takeout from ThreeV? I didn't cook anything. It's been a long day.",
    timestampPrecision: "second",
    timestampBasis: "Second-level message timestamp displayed in the extraction report as described in testimony.",
    attributionBoundary: "The report labels the message outgoing from the phone and identifies the account endpoints; physical authorship remains analytically distinct.",
    interpretationBoundary: "Message content and timestamp are displayed without assigning motive or treating the message as proof of a surrounding event.",
    sourceSegmentIds: ["985af602-3ddf-564a-ab1d-32b97e4b0502", "943c7d6a-61b0-5ac8-a806-9a28a4354cdb", "0f9547cb-b9f7-5d20-a490-e82079e4e45f", "e541384d-7098-5a70-ab22-d16c0b9f8d83"],
    expectedPrimaryText: "message 80 outgoing",
  },
  {
    key: "parallel-tabs-170645",
    displayTimestamp: "17:06:45",
    occurredAt: "2023-01-24T17:06:45-05:00",
    artifactType: "browser artifacts",
    sourceSystem: "Safari parsed data",
    device: "iPhone extraction",
    headline: "ThreeV menu and Pedia-Lax artifacts share a timestamp.",
    summary: "The examiner said explaining the shared timestamp required inference and suggested that more than one browser tab may have been open.",
    recordedValue: "ThreeV menu · Pedia-Lax",
    timestampPrecision: "second",
    timestampBasis: "Shared second-level timestamp displayed for two Safari artifacts in the extraction report.",
    attributionBoundary: "The timestamp belongs to parsed device artifacts; it does not establish who selected either tab.",
    interpretationBoundary: "The multiple-tab explanation is explicitly preserved as examiner inference, not artifact fact.",
    sourceSegmentIds: ["dee0b7cb-f237-5d8c-abae-59becc77daa3", "2cc6888e-e403-541e-ad0c-9ab3d455a26b", "1b34c5a1-ba84-586d-a7c8-54ea653b9d8f", "537f9f57-40cf-5f98-a82f-64e9fcb66786"],
    expectedPrimaryText: "5:06:45",
  },
  {
    key: "pedialax-message-171500",
    displayTimestamp: "17:15:--",
    occurredAt: "2023-01-24T17:15:00-05:00",
    artifactType: "message",
    sourceSystem: "Messages",
    device: "iPhone extraction",
    headline: "An outgoing Pedia-Lax message is recorded.",
    summary: "The examiner confirmed a message from the phone to Patrick containing a product description.",
    recordedValue: "Pedia-Lax liquid stool softener",
    timestampPrecision: "minute",
    timestampBasis: "Minute-level message time stated in testimony; seconds were not supplied in this passage.",
    attributionBoundary: "The message is linked to the extracted phone and named endpoints; physical authorship remains separate.",
    interpretationBoundary: "The message is shown in sequence without inferring whether a purchase occurred or why the information was sent.",
    sourceSegmentIds: ["0de0a447-be22-5a39-a1a2-3a05c36bca47", "75c7124b-dc10-5f5d-abc5-539b39867b16"],
    expectedPrimaryText: "message from Lindsay to Patrick at 5:15 PM",
  },
];

export function digitalEvidenceSourceSegmentIds() {
  return [...new Set(definitions.flatMap((definition) => definition.sourceSegmentIds))];
}

export function buildDigitalEvidenceTimeline(segments: DigitalEvidenceSourceSegment[]) {
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const missingKeys: string[] = [];
  const items = definitions.flatMap((definition) => {
    const { expectedPrimaryText, ...item } = definition;
    const sources = definition.sourceSegmentIds.flatMap((id) => {
      const segment = segmentById.get(id);
      return segment ? [segment] : [];
    });
    if (sources.length !== definition.sourceSegmentIds.length || !sources[0]?.exact_text.includes(expectedPrimaryText)) {
      missingKeys.push(definition.key);
      return [];
    }
    return [{ ...item, sourceExcerpt: sources.map((source) => source.exact_text).join(" ") }];
  });
  return { items, missingKeys };
}
