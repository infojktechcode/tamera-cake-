// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, createClientMock, revalidatePathMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));
vi.mock("@/lib/session", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const { updateSettings } = await import("./actions");

const superadmin = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "owner@tamera.test",
  fullName: "Owner",
  role: "superadmin",
} as const;

const manager = { ...superadmin, role: "manager" } as const;

type RecordedUpdate = { table: string; payload: Record<string, unknown> };

let updates: RecordedUpdate[];

/** The four inputs `SettingsForm` actually renders and submits. */
function settingsForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("whatsapp_number", "+254712345678");
  formData.set("daily_cake_limit", "12");
  formData.set("deposit_percent", "50");
  formData.set("min_lead_days", "2");
  for (const [name, value] of Object.entries(overrides)) formData.set(name, value);
  return formData;
}

function payload() {
  expect(updates).toHaveLength(1);
  return updates[0]!.payload;
}

describe("updateSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates = [];
    requireUserMock.mockResolvedValue(superadmin);
    createClientMock.mockResolvedValue({
      from(table: string) {
        return {
          update(value: Record<string, unknown>) {
            updates.push({ table, payload: value });
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    });
  });

  it("saves exactly the four fields SettingsForm submits", async () => {
    const result = await updateSettings(settingsForm());

    expect(result).toEqual({ success: true });
    expect(updates[0]!.table).toBe("settings");
    expect(payload()).toEqual({
      whatsapp_number: "+254712345678",
      daily_cake_limit: 12,
      deposit_percent: 50,
      min_lead_days: 2,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/settings");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("leaves sms_enabled untouched when the form never submits it", async () => {
    // Regression: the absent checkbox used to reach `z.coerce.boolean()` as
    // `null` and coerce to `false`, silently disabling SMS on every save.
    await updateSettings(settingsForm());

    expect(payload()).not.toHaveProperty("sms_enabled");
    expect(payload()).not.toHaveProperty("sms_provider");
  });

  it("records a checked sms_enabled as true", async () => {
    await updateSettings(settingsForm({ sms_enabled: "on" }));

    expect(payload().sms_enabled).toBe(true);
  });

  it("records an explicit sms_enabled off as false", async () => {
    // Regression: `z.coerce.boolean()` mapped the literal "off" to `true`,
    // so SMS could never be switched off once the field existed.
    await updateSettings(settingsForm({ sms_enabled: "off" }));

    expect(payload().sms_enabled).toBe(false);
  });

  it("lets a checked box override a preceding hidden off input", async () => {
    const formData = settingsForm();
    formData.append("sms_enabled", "off");
    formData.append("sms_enabled", "on");

    await updateSettings(formData);

    expect(payload().sms_enabled).toBe(true);
  });

  it("treats an empty numeric input as not provided rather than zero", async () => {
    await updateSettings(settingsForm({ min_lead_days: "" }));

    expect(payload()).not.toHaveProperty("min_lead_days");
    expect(payload().min_lead_days).toBeUndefined();
    expect(payload()).toMatchObject({ daily_cake_limit: 12, deposit_percent: 50 });
  });

  it("parses JSON string fields before writing them", async () => {
    await updateSettings(settingsForm({ social_links: '{"instagram":"tamera"}' }));

    expect(payload().social_links).toEqual({ instagram: "tamera" });
  });

  it("rejects a manager", async () => {
    requireUserMock.mockResolvedValue(manager);

    await expect(updateSettings(settingsForm())).rejects.toThrow("Unauthorized");
    expect(updates).toHaveLength(0);
  });

  it("rejects an out-of-range daily limit without writing", async () => {
    await expect(updateSettings(settingsForm({ daily_cake_limit: "0" }))).rejects.toThrow(
      "Too small: expected number to be >=1",
    );
    expect(updates).toHaveLength(0);
  });

  it("rejects a malformed whatsapp number without writing", async () => {
    await expect(updateSettings(settingsForm({ whatsapp_number: "123" }))).rejects.toThrow(
      "Too small: expected string to have >=8 characters",
    );
    expect(updates).toHaveLength(0);
  });
});
