import { requireCaseOwner } from "@/lib/case-owner";

export default async function OwnerOnlyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ caseId: string }> }) {
  await requireCaseOwner(params);
  return children;
}
