import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { z } from "zod";
import { supportingMediaStorageBackend } from "@/lib/supporting-media-storage-mode";

// Server Action uploads stay below Vercel's request envelope for the MVP.
export const MAX_SUPPORTING_IMAGE_BYTES = 4 * 1024 * 1024;

const caseIdSchema = z.uuid();
const itemIdSchema = z.uuid();

const formats = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Uint8Array) => bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]) },
  "image/webp": { extension: "webp", matches: (bytes: Uint8Array) => Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP" },
  "image/gif": { extension: "gif", matches: (bytes: Uint8Array) => ["GIF87a", "GIF89a"].includes(Buffer.from(bytes.slice(0, 6)).toString("ascii")) },
  "image/avif": { extension: "avif", matches: (bytes: Uint8Array) => Buffer.from(bytes.slice(4, 8)).toString("ascii") === "ftyp" && ["avif", "avis"].includes(Buffer.from(bytes.slice(8, 12)).toString("ascii")) },
} as const;

export type SupportingImageMediaType = keyof typeof formats;
function storageRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.env.ICARUS_LOCAL_MEDIA_ROOT || path.join(process.cwd(), ".data", "case-media"));
}

function validateObjectKey(caseId: string, objectKey: string) {
  const safeCaseId = caseIdSchema.parse(caseId);
  const [keyCaseId, filename, extra] = objectKey.split("/");
  if (extra || keyCaseId !== safeCaseId || !filename || !/^[0-9a-f-]{36}\.(?:jpg|png|webp|gif|avif)$/.test(filename)) {
    throw new Error("The supporting image location is invalid.");
  }
  return { filename, keyCaseId, objectKey: `${keyCaseId}/${filename}` };
}

function resolveObjectPath(caseId: string, objectKey: string) {
  const { filename, keyCaseId } = validateObjectKey(caseId, objectKey);
  const root = storageRoot();
  const resolved = path.resolve(root, keyCaseId, filename);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("The supporting image location is outside the local library.");
  return resolved;
}

function detectMediaType(bytes: Uint8Array): SupportingImageMediaType | null {
  for (const [mediaType, format] of Object.entries(formats) as Array<[SupportingImageMediaType, (typeof formats)[SupportingImageMediaType]]>) {
    if (format.matches(bytes)) return mediaType;
  }
  return null;
}

function cleanOriginalFilename(value: string) {
  const cleaned = path.basename(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "image").slice(0, 255);
}

export async function writeSupportingImage(caseId: string, itemId: string, file: File) {
  const safeCaseId = caseIdSchema.parse(caseId);
  const safeItemId = itemIdSchema.parse(itemId);
  if (file.size <= 0) throw new Error("Choose a non-empty image file.");
  if (file.size > MAX_SUPPORTING_IMAGE_BYTES) throw new Error("Images must be 4 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = detectMediaType(bytes);
  if (!mediaType) throw new Error("Use a JPEG, PNG, WebP, GIF, or AVIF image.");
  if (file.type && file.type !== mediaType) throw new Error("The file contents do not match its reported image type.");

  const extension = formats[mediaType].extension;
  const objectKey = `${safeCaseId}/${safeItemId}.${extension}`;
  const backend = supportingMediaStorageBackend();
  if (backend === "vercel_blob") {
    await put(objectKey, Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: mediaType,
    });
  } else {
    const absolutePath = resolveObjectPath(safeCaseId, objectKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes, { flag: "wx" });
  }

  return {
    backend,
    byteLength: bytes.byteLength,
    mediaType,
    objectKey,
    originalFilename: cleanOriginalFilename(file.name),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readSupportingImage(caseId: string, objectKey: string) {
  const safeObjectKey = validateObjectKey(caseId, objectKey).objectKey;
  if (supportingMediaStorageBackend() === "vercel_blob") {
    const result = await get(safeObjectKey, { access: "private" });
    if (!result || result.statusCode !== 200) throw new Error("The supporting image is unavailable.");
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  return readFile(/* turbopackIgnore: true */ resolveObjectPath(caseId, objectKey));
}

export async function removeSupportingImage(caseId: string, objectKey: string) {
  const safeObjectKey = validateObjectKey(caseId, objectKey).objectKey;
  if (supportingMediaStorageBackend() === "vercel_blob") {
    await del(safeObjectKey);
    return;
  }
  try {
    await unlink(resolveObjectPath(caseId, objectKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
