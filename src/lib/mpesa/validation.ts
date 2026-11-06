/**
 * Phone number validation and normalization for Daraja M-Pesa
 * Daraja requires format: 2547XXXXXXXX (12 digits, starting with 2547 or 2541)
 */

import { normalizePhone } from "@/lib/phone";

/**
 * Normalize a Kenyan phone number to Daraja format (2547XXXXXXXX)
 * Returns null if invalid
 */
export function normalizePhoneForDaraja(input: string): string | null {
  const normalized = normalizePhone(input);
  if (!normalized) return null;

  // Daraja only accepts 2547XXXXXXXX (Safaricom) or 2541XXXXXXXX (Airtel)
  // But STK Push only works on Safaricom (2547)
  if (!/^254(7|1)\d{8}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Check if a phone number is a valid Safaricom number for STK Push
 * STK Push only works on Safaricom numbers (2547XXXXXXXX)
 */
export function isSafaricomNumber(phone: string): boolean {
  const normalized = normalizePhoneForDaraja(phone);
  return normalized?.startsWith('2547') ?? false;
}

/**
 * Validate phone number for M-Pesa checkout
 * Returns normalized number or throws with user-friendly message
 */
export function validateMpesaPhone(input: string): string {
  const normalized = normalizePhoneForDaraja(input);

  if (!normalized) {
    throw new Error(
      'Enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678).'
    );
  }

  if (!isSafaricomNumber(normalized)) {
    throw new Error(
      'M-Pesa STK Push only works on Safaricom numbers (starting with 07 or 2547).'
    );
  }

  return normalized;
}

/**
 * Format phone for display (07XX XXX XXX)
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneForDaraja(phone);
  if (!normalized) return phone;

  // Convert 2547XXXXXXXX to 07XX XXX XXX
  const local = '0' + normalized.slice(4);
  return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
}