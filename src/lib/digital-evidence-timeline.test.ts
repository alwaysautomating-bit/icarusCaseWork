import { describe, expect, it } from "vitest";

import { buildDigitalEvidenceTimeline, digitalEvidenceSourceSegmentIds } from "@/lib/digital-evidence-timeline";

describe("digital evidence timeline", () => {
  it("requires every exact source segment before exposing an artifact", () => {
    const result = buildDigitalEvidenceTimeline([]);
    expect(result.items).toHaveLength(0);
    expect(result.missingKeys).toHaveLength(8);
  });

  it("preserves artifact type, machine-time semantics, and source lineage", () => {
    const ids = digitalEvidenceSourceSegmentIds();
    const primaryText = new Map<string, string>([
      [ids[0], "ThreeV Restaurant at 4:13 PM"],
      [ids[2], "4:43 PM on January 24th"],
      [ids[6], "MiraLAX for kids, 4:46:55"],
      [ids[8], "CVS website here at 4:47:04"],
      [ids[10], "outgoing phone call at 4:48:21"],
      [ids[14], "message 80 outgoing"],
      [ids[18], "5:06:45"],
      [ids[22], "message from Lindsay to Patrick at 5:15 PM"],
    ]);
    const result = buildDigitalEvidenceTimeline(ids.map((id, ordinal) => ({
      id,
      ordinal,
      exact_text: primaryText.get(id) ?? `Supporting source ${ordinal}`,
    })));

    expect(result.missingKeys).toEqual([]);
    expect(result.items).toHaveLength(8);
    expect(result.items.map((item) => item.displayTimestamp)).toEqual([
      "16:13:--", "16:43:--", "16:46:55", "16:47:04", "16:48:21", "16:53:09", "17:06:45", "17:15:--",
    ]);
    expect(result.items[0]).toMatchObject({ artifactType: "map activity", timestampPrecision: "minute" });
    expect(result.items[0].sourceSegmentIds).toHaveLength(2);
  });
});

