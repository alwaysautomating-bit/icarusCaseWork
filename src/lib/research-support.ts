import { accountsHref, careTrajectoryHref, digitalTimelineHref, documentsHref, firstRespondersTimelineHref, timelineHref, witnessHref } from "@/lib/case-routes";

export type SupportLink = { label: string; href: string };
export type ResearchSupport = { icarus: SupportLink[]; hunt: string[] };

type Rule = { test: RegExp; icarus?: (caseId: string) => SupportLink; hunt?: string[] };

const rules: Rule[] = [
  { test: /timeline|chronolog|timestamp|reconstruct|window|sequence/, icarus: (c) => ({ label: "Timelines", href: timelineHref(c) }) },
  { test: /medic|pill|dose|dosing|quetiapine|prescri|pharmac|dispens|toxicolog|nms|blood|trazodone|ingest/, icarus: (c) => ({ label: "Care Trajectory (medications)", href: careTrajectoryHref(c) }), hunt: ["Pharmacy dispensing records for the relevant period", "Prescriber records and medication administration records"] },
  { test: /toxicolog|nms|blood|specimen|\blab\b|ng\/ml/, hunt: ["Full laboratory report, specimen collection time, and chain of custody for the blood sample"] },
  { test: /phone|device|apple|watch|cellebrite|imei|extraction|digital|icloud|health data|text message|call log|iphone/, icarus: (c) => ({ label: "Digital device timeline", href: digitalTimelineHref(c) }), hunt: ["Full device extraction reports with exhibit numbers", "Carrier call and text logs"] },
  { test: /warrant|seiz|inventory|photograph|exhibit|property|chain of custody/, icarus: (c) => ({ label: "Documents (search warrants)", href: documentsHref(c) }), hunt: ["Search-warrant returns and property/evidence inventories", "Scene and evidence photographs, plus the exhibit list"] },
  { test: /911|dispatch|\bems\b|first responder|responder|police|patient|paramedic/, icarus: (c) => ({ label: "First responder timeline", href: firstRespondersTimelineHref(c) }), hunt: ["911 audio with CAD/dispatch log", "EMS run reports"] },
  { test: /patrick|paraphras|earliest appearance|earliest source|originat|claim ledger|statement/, icarus: (c) => ({ label: "Accounts", href: accountsHref(c) }) },
  { test: /south shore|tufts|mclean|brigham|clinical|screen|hospital|psychiat|treatment|medical record|visit/, icarus: (c) => ({ label: "Care Trajectory", href: careTrajectoryHref(c) }), hunt: ["Complete certified medical records from each treating provider, including audit trails"] },
  { test: /diary|journal|writing|handwrit/, hunt: ["Original diary or journal pages, or the native file with metadata"] },
  { test: /surveillance|video|receipt|cvs|store|transaction/, hunt: ["Store surveillance footage and timestamped receipt or transaction records"] },
];

export function researchSupport(caseId: string, dayNumber: number, task: string, reason: string): ResearchSupport {
  const text = `${task} ${reason}`.toLowerCase();
  const icarus = new Map<string, SupportLink>([[`day-${dayNumber}`, { label: `Day ${dayNumber} testimony (Witness tab)`, href: witnessHref(caseId, { day: dayNumber }) }]]);
  const hunt = new Set<string>();
  for (const rule of rules) {
    if (!rule.test.test(text)) continue;
    const link = rule.icarus?.(caseId);
    if (link) icarus.set(link.href, link);
    rule.hunt?.forEach((item) => hunt.add(item));
  }
  if (hunt.size === 0) hunt.add(`Any exhibit or record referred to in the Day ${dayNumber} testimony on this point`);
  return { icarus: [...icarus.values()].slice(0, 5), hunt: [...hunt].slice(0, 5) };
}

export function researchPrompt(dayNumber: number, task: string, reason: string, support: ResearchSupport) {
  return [
    `You are assisting with case research for Commonwealth v. Lindsay M. Clancy (trial Day ${dayNumber}).`,
    "",
    `Task: ${task}`,
    `Why it matters: ${reason}`,
    "",
    "Rules:",
    "- Work only from the materials I provide. Do not supply facts from memory.",
    "- Cite the source and locator (page/line, timestamp, or exhibit) for every finding.",
    "- Keep what a source directly states separate from your inference, and say what is missing.",
    "",
    "Materials I will attach or paste:",
    ...support.icarus.map((item) => `- From Icarus: ${item.label}`),
    ...support.hunt.map((item) => `- To be gathered: ${item}`),
    "",
    "Return: (1) the requested output as a table or timeline, (2) unresolved questions, (3) any further records needed.",
  ].join("\n");
}
