export type SupportingMediaStorageBackend = "local_filesystem" | "vercel_blob";

export function supportingMediaStorageBackend(environment: Record<string, string | undefined> = process.env): SupportingMediaStorageBackend {
  if (environment.BLOB_READ_WRITE_TOKEN) return "vercel_blob";
  if (environment.VERCEL === "1") {
    throw new Error("Private Blob storage is not connected to this Vercel deployment.");
  }
  return "local_filesystem";
}
