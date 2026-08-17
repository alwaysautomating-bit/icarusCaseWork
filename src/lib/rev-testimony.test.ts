import { describe, expect, it } from "vitest";
import { parseRevTranscript } from "@/lib/rev-testimony";

const fixture = `<!doctype html>
<html><head>
<title>Example Trial Day 6 | Rev</title>
<meta name="description" content="A synthetic testimony fixture." />
<link href="https://www.rev.com/transcripts/example-trial-day-6" rel="canonical" />
<script type="application/ld+json">{"datePublished":"2026-08-05"}</script>
</head><body>
<iframe class="embedly-embed" src="//cdn.embedly.com/widgets/media.html?src=https%3A%2F%2Fwww.youtube.com%2Fembed%2Fvideo123&amp;display_name=YouTube&amp;url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dvideo123"></iframe>
<div id="main-content" class="w-richtext">
<p>Clerk (<a href="https://www.rev.com/app/transcript/example?ts=47.13">00:47</a>):</p><p>Exhibit J for identification.</p>
<p>Attorney Example (<a href="https://www.rev.com/app/transcript/example?ts=60">01:00</a>):</p><p>Doctor, were you working at the hospital?</p>
<p>Doctor Example (<a href="https://www.rev.com/app/transcript/example?ts=63">01:03</a>):</p><p>I was the on-call surgeon at the hospital that evening.</p>
<p>Doctor Example (<a href="https://www.rev.com/app/transcript/example?ts=70">01:10</a>):</p><p>I recall we were told the patient fell from a substantial height.</p>
<p>Doctor Example (<a href="https://www.rev.com/app/transcript/example?ts=76">01:16</a>):</p><p>The EMS information affected our preparation.</p>
</div></body></html>`;

describe("Rev testimony parser", () => {
  it("preserves canonical metadata, media identity, speakers, timestamps, and deep links", () => {
    const parsed = parseRevTranscript(fixture, "https://www.rev.com/transcripts/example-trial-day-6?utm_source=test");
    expect(parsed.title).toBe("Example Trial Day 6");
    expect(parsed.canonicalUrl).toBe("https://www.rev.com/transcripts/example-trial-day-6");
    expect(parsed.publishedDate).toBe("2026-08-05");
    expect(parsed.media[0]).toMatchObject({ provider: "YouTube", externalId: "video123", mediaUrl: "https://www.youtube.com/watch?v=video123" });
    expect(parsed.segments).toHaveLength(5);
    expect(parsed.segments[2]).toMatchObject({ speaker: "Doctor Example", timestampStartMs: 63_000, deepLink: "https://www.rev.com/app/transcript/example?ts=63" });
    expect(parsed.segments[2].locator).toMatchObject({ type: "timestamp", timestampStart: "00:01:03" });
  });

  it("creates testimony candidates without turning questions into claims or confidence into verification", () => {
    const parsed = parseRevTranscript(fixture, "https://www.rev.com/transcripts/example-trial-day-6");
    expect(parsed.claims.some((claim) => claim.assertion.includes("were you working"))).toBe(false);
    const surgeon = parsed.claims.find((claim) => claim.sourceQuote.includes("on-call surgeon"));
    expect(surgeon).toMatchObject({ speaker: "Doctor Example", extractionConfidence: 0.82 });
    expect(surgeon?.reviewReasons).toContain("proposition_requires_normalization");
    expect(Object.hasOwn(surgeon ?? {}, "supportStatus")).toBe(false);
  });

  it("preserves the order of a reported testimony attribution chain", () => {
    const parsed = parseRevTranscript(fixture, "https://www.rev.com/transcripts/example-trial-day-6");
    const reportedClaim = parsed.claims.find((claim) => claim.sourceQuote.includes("we were told"));
    const chain = parsed.attributions.filter((item) => item.claimId === reportedClaim?.id).sort((a, b) => a.sequence - b.sequence);
    expect(chain.map((item) => [item.entityLabel, item.attributionRole])).toEqual([
      ["Unknown incoming information source", "reported_by"],
      ["Doctor Example", "testified_by"],
      ["Rev", "transcribed_by"],
    ]);
  });

  it("creates unpossessed acquisition targets for exhibits and underlying records", () => {
    const parsed = parseRevTranscript(fixture, "https://www.rev.com/transcripts/example-trial-day-6");
    expect(parsed.acquisitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ exhibitNumber: "J for identification", admittedAsExhibit: null }),
      expect.objectContaining({ title: expect.stringContaining("EMS") }),
    ]));
  });

  it("leaves an interval open when a publisher timestamp moves backward", () => {
    const discontinuous = fixture.replace(">01:16</a>", ">00:05</a>");
    const parsed = parseRevTranscript(discontinuous, "https://www.rev.com/transcripts/example-trial-day-6");
    expect(parsed.segments[3].timestampEndMs).toBeNull();
    expect(parsed.segments[3].locator).not.toHaveProperty("timestampEnd");
  });

  it("reconstructs temperature Q/A when the answer is short", () => {
    const temperatureFixture = fixture.replace(
      "</div></body>",
      `<p>Attorney Example (<a href="https://www.rev.com/app/transcript/example?ts=80">01:20</a>):</p><p>Was the recorded temperature 82.1 degrees?</p>
       <p>Doctor Example (<a href="https://www.rev.com/app/transcript/example?ts=82">01:22</a>):</p><p>Yes, that's correct.</p>
       <p>Attorney Example (<a href="https://www.rev.com/app/transcript/example?ts=90">01:30</a>):</p><p>And did it come up to 95.2 degrees, correct?</p>
       <p>Doctor Example (<a href="https://www.rev.com/app/transcript/example?ts=92">01:32</a>):</p><p>Yes.</p></div></body>`,
    );
    const parsed = parseRevTranscript(temperatureFixture, "https://www.rev.com/transcripts/example-trial-day-6");
    expect(parsed.qaExchanges.find((item) => item.question.includes("82.1"))?.answer).toBe("Yes, that's correct.");
    expect(parsed.qaExchanges.find((item) => item.question.includes("95.2"))?.answer).toBe("Yes.");
  });

  it("keeps Rev continuation paragraphs inside the owning speaker turn", () => {
    const continued = fixture.replace(
      "<p>I was the on-call surgeon at the hospital that evening.</p>",
      "<p>I was the on-call surgeon at the hospital that evening.</p><p>(<a href=\"https://www.rev.com/app/transcript/example?ts=65\">01:05</a>)<br/>This is the continuation.</p>",
    );
    const parsed = parseRevTranscript(continued, "https://www.rev.com/transcripts/example-trial-day-6");
    expect(parsed.segments[2].text).toContain("This is the continuation.");
    expect(parsed.coverage).toMatchObject({ detectedSegments: 5, parsedSegments: 5, completionState: "complete" });
  });
});
