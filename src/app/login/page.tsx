import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendMagicLink, signInWithProvider } from "./actions";

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/casework";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next: requestedNext } = await searchParams;
  const next = safeNext(requestedNext);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Private research workspace</p>
        <h1>Enter the record.</h1>
        <p className="lede">Sign in to access case material. Every consequential change is attributed to your authenticated account.</p>
        {error && <p className="auth-notice error" role="alert">{error}</p>}
        {message && <p className="auth-notice success" role="status">{message}</p>}
        <form action={signInWithProvider}><input type="hidden" name="provider" value="google" /><input type="hidden" name="next" value={next} /><button className="auth-provider">Continue with Google</button></form>
        <form action={signInWithProvider}><input type="hidden" name="provider" value="apple" /><input type="hidden" name="next" value={next} /><button className="auth-provider secondary">Continue with Apple</button></form>
        <div className="auth-divider"><span>or use a magic link</span></div>
        <form action={sendMagicLink} className="magic-link-form">
          <input type="hidden" name="next" value={next} />
          <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="researcher@example.com" /></label>
          <button>Send secure sign-in link</button>
        </form>
        <small>No password is stored by Icarus Casework.</small>
      </section>
    </main>
  );
}
