// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";

import { compressImage } from "./photo-compress";

const originalCreateImageBitmap = globalThis.createImageBitmap;

afterEach(() => {
  if (originalCreateImageBitmap) {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  } else {
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  }
});

function sampleFile(size = 1024, name = "photo.png", type = "image/png"): File {
  return new File(["x".repeat(size)], name, { type });
}

describe("compressImage", () => {
  it("returns the original file when the browser cannot decode images", async () => {
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
    const file = sampleFile();
    await expect(compressImage(file)).resolves.toBe(file);
  });

  it("returns the original file when the image fails to decode", async () => {
    globalThis.createImageBitmap = (() =>
      Promise.reject(new Error("unsupported format"))) as typeof createImageBitmap;
    const file = sampleFile();
    await expect(compressImage(file)).resolves.toBe(file);
  });

  it("returns the original file when no 2d canvas is available", async () => {
    globalThis.createImageBitmap = (() =>
      Promise.resolve({
        width: 4000,
        height: 3000,
        close: () => {},
      })) as unknown as typeof createImageBitmap;
    const file = sampleFile();
    await expect(compressImage(file)).resolves.toBe(file);
  });
});
