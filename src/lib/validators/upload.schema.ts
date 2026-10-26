import { z } from "zod";

/**
 * The payload the browser sends to `POST /api/upload` before it uploads the
 * bytes themselves.
 *
 * The route uses this to decide whether to hand out a signed upload URL. The
 * bytes never pass through the app server — the browser PUTs them straight to
 * Supabase storage, which keeps a 5 MB photo off the function's request body
 * limit and off the server's memory.
 *
 * The declared size and type are checked here *and* enforced again by the
 * bucket (`file_size_limit`, `allowed_mime_types`), so a lying client cannot
 * store anything the schema forbids.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const uploadRequestSchema = z.strictObject({
  /** The original file name — display only, never used to build a path. */
  name: z.string().trim().min(1).max(200),
  type: z.enum(ALLOWED_IMAGE_TYPES, {
    message: "Photos must be JPG, PNG or WebP.",
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, "That photo is larger than 5MB."),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
