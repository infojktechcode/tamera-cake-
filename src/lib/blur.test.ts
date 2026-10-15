import { describe, expect, it } from "vitest";
import { IMAGE_BLUR_DATA_URL } from "./blur";

describe("IMAGE_BLUR_DATA_URL", () => {
  it("is a PNG data URL that decodes to a real PNG", () => {
    expect(IMAGE_BLUR_DATA_URL.startsWith("data:image/png;base64,")).toBe(true);
    const bytes = Buffer.from(
      IMAGE_BLUR_DATA_URL.slice("data:image/png;base64,".length),
      "base64",
    );
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR chunk follows the signature — next/image inspects width/height from it.
    expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(bytes.readUInt32BE(16)).toBe(1); // width
    expect(bytes.readUInt32BE(20)).toBe(1); // height
  });
});
