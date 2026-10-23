import { z } from "zod";

/** Strict input for a single cake reference photo upload. */
export const PhotoUploadInput = z.object({
  name: z.string().min(1).max(80),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(5 * 1024 * 1024), // ≤ 5 MB
});

export type PhotoUploadInputType = z.infer<typeof PhotoUploadInput>;
