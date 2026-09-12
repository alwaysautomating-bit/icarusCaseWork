import { describe, expect, it } from "vitest";
import { supportingMediaStorageBackend } from "./supporting-media-storage-mode";

describe("supporting media storage selection", () => {
  it("uses the local filesystem away from Vercel", () => {
    expect(supportingMediaStorageBackend({})).toBe("local_filesystem");
  });

  it("uses private Blob when its token is present", () => {
    expect(supportingMediaStorageBackend({ VERCEL: "1", BLOB_READ_WRITE_TOKEN: "configured" })).toBe("vercel_blob");
  });

  it("fails closed when a Vercel deployment has no private Blob connection", () => {
    expect(() => supportingMediaStorageBackend({ VERCEL: "1" })).toThrow(/Blob storage is not connected/);
  });
});
