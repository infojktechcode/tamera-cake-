import { describe, it, expect } from "vitest";

import { PHOTO_BUCKET, buildPhotoPath, publicPhotoUrl } from "./photo-paths";

describe("buildPhotoPath", () => {
  it("uses the validated mime type for the extension", () => {
    expect(buildPhotoPath("image/jpeg", "abc")).toBe("cakes/abc.jpg");
    expect(buildPhotoPath("image/png", "abc")).toBe("cakes/abc.png");
    expect(buildPhotoPath("image/webp", "abc")).toBe("cakes/abc.webp");
  });

  it("throws for an unsupported type rather than guessing an extension", () => {
    expect(() => buildPhotoPath("application/pdf", "abc")).toThrow(/Unsupported photo type/);
    expect(() => buildPhotoPath("image/gif", "abc")).toThrow(/Unsupported photo type/);
  });
});

describe("publicPhotoUrl", () => {
  const url = "https://project.supabase.co";

  it("points at the public bucket", () => {
    expect(publicPhotoUrl("cakes/abc.jpg", url)).toBe(
      `https://project.supabase.co/storage/v1/object/public/${PHOTO_BUCKET}/cakes/abc.jpg`,
    );
  });

  it("encodes each path segment", () => {
    expect(publicPhotoUrl("cakes/a b.jpg", url)).toContain("a%20b.jpg");
  });

  it("tolerates a trailing slash on the project url", () => {
    expect(publicPhotoUrl("cakes/abc.jpg", "https://project.supabase.co/")).toBe(
      `https://project.supabase.co/storage/v1/object/public/${PHOTO_BUCKET}/cakes/abc.jpg`,
    );
  });

  it("does not let a path escape the bucket", () => {
    const result = publicPhotoUrl("cakes/../../secret", url);
    expect(result).not.toContain("..");
  });
});
