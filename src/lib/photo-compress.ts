/**
 * Best-effort client-side resize of a reference photo. Resizes to a max width of
 * 1600px and re-encodes as JPEG at 0.8 quality; on any failure the original
 * file is returned unchanged so uploads never fail because of canvas/AbortError.
 */

export const MAX_WIDTH = 1600;
export const JPEG_QUALIFICATION = 0.8;

export async function compressReferencePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const targetWidth = Math.round(bitmap.width * scale);
    const targetHeight = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
        "image/jpeg",
        JPEG_QUALIFICATION,
      );
    });
  } catch {
    // Any decode/encode error falls back to the original file.
    return file;
  }
}
