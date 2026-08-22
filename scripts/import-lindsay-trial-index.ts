import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type FixtureDay = Record<string, unknown> & { day_number: number; basis: string };
type Fixture = { schema_version: string; case_workspace_key: string; navigation_only: boolean; source_note: string; days: FixtureDay[] };

function statusJson() {
  const output = process.platform === "win32"
    ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec supabase status -o json"], { encoding: "utf8" })
    : execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8" });
  return JSON.parse(output.replace(/^Stopped services:.*\r?\n/, "")) as { API_URL: string; ANON_KEY: string };
}

const fixture = JSON.parse(await readFile(path.resolve("fixtures/lindsay-clancy-trial-index.json"), "utf8")) as Fixture;
assert.equal(fixture.navigation_only, true);
assert.equal(fixture.days.length, 18);
assert.deepEqual(fixture.days.map((day) => day.day_number), Array.from({ length: 18 }, (_, index) => index + 1));

const status = statusJson();
const identity = createHash("sha256").update("icarus-testimony-corpus-publication-v1").digest("hex");
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email: `corpus-${identity.slice(0, 12)}@example.test`, password: `Local-${identity.slice(0, 16)}-A1!` });
if (signedIn.error) throw signedIn.error;
const caseResult = await client.from("cases").select("id").eq("workspace_key", fixture.case_workspace_key).single();
if (caseResult.error) throw caseResult.error;
const caseId = caseResult.data.id;
const proceedingsResult = await client.from("proceedings").select("id,title").eq("case_id", caseId);
if (proceedingsResult.error) throw proceedingsResult.error;
const proceedings = proceedingsResult.data;
const proceedingForDay = (day: number) => proceedings.find((item) => day === 1 ? /opening statements/i.test(item.title) : new RegExp(`Day ${day}$`, "i").test(item.title));
const requestedUpdates = new Set(process.argv.slice(2).flatMap((argument, index, arguments_) => argument === "--update-day" ? [Number(arguments_[index + 1])] : []));
if ([...requestedUpdates].some((day) => !Number.isInteger(day) || day < 1 || day > 18)) throw new Error("--update-day requires a day number from 1 through 18.");
const existingResult = await client.from("trial_index_projection").select("day_number").eq("case_id", caseId);
if (existingResult.error) throw existingResult.error;
const existingDays = new Set(existingResult.data.map((day) => day.day_number));

const processed = [];
let createdDays = 0;
let updatedDays = 0;
for (const day of fixture.days) {
  if (existingDays.has(day.day_number) && !requestedUpdates.has(day.day_number)) continue;
  const proceeding = proceedingForDay(day.day_number);
  const changeNote = existingDays.has(day.day_number)
    ? `Updated Day ${day.day_number} from the reviewed navigation fixture on 2026-08-22.`
    : "Initial Day 1–18 navigation index supplied by the user on 2026-08-22.";
  const payload = { ...day, proceeding_id: proceeding?.id ?? "", change_note: changeNote };
  const result = await client.rpc("upsert_trial_index_day", {
    p_case_id: caseId,
    p_payload: payload,
  });
  if (result.error) throw new Error(`Day ${day.day_number}: ${result.error.message}`);
  if (existingDays.has(day.day_number)) updatedDays += 1;
  else createdDays += 1;
  const replayResult = await client.rpc("upsert_trial_index_day", {
    p_case_id: caseId,
    p_payload: payload,
  });
  if (replayResult.error) throw new Error(`Replay Day ${day.day_number}: ${replayResult.error.message}`);
  processed.push({ first: result.data as { duplicate: boolean }, replay: replayResult.data as { duplicate: boolean } });
}

const [daysResult, versionsResult] = await Promise.all([
  client.from("trial_index_projection").select("day_number,proceeding_id,witness_names,topic_labels,basis,navigation_only").eq("case_id", caseId).order("day_number"),
  client.from("trial_index_day_versions").select("id", { count: "exact", head: true }).eq("case_id", caseId),
]);
if (daysResult.error) throw daysResult.error;
if (versionsResult.error) throw versionsResult.error;
assert.equal(daysResult.data.length, 18);
assert.ok(daysResult.data.every((day) => day.navigation_only));
assert.ok(processed.every((item) => item.replay.duplicate));

const report = {
  schemaVersion: "trial-navigation-index-acceptance/1.0",
  generatedAt: new Date().toISOString(),
  caseId,
  days: daysResult.data.length,
  canonicalProceedingLinks: daysResult.data.filter((day) => day.proceeding_id).length,
  editorialOnlyDays: daysResult.data.filter((day) => day.basis === "editorial_reference").length,
  witnessEntries: daysResult.data.reduce((total, day) => total + day.witness_names.length, 0),
  topicEntries: daysResult.data.reduce((total, day) => total + day.topic_labels.length, 0),
  immutableVersions: versionsResult.count ?? 0,
  createdDays,
  updatedDays,
  existingDaysPreserved: existingDays.size - updatedDays,
  idempotentReplay: processed.every((item) => item.replay.duplicate),
  navigationOnly: daysResult.data.every((day) => day.navigation_only),
  boundaries: { evidenceRowsCreated: 0, claimsCreated: 0, canonicalEventsCreated: 0, reconstructionVersionsCreated: 0 },
};
assert.equal(report.canonicalProceedingLinks, 14);
assert.equal(report.editorialOnlyDays, 4);
await writeFile(path.resolve("reports/lindsay-clancy-trial-index-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.resolve("reports/lindsay-clancy-trial-index-v1.md"), `# Lindsay Clancy Trial Navigation Index v1\n\nGenerated: ${report.generatedAt}\n\n- Indexed trial days: **${report.days}**\n- Canonical proceeding links: **${report.canonicalProceedingLinks}**\n- Editorial-only days awaiting canonical transcripts: **${report.editorialOnlyDays}**\n- Witness entries: **${report.witnessEntries}**\n- Topic entries: **${report.topicEntries}**\n- Immutable day versions: **${report.immutableVersions}**\n- Existing days preserved: **${report.existingDaysPreserved}**\n- Days created this run: **${report.createdDays}**\n- Days explicitly updated this run: **${report.updatedDays}**\n- Idempotent replay: **${report.idempotentReplay ? "PASS" : "FAIL"}**\n- Navigation-only constraint: **${report.navigationOnly ? "PASS" : "FAIL"}**\n\n## Boundary\n\nThis is a table of contents for the trial. Reporting summaries and external references are non-evidentiary navigation aids. Canonical proceeding links open the Court Record; no claims, canonical events, findings, or reconstruction versions are created. The importer preserves existing days unless a specific day is selected with \`--update-day\`.\n`, "utf8");
process.stdout.write(`${JSON.stringify(report)}\n`);
