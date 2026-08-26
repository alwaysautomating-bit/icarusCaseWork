export type ReferenceReport = {
  id: string;
  title: string;
  classification: string;
  format: "Markdown" | "PDF";
  contentType: string;
  fileName: string;
  byteLength: number;
  sha256: string;
  description: string;
  boundary: string;
};

export const referenceReports: ReferenceReport[] = [
  {
    id: "lindsey-clancy-mental-health-timeline",
    title: "Lindsey Clancy Mental Health Timeline",
    classification: "Research compilation · reference only",
    format: "Markdown",
    contentType: "text/markdown; charset=utf-8",
    fileName: "lindsey-clancy-mental-health-timeline.md",
    byteLength: 67_703,
    sha256: "486c5998efe8618c5b7256525d5f0030fe154fe987eb3d0d9dfa6dc113cbc851",
    description: "A third-party research timeline supplied for orientation and follow-up source checking.",
    boundary: "Not canonical fact. Its narrative, citations, and generated framing remain unverified until traced to source-level evidence.",
  },
  {
    id: "search-warrant-evidence-packet",
    title: "Search Warrant Evidence Packet",
    classification: "Court-document packet · reference evidence",
    format: "PDF",
    contentType: "application/pdf",
    fileName: "search-warrant-evidence-packet.pdf",
    byteLength: 6_925_349,
    sha256: "5f7c76cab4d7204ebde87ab424acd43388f4716451c12e725a6af61d48827d6c",
    description: "The supplied Lindsay Clancy search-warrant court-document packet, preserved as received.",
    boundary: "Evidence source, not a finding of fact. Allegations, attributed statements, and investigator assertions are not promoted into the canonical record by inclusion here.",
  },
];

export function referenceReportById(reportId: string) {
  return referenceReports.find((report) => report.id === reportId);
}
