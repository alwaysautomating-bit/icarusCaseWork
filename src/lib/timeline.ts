export type ResearchWindow = "all" | "ninety_days" | "thirty_days" | "incident_window";

export function windowsForEvent(eventStart: string | null, incidentAt: string | null, incidentWindowStart: string | null, incidentWindowEnd: string | null): ResearchWindow[] {
  if (!eventStart || !incidentAt) return ["all"];
  const event = new Date(eventStart).getTime();
  const incident = new Date(incidentAt).getTime();
  const daysBefore = (incident - event) / 86_400_000;
  const windows: ResearchWindow[] = ["all"];
  if (daysBefore >= 0 && daysBefore <= 90) windows.push("ninety_days");
  if (daysBefore >= 0 && daysBefore <= 30) windows.push("thirty_days");
  if (incidentWindowStart && incidentWindowEnd && event >= new Date(incidentWindowStart).getTime() && event <= new Date(incidentWindowEnd).getTime()) windows.push("incident_window");
  return windows;
}
