import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2_000_000;
const CAPTURE_TIMEOUT_MS = 20_000;

type LookupResult = { address: string; family: number };
export type HostLookup = (hostname: string) => Promise<LookupResult[]>;

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIp(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) return isBlockedIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isBlockedIpv4(mapped) : false;
}

const defaultLookup: HostLookup = async (hostname) => {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => ({ address, family }));
};

export async function assertSafeRemoteUrl(rawUrl: string, lookup: HostLookup = defaultLookup) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid testimony URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP and HTTPS testimony URLs are supported.");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Non-standard URL ports are not allowed.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error("Local and private-network URLs are not allowed.");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) throw new Error("Local and private-network URLs are not allowed.");
  return url;
}

export function canonicalizeSubmittedUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  return url.toString();
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_HTML_BYTES) throw new Error("The testimony page is larger than the capture limit.");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("The testimony page is larger than the capture limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export type CapturedHtml = {
  submittedUrl: string;
  finalUrl: string;
  contentType: string;
  capturedAt: string;
  bytes: Uint8Array;
  html: string;
};

export async function captureRemoteHtml(submittedUrl: string, lookup: HostLookup = defaultLookup): Promise<CapturedHtml> {
  let current = await assertSafeRemoteUrl(submittedUrl, lookup);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
      headers: { "User-Agent": "IcarusCasework/0.1 testimony-capture", Accept: "text/html,application/xhtml+xml" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === MAX_REDIRECTS) throw new Error("The testimony URL exceeded the redirect limit.");
      const location = response.headers.get("location");
      if (!location) throw new Error("The testimony URL returned an invalid redirect.");
      current = await assertSafeRemoteUrl(new URL(location, current).toString(), lookup);
      continue;
    }
    if (!response.ok) throw new Error(`The testimony page returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(contentType)) throw new Error("The URL did not return an HTML testimony page.");
    const bytes = await readLimitedBody(response);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!html.trim()) throw new Error("The testimony page was empty.");
    return { submittedUrl, finalUrl: current.toString(), contentType, capturedAt: new Date().toISOString(), bytes, html };
  }
  throw new Error("The testimony URL could not be captured.");
}
