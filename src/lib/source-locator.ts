export type SourceLocator =
  | { type: "character_offset"; start: number; end: number }
  | { type: "page"; page: number; start: number; end: number }
  | { type: "timestamp"; timestampStart: string; timestampEnd?: string; start: number; end: number }
  | { type: "spreadsheet_range"; sheet: string; range: string; start: number; end: number }
  | { type: "image_region"; region: string; start: number; end: number };

type LocatorInput = {
  locatorType: SourceLocator["type"];
  page?: string;
  timestampStart?: string;
  timestampEnd?: string;
  sheet?: string;
  range?: string;
  imageRegion?: string;
};

export function buildSourceLocator(input: LocatorInput, characterOffset: { start: number; end: number }): SourceLocator {
  switch (input.locatorType) {
    case "page": {
      const page = Number(input.page);
      if (!Number.isInteger(page) || page < 1) throw new Error("A PDF or document citation requires a positive page number.");
      return { type: "page", page, ...characterOffset };
    }
    case "timestamp":
      if (!input.timestampStart?.trim()) throw new Error("A transcript or recording citation requires a start timestamp.");
      return { type: "timestamp", timestampStart: input.timestampStart.trim(), timestampEnd: input.timestampEnd?.trim() || undefined, ...characterOffset };
    case "spreadsheet_range":
      if (!input.sheet?.trim() || !input.range?.trim()) throw new Error("A spreadsheet citation requires a sheet and cell range.");
      return { type: "spreadsheet_range", sheet: input.sheet.trim(), range: input.range.trim(), ...characterOffset };
    case "image_region":
      if (!input.imageRegion?.trim()) throw new Error("An image citation requires a region description.");
      return { type: "image_region", region: input.imageRegion.trim(), ...characterOffset };
    default:
      return { type: "character_offset", ...characterOffset };
  }
}

export function formatSourceLocator(locator: SourceLocator) {
  switch (locator.type) {
    case "page": return `page ${locator.page}`;
    case "timestamp": return locator.timestampEnd ? `${locator.timestampStart}–${locator.timestampEnd}` : locator.timestampStart;
    case "spreadsheet_range": return `${locator.sheet}!${locator.range}`;
    case "image_region": return `image region: ${locator.region}`;
    default: return `characters ${locator.start}–${locator.end}`;
  }
}
