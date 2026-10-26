// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStaffSessionMock } = vi.hoisted(() => ({
  getStaffSessionMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getStaffSession: getStaffSessionMock,
}));

const { GET } = await import("./route");

function request(query = "type=sales&from=2026-10-01&to=2026-10-31") {
  return new Request(`http://localhost/api/admin/reports?${query}`);
}

describe("GET /api/admin/reports", () => {
  beforeEach(() => {
    getStaffSessionMock.mockReset();
  });

  it("requires a signed-in staff member", async () => {
    getStaffSessionMock.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it("denies managers before reading report data", async () => {
    getStaffSessionMock.mockResolvedValue({
      user: { role: "manager" },
      supabase: {},
    });
    const response = await GET(request());
    expect(response.status).toBe(403);
  });

  it("rejects invalid calendar dates and reversed ranges", async () => {
    getStaffSessionMock.mockResolvedValue({
      user: { role: "superadmin" },
      supabase: {},
    });
    expect((await GET(request("type=sales&from=2026-02-30&to=2026-03-01"))).status).toBe(400);
    expect((await GET(request("type=sales&from=2026-10-31&to=2026-10-01"))).status).toBe(400);
  });

  it("limits exports to 367 calendar days", async () => {
    getStaffSessionMock.mockResolvedValue({
      user: { role: "superadmin" },
      supabase: {},
    });
    const response = await GET(request("type=sales&from=2025-10-01&to=2026-10-04"));
    expect(response.status).toBe(400);
  });
});
