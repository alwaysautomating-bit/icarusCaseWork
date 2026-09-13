export type LindsayFoundSourceSegment = {
  id: string;
  exact_text: string;
};

export type LindsayFoundSource = {
  key: string;
  segmentId: string;
  proceeding: string;
  witness: string;
  basis: string;
  label: string;
};

export type LindsayFoundFinding = {
  key: string;
  phase: "Discovery" | "Scene" | "Emergency care" | "Transport" | "Hospital documentation";
  title: string;
  text: string;
  status: "corroborated" | "source-linked" | "qualified";
  sourceKeys: string[];
};

type SourceRequirement = LindsayFoundSource & { expectedText: string };

const sourceRequirements: SourceRequirement[] = [
  { key: "patrick-location", segmentId: "eb45b2ce-9734-5cfa-a167-107a0d29c141", proceeding: "Day 2", witness: "Patrick Clancy", basis: "Family witness testimony", label: "Discovery in backyard", expectedText: "below that window" },
  { key: "patrick-position", segmentId: "67f62f50-d38a-5a2c-ac84-5927f1d58726", proceeding: "Day 2", witness: "Patrick Clancy", basis: "Family witness testimony", label: "Body position", expectedText: "head was closer to the house" },
  { key: "patrick-injuries", segmentId: "ad1d8157-7f60-5ef8-a37a-5d67bf19d4f1", proceeding: "Day 2", witness: "Patrick Clancy", basis: "Family witness testimony", label: "Initial injury observation", expectedText: "deep cuts on her wrists" },
  { key: "patrick-no-pressure", segmentId: "738b354c-19b0-5098-a9ae-f78be291b957", proceeding: "Day 2", witness: "Patrick Clancy", basis: "Family witness testimony", label: "No pressure applied", expectedText: "didn't at the time feel the need" },
  { key: "patrick-self-harm-statement", segmentId: "b3ffec55-58a2-5649-aa3d-bb7170c48090", proceeding: "Day 2", witness: "Patrick Clancy", basis: "Family witness testimony", label: "Statement after discovery", expectedText: "I tried to kill myself" },
  { key: "patrick-children-statement", segmentId: "15fa88ab-2467-5bd9-acea-2c357fbdba57", proceeding: "Day 2", witness: "Patrick Clancy", basis: "Family witness testimony", label: "Basement statement", expectedText: "They're in the basement" },

  { key: "hall-injuries", segmentId: "d683f323-7d41-5dd0-ad4f-d6936c703a99", proceeding: "Day 3", witness: "Officer Stephen Hall", basis: "First-responder testimony", label: "Wrist and neck cuts", expectedText: "cuts to both wrists" },
  { key: "hall-wrist-bleeding", segmentId: "f223f670-9b24-5061-ace8-9175fe6079c7", proceeding: "Day 3", witness: "Officer Stephen Hall", basis: "First-responder testimony", label: "Wrist bleeding assessment", expectedText: "actively bleeding" },
  { key: "hall-neck-bleeding", segmentId: "b31bf8d0-2428-5292-ad6a-eef8656fba54", proceeding: "Day 3", witness: "Officer Stephen Hall", basis: "First-responder testimony", label: "Neck bleeding assessment", expectedText: "actively bleeding" },
  { key: "hall-consciousness", segmentId: "b70fccf1-208d-58d8-ae7f-c025164d640a", proceeding: "Day 3", witness: "Officer Stephen Hall", basis: "First-responder testimony", label: "In-and-out consciousness", expectedText: "in and out of consciousness" },
  { key: "hall-speech", segmentId: "0f823c2e-1b1d-5668-a1fa-289c62d90c98", proceeding: "Day 3", witness: "Officer Stephen Hall", basis: "First-responder testimony", label: "Unable to speak", expectedText: "wasn't" },
  { key: "hall-sounds", segmentId: "9631bfaa-b1e9-55c9-aa39-0cb583eb74df", proceeding: "Day 3", witness: "Officer Stephen Hall", basis: "First-responder testimony", label: "Pain sounds", expectedText: "sounded like she was in pain" },
  { key: "josephine-response", segmentId: "1722434c-3fa1-5477-a673-25b5efacb63a", proceeding: "Day 3", witness: "Officer Brian Josephine", basis: "First-responder testimony", label: "Mumbled response", expectedText: "mumbled" },
  { key: "josephine-injuries", segmentId: "96c0a34e-0439-5cfe-ac14-d8e6e7e40a60", proceeding: "Day 3", witness: "Officer Brian Josephine", basis: "First-responder testimony", label: "Right wrist and neck observation", expectedText: "cuts to her right wrist" },
  { key: "josephine-bleeding", segmentId: "c2443a6f-c1f3-566d-aafd-2b4b6e9eedd7", proceeding: "Day 3", witness: "Officer Brian Josephine", basis: "First-responder testimony", label: "Bleeding not profuse", expectedText: "not profusely" },
  { key: "josephine-severity", segmentId: "288aeb59-67bf-5139-ab40-74f05dc79ee6", proceeding: "Day 3", witness: "Officer Brian Josephine", basis: "First-responder testimony", label: "First-aid severity assessment", expectedText: "appear life-threatening" },

  { key: "dougherty-injuries", segmentId: "cfe2ac31-18ca-58e4-ae8e-da8dfa4ca4ba", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Paramedic injury observation", expectedText: "lacerations to both wrists" },
  { key: "dougherty-dried-blood", segmentId: "526018dd-bfe2-5095-a5e6-40d1d94bbbfe", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Dried blood and no active bleed", expectedText: "dried blood" },
  { key: "dougherty-breathing", segmentId: "4c6291a0-5c1c-5d6e-acca-c2752be2aae5", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Independent breathing assessment", expectedText: "breathing on her own" },
  { key: "dougherty-response", segmentId: "2b477c0d-7285-5a3a-ad25-41e654c3a389", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Response to painful stimuli", expectedText: "painful stimuli" },
  { key: "dougherty-airway", segmentId: "440734cf-4bd0-53cc-a74e-cc6b893d372f", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Airway device", expectedText: "OPA device" },
  { key: "dougherty-oxygen", segmentId: "0b5c634c-9e87-5e57-a1c9-7859c49ad41b", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Oxygen mask", expectedText: "non-rebreather" },
  { key: "dougherty-bandaging", segmentId: "e37fe760-857a-55b7-a318-bc54df0c1ace", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Wound bandaging", expectedText: "bandaged them" },
  { key: "dougherty-spine", segmentId: "c7d0fd68-f6fa-525c-aad4-d5fb6971b964", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Spine precautions", expectedText: "spine precautions" },
  { key: "dougherty-transfer", segmentId: "1a7793d0-f11a-5179-aa39-92876fe44c90", proceeding: "Day 3", witness: "Paramedic Daniel Dougherty", basis: "Treating-responder testimony", label: "Pembroke ambulance assigned", expectedText: "she was going with Pembroke" },

  { key: "costanzo-scene", segmentId: "669324e2-2857-53f8-a0be-f243f80ecf1a", proceeding: "Day 3", witness: "Paramedic Robert Costanzo", basis: "Transport-paramedic testimony", label: "Condition at transfer", expectedText: "unresponsive, but breathing" },
  { key: "costanzo-wrists", segmentId: "664c5db8-8d45-5d3f-ac62-ad436b99e07e", proceeding: "Day 3", witness: "Paramedic Robert Costanzo", basis: "Transport-paramedic testimony", label: "Bandaged wrists", expectedText: "no active bleeding" },
  { key: "costanzo-neck", segmentId: "1be401b7-8408-5d2a-a4bb-b40c9a38555d", proceeding: "Day 3", witness: "Paramedic Robert Costanzo", basis: "Transport-paramedic testimony", label: "Neck observation limited by collar", expectedText: "didn't investigate any further" },
  { key: "costanzo-treatment", segmentId: "2ed5e190-8686-5944-a57b-095b38dfbf14", proceeding: "Day 3", witness: "Paramedic Robert Costanzo", basis: "Transport-paramedic testimony", label: "IV and Narcan treatment", expectedText: "potential opioid overdose" },
  { key: "costanzo-monitoring", segmentId: "529870ff-80e2-5804-af11-460d206e8a9d", proceeding: "Day 3", witness: "Paramedic Robert Costanzo", basis: "Transport-paramedic testimony", label: "Vital-sign monitoring", expectedText: "no decline" },
  { key: "costanzo-hospital", segmentId: "2505bd57-a61d-5fa9-ae1d-e4140429923b", proceeding: "Day 3", witness: "Paramedic Robert Costanzo", basis: "Transport-paramedic testimony", label: "Destination hospital", expectedText: "South Shore Hospital" },

  { key: "lippard-south-shore", segmentId: "3d91042f-7f2b-5226-a549-a0dc473a31be", proceeding: "Day 4", witness: "Officer Richard Lippard", basis: "Police hospital observation", label: "South Shore observation", expectedText: "seemed to be sedated" },
  { key: "lippard-transfer", segmentId: "d77cb0aa-5019-5aff-af7f-0a5b915540ad", proceeding: "Day 4", witness: "Officer Richard Lippard", basis: "Police hospital observation", label: "Medflight destination", expectedText: "med flighted to the Brigham" },

  { key: "stoffers-warming", segmentId: "9dc71880-81ea-55f3-aced-c768588d2c4c", proceeding: "Day 5", witness: "Sergeant Rose Stoffers", basis: "Hospital documentation testimony", label: "Blankets, warming devices, and collar", expectedText: "heating devices" },
  { key: "stoffers-movement", segmentId: "a5af1454-bc70-5b59-a26a-73a477e8fc16", proceeding: "Day 5", witness: "Sergeant Rose Stoffers", basis: "Hospital documentation testimony", label: "Arm movement during documentation", expectedText: "pulling it back" },
  { key: "stoffers-hands", segmentId: "81645efd-ca1b-50ac-a474-6c0468cb3376", proceeding: "Day 5", witness: "Sergeant Rose Stoffers", basis: "Hospital documentation testimony", label: "Red-brown hand staining", expectedText: "red-brown stain on her hands" },
  { key: "stoffers-photos", segmentId: "89e17208-02c2-53b0-a273-6ea30c4b0383", proceeding: "Day 5", witness: "Sergeant Rose Stoffers", basis: "Hospital documentation testimony", label: "Photographed areas", expectedText: "both her hands" },
];

const findings: LindsayFoundFinding[] = [
  { key: "location", phase: "Discovery", title: "Found face-up below the second-floor bedroom window", text: "Patrick testified that he found Lindsay face-up in the backyard directly below the bedroom window, with her head closer to the house and her feet pointing away. This establishes the location and position in which he found her; it does not, by itself, establish the mechanism by which she arrived there.", status: "corroborated", sourceKeys: ["patrick-location", "patrick-position"] },
  { key: "statements", phase: "Discovery", title: "Two statements immediately after discovery", text: "Patrick testified that, when asked what happened, Lindsay said, “I tried to kill myself.” When he asked where the children were, he testified that she answered, “They’re in the basement.” The report preserves these as attributed statements rather than independent findings about intent or events inside the house.", status: "source-linked", sourceKeys: ["patrick-self-harm-statement", "patrick-children-statement"] },
  { key: "condition", phase: "Scene", title: "Breathing, variably responsive, and unable to give a clear answer", text: "Hall described Lindsay as semi-conscious and moving in and out of consciousness, unable to speak, and making sounds consistent with pain. Josephine said she mumbled without giving a definite answer. Dougherty later testified that she was breathing on her own and responded mainly to painful stimuli or movement.", status: "corroborated", sourceKeys: ["hall-consciousness", "hall-speech", "hall-sounds", "josephine-response", "dougherty-breathing", "dougherty-response"] },
  { key: "wounds", phase: "Scene", title: "Wrist and neck wound descriptions remain witness-specific", text: "Patrick described deep wrist cuts and a red line across the neck. Hall saw cuts to both wrists and the left side of the neck and testified they were not actively bleeding. Josephine recalled cuts to the right wrist and right side of the neck that were bleeding, but not profusely, and did not appear life-threatening under his first-aid assessment. Dougherty described wrist and neck lacerations, dried blood, and no active bleeding. These descriptions are not collapsed into one severity finding.", status: "qualified", sourceKeys: ["patrick-injuries", "patrick-no-pressure", "hall-injuries", "hall-wrist-bleeding", "hall-neck-bleeding", "josephine-injuries", "josephine-bleeding", "josephine-severity", "dougherty-injuries", "dougherty-dried-blood"] },
  { key: "field-care", phase: "Emergency care", title: "Airway support, oxygen, bandaging, and spinal precautions", text: "Dougherty testified that responders used an oral airway device to keep the airway open, applied a non-rebreather oxygen mask, bandaged the wrist and neck areas, and used spinal precautions while moving Lindsay onto a backboard with a cervical collar.", status: "corroborated", sourceKeys: ["dougherty-airway", "dougherty-oxygen", "dougherty-bandaging", "dougherty-spine"] },
  { key: "transport", phase: "Transport", title: "Transferred breathing but unresponsive to the Pembroke ambulance", text: "Costanzo found Lindsay secured to a backboard with a collar, unresponsive but breathing, with bandaged wrists and no active bleeding visible through the bandages or around the collar. During transport, he placed two IVs and administered Narcan after observing constricted pupils and unresponsiveness; he described some increased reaching or agitation but no verbal response or full awakening. Her vital signs were monitored without a reported decline, and care was transferred at South Shore Hospital.", status: "qualified", sourceKeys: ["dougherty-transfer", "costanzo-scene", "costanzo-wrists", "costanzo-neck", "costanzo-treatment", "costanzo-monitoring", "costanzo-hospital"] },
  { key: "hospital", phase: "Hospital documentation", title: "Warming treatment, photographed injuries, and red-brown hand staining", text: "At South Shore, Stoffers observed Lindsay under blankets and heating devices with a neck collar. During injury documentation, Stoffers said Lindsay pulled her right arm back and resisted somewhat; she observed a red-brown stain on the hands and gauze at the wrists and photographed the face, neck, both sides of both hands, and wrist areas. Lippard separately recalled that Lindsay appeared sedated and did not speak while he was present; he later accompanied her medflight to Brigham and Women’s Hospital. These are law-enforcement observations, not medical diagnoses.", status: "qualified", sourceKeys: ["stoffers-warming", "stoffers-movement", "stoffers-hands", "stoffers-photos", "lippard-south-shore", "lippard-transfer"] },
];

const heldDetails = [
  { key: "hand-stain-identity", detail: "Composition and source of the red-brown stain on Lindsay’s hands", reason: "Stoffers documented its appearance and location. That testimony does not identify the substance as blood or establish whose biological material it was. A laboratory result, stipulation, or qualified testimony is required before promotion." },
  { key: "internal-injuries", detail: "Definitive spinal, rib, or internal-injury diagnoses and later medical course", reason: "Questions put to a transport paramedic referred to serious internal injuries, but the paramedic did not know of them. Add the treating-clinician testimony or medical record before reporting the diagnoses or their extent as findings." },
];

export function lindsayFoundSourceRequirements() {
  return sourceRequirements.map((source) => ({ ...source }));
}

export function lindsayFoundSourceSegmentIds() {
  return sourceRequirements.map((source) => source.segmentId);
}

export function buildLindsayFoundReport(segments: LindsayFoundSourceSegment[]) {
  const segmentById = new Map(segments.map((segment) => [segment.id, segment.exact_text]));
  const missingSourceKeys = sourceRequirements
    .filter((source) => !segmentById.get(source.segmentId)?.toLocaleLowerCase().includes(source.expectedText.toLocaleLowerCase()))
    .map((source) => source.key);

  return {
    available: missingSourceKeys.length === 0,
    missingSourceKeys,
    sources: sourceRequirements.map(({ key, segmentId, proceeding, witness, basis, label }) => ({
      key,
      segmentId,
      proceeding,
      witness,
      basis,
      label,
    })),
    findings,
    heldDetails,
  };
}
