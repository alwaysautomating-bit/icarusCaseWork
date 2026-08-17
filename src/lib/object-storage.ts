import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

export type StoredObject = { key: string; provider: "local" | "vercel_blob"; url?: string };
export type StoreObjectInput = { key: string; bytes: Uint8Array; contentType: string };
export interface ObjectStorage { putImmutable(input: StoreObjectInput): Promise<StoredObject> }

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly root: string) {}
  async putImmutable(input: StoreObjectInput): Promise<StoredObject> {
    await mkdir(this.root, { recursive: true });
    await writeFile(path.join(this.root, input.key), input.bytes, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    return { key: input.key, provider: "local" };
  }
}

export class VercelBlobObjectStorage implements ObjectStorage {
  async putImmutable(input: StoreObjectInput): Promise<StoredObject> {
    const blob = await put(input.key, Buffer.from(input.bytes), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: input.contentType,
    });
    return { key: blob.pathname, provider: "vercel_blob", url: blob.url };
  }
}

export function getObjectStorage(dataRoot: string): ObjectStorage {
  return process.env.BLOB_READ_WRITE_TOKEN
    ? new VercelBlobObjectStorage()
    : new LocalObjectStorage(path.join(dataRoot, "objects"));
}
