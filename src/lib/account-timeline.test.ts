import { describe, expect, it } from "vitest";
import { buildWitnessAccountTimelines, witnessAccountKey, type AccountReconstructionSnapshot } from "@/lib/account-timeline";

const snapshot: AccountReconstructionSnapshot = {
  assertions: [
    { ref: "hall-radio", witness: "Officer Stephen Hall", neutral_description: "Hall heard a dispatch relay.", event_class: "dispatch_relay", source_wording: "Dispatch said that he couldn't wake them up.", raw_temporal_language: "Shortly after Patrick went inside", precision: "relative", qualification: "qualified", source_segment_ids: ["11111111-1111-4111-a111-111111111111"] },
    { ref: "josephine-scream", witness: "Officer Brian Josephine", neutral_description: "Josephine heard a scream.", event_class: "auditory_observation", source_wording: "We started hearing screams.", raw_temporal_language: "then", precision: "relative", qualification: "asserted", source_segment_ids: ["22222222-2222-4222-a222-222222222222"] },
    { ref: "hall-scream", witness: "Officer Stephen Hall", neutral_description: "Hall heard a scream.", event_class: "auditory_observation", source_wording: "I heard a loud scream.", raw_temporal_language: "then", precision: "relative", qualification: "asserted", source_segment_ids: ["33333333-3333-4333-a333-333333333333"] },
  ],
  nodes: [
    { key: "scream", title: "Scream heard", summary: "Two accounts align here.", temporalLabel: "After the radio relay", assertionRefs: ["josephine-scream", "hall-scream"], ordinal: 2, status: "proposed" },
    { key: "radio", title: "Dispatch relay", summary: "Hall describes relayed information.", temporalLabel: "After Patrick enters", assertionRefs: ["hall-radio"], ordinal: 1, status: "proposed" },
  ],
  tensions: [{ key: "wording", title: "Wording source", field: "information_path", assertionRefs: ["hall-radio", "hall-scream"], note: "Keep the paths separate.", status: "unresolved" }],
};

describe("witness account timelines", () => {
  it("creates stable account keys", () => {
    expect(witnessAccountKey("Officer Stephen Hall")).toBe("officer-stephen-hall");
  });

  it("orders each account by proposed reconstruction position and preserves source lineage", () => {
    const accounts = buildWitnessAccountTimelines(snapshot);
    const hall = accounts.find((account) => account.key === "officer-stephen-hall");
    expect(hall?.items.map((item) => item.ref)).toEqual(["hall-radio", "hall-scream"]);
    expect(hall?.sourceSegmentCount).toBe(2);
    expect(hall?.tensionCount).toBe(1);
    expect(hall?.items[1]?.alignedWitnesses).toEqual(["Officer Brian Josephine"]);
  });
});
