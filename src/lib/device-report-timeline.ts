import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const eventSchema = z.object({
  time: z.string().optional(),
  time_start: z.string().optional(),
  time_end: z.string().optional(),
  category: z.string(),
  source: z.string(),
  detail: z.string(),
  value: z.union([z.string(), z.number()]).nullable().optional(),
  direction: z.string().optional(),
  counterparty: z.string().optional(),
});

const reportSchema = z.object({
  report: z.object({
    title: z.string(),
    date: z.string(),
    location: z.string(),
    reported_primary_device: z.string(),
    reported_secondary_device: z.string(),
    timezone_as_stated: z.string(),
    scope_note: z.string(),
    report_source_notes: z.object({
      heart_rate_first: z.string(),
      heart_rate_last: z.string(),
      heart_rate_total_records_stated: z.number(),
      heart_rate_average_stated: z.string(),
      device_locked_after_stated: z.string(),
      second_phone_statement: z.string(),
    }),
  }),
  events: z.array(eventSchema),
  hourly_summary: z.array(z.object({
    period: z.string(),
    distance_feet: z.number().nullable(),
    max_speed: z.number().nullable(),
    max_heart_rate_bpm: z.number().nullable(),
    flights_climbed: z.number().nullable(),
  })),
  transcription_notes: z.array(z.string()),
});

export type DeviceReport = z.infer<typeof reportSchema>;
export type DeviceReportEvent = DeviceReport["events"][number] & { seconds: number; approximate: boolean; index: number };

function toSeconds(value: string) {
  const [h = 0, m = 0, s = 0] = value.replace("~", "").split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

export async function getDeviceReportTimeline() {
  const file = path.join(process.cwd(), "content", "timelines", "digital", "clancy-2023-01-24.json");
  const report = reportSchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
  const events: DeviceReportEvent[] = report.events
    .map((event, index) => {
      const start = event.time ?? event.time_start ?? "00:00:00";
      return { ...event, seconds: toSeconds(start), approximate: start.startsWith("~"), index };
    })
    .sort((a, b) => a.seconds - b.seconds || a.index - b.index);
  return { ...report, events };
}

export const DEVICE_CATEGORIES: Array<{ key: string; label: string; members: string[] }> = [
  { key: "messages", label: "Messages", members: ["message", "reaction"] },
  { key: "calls", label: "Calls", members: ["call"] },
  { key: "searches", label: "Searches", members: ["search"] },
  { key: "apps", label: "App activity", members: ["app_activity"] },
  { key: "unlocks", label: "Device unlocks", members: ["device_unlock"] },
  { key: "photos", label: "Photos", members: ["photo"] },
  { key: "mail", label: "Email", members: ["email"] },
  { key: "heart", label: "Heart rate", members: ["heart_rate"] },
  { key: "flights", label: "Flights climbed", members: ["flights_climbed", "activity_sensor"] },
  { key: "context", label: "Report context", members: ["appointment", "location_context", "network"] },
];

const NOISY = new Set(["heart", "flights"]);

export function categoryKey(category: string) {
  return DEVICE_CATEGORIES.find((item) => item.members.includes(category))?.key ?? "context";
}

export function isNoisyCategory(key: string) {
  return NOISY.has(key);
}

export function formatEventTime(event: DeviceReportEvent) {
  if (event.time) return event.time;
  if (event.time_start && event.time_end) return `${event.time_start}–${event.time_end}`;
  return event.time_start ?? "";
}
