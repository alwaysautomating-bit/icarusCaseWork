import { redirect } from "next/navigation";
import { caseFilesHref } from "@/lib/case-routes";

export default async function LegacySetupRedirect({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  redirect(caseFilesHref(caseId));
}
