import { notFound } from "next/navigation";
import { CareTrajectoryWorkspace } from "@/app/cases/[caseId]/trajectory/_components/care-trajectory-workspace";
import { requireCaseActor } from "@/lib/authority";
import { getAccessibleCase } from "@/lib/case-access";
import { lindsayLongitudinalDemo } from "@/lib/longitudinal-care";

export const dynamic = "force-dynamic";

export default async function CareTrajectoryPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await requireCaseActor();
  const { caseId } = await params;
  const currentCase = await getAccessibleCase(actor.id, caseId);
  if (!currentCase) notFound();

  return <CareTrajectoryWorkspace caseId={currentCase.id} snapshot={lindsayLongitudinalDemo} />;
}
