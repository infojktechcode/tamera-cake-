/**
 * Customer notification service.
 *
 * Provider-independent interface for sending SMS/WhatsApp messages.
 * All outbound notifications go through the outbox table for reliable
 * delivery and duplicate prevention.
 *
 * Providers are selected via settings.sms_provider. The mock provider
 * records calls without sending real messages — used in tests and
 * development when no provider credentials are configured.
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { NotificationProvider } from "./providers/types";
import { africastalkingProvider } from "./providers/africastalking";
import { mockProvider } from "./providers/mock";

/** Notification channels. */
export type NotificationChannel = "sms" | "whatsapp";

/** Result of sending a notification. */
export interface SendResult {
  ok: boolean;
  outboxId?: string;
  error?: string;
}

/** Resolved provider based on settings. */
function resolveProvider(providerName: string): NotificationProvider {
  switch (providerName) {
    case "africas_talking":
      return africastalkingProvider;
    case "mock":
    default:
      return mockProvider;
  }
}

/**
 * Queue a notification for delivery. Returns the outbox row id.
 * Idempotent: if a pending/sent notification with the same idempotency key
 * already exists, returns the existing row id without creating a duplicate.
 */
export async function queueNotification(params: {
  orderId: string;
  channel: NotificationChannel;
  template: string;
  toPhone: string;
  message: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; outboxId?: string; error?: string }> {
  const service = createServiceClient();

  // Check for existing pending/sent notification with same idempotency key
  const { data: existing } = await service
    .from("notifications_outbox")
    .select("id, status")
    .eq("idempotency_key", params.idempotencyKey)
    .in("status", ["pending", "sent"])
    .maybeSingle();

  if (existing) {
    return { ok: true, outboxId: existing.id as string };
  }

  const { data, error } = await service
    .from("notifications_outbox")
    .insert({
      order_id: params.orderId,
      channel: params.channel,
      template: params.template,
      to_phone: params.toPhone,
      message: params.message,
      status: "pending",
      idempotency_key: params.idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, outboxId: (data as { id: string }).id };
}

/**
 * Send a notification immediately via the configured provider.
 * Also records the attempt in the outbox for audit and retry.
 *
 * Returns the provider result. The caller is responsible for updating
 * the outbox row status based on the outcome.
 */
export async function sendNotification(params: {
  channel: NotificationChannel;
  toPhone: string;
  message: string;
}): Promise<SendResult> {
  // Load settings to determine provider
  const service = createServiceClient();
  const { data: settings, error: settingsError } = await service
    .from("settings")
    .select("sms_enabled, sms_provider")
    .single();

  if (settingsError || !settings) {
    return { ok: false, error: "Notification settings not configured" };
  }

  const smsEnabled = (settings as { sms_enabled?: boolean }).sms_enabled ?? false;
  if (!smsEnabled) {
    return { ok: false, error: "SMS notifications are disabled" };
  }

  const providerName = (settings as { sms_provider?: string }).sms_provider ?? "mock";
  const provider = resolveProvider(providerName);

  try {
    const result = await provider.send({ to: params.toPhone, message: params.message });
    return {
      ok: result.ok,
      error: result.error,
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Convenience: send a templated notification on order status change.
 * Queues to outbox and attempts immediate delivery.
 *
 * Idempotency key is SHA-256 of (orderId + status + channel).
 */
export async function notifyOrderStatusChange(params: {
  orderId: string;
  status: string;
  channel: NotificationChannel;
  toPhone: string;
  template: string;
  message: string;
}): Promise<SendResult> {
  // Build idempotency key from order + status + channel
  const encoder = new TextEncoder();
  const data = encoder.encode(`${params.orderId}|${params.status}|${params.channel}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const idempotencyKey = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Queue in outbox
  const queued = await queueNotification({
    orderId: params.orderId,
    channel: params.channel,
    template: params.template,
    toPhone: params.toPhone,
    message: params.message,
    idempotencyKey,
  });

  if (!queued.ok) {
    return { ok: false, error: queued.error };
  }

  // Attempt immediate delivery
  const sent = await sendNotification({
    channel: params.channel,
    toPhone: params.toPhone,
    message: params.message,
  });

  // Update outbox row status based on delivery result
  const service = createServiceClient();
  if (queued.outboxId) {
    await service
      .from("notifications_outbox")
      .update({
        status: sent.ok ? "sent" : "failed",
        sent_at: sent.ok ? new Date().toISOString() : null,
        error_message: sent.error ?? null,
        attempts: 1,
      })
      .eq("id", queued.outboxId);
  }

  return sent;
}