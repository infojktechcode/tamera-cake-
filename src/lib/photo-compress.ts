/**
 * Best-effort client-side photo compression.
 *
 * A modern phone camera produces 3–8 MB photos. On a slow 3G connection that
 * is the difference between a customer waiting and giving up, so the image is
 * downscaled and re-encoded before it is uploaded (spec §7.5: "compress uploads
 * on the client before sending where possible").
 *
 * Every failure path returns the original file: a photo that cannot be
 * decoded is still a photo the shop wants to see.
 */

const MAX_DIMENSION = 1600;
const QUALITY = 0.8;

/** `photo.png` -> `photo.jpg` (the re-encoded file is always a JPEG). */
function toJpgName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

export async function compressImage(file: File): Promise<File> {
  // `createImageBitmap` is the fastest decode path and is absent in jsdom and
  // in older Safari, where we simply upload the original.
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = longestSide > MAX_DIMENSION ? MAX_DIMENSION / longestSide : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // PNGs can be transparent; JPEG cannot, so paint a white ground first.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return file;

    return new File([blob], toJpgName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
