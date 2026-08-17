import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execSync("pnpm exec supabase status -o json", {
    encoding: "utf8",
  }).replace(/^Stopped services:.*\r?\n/, ""),
);

const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const emailA = `testimony-a-${randomUUID()}@example.test`;
const emailB = `testimony-b-${randomUUID()}@example.test`;
const password = `Local-${randomUUID()}-A1!`;
const createdUserIds = [];
let caseId;

async function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

try {
  const userA = await must(
    await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true }),
    "create user A",
  );
  const userB = await must(
    await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true }),
    "create user B",
  );
  createdUserIds.push(userA.user.id, userB.user.id);

  const clientA = createClient(status.API_URL, status.ANON_KEY, anonOptions);
  const clientB = createClient(status.API_URL, status.ANON_KEY, anonOptions);
  await must(await clientA.auth.signInWithPassword({ email: emailA, password }), "sign in A");
  await must(await clientB.auth.signInWithPassword({ email: emailB, password }), "sign in B");

  caseId = randomUUID();
  await must(
    await clientA.from("cases").insert({
      id: caseId,
      owner_user_id: userA.user.id,
      title: "Testimony intake integration",
      purpose: "Verify the atomic testimony URL intake boundary.",
      public_record_cutoff: new Date().toISOString(),
    }),
    "create case",
  );

  const hidden = await clientB.from("cases").select("id").eq("id", caseId);
  assert.equal(hidden.error, null);
  assert.equal(hidden.data.length, 0, "RLS must hide another user's case");

  const segmentId = randomUUID();
  const payload = {
    case_id: caseId,
    intake: {
      id: randomUUID(),
      submitted_url: "https://www.rev.com/transcripts/example?utm_source=test",
      canonical_url: "https://www.rev.com/transcripts/example",
      page_title: "Example testimony",
      publisher: "Rev",
      published_date: "2026-08-05",
      content_type: "text/html",
      captured_at: new Date().toISOString(),
      parser_name: "rev-testimony",
      parser_version: "1.0.0",
    },
    source: {
      id: randomUUID(),
      title: "Example testimony",
      source_family: "trial_transcript",
      evidence_lane: "testimony",
      origin_date: "2026-08-05",
      completeness: "complete",
      notes: "Integration fixture.",
    },
    lineage: { id: randomUUID(), lineage_key: "rev:example", notes: "Captured HTML." },
    artifact: {
      id: randomUUID(),
      title: "Example testimony HTML",
      media_type: "text/html",
      sha256: `integration-${randomUUID()}`,
      byte_length: 123,
      object_key: `integration/${randomUUID()}.html`,
      document_type: "web_transcript",
      source_url: "https://www.rev.com/transcripts/example?utm_source=test",
      canonical_url: "https://www.rev.com/transcripts/example",
      publisher: "Rev",
      retrieved_at: new Date().toISOString(),
    },
    segments: [
      {
        id: segmentId,
        ordinal: 1,
        speaker: "Witness",
        timestamp_start_ms: 1000,
        timestamp_end_ms: null,
        deep_link: "https://www.rev.com/transcripts/example?ts=1",
        exact_text: "The measurement was 20 feet.",
        locator: { timestamp: "00:01" },
      },
    ],
    claims: [
      {
        id: randomUUID(),
        proposition_id: randomUUID(),
        segment_id: segmentId,
        speaker: "Witness",
        assertion: "The measurement was 20 feet.",
        normalized_text: "the measurement was 20 feet",
        extraction_confidence: 0.82,
        source_quote: "The measurement was 20 feet.",
        review_reasons: ["machine_extracted"],
      },
    ],
    attributions: [],
    media: [],
    acquisitions: [],
  };

  const first = await must(
    await clientA.rpc("commit_testimony_url_intake", { payload }),
    "commit testimony intake",
  );
  assert.equal(first.duplicate, false);
  assert.equal(first.segments, 1);
  assert.equal(first.claims, 1);

  const forbiddenPayload = { ...payload, intake: { ...payload.intake, id: randomUUID() }, support: [] };
  const forbidden = await clientA.rpc("commit_testimony_url_intake", { payload: forbiddenPayload });
  assert.ok(forbidden.error, "intake must reject reconciliation fields");

  const duplicatePayload = {
    ...payload,
    intake: { ...payload.intake, id: randomUUID() },
    source: { ...payload.source, id: randomUUID() },
    lineage: { ...payload.lineage, id: randomUUID() },
    artifact: { ...payload.artifact, id: randomUUID() },
  };
  const duplicate = await must(
    await clientA.rpc("commit_testimony_url_intake", { payload: duplicatePayload }),
    "commit exact duplicate",
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.artifact_id, first.artifact_id);

  const segmentCount = await clientA
    .from("source_segments")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);
  const claimCount = await clientA
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);
  assert.equal(segmentCount.count, 1, "duplicate must not copy segments");
  assert.equal(claimCount.count, 1, "duplicate must not copy claims");

  const supportWrite = await clientA.from("claim_support").insert({ case_id: caseId });
  const verificationWrite = await clientA.from("verification_assessments").insert({ case_id: caseId });
  assert.ok(supportWrite.error, "authenticated intake users must not write claim support");
  assert.ok(verificationWrite.error, "authenticated intake users must not write verification");

  const otherUser = await clientB.rpc("commit_testimony_url_intake", {
    payload: { ...duplicatePayload, intake: { ...duplicatePayload.intake, id: randomUUID() } },
  });
  assert.ok(otherUser.error, "another user must not commit into the case");

  process.stdout.write(
    `${JSON.stringify({ ok: true, caseIsolation: true, atomicCommit: true, duplicateSafe: true, reconciliationWritesBlocked: true })}\n`,
  );
} finally {
  if (caseId) {
    const cleanup = await admin.from("cases").delete().eq("id", caseId);
    if (cleanup.error) process.stderr.write(`case cleanup failed: ${cleanup.error.message}\n`);
  }
  for (const userId of createdUserIds) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) process.stderr.write(`user cleanup failed: ${cleanup.error.message}\n`);
  }
}
