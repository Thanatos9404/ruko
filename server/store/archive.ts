import type { Check } from "../../shared/types.js";

/**
 * Durable audit archive for decided checks. On Vercel, with a Blob store
 * connected (BLOB_READ_WRITE_TOKEN), each decided check is written once as an
 * immutable, private JSON object. Without a token this is a no-op; the live store still
 * holds the record for its TTL.
 */
export interface Archive {
  readonly enabled: boolean;
  put(check: Check): Promise<void>;
}

export const noArchive: Archive = { enabled: false, async put() {} };

export function blobArchive(token: string): Archive {
  return {
    enabled: true,
    async put(check: Check) {
      const { put } = await import("@vercel/blob");
      const day = check.created_at.slice(0, 10);
      await put(`audit/${day}/${check.id}-${Date.parse(check.updated_at)}.json`, JSON.stringify(check), {
        access: "private",
        addRandomSuffix: true,
        contentType: "application/json",
        token,
      });
    },
  };
}
