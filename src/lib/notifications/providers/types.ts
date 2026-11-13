/**
 * Notification provider interface.
 *
 * All providers implement send({ to, message }) and return { ok, error? }.
 * Providers must never log phone numbers or message content.
 */

export interface SendParams {
  to: string;
  message: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  send(params: SendParams): Promise<SendResult>;
}