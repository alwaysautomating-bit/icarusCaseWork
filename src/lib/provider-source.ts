type TranscriptSource = {
  proceedingTitle?: string | null;
  canonicalUrl?: string | null;
  sourceUrl?: string | null;
};

const REV_TRANSCRIPT_HOSTS = new Set(["rev.com", "www.rev.com"]);

function supportedRevTranscriptUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !REV_TRANSCRIPT_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (!/^\/transcripts\/ma-v-lindsay-clancy-day-\d+\/?$/i.test(url.pathname)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function revTranscriptPage(source: TranscriptSource) {
  const recorded = supportedRevTranscriptUrl(source.canonicalUrl)
    ?? supportedRevTranscriptUrl(source.sourceUrl);
  if (recorded) return recorded;

  const dayMatch = /^(?:MA\s+v\.?\s+Lindsay\s+(?:M\.\s+)?Clancy\s+)?Day\s+(\d{1,3})$/i.exec(
    source.proceedingTitle?.trim() ?? "",
  );
  if (!dayMatch) return null;
  return `https://www.rev.com/transcripts/ma-v-lindsay-clancy-day-${Number(dayMatch[1])}`;
}
