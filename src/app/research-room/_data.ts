export type ContributionKind =
  | "I FOUND A SOURCE"
  | "I FOUND SUPPORTING INFORMATION"
  | "I FOUND CONFLICTING INFORMATION"
  | "I NOTICED SOMETHING"
  | "I HAVE RELEVANT EXPERTISE / CONTEXT"
  | "I HAVE ANOTHER QUESTION";

export type Researcher = {
  id: string;
  name: string;
  handle: string;
  color: string;
  skills: string[];
};

export type Contribution = {
  id: string;
  authorId: string;
  kind: ContributionKind;
  status: "NEEDS VERIFICATION" | "POSSIBLE CONFLICT" | "OPEN QUESTION" | "SOURCE FOUND";
  body: string;
  context: string;
  sources: string[];
  flags: number;
  discussions: number;
  saved: number;
  time: string;
};

export const researchers: Researcher[] = [
  { id: "mara", name: "Mara Reyes", handle: "@marareyes", color: "#ac001e", skills: ["Court records", "Timeline reconstruction", "Public records"] },
  { id: "jonah", name: "Jonah Bell", handle: "@jonahbell", color: "#191c1e", skills: ["Police procedure", "Dispatch records", "Audio review"] },
  { id: "priya", name: "Priya Anand", handle: "@priyaanand", color: "#5d3f3d", skills: ["Medical terminology", "Pharmacy workflow", "Data analysis"] },
  { id: "le", name: "Le Tran", handle: "@letran", color: "#00716e", skills: ["Device data", "Video analysis", "Timeline reconstruction"] },
];

export const contributions: Contribution[] = [
  {
    id: "dispatch-chronology",
    authorId: "mara",
    kind: "I FOUND CONFLICTING INFORMATION",
    status: "POSSIBLE CONFLICT",
    body: "Hall testified that his response took seven to ten minutes. This may conflict with the dispatch chronology.",
    context: "January 24 timeline · responder arrival",
    sources: ["Testimony · Stephen Hall · Day 3 · 00:48:17", "Dispatch record · p. 18"],
    flags: 4,
    discussions: 12,
    saved: 8,
    time: "18M AGO",
  },
  {
    id: "cvs-timing",
    authorId: "jonah",
    kind: "I FOUND A SOURCE",
    status: "SOURCE FOUND",
    body: "The search warrant packet includes a receipt image that may independently narrow the CVS timing. The timestamp needs comparison against the device chronology.",
    context: "CVS timing · external corroboration",
    sources: ["Search warrant packet · exhibit image 14", "Device extraction summary · p. 31"],
    flags: 2,
    discussions: 6,
    saved: 14,
    time: "1H AGO",
  },
  {
    id: "medication-reference",
    authorId: "priya",
    kind: "I HAVE RELEVANT EXPERTISE / CONTEXT",
    status: "NEEDS VERIFICATION",
    body: "The medication name in the transcript may be a brand reference rather than a separate prescription. A pharmacist or source record should confirm before this is used in the timeline.",
    context: "Medication history · terminology",
    sources: ["Testimony · Day 6 · 01:12:04"],
    flags: 1,
    discussions: 4,
    saved: 5,
    time: "3H AGO",
  },
  {
    id: "return-home",
    authorId: "le",
    kind: "I HAVE ANOTHER QUESTION",
    status: "OPEN QUESTION",
    body: "What does the testimony establish about the return-home timeline, and which points are still only inferred from later statements?",
    context: "January 24 timeline · return home",
    sources: ["Testimony · Day 3 · 00:35:42"],
    flags: 0,
    discussions: 9,
    saved: 3,
    time: "5H AGO",
  },
];

export const rooms = [
  {
    id: "clancy",
    name: "Commonwealth v. Clancy",
    label: "PLYMOUTH SUPERIOR COURT · CASE-SCOPED",
    description: "Collaborative examination of testimony, filings, source records, and the January 24 event sequence.",
    questions: 24,
    verification: 11,
    timelines: 8,
    researchers: 8,
  },
  {
    id: "record-methods",
    name: "Court Record Methods",
    label: "SPECIALIST WORKING GROUP",
    description: "Shared methods for transcript citation, proposition tracing, and source-to-record comparison.",
    questions: 7,
    verification: 3,
    timelines: 2,
    researchers: 14,
  },
  {
    id: "medical-context",
    name: "Medical Record Context",
    label: "SPECIALIST WORKING GROUP",
    description: "Terminology and workflow context for reading the available medical record without exceeding the source.",
    questions: 12,
    verification: 9,
    timelines: 4,
    researchers: 6,
  },
];

export const timeline = [
  { time: "4:47 PM", title: "CVS timing reference", detail: "Receipt image and testimony require source-to-source comparison.", state: "NEEDS VERIFICATION" },
  { time: "5:06 PM", title: "Return-home window", detail: "Current range is reconstructed from testimony and device chronology.", state: "OPEN QUESTION" },
  { time: "6:11 PM", title: "Responder dispatch", detail: "Dispatch record establishes the first preserved system timestamp.", state: "SOURCE FOUND" },
  { time: "6:18 PM", title: "Arrival accounts", detail: "Witness description and dispatch chronology may use different reference points.", state: "POSSIBLE CONFLICT" },
];

export const researchSkills = [
  "Court records",
  "Medical terminology",
  "Pharmacy workflow",
  "Accounting",
  "Digital forensics",
  "Device data",
  "Timeline reconstruction",
  "Video analysis",
  "Public records",
  "Police procedure",
  "Data analysis",
];
