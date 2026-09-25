import { z } from "zod";
import { submitCaseContribution } from "./actions";

export const dynamic = "force-dynamic";

const caseIdSchema = z.uuid();

export default async function ContributePage({ params, searchParams }: { params: Promise<{ caseId: string }>; searchParams: Promise<{ message?: string; error?: string }> }) {
  const [{ caseId }, { message, error }] = await Promise.all([params, searchParams]);
  const validCase = caseIdSchema.safeParse(caseId);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Contribute to this case</p>
        <h1>Add what you have.</h1>
        <p className="lede">Submit a document, photo, or screenshot for this case. Nothing you send becomes part of the record until the case owner reviews and approves it.</p>
        {!validCase.success ? <p className="auth-notice error" role="alert">This contribution link is invalid.</p> : <>
          {error && <p className="auth-notice error" role="alert">{error}</p>}
          {message && <p className="auth-notice success" role="status">{message}</p>}
          <form action={submitCaseContribution.bind(null, caseId)} className="magic-link-form">
            <label>Case password<input name="password" type="password" autoComplete="off" required /></label>
            <label>Your name (optional)<input name="contributorName" maxLength={120} placeholder="So the reviewer knows who to thank" /></label>
            <label>File<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf" required /></label>
            <label>Note (optional)<textarea name="contributorNote" rows={3} maxLength={2000} placeholder="What is this, and where did it come from?" /></label>
            <button>Submit for review</button>
          </form>
        </>}
        <small>No account is required. Submissions are private until approved.</small>
      </section>
    </main>
  );
}
