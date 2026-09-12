export type ReferenceReport = {
  id: string;
  title: string;
  classification: string;
  format: "Markdown" | "PDF";
  contentType: string;
  relativePath: string;
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
    relativePath: "reports/lindsey-clancy-mental-health-timeline.md",
    fileName: "lindsey-clancy-mental-health-timeline.md",
    byteLength: 67_703,
    sha256: "486c5998efe8618c5b7256525d5f0030fe154fe987eb3d0d9dfa6dc113cbc851",
    description: "A third-party research timeline supplied for orientation and follow-up source checking.",
    boundary: "Not canonical fact. Its narrative, citations, and generated framing remain unverified until traced to source-level evidence.",
  },
];

export function referenceReportById(reportId: string) {
  return referenceReports.find((report) => report.id === reportId);
}
