import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalObjectStorage } from "./object-storage";

describe("local object storage", () => {
  it("preserves a deterministic immutable object", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "icarus-objects-"));
    const storage = new LocalObjectStorage(root);
    await storage.putImmutable({ key: "digest.txt", bytes: Buffer.from("record"), contentType: "text/plain" });
    await storage.putImmutable({ key: "digest.txt", bytes: Buffer.from("record"), contentType: "text/plain" });
    expect(await readFile(path.join(root, "digest.txt"), "utf8")).toBe("record");
  });
});
