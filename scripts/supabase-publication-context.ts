import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type PublicationContext = {
  admin: SupabaseClient;
  client: SupabaseClient;
  user: User;
  target: "local" | "hosted";
};

type LocalIdentity = { email: string; password: string };

function localStatus() {
  const output = process.platform === "win32"
    ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec supabase status -o json"], { encoding: "utf8" })
    : execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8" });
  return JSON.parse(output.replace(/^Stopped services:.*\r?\n/, "")) as {
    API_URL: string;
    SERVICE_ROLE_KEY: string;
    ANON_KEY: string;
  };
}

async function findUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
    if (result.error) throw result.error;
    const user = result.data.users.find((candidate) => candidate.email?.toLocaleLowerCase() === email);
    if (user || result.data.users.length < 1_000) return user ?? null;
  }
  throw new Error("The hosted Auth user search exceeded 10,000 accounts; use a narrower administrative lookup.");
}

export async function createPublicationContext(localIdentity: LocalIdentity): Promise<PublicationContext> {
  const target = process.env.ICARUS_PUBLISH_TARGET === "hosted" ? "hosted" : "local";

  if (target === "local") {
    const status = localStatus();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    let user = await findUserByEmail(admin, localIdentity.email.toLocaleLowerCase());
    if (!user) {
      const created = await admin.auth.admin.createUser({ email: localIdentity.email, password: localIdentity.password, email_confirm: true });
      if (created.error) throw created.error;
      user = created.data.user;
    }
    const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await client.auth.signInWithPassword(localIdentity);
    if (signedIn.error) throw signedIn.error;
    return { admin, client, user, target };
  }

  assert.equal(
    process.env.ICARUS_PUBLISH_CONFIRM,
    "I_UNDERSTAND_THIS_WRITES_TO_HOSTED_SUPABASE",
    "Set ICARUS_PUBLISH_CONFIRM=I_UNDERSTAND_THIS_WRITES_TO_HOSTED_SUPABASE for an intentional hosted publication.",
  );
  const apiUrl = process.env.ICARUS_PUBLISH_SUPABASE_URL?.trim();
  const publishableKey = process.env.ICARUS_PUBLISH_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.ICARUS_PUBLISH_SUPABASE_SECRET_KEY?.trim();
  const ownerEmail = process.env.ICARUS_PUBLISH_OWNER_EMAIL?.trim().toLocaleLowerCase();
  assert.ok(apiUrl && publishableKey && secretKey && ownerEmail, "Hosted publication requires its URL, publishable key, secret key, and owner email.");
  const parsedUrl = new URL(apiUrl);
  assert.equal(parsedUrl.protocol, "https:", "Hosted publication requires an HTTPS Supabase URL.");
  assert.ok(!["localhost", "127.0.0.1"].includes(parsedUrl.hostname), "Hosted publication cannot target the local Supabase host.");

  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const user = await findUserByEmail(admin, ownerEmail);
  assert.ok(user, `No hosted Auth account exists for ${ownerEmail}. Sign in once through the production app before publishing.`);
  const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  if (generated.error) throw generated.error;

  const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: generated.data.properties.hashed_token });
  if (verified.error) throw verified.error;
  assert.equal(verified.data.user?.id, user.id, "Hosted publication session did not match the selected owner account.");
  return { admin, client, user, target };
}
