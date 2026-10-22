// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const signedCalls: { path: string; opts: { upsert: boolean } }[] = [];
let failNext = false;

const serviceClient = {
  storage: {
    from: vi.fn(() => ({
      createSignedUploadUrl: (path: string, opts: { upsert: boolean }) => {
        if (failNext) {
          failNext = false;
          return Promise.resolve({ data: null, error: { message: "bucket missing" } });
        }
        signedCalls.push({ path, opts });
        return Promise.resolve({
          data: { signedUrl: `https://storage.test/sign/${path}`, token: "tok_123", path },
          error: null,
        });
      },
    })),
  },
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => serviceClient,
}));

const { POST } = await import("./route");

let requestCounter = 0;

/** A unique client IP per request — the route rate-limits per IP. */
function makeRequest(body: unknown) {
  requestCounter += 1;
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.1.0.${requestCounter}`,
    },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return { name: "my photo.jpg", type: "image/jpeg", size: 1024 };
}

beforeEach(() => {
  vi.clearAllMocks();
  signedCalls.length = 0;
  failNext = false;
});

describe("POST /api/upload", () => {
  it("returns a path and a token for a valid photo", async () => {
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.token).toBe("tok_123");
    expect(json.path).toMatch(/^cakes\/[0-9a-f-]{36}\.jpg$/);
  });

  it("signs the path in the cake-references bucket", async () => {
    await POST(makeRequest(validBody()));
    expect(serviceClient.storage.from).toHaveBeenCalledWith("cake-references");
    expect(signedCalls[0].path).toMatch(/^cakes\//);
    expect(signedCalls[0].opts.upsert).toBe(true);
  });

  it("never puts the client's file name in the storage path", async () => {
    const res = await POST(makeRequest(validBody()));
    const json = await res.json();
    expect(json.path).not.toContain("my photo");
    expect(json.path).not.toContain("..");
  });

  it("derives the extension from the mime type, not the file name", async () => {
    const res = await POST(
      makeRequest({ name: "sneaky.exe", type: "image/png", size: 100 }),
    );
    const json = await res.json();
    expect(json.path).toMatch(/\.png$/);
  });

  it("rejects a non-image type", async () => {
    const res = await POST(
      makeRequest({ name: "doc.pdf", type: "application/pdf", size: 100 }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(signedCalls).toHaveLength(0);
  });

  it("rejects a file larger than 5 MB", async () => {
    const res = await POST(
      makeRequest({ ...validBody(), size: 5 * 1024 * 1024 + 1 }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/larger than 5MB/i);
    expect(signedCalls).toHaveLength(0);
  });

  it("rejects unknown fields", async () => {
    const res = await POST(makeRequest({ ...validBody(), bucket: "product-images" }));
    expect(res.status).toBe(400);
    expect(signedCalls).toHaveLength(0);
  });

  it("rejects a non-JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/upload", { method: "POST", body: "nope" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when storage refuses to sign the upload", async () => {
    failNext = true;
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});
