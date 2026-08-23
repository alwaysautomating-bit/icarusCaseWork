export const longitudinalViewKeys = ["full", "jan-focus"] as const;
export type LongitudinalViewKey = (typeof longitudinalViewKeys)[number];

export type EvidenceStatus = "reviewed_testimony" | "reported_taken" | "prescribed" | "recommended_not_taken" | "analytical_candidate";
export type MedicationAction = "prescribed" | "reported_taken" | "dose_change" | "taper" | "stopped" | "recommended_not_taken";
export type SignalLane = "sleep" | "clinical" | "care" | "diagnostic" | "escalation";

export type SourceAnchor = {
  segmentId: string;
  label: string;
  proceeding: "Day 10" | "Day 11";
};

export type MedicationPeriod = {
  id: string;
  medication: string;
  classLabel: string;
  start: string;
  end: string;
  doseLabel: string;
  action: MedicationAction;
  status: EvidenceStatus;
  note: string;
  source: SourceAnchor;
};

export type TrajectorySignal = {
  id: string;
  lane: SignalLane;
  date: string;
  end?: string;
  title: string;
  detail: string;
  status: EvidenceStatus;
  source: SourceAnchor;
};

export type LongitudinalEpisode = {
  id: string;
  start: string;
  end: string;
  title: string;
  interpretation: string;
  status: EvidenceStatus;
  sourceSegmentIds: string[];
};

export type LongitudinalCareSnapshot = {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  boundaryNote: string;
  windows: Record<LongitudinalViewKey, { label: string; start: string; end: string; description: string }>;
  episode: LongitudinalEpisode;
  medications: MedicationPeriod[];
  signals: TrajectorySignal[];
};

const day10 = (segmentId: string, label: string): SourceAnchor => ({ segmentId, label, proceeding: "Day 10" });
const day11 = (segmentId: string, label: string): SourceAnchor => ({ segmentId, label, proceeding: "Day 11" });

export const lindsayLongitudinalDemo: LongitudinalCareSnapshot = {
  id: "lindsay-care-trajectory-reviewed-demo-v1",
  name: "Observed care trajectory · reviewed testimony",
  version: 1,
  createdAt: "2026-08-23T12:00:00-05:00",
  boundaryNote: "Reviewed testimony projection, not a canonical clinical record. Prescription, reported administration, and later interpretation remain distinct.",
  windows: {
    full: {
      label: "Full trajectory",
      start: "2022-09-15",
      end: "2023-01-23",
      description: "The continuing episode remains visible across successive medication trials and care transitions.",
    },
    "jan-focus": {
      label: "Jan 9–23 focus",
      start: "2023-01-09",
      end: "2023-01-23",
      description: "Post-McLean follow-up: fourteen days of medication changes, persistent sleep disruption, and worsening reported affect.",
    },
  },
  episode: {
    id: "persistent-unresolved-episode",
    start: "2022-09-15",
    end: "2023-01-23",
    title: "Persistent episode without demonstrated stabilization",
    interpretation: "Analytical candidate linking the continuing symptom and sleep trajectory across interventions. It does not treat each medication start as a new illness episode.",
    status: "analytical_candidate",
    sourceSegmentIds: [
      "8cc3a133-920a-5e68-a008-dee027890b5c",
      "7bf8e440-c29e-59b0-aec2-0c741d41c107",
      "44fbc966-3c63-5cd8-a22a-85e76245c2e2",
      "2fa7fb68-d744-5995-acfd-7d2ff7fd7baf",
      "8e3f69fe-d083-55d3-a867-83bc69400abe",
      "1754a3aa-aba9-5333-ac4e-86c4ee673c4f",
      "e3c9bae6-0837-5a55-a67e-e8272ce0032b",
    ],
  },
  medications: [
    {
      id: "sertraline-prescribed",
      medication: "Sertraline / Zoloft",
      classLabel: "SSRI antidepressant",
      start: "2022-09-15",
      end: "2022-10-12",
      doseLabel: "25 mg prescribed · start delayed",
      action: "prescribed",
      status: "prescribed",
      note: "The prescription existed before testimony placed the start of administration roughly one month later.",
      source: day10("8cc3a133-920a-5e68-a008-dee027890b5c", "September 15 prescription"),
    },
    {
      id: "sertraline-taken-25",
      medication: "Sertraline / Zoloft",
      classLabel: "SSRI antidepressant",
      start: "2022-10-13",
      end: "2022-10-19",
      doseLabel: "25 mg reportedly taken",
      action: "reported_taken",
      status: "reported_taken",
      note: "Reported administration after the delayed start.",
      source: day10("94e94a95-3296-5a83-ad9b-fa27fc007dd9", "Instruction to increase after one week"),
    },
    {
      id: "sertraline-increase-stop",
      medication: "Sertraline / Zoloft",
      classLabel: "SSRI antidepressant",
      start: "2022-10-20",
      end: "2022-10-20",
      doseLabel: "50 mg increase · stopped",
      action: "stopped",
      status: "reviewed_testimony",
      note: "Testimony described worse insomnia, anxiety, depression, appetite symptoms, and mental fog after the increase.",
      source: day10("7bf8e440-c29e-59b0-aec2-0c741d41c107", "Reported response after dose increase"),
    },
    {
      id: "lorazepam-05",
      medication: "Lorazepam / Ativan",
      classLabel: "Benzodiazepine",
      start: "2022-10-21",
      end: "2022-11-01",
      doseLabel: "0.5 mg",
      action: "prescribed",
      status: "prescribed",
      note: "Prescribed for anxiety and sleep-related distress.",
      source: day10("63f10423-cec5-5672-afad-3140280e17ab", "Ativan 0.5 mg testimony"),
    },
    {
      id: "lorazepam-1",
      medication: "Lorazepam / Ativan",
      classLabel: "Benzodiazepine",
      start: "2022-11-02",
      end: "2022-12-05",
      doseLabel: "Up to 1 mg discussed",
      action: "dose_change",
      status: "reviewed_testimony",
      note: "An increase was offered after 0.5 mg was reported as only somewhat helpful; actual nightly administration varied.",
      source: day10("9a9019f3-58cc-518c-ad00-7161a7ed4bfd", "Ativan increase discussion"),
    },
    {
      id: "trazodone-50",
      medication: "Trazodone",
      classLabel: "Sedating antidepressant",
      start: "2022-11-16",
      end: "2023-01-05",
      doseLabel: "50 mg initial prescription",
      action: "prescribed",
      status: "prescribed",
      note: "Initial ER prescription. Later changes are represented separately rather than assuming this dose persisted unchanged.",
      source: day11("f721213a-05dc-5c0c-a224-3806540f2b21", "November 16 ER prescription"),
    },
    {
      id: "fluoxetine-intro",
      medication: "Fluoxetine / Prozac",
      classLabel: "SSRI antidepressant",
      start: "2022-11-20",
      end: "2022-11-24",
      doseLabel: "10 mg introductory dose",
      action: "reported_taken",
      status: "reviewed_testimony",
      note: "A 20 mg increase was planned if tolerated; testimony described stopping after intolerance rather than completing a full trial.",
      source: day10("71bcaf12-8cdf-5488-a7ad-1b125582cff8", "Fluoxetine introductory dosing"),
    },
    {
      id: "mirtazapine-75",
      medication: "Mirtazapine / Remeron",
      classLabel: "Antidepressant with sedating effect",
      start: "2022-11-25",
      end: "2022-11-27",
      doseLabel: "7.5 mg",
      action: "prescribed",
      status: "prescribed",
      note: "The age of this intervention was days; the illness and sleep trajectory already predated it by months.",
      source: day10("1a8458a6-b70a-59f0-af62-9a9506d348a7", "Mirtazapine started at 7.5 mg"),
    },
    {
      id: "mirtazapine-15",
      medication: "Mirtazapine / Remeron",
      classLabel: "Antidepressant with sedating effect",
      start: "2022-11-28",
      end: "2022-12-06",
      doseLabel: "15 mg",
      action: "dose_change",
      status: "reported_taken",
      note: "Reported sleep improvement coexisted with feeling disconnected from self and reality.",
      source: day10("e53bcbfb-53e7-51a5-a9b7-af53a6010e36", "Reported 15 mg use and response"),
    },
    {
      id: "clonazepam-05",
      medication: "Clonazepam / Klonopin",
      classLabel: "Benzodiazepine",
      start: "2022-11-25",
      end: "2022-11-27",
      doseLabel: "0.5 mg reported",
      action: "reported_taken",
      status: "reported_taken",
      note: "Short reported exposure paired with mirtazapine.",
      source: day10("e53bcbfb-53e7-51a5-a9b7-af53a6010e36", "Reported Klonopin use"),
    },
    {
      id: "quetiapine-25",
      medication: "Quetiapine / Seroquel",
      classLabel: "Atypical antipsychotic",
      start: "2022-11-30",
      end: "2022-12-06",
      doseLabel: "25 mg",
      action: "prescribed",
      status: "prescribed",
      note: "Initially prescribed at a low dose for insomnia.",
      source: day11("48c0f0a6-65fe-5c28-ae3b-ee1f860c8dfd", "November 30 Seroquel prescription"),
    },
    {
      id: "quetiapine-titration",
      medication: "Quetiapine / Seroquel",
      classLabel: "Atypical antipsychotic",
      start: "2022-12-07",
      end: "2022-12-11",
      doseLabel: "100 → 200 mg; higher titration proposed",
      action: "dose_change",
      status: "reviewed_testimony",
      note: "Jollotta testified that bipolar-spectrum concern changed the plan; proposed 300–400 mg steps were not equivalent to confirmed administration.",
      source: day11("ceacac34-84c0-525c-a148-d238aceb913e", "Bipolar differential and Seroquel titration"),
    },
    {
      id: "quetiapine-200",
      medication: "Quetiapine / Seroquel",
      classLabel: "Atypical antipsychotic",
      start: "2022-12-12",
      end: "2022-12-15",
      doseLabel: "200 mg reported",
      action: "reported_taken",
      status: "reported_taken",
      note: "Seven to eight hours of sleep was reported alongside severe morning/daytime depression and low motivation.",
      source: day11("a92f5eb2-c03e-544e-a4ad-cd9c43c0113c", "Reported Seroquel and Valium use"),
    },
    {
      id: "quetiapine-300",
      medication: "Quetiapine / Seroquel",
      classLabel: "Atypical antipsychotic",
      start: "2022-12-16",
      end: "2022-12-20",
      doseLabel: "300 mg plan/prescription",
      action: "dose_change",
      status: "prescribed",
      note: "Listed with lamotrigine 25 mg and diazepam 2 mg in the treatment plan.",
      source: day11("acb94acb-3a80-505d-a179-32fae002bec6", "December 16 medication plan"),
    },
    {
      id: "quetiapine-taper",
      medication: "Quetiapine / Seroquel",
      classLabel: "Atypical antipsychotic",
      start: "2022-12-21",
      end: "2023-01-05",
      doseLabel: "200 → 100 → 50 mg taper",
      action: "taper",
      status: "prescribed",
      note: "Taper schedule issued before and across the McLean transition; exact administration remains a separate question.",
      source: day11("dd1bed77-1ce5-5560-abd9-ec560df17b63", "Seroquel taper schedule"),
    },
    {
      id: "lamotrigine-25",
      medication: "Lamotrigine / Lamictal",
      classLabel: "Mood stabilizer / anticonvulsant",
      start: "2022-12-16",
      end: "2022-12-20",
      doseLabel: "25 mg",
      action: "prescribed",
      status: "prescribed",
      note: "Start documented in testimony; the reviewed slice does not establish a continuous administration end date.",
      source: day10("a2b9e8ae-e72e-5d24-a38f-d068c70514b5", "Lamictal start"),
    },
    {
      id: "diazepam-jan",
      medication: "Diazepam / Valium",
      classLabel: "Benzodiazepine",
      start: "2023-01-09",
      end: "2023-01-15",
      doseLabel: "5 mg · 14 count",
      action: "prescribed",
      status: "prescribed",
      note: "Prescription confirmed in testimony; daily administration should not be inferred solely from the count.",
      source: day10("e1e0cef1-9d79-5893-a339-f0c5fefa3e0c", "January 9 diazepam prescription"),
    },
    {
      id: "diazepam-taper-jan",
      medication: "Diazepam / Valium",
      classLabel: "Benzodiazepine",
      start: "2023-01-16",
      end: "2023-01-23",
      doseLabel: "Taper; 5 mg reported for prior two nights",
      action: "taper",
      status: "reviewed_testimony",
      note: "January 16 history described four hours of sleep followed by light sleep in roughly two-hour stretches.",
      source: day10("65349fd3-9814-5e7e-a6ae-a58a585ecaea", "January 16 diazepam and sleep history"),
    },
    {
      id: "trazodone-150",
      medication: "Trazodone",
      classLabel: "Sedating antidepressant",
      start: "2023-01-12",
      end: "2023-01-23",
      doseLabel: "150 mg · 30 count",
      action: "dose_change",
      status: "prescribed",
      note: "Prescription confirmed on January 12; the excerpt does not independently establish every administered dose.",
      source: day10("cd4c2859-9cf8-5906-aa91-0f5bb2a0181e", "January 12 trazodone prescription"),
    },
    {
      id: "amitriptyline-10",
      medication: "Amitriptyline",
      classLabel: "Tricyclic antidepressant",
      start: "2023-01-16",
      end: "2023-01-23",
      doseLabel: "10 mg · 30 count",
      action: "reported_taken",
      status: "reported_taken",
      note: "Eight pills were missing from the bottle across January 16–23, consistent with one 10 mg tablet on each date.",
      source: day10("2a1553b6-186c-5444-a4cd-874c8a4b70ee", "January 16 amitriptyline prescription"),
    },
    {
      id: "amitriptyline-20-not-taken",
      medication: "Amitriptyline",
      classLabel: "Tricyclic antidepressant",
      start: "2023-01-23",
      end: "2023-01-23",
      doseLabel: "20 mg authorized · apparently not taken",
      action: "recommended_not_taken",
      status: "recommended_not_taken",
      note: "The 20 mg increase was authorized on January 23. Pill count testimony indicated the additional dose was not taken.",
      source: day10("4d627304-6bde-5e4d-a6f8-d939f2a28f1b", "Pill-count inference on recommended increase"),
    },
  ],
  signals: [
    {
      id: "oct20-sleep-adverse",
      lane: "sleep",
      date: "2022-10-20",
      title: "Insomnia worsened after dose increase",
      detail: "Testimony linked the increased sertraline dose with inability to sleep, worsened insomnia, and additional adverse symptoms.",
      status: "reviewed_testimony",
      source: day10("7bf8e440-c29e-59b0-aec2-0c741d41c107", "October 20 interval history"),
    },
    {
      id: "nov29-sleep-fragmented",
      lane: "sleep",
      date: "2022-11-29",
      title: "Two hours asleep; three hours awake",
      detail: "Four nights into Remeron, mood, anxiety, and insomnia had not meaningfully improved; Ativan was used to try to return to sleep.",
      status: "reviewed_testimony",
      source: day11("44fbc966-3c63-5cd8-a22a-85e76245c2e2", "November 29 Remeron follow-up"),
    },
    {
      id: "dec3-intrusive",
      lane: "clinical",
      date: "2022-12-03",
      title: "Horrible intrusive thoughts; deeply depressed",
      detail: "Message described about four hours of sleep plus a short doze, all-day intrusive thoughts, and deep depression.",
      status: "reviewed_testimony",
      source: day11("dc1d8615-6269-51d7-a796-5b9993e1dc6e", "December 3 message reviewed in testimony"),
    },
    {
      id: "dec7-bipolar-differential",
      lane: "diagnostic",
      date: "2022-12-07",
      title: "Bipolar spectrum entered the differential",
      detail: "Jollotta testified that bipolar concern changed the medication recommendation and that antidepressants would be problematic if the condition were bipolar.",
      status: "reviewed_testimony",
      source: day11("ceacac34-84c0-525c-a148-d238aceb913e", "December 7 bipolar differential"),
    },
    {
      id: "dec9-acute",
      lane: "escalation",
      date: "2022-12-09",
      title: "Symptoms described as too acute",
      detail: "Better sleep coexisted with waking panic, intrusive thoughts, numbness, and suicidal thoughts without plan or intent; partial hospitalization intake was encouraged.",
      status: "reviewed_testimony",
      source: day11("2fa7fb68-d744-5995-acfd-7d2ff7fd7baf", "December 9 joint call"),
    },
    {
      id: "dec12-sleep-mood-split",
      lane: "sleep",
      date: "2022-12-12",
      title: "Seven–eight hours sleep; profound daytime depression",
      detail: "Reported deeper sleep on Seroquel and Valium alongside feeling incredibly depressed and unmotivated during the morning and day.",
      status: "reviewed_testimony",
      source: day11("a92f5eb2-c03e-544e-a4ad-cd9c43c0113c", "December 12 medication response"),
    },
    {
      id: "jan6-record-gap",
      lane: "care",
      date: "2023-01-06",
      title: "Post-McLean follow-up without full-record or clinician handoff",
      detail: "Tufts testified that she reviewed a discharge summary, did not obtain the full McLean record, and did not speak with the discharging physician.",
      status: "reviewed_testimony",
      source: day10("bb5a2595-12d5-5142-a9bf-629b56837495", "McLean handoff testimony"),
    },
    {
      id: "jan6-broken-sleep",
      lane: "sleep",
      date: "2023-01-06",
      title: "Five hours, broken",
      detail: "Post-discharge history described Ativan and trazodone, five broken hours of sleep, and consideration of more trazodone and a switch to Valium.",
      status: "reviewed_testimony",
      source: day10("8e3f69fe-d083-55d3-a867-83bc69400abe", "January 6 sleep history"),
    },
    {
      id: "jan9-post-discharge-window",
      lane: "escalation",
      date: "2023-01-09",
      end: "2023-01-23",
      title: "Post-hospital treatment-escalation window",
      detail: "Analytical candidate: persistent sleep and mood burden continued through multiple medication changes after inpatient discharge, without demonstrated stabilization in the reviewed testimony.",
      status: "analytical_candidate",
      source: day10("e1e0cef1-9d79-5893-a339-f0c5fefa3e0c", "January 9 follow-up"),
    },
    {
      id: "jan16-sleep",
      lane: "sleep",
      date: "2023-01-16",
      title: "Four hours, then light two-hour stretches",
      detail: "Sleep remained fragmented during the diazepam taper.",
      status: "reviewed_testimony",
      source: day10("65349fd3-9814-5e7e-a6ae-a58a585ecaea", "January 16 sleep history"),
    },
    {
      id: "jan16-clinical",
      lane: "clinical",
      date: "2023-01-16",
      title: "Very low mood; no motivation; numb",
      detail: "She reportedly forced herself out of bed, managed basics, and described bonding with the baby as forced.",
      status: "reviewed_testimony",
      source: day10("1754a3aa-aba9-5333-ac4e-86c4ee673c4f", "January 16 interval history"),
    },
    {
      id: "jan23-clinical",
      lane: "clinical",
      date: "2023-01-23",
      title: "Depressed, flat, numb, no motivation",
      detail: "The final documented session included depressed mood and affect, racing heart, no motivation, and a reported prolonged period of numbness/no emotion.",
      status: "reviewed_testimony",
      source: day10("e3c9bae6-0837-5a55-a67e-e8272ce0032b", "January 23 clinical observations"),
    },
    {
      id: "jan23-emergency-threshold",
      lane: "care",
      date: "2023-01-23",
      title: "Emergency threshold used; treatment titration continued",
      detail: "Tufts explained no hospital recommendation by reference to denied SI/HI and no observed psychosis or mania; the treatment response was gradual amitriptyline titration.",
      status: "reviewed_testimony",
      source: day10("283017a7-8ee8-5afd-a5d0-5f9f2189d23e", "January 23 hospitalization rationale"),
    },
  ],
};

const utcDay = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

export function differenceInDays(start: string, end: string) {
  return Math.round((utcDay(end) - utcDay(start)) / 86_400_000);
}

export function inclusiveDayCount(start: string, end: string) {
  return differenceInDays(start, end) + 1;
}

export function overlapsWindow(start: string, end: string, windowStart: string, windowEnd: string) {
  return utcDay(end) >= utcDay(windowStart) && utcDay(start) <= utcDay(windowEnd);
}

export function clipToWindow(start: string, end: string, windowStart: string, windowEnd: string) {
  return {
    start: utcDay(start) < utcDay(windowStart) ? windowStart : start,
    end: utcDay(end) > utcDay(windowEnd) ? windowEnd : end,
  };
}

export function positionInWindow(date: string, windowStart: string, windowEnd: string) {
  const span = Math.max(1, differenceInDays(windowStart, windowEnd));
  return Math.max(0, Math.min(100, (differenceInDays(windowStart, date) / span) * 100));
}
