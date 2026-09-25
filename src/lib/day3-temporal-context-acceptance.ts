import type { ParsedRevTranscript } from "@/lib/rev-testimony";
import {
  compileTemporalContext,
  type AnchorClass,
  type AnchorRole,
  type CandidateKind,
  type ConstraintDerivation,
  type TemporalAccount,
  type TemporalRelationSpec,
  type TemporalStatement,
} from "@/lib/temporal-context";
import type { TemporalRelation } from "@/lib/temporal-lexicon";

/** Day 3 Rev transcript, ordinals from the committed segment list. */
export const DAY3_TEMPORAL_ACCOUNTS = {
  hall: { key: "day3-hall", importedId: "witness_001", label: "Officer Stephen Hall" },
  josephine: { key: "day3-josephine", importedId: "witness_002", label: "Officer Brian Josephine" },
} as const;

type WitnessKey = keyof typeof DAY3_TEMPORAL_ACCOUNTS;
type EventInput = {
  key: string; desc: string; cls: string; src: number[]; wording: string; time: number[]; when: string;
  kind?: CandidateKind; adopted?: boolean; participants?: string[];
  anchor?: { family: string; class: AnchorClass; role?: AnchorRole; label?: string };
  state?: { key: string; value: string }; knowledge?: { holder: string; proposition: string };
  extra?: Array<{ when: string; time: number[]; adopted?: boolean }>;
};

function builder(transcript: ParsedRevTranscript, who: WitnessKey) {
  const witness = DAY3_TEMPORAL_ACCOUNTS[who];
  const ids = (ordinals: number[]) => ordinals.map((ordinal) => {
    const segment = transcript.segments[ordinal];
    if (!segment || segment.ordinal !== ordinal) throw new Error(`Missing Day 3 segment ${ordinal}.`);
    return segment.id;
  });
  const statements: TemporalStatement[] = [];
  const relations: TemporalRelationSpec[] = [];
  return {
    statement(key: string, summary: string, claimText: string, events: EventInput[], options: {
      basis?: "PERSONALLY_OBSERVED" | "HEARD_FROM_PERSON" | "RECALLED"; status?: "asserted" | "qualified"; unknowns?: string[];
      mentions?: Array<{ key: string; raw: string; type: string; at: number[] }>;
    } = {}) {
      const all = [...new Set(events.flatMap((event) => [...event.src, ...event.time, ...(event.extra ?? []).flatMap((extra) => extra.time)]))].sort((a, b) => a - b);
      const claimSegments = [...new Set(events.flatMap((event) => event.src))].sort((a, b) => a - b);
      statements.push({
        key, witnessBlockImportedId: witness.importedId, unitKind: "qa_thread", sourceSegmentIds: ids(all), summary, unknowns: options.unknowns ?? [],
        claim: { key: `${key}-claim`, assertedByRaw: witness.label, speakerCapacity: "witness", normalizedAssertion: claimText, assertionStatus: options.status ?? "asserted", informationBasis: options.basis ?? "PERSONALLY_OBSERVED", sourceSegmentIds: ids(claimSegments), extractionConfidence: 1 },
        entityMentions: (options.mentions ?? []).map((mention) => ({ key: mention.key, rawMention: mention.raw, mentionType: mention.type, sourceSegmentIds: ids(mention.at) })),
        events: events.map((event) => ({
          key: event.key, neutralDescription: event.desc, eventClass: event.cls, sourceClaimKey: `${key}-claim`,
          sourceWording: event.wording, sourceSegmentIds: ids(event.src), temporalWording: event.when, temporalSourceSegmentIds: ids(event.time),
          participantMentions: event.participants ?? [witness.label], extractionConfidence: 1,
          temporalAdoptedFromQuestion: event.adopted ?? false,
          additionalTemporal: (event.extra ?? []).map((extra) => ({ wording: extra.when, sourceSegmentIds: ids(extra.time), adoptedFromQuestion: extra.adopted ?? false })),
          kind: event.kind, anchor: event.anchor, stateClaim: event.state, knowledge: event.knowledge,
        })),
      });
    },
    relate(key: string, from: string, relation: TemporalRelation, to: string, wording: string, at: number[], derivation: ConstraintDerivation = "sequence_wording") {
      relations.push({ key, from, relation, to, wording, sourceSegmentIds: ids(at), derivation });
    },
    build(): TemporalAccount { return { accountKey: witness.key, witnessLabel: witness.label, statements, relations }; },
  };
}

function hallAccount(transcript: ParsedRevTranscript) {
  const b = builder(transcript, "hall");
  b.statement("hall-dispatch", "Hall affirmed counsel's premise that he was dispatched at approximately 6:11 PM.",
    "Hall received a dispatch to 47 Summer Street at approximately 6:11 PM, a time stated in counsel's question that he affirmed.",
    [{ key: "dispatch", desc: "Stephen Hall received a dispatch to 47 Summer Street.", cls: "dispatch_received", src: [55, 56], wording: "did you receive a dispatch to go to 47 Summer Street in Duxbury?", time: [55], when: "approximately 6:11 PM", adopted: true, anchor: { family: "dispatch", class: "CLOCK", label: "Dispatch to 47 Summer Street" } }],
    { unknowns: ["The 6:11 PM time is counsel's premise; Hall answered only \"I did.\""], mentions: [{ key: "address", raw: "47 Summer Street in Duxbury", type: "location", at: [55] }] });
  b.statement("hall-travel", "Hall estimated a seven-to-ten-minute response from Lincoln Street Fields.",
    "Hall estimated that reaching 47 Summer Street took seven to ten minutes.",
    [{ key: "travel", desc: "Stephen Hall traveled from Lincoln Street Fields to 47 Summer Street.", cls: "emergency_response_travel", src: [58, 59, 60], wording: "how long did it take you to get from there to 47 Summer Street?", time: [60], when: "Seven to 10 minutes.", anchor: { family: "response-travel", class: "ARRIVAL_DEPARTURE", label: "Police response travel duration" } }],
    { status: "qualified", mentions: [{ key: "fields", raw: "the Lincoln Street Fields in Duxbury", type: "location", at: [58] }] });
  b.statement("hall-arrival", "Hall said he arrived simultaneously with Officer Josephine and found a gate open.",
    "Hall arrived at 47 Summer Street simultaneously with Officer Josephine and observed an open gate on arrival.",
    [
      { key: "arrival", desc: "Stephen Hall arrived at 47 Summer Street with Brian Josephine.", cls: "arrival", src: [72], wording: "I arrived simultaneously with Officer Josephine.", time: [72], when: "simultaneously with Officer Josephine", anchor: { family: "police-arrival", class: "ARRIVAL_DEPARTURE", label: "First police arrival" } },
      { key: "gate-open", desc: "Stephen Hall observed an open gate on the left side of the house on arrival.", cls: "state_observation", kind: "state_observation", src: [64], wording: "There was a gate open on the left side of the house.", time: [64], when: "When I arrived" },
    ], { mentions: [{ key: "josephine", raw: "Officer Josephine", type: "person", at: [72] }] });
  b.statement("hall-lindsay", "Hall described Lindsay Clancy on the ground; no time is stated.",
    "Hall saw Lindsay Clancy on the ground with cuts to both wrists and the left side of her neck.",
    [{ key: "lindsay-observed", desc: "Stephen Hall observed Lindsay Clancy on the ground with cuts.", cls: "medical_observation", src: [119], wording: "She had cuts to both wrists and to the left side of her neck.", time: [119], when: "She had cuts to both wrists and to the left side of her neck." }],
    { unknowns: ["No time is given for this observation."] });
  b.statement("hall-patrick-name", "Hall said he later learned the man's name was Patrick Clancy.",
    "Hall met a male in the backyard and later learned his name was Patrick Clancy.",
    [
      { key: "male-encountered", desc: "Stephen Hall encountered a male in the backyard.", cls: "encounter", src: [81, 82], wording: "did you encounter a male in the backyard?", time: [81], when: "did you encounter a male in the backyard", participants: ["Stephen Hall", "unidentified male"] },
      { key: "learns-patrick", desc: "Stephen Hall came to know that the man's name was Patrick Clancy.", cls: "knowledge_change", kind: "knowledge_state", src: [83, 84], wording: "did you later learn his name was Patrick Clancy?", time: [83], when: "did you later learn his name was Patrick Clancy?", knowledge: { holder: "Stephen Hall", proposition: "The man in the backyard was Patrick Clancy." } },
    ], { mentions: [{ key: "male", raw: "a male in the backyard", type: "person", at: [81] }] });
  b.statement("hall-fire", "Hall heard sirens as firefighters arrived and went to the gate.",
    "While Hall and Josephine were at the scene, firefighters began to arrive and Hall directed them from the gate.",
    [{ key: "fire-arrival", desc: "Firefighters began arriving at 47 Summer Street.", cls: "arrival", src: [138, 139], wording: "They started to arrive and I went to gate to direct them where to go.", time: [138], when: "While you and Officer Josephine are there", anchor: { family: "fire-arrival", class: "ARRIVAL_DEPARTURE", label: "Fire personnel arrive" } }],
    { mentions: [{ key: "fire", raw: "firefighters", type: "group", at: [138] }] });
  b.statement("hall-patrick-inside", "Hall said Patrick went inside at one point.",
    "At one point Patrick Clancy went inside toward the back slider to check on his children.",
    [{ key: "patrick-enters", desc: "Patrick Clancy went inside the house.", cls: "movement", src: [145, 147], wording: "At one point, he went inside to say he was going to check on his children.", time: [145], when: "At one point", participants: ["Patrick Clancy", "the children"], anchor: { family: "patrick-enters-house", class: "TRANSITION", label: "Patrick goes inside" } }]);
  b.statement("hall-radio", "Hall heard a radio relay that Patrick could not wake them.",
    "Shortly after Patrick went inside, Hall heard dispatch say over the radio that he couldn't wake them up; Hall did not initially know what that meant.",
    [
      { key: "radio-relay", desc: "Dispatch relayed over the radio that Patrick could not wake them up.", cls: "dispatch_relay", src: [151], wording: "Dispatch said that he couldn't wake them up.", time: [148], when: "Shortly after Patrick Clancy went inside the home", participants: ["Dispatch", "Patrick Clancy"], anchor: { family: "dispatch-relay", class: "INFORMATION", label: "Dispatch relays that Patrick cannot wake them" } },
      { key: "knows-cannot-wake", desc: "Stephen Hall received the information that Patrick could not wake them.", cls: "knowledge_change", kind: "knowledge_state", src: [151, 152, 153], wording: "Not really, no.", time: [151], when: "Dispatch said that he couldn't wake them up.", knowledge: { holder: "Stephen Hall", proposition: "Patrick Clancy could not wake 'them'." } },
    ], { basis: "HEARD_FROM_PERSON", status: "qualified", mentions: [{ key: "dispatch", raw: "Dispatch", type: "organization", at: [151] }] });
  b.statement("hall-scream", "Hall heard a loud scream from inside and he and Josephine entered through the slider.",
    "Hall heard a loud scream from inside the house, after which he and Josephine ran to the slider and entered the kitchen.",
    [
      { key: "scream", desc: "Stephen Hall heard a loud scream from inside the house.", cls: "auditory_observation", src: [154, 155], wording: "I heard a loud scream from inside.", time: [154], when: "Did something then catch your attention?", participants: ["Stephen Hall", "unidentified screamer"], anchor: { family: "scream", class: "SHARED_OBSERVATION", label: "Loud scream heard from inside" } },
      { key: "kitchen-entry", desc: "Stephen Hall and Brian Josephine entered the house through the slider into the kitchen.", cls: "scene_entry", src: [160, 161, 162, 163], wording: "Myself and Officer Josephine ran towards the slider and entered into the house.", time: [160], when: "When you heard that screaming", participants: ["Stephen Hall", "Brian Josephine"], anchor: { family: "kitchen-entry", class: "TRANSITION", label: "Officers enter the kitchen" } },
      { key: "kitchen-screaming", desc: "Stephen Hall observed the condition of the screaming when he entered the kitchen.", cls: "state_observation", kind: "state_observation", src: [164, 165], wording: "We could hear he was talking, but there was screaming was done.", time: [164], when: "when you entered into the kitchen", state: { key: "screaming-at-kitchen-entry", value: "ended" } },
    ]);
  b.statement("hall-basement-statement", "Hall recalled Patrick saying he could not wake them.",
    "Once at the bottom of the basement stairs, Hall recalled hearing Patrick say he could not wake them, affirming counsel's quoted words.",
    [{ key: "patrick-statement", desc: "Hall heard Patrick Clancy say he could not wake or get up the children.", cls: "reported_statement", src: [187, 188], wording: "Do you recall him saying, \"I can't wake them up. I can't get them Up?\"", time: [178], when: "Once you got to the bottom of the stairs", participants: ["Patrick Clancy", "the children"], anchor: { family: "patrick-statement-right-basement", class: "SHARED_OBSERVATION", label: "Patrick's statement in the right basement" } }],
    { basis: "HEARD_FROM_PERSON", status: "qualified", unknowns: ["Hall first said he did not recall the words before affirming counsel's quotation."] });
  b.statement("hall-dawson", "Hall found Dawson, then took him with Josephine to the ambulance.",
    "Hall found a young child in the back room; then Hall called for paramedics and Josephine carried the child to the ambulance.",
    [
      { key: "finds-dawson", desc: "Stephen Hall saw a child's body in the basement back room.", cls: "victim_discovery", src: [222, 223], wording: "there was a body of a young child.", time: [222], when: "what did you see when you got to that back room?" },
      { key: "child-to-ambulance", desc: "Officer Josephine picked up the child and they ran him outside to the ambulance.", cls: "patient_removal", src: [245], wording: "Officer Josephine picked up the child and we ran him outside through the front door to the ambulance.", time: [244], when: "What happened next?", participants: ["Stephen Hall", "Brian Josephine", "the child"], anchor: { family: "dawson-to-ambulance", class: "TRANSITION", label: "First child carried to the ambulance" } },
    ], { mentions: [{ key: "paramedics", raw: "paramedics", type: "group", at: [245] }] });
  b.statement("hall-return", "Hall returned to the basement, said Patrick's plural wording made him look for other children, and saw EMS already working.",
    "After giving the child to EMTs Hall returned to the basement; on entering the left side he saw EMTs and paramedics already working on two children.",
    [
      { key: "return-basement", desc: "Stephen Hall and Brian Josephine returned to the basement to look for other children.", cls: "search", src: [246, 247], wording: "We ran back down into the basement to check to see if we could find other children.", time: [246], when: "after that after giving Dawson to EMTs", participants: ["Stephen Hall", "Brian Josephine"], anchor: { family: "left-basement-return", class: "TRANSITION", label: "Officers return to the basement" } },
      { key: "suspects-others", desc: "Stephen Hall thought there were other children because of Patrick's plural wording.", cls: "knowledge_change", kind: "knowledge_state", src: [248, 249], wording: "When Patrick Clancy said, \"Well, I can't wake them up,\" instead of just the singular.", time: [249], when: "When Patrick Clancy said", knowledge: { holder: "Stephen Hall", proposition: "There may be other children in the house." } },
      { key: "ems-working", desc: "Stephen Hall observed EMTs and paramedics working on two children in the left basement.", cls: "state_observation", kind: "state_observation", src: [266, 267], wording: "EMTs and paramedics were working on them.", time: [266, 267], when: "EMTs and paramedics were working on them", anchor: { family: "ems-care-left-basement", class: "STATE", role: "prior_state_origin", label: "EMS care underway in the left basement" } },
    ], { mentions: [{ key: "children", raw: "two children on the floor", type: "person", at: [267] }] });

  b.relate("dispatch-before-arrival", "dispatch", "BEFORE_OR_AT", "arrival", "what did you see when you arrived there?", [63]);
  b.relate("arrival-at-gate", "arrival", "AT", "gate-open", "When I arrived", [64], "simultaneity_wording");
  b.relate("male-before-learns", "male-encountered", "BEFORE", "learns-patrick", "did you later learn his name was Patrick Clancy?", [83]);
  b.relate("inside-before-radio", "patrick-enters", "BEFORE", "radio-relay", "Shortly after Patrick Clancy went inside the home", [148]);
  b.relate("fire-overlaps-inside", "fire-arrival", "OVERLAPS", "patrick-enters", "While you were doing this", [144]);
  b.relate("radio-to-knowledge", "radio-relay", "BEFORE_OR_AT", "knows-cannot-wake", "Dispatch said that he couldn't wake them up.", [151], "knowledge_flow");
  b.relate("radio-before-scream", "radio-relay", "BEFORE", "scream", "Did something then catch your attention?", [154]);
  b.relate("scream-before-entry", "scream", "BEFORE_OR_AT", "kitchen-entry", "When you heard that screaming", [160]);
  b.relate("entry-at-kitchen-state", "kitchen-entry", "AT", "kitchen-screaming", "when you entered into the kitchen", [164], "simultaneity_wording");
  b.relate("entry-before-statement", "kitchen-entry", "BEFORE_OR_AT", "patrick-statement", "Once you got to the bottom of the stairs", [178]);
  b.relate("finds-before-carry", "finds-dawson", "BEFORE", "child-to-ambulance", "What happened next?", [244]);
  b.relate("carry-before-return", "child-to-ambulance", "BEFORE", "return-basement", "after that after giving Dawson to EMTs", [246]);
  b.relate("statement-to-suspicion", "patrick-statement", "BEFORE_OR_AT", "suspects-others", "When Patrick Clancy said", [249], "knowledge_flow");
  b.relate("return-at-ems", "return-basement", "BEFORE_OR_AT", "ems-working", "when you went into that room", [266]);
  return b.build();
}

function josephineAccount(transcript: ParsedRevTranscript) {
  const b = builder(transcript, "josephine");
  b.statement("j-dispatch", "Josephine affirmed counsel's premise that he was dispatched at approximately 6:11 PM.",
    "Josephine received a dispatch to 47 Summer Street at approximately 6:11 PM, a time stated in counsel's question that he affirmed.",
    [{ key: "dispatch", desc: "Brian Josephine received a dispatch to 47 Summer Street.", cls: "dispatch_received", src: [360, 361], wording: "did you receive a dispatch at approximately 6:11 PM to go to 47 Summer Street in Duxbury?", time: [360], when: "approximately 6:11 PM", adopted: true, anchor: { family: "dispatch", class: "CLOCK", label: "Dispatch to 47 Summer Street" } }],
    { unknowns: ["The 6:11 PM time is counsel's premise; Josephine answered \"Yes, we did.\""] });
  b.statement("j-travel", "Josephine estimated a three-to-four-minute response.",
    "Josephine estimated that reaching 47 Summer Street took three to four minutes.",
    [{ key: "travel", desc: "Brian Josephine traveled to 47 Summer Street.", cls: "emergency_response_travel", src: [368, 369], wording: "I would say anywhere from three to four minutes.", time: [369], when: "I would say anywhere from three to four minutes.", anchor: { family: "response-travel", class: "ARRIVAL_DEPARTURE", label: "Police response travel duration" } }],
    { status: "qualified" });
  b.statement("j-arrival", "Josephine described parking on the street and finding the house.",
    "Josephine parked in the street after roughly fifteen seconds spent identifying the house, then went to the mudroom door.",
    [{ key: "arrival", desc: "Brian Josephine arrived and parked on the street at 47 Summer Street.", cls: "arrival", src: [372, 373], wording: "Parked in the street.", time: [373], when: "It took probably 15 seconds for me to identify the house", anchor: { family: "police-arrival", class: "ARRIVAL_DEPARTURE", label: "First police arrival" } }],
    { status: "qualified", mentions: [{ key: "mudroom", raw: "a mudroom", type: "location", at: [373] }] });
  b.statement("j-parties", "Josephine saw two parties in the yard and later learned who they were.",
    "When Josephine came around the house he saw one person lying on the ground and one standing over them, whom he later learned were Lindsay and Patrick Clancy.",
    [
      { key: "sees-parties", desc: "Brian Josephine observed two people in the backyard, one on the ground and one standing over them.", cls: "visual_observation", src: [390, 391], wording: "I observed two parties, one lying in the ground and one standing over it.", time: [390], when: "when you came around there, what did you see?" },
      { key: "learns-identities", desc: "Brian Josephine came to know the two people were Patrick and Lindsay Clancy.", cls: "knowledge_change", kind: "knowledge_state", src: [394, 395, 396, 397], wording: "did you later learn that was Patrick Clancy?", time: [394], when: "did you later learn that was Patrick Clancy?", knowledge: { holder: "Brian Josephine", proposition: "The standing person was Patrick Clancy and the person on the ground was Lindsay Clancy." } },
    ], { mentions: [{ key: "parties", raw: "two parties", type: "person", at: [391] }] });
  b.statement("j-crosses", "Josephine described crossing paths with Patrick, then speaking to Lindsay.",
    "Josephine crossed paths with Patrick near the bulkhead, then went to the woman on the ground and tried to speak with her.",
    [
      { key: "crosses-patrick", desc: "Brian Josephine and Patrick Clancy crossed paths near the bulkhead.", cls: "encounter", src: [403], wording: "and then that's when me and him crossed paths.", time: [403], when: "and then that's when me and him crossed paths", participants: ["Brian Josephine", "Patrick Clancy"] },
      { key: "speaks-lindsay", desc: "Brian Josephine went to the woman on the ground and attempted to speak with her.", cls: "medical_contact", src: [414, 415, 417], wording: "I attempted to.", time: [414], when: "after you crossed paths with Patrick, where did you go?", participants: ["Brian Josephine", "Lindsay Clancy"] },
    ]);
  b.statement("j-fire", "Josephine spoke with Lindsay for roughly thirty seconds to a minute before fire arrived.",
    "After probably 30 seconds to a minute talking to Lindsay, Josephine saw Duxbury Fire personnel arrive.",
    [{ key: "fire-arrival", desc: "Duxbury Fire personnel arrived at the backyard.", cls: "arrival", src: [441], wording: "I observed Duxbury Fire personnel show up.", time: [441], when: "I tried to talk to Ms. Clancy for probably 30 seconds to a minute. And at that point", anchor: { family: "fire-arrival", class: "ARRIVAL_DEPARTURE", label: "Fire personnel arrive" } }],
    { status: "qualified", mentions: [{ key: "fire", raw: "Duxbury Fire personnel", type: "group", at: [441] }] });
  b.statement("j-scream", "Josephine and Hall heard loud screams by the window; Josephine is unsure whether dispatch said something about the basement.",
    "At some point Josephine and Hall, standing by the window, heard loud screams, and both went back toward the deck; Josephine was unsure whether dispatch said something about the basement.",
    [
      { key: "scream", desc: "Brian Josephine and Stephen Hall heard loud screams while standing by the window.", cls: "auditory_observation", src: [444, 445], wording: "we just started hearing loud screams.", time: [442], when: "at some point in time, do you hear something?", participants: ["Brian Josephine", "Stephen Hall"], anchor: { family: "scream", class: "SHARED_OBSERVATION", label: "Loud scream heard from inside" } },
      { key: "dispatch-basement", desc: "Josephine was unsure whether dispatch said something about the basement over the air.", cls: "dispatch_relay", src: [447], wording: "I'm not sure if dispatch or something came over the air and said something about the basement", time: [447], when: "I'm not sure if dispatch or something came over the air", participants: ["Dispatch"], anchor: { family: "dispatch-relay", class: "INFORMATION", role: "detail", label: "Dispatch relays that Patrick cannot wake them" } },
    ], { status: "qualified", basis: "RECALLED", unknowns: ["Josephine does not know whether a dispatch message was heard."] });
  b.statement("j-kitchen", "Josephine went through the sliding doors and heard the same screaming as he entered the kitchen.",
    "Josephine and Hall went up the deck through the sliding doors into the kitchen, where Josephine could hear the exact screaming he had heard from the window.",
    [
      { key: "kitchen-entry", desc: "Brian Josephine and Stephen Hall entered the kitchen through the sliding glass doors.", cls: "scene_entry", src: [449], wording: "We went up the deck and through the sliding glass doors into the kitchen.", time: [446], when: "what did you do when you heard those loud screams?", participants: ["Brian Josephine", "Stephen Hall"], anchor: { family: "kitchen-entry", class: "TRANSITION", label: "Officers enter the kitchen" } },
      { key: "kitchen-screaming", desc: "Brian Josephine observed the condition of the screaming as he entered the kitchen.", cls: "state_observation", kind: "state_observation", src: [452, 453], wording: "it was the exact screaming that I heard from the window.", time: [452], when: "as you entered the kitchen", state: { key: "screaming-at-kitchen-entry", value: "continuing" } },
    ]);
  b.statement("j-right-basement", "Josephine described Patrick screaming as he left the back room, then finding Dawson.",
    "In the right basement Josephine saw Patrick leave the back room and scream, then saw a child motionless on the floor, whom he later learned was Dawson.",
    [
      { key: "patrick-statement", desc: "Brian Josephine heard Patrick Clancy scream that she had killed the children.", cls: "reported_statement", src: [465], wording: "She killed the fucking kids", time: [465], when: "at that point he looked up and he screamed", participants: ["Patrick Clancy", "Brian Josephine"], anchor: { family: "patrick-statement-right-basement", class: "SHARED_OBSERVATION", label: "Patrick's statement in the right basement" } },
      { key: "finds-dawson", desc: "Brian Josephine saw a child laying motionless on the floor.", cls: "victim_discovery", src: [466, 467], wording: "we observed what appeared to be a child laying motionless on the floor.", time: [466], when: "And after he said that, where did you go?" },
      { key: "learns-dawson", desc: "Brian Josephine came to know the child was Dawson Clancy.", cls: "knowledge_change", kind: "knowledge_state", src: [468, 469], wording: "did you later learn his name was Dawson Clancy?", time: [468], when: "did you later learn his name was Dawson Clancy?", knowledge: { holder: "Brian Josephine", proposition: "The child was Dawson Clancy." } },
    ], { mentions: [{ key: "child", raw: "a child laying motionless", type: "person", at: [467] }] });
  b.statement("j-ambulance", "Josephine carried Dawson out; the ambulance had just parked.",
    "Josephine picked up the child, carried him out, and found the ambulance backing up and pretty much just parked; he put the child on the stretcher.",
    [
      { key: "dawson-to-ambulance", desc: "Brian Josephine carried Dawson to the ambulance and put him on the stretcher.", cls: "patient_removal", src: [495, 497], wording: "I rushed over with Dawson and I put him on the stretcher", time: [494], when: "And once you saw him there with these injuries, what did you do?", participants: ["Brian Josephine", "Dawson Clancy"], anchor: { family: "dawson-to-ambulance", class: "TRANSITION", label: "First child carried to the ambulance" } },
      { key: "ambulance-state", desc: "Brian Josephine observed the ambulance backing up and having just parked.", cls: "state_observation", kind: "state_observation", src: [497], wording: "The ambulance was backing up and had pretty much just parked", time: [497], when: "The ambulance was backing up and had pretty much just parked", anchor: { family: "ambulance-arrival", class: "STATE", role: "prior_state_origin", label: "Ambulance arrives in the driveway" } },
    ], { mentions: [{ key: "homestead", raw: "Sergeant Homestead", type: "person", at: [497] }, { key: "fire-personnel", raw: "fire personnel", type: "group", at: [497] }] });
  b.statement("j-left-basement", "Josephine returned to the left basement, where fire personnel were already on scene.",
    "Josephine went back into the house and down to the left basement, where two fire personnel were already on scene working on the children; he recalled that the baby was brought out first.",
    [
      { key: "return-basement", desc: "Brian Josephine went back into the house and down to the left side of the basement.", cls: "search", src: [498, 499, 503], wording: "I went back in that front door, back down to the basement, and this time I went to the left-hand side.", time: [498], when: "What did you do next?", anchor: { family: "left-basement-return", class: "TRANSITION", label: "Officers return to the basement" } },
      { key: "ems-already", desc: "Brian Josephine observed two fire personnel already at work in the left basement.", cls: "state_observation", kind: "state_observation", src: [513], wording: "two fire personnel were already on scene.", time: [513], when: "two fire personnel were already on scene", anchor: { family: "ems-care-left-basement", class: "STATE", role: "prior_state_origin", label: "EMS care underway in the left basement" } },
      { key: "baby-first", desc: "Josephine recalled the baby was brought out before Cora.", cls: "patient_removal", src: [522, 523], wording: "I think the baby was brought out first", time: [523], when: "I think the baby was brought out first" },
    ], { status: "qualified", mentions: [{ key: "baby", raw: "the baby", type: "person", at: [523] }] });

  b.relate("arrival-from-dispatch", "dispatch", "BEFORE_OR_AT", "arrival", "And when you arrived at 47 Summer Street", [372]);
  b.relate("arrival-before-sees", "arrival", "BEFORE_OR_AT", "sees-parties", "when you came around there", [390]);
  b.relate("sees-before-learns", "sees-parties", "BEFORE", "learns-identities", "did you later learn that was Patrick Clancy?", [394]);
  b.relate("sees-before-crosses", "sees-parties", "BEFORE", "crosses-patrick", "and then that's when me and him crossed paths", [403]);
  b.relate("crosses-before-speaks", "crosses-patrick", "BEFORE", "speaks-lindsay", "after you crossed paths with Patrick", [414]);
  b.relate("speaks-before-fire", "speaks-lindsay", "BEFORE_OR_AT", "fire-arrival", "And at that point, coming from that opposite side of the house", [441]);
  b.relate("scream-before-entry", "scream", "BEFORE_OR_AT", "kitchen-entry", "when you heard those loud screams", [446]);
  b.relate("entry-at-kitchen-state", "kitchen-entry", "AT", "kitchen-screaming", "as you entered the kitchen", [452], "simultaneity_wording");
  b.relate("entry-before-statement", "kitchen-entry", "BEFORE", "patrick-statement", "after you went down the stairs", [456]);
  b.relate("statement-before-finds", "patrick-statement", "BEFORE", "finds-dawson", "And after he said that", [466]);
  b.relate("finds-before-learns", "finds-dawson", "BEFORE", "learns-dawson", "did you later learn his name was Dawson Clancy?", [468]);
  b.relate("finds-before-carry", "finds-dawson", "BEFORE_OR_AT", "dawson-to-ambulance", "And once you saw him there with these injuries", [494]);
  b.relate("carry-before-return", "dawson-to-ambulance", "BEFORE", "return-basement", "What did you do next?", [498]);
  b.relate("return-at-ems", "return-basement", "BEFORE_OR_AT", "ems-already", "So when I got down to the basement", [513]);
  b.relate("ems-before-baby", "ems-already", "BEFORE", "baby-first", "And, eventually, was Cora put on a stretcher and brought out?", [522]);
  return b.build();
}

export function day3TemporalContextAccounts(transcript: ParsedRevTranscript): TemporalAccount[] {
  return [hallAccount(transcript), josephineAccount(transcript)];
}

export function buildDay3TemporalContext(
  transcript: ParsedRevTranscript,
  identity: { caseId: string; proceedingId: string; sourceArtifactId: string },
  options: { accounts?: WitnessKey[] } = {},
) {
  const all = day3TemporalContextAccounts(transcript);
  const wanted = options.accounts ? all.filter((account) => options.accounts!.some((key) => DAY3_TEMPORAL_ACCOUNTS[key].key === account.accountKey)) : all;
  return compileTemporalContext({ ...identity, transcript, accounts: wanted });
}
