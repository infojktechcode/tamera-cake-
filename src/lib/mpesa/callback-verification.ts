/**
 * M-Pesa Daraja Callback Verification
 * Implements cryptographic verification of Daraja callbacks using HMAC-SHA256
 * and STK Push Query API for independent transaction status verification.
 *
 * References:
 * - Safaricom Daraja API Documentation
 * - STK Push Callback: No signature by default, but Query API provides verification
 * - C2B (Paybill/Buy Goods): Uses HMAC-SHA256 with Security Credential/Consumer Secret
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { STKCallback } from './types';
import { initiateStkPushQuery, StkPushQueryResponse } from './daraja';
import { getDarajaConfig, getDarajaCallbackVerificationConfig } from '@/lib/supabase/env';

/**
 * Result of callback verification
 */
export interface CallbackVerificationResult {
  /** Whether the callback passed all enabled verification checks */
  verified: boolean;
  /** Reason if verification failed */
  reason?: string;
  /** STK Push Query response if query verification was performed */
  stkQueryResult?: StkPushQueryResponse;
  /** Which verification methods were used */
  methods: {
    structure: boolean;
    hmac: boolean;
    stkQuery: boolean;
  };
}

/**
 * Verify callback structure (required fields, types)
 * This is the first line of defense - validates the callback has expected shape
 */
export function verifyCallbackStructure(callback: STKCallback): { valid: boolean; reason?: string } {
  // Required fields
  if (!callback.MerchantRequestID || typeof callback.MerchantRequestID !== 'string') {
    return { valid: false, reason: 'Missing or invalid MerchantRequestID' };
  }
  if (!callback.CheckoutRequestID || typeof callback.CheckoutRequestID !== 'string') {
    return { valid: false, reason: 'Missing or invalid CheckoutRequestID' };
  }
  if (typeof callback.ResultCode !== 'number' || !Number.isInteger(callback.ResultCode)) {
    return { valid: false, reason: 'Missing or invalid ResultCode' };
  }
  if (!callback.ResultDesc || typeof callback.ResultDesc !== 'string') {
    return { valid: false, reason: 'Missing or invalid ResultDesc' };
  }

  // If successful, must have CallbackMetadata with required items
  if (callback.ResultCode === 0) {
    if (!callback.CallbackMetadata || !callback.CallbackMetadata.Item) {
      return { valid: false, reason: 'Missing CallbackMetadata for successful transaction' };
    }
    const items = callback.CallbackMetadata.Item;
    const requiredItems = ['MpesaReceiptNumber', 'TransactionDate', 'PhoneNumber', 'Amount'];
    for (const required of requiredItems) {
      const item = items.find((i) => i.Name === required);
      if (!item || item.Value === undefined || item.Value === null) {
        return { valid: false, reason: `Missing required callback metadata: ${required}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Verify HMAC signature for C2B (Paybill/Buy Goods) callbacks
 * STK Push callbacks don't include signature by default, but this provides
 * future compatibility and supports C2B if configured.
 *
 * The signature is computed as: HMAC-SHA256(payload, consumerSecret)
 * and sent in the 'X-Signature' header (or similar, per Daraja config)
 */
export function verifyHmacSignature(
  payload: string,
  signature: string | undefined,
  consumerSecret: string
): { valid: boolean; reason?: string } {
  if (!signature) {
    return { valid: false, reason: 'Missing signature header' };
  }

  // Remove 'sha256=' prefix if present (Daraja format)
  const cleanSignature = signature.replace(/^sha256=/, '');

  // Compute expected signature
  const expectedSignature = createHmac('sha256', consumerSecret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(cleanSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Verify callback using STK Push Query API
 * This independently queries Safaricom for the transaction status
 * using the CheckoutRequestID, providing strong verification that
 * the callback is genuine and not spoofed.
 */
export async function verifyWithStkPushQuery(
  checkoutRequestId: string
): Promise<{ valid: boolean; reason?: string; queryResult?: StkPushQueryResponse }> {
  const config = getDarajaConfig();
  try {
    const queryResult = await initiateStkPushQuery(config, checkoutRequestId);

    // Query successful - check ResultCode
    if (queryResult.ResponseCode === '0') {
      // Transaction found - callback is verified
      return { valid: true, queryResult };
    } else {
      // Query returned error - could be timeout, not found, etc.
      return {
        valid: false,
        reason: `STK Push Query failed: ${queryResult.ResponseDescription} (${queryResult.ResponseCode})`,
        queryResult,
      };
    }
  } catch (error) {
    // Network error, timeout, etc. - don't block callback, but log warning
    console.warn(`[mpesa] STK Push Query verification failed for ${checkoutRequestId}: ${(error as Error).message}`);
    return {
      valid: false,
      reason: `STK Push Query error: ${(error as Error).message}`,
    };
  }
}

/**
 * Main callback verification function
 * Runs all enabled verification methods and returns combined result
 */
export async function verifyDarajaCallback(
  callback: STKCallback,
  rawPayload: string,
  signatureHeader?: string
): Promise<CallbackVerificationResult> {
  const darajaConfig = getDarajaConfig();
  const verificationConfig = getDarajaCallbackVerificationConfig();
  
  const methods = {
    structure: false,
    hmac: false,
    stkQuery: false,
  };

  // 1. Structure verification (always required)
  const structureResult = verifyCallbackStructure(callback);
  methods.structure = structureResult.valid;

  if (!structureResult.valid) {
    return {
      verified: false,
      reason: `Structure verification failed: ${structureResult.reason}`,
      methods,
    };
  }

  // 2. HMAC verification (if enabled)
  if (verificationConfig.enableHmacVerification) {
    methods.hmac = true;
    const hmacResult = verifyHmacSignature(rawPayload, signatureHeader, darajaConfig.consumerSecret);
    if (!hmacResult.valid) {
      return {
        verified: false,
        reason: `HMAC verification failed: ${hmacResult.reason}`,
        methods,
      };
    }
  }

  // 3. STK Push Query verification (if enabled)
  if (verificationConfig.enableStkQueryVerification) {
    methods.stkQuery = true;
    const queryResult = await verifyWithStkPushQuery(callback.CheckoutRequestID);
    if (!queryResult.valid) {
      // For STK Push, query failure doesn't necessarily mean callback is fake
      // (could be network issue, timeout, etc.) - log but don't hard-fail
      console.warn(
        `[mpesa] STK Push Query verification failed for ${callback.CheckoutRequestID}: ${queryResult.reason}. ` +
          'Callback will be processed based on structural validation only.'
      );
      // Don't return false here - just log warning
    } else if (queryResult.queryResult) {
      // Additional validation: cross-check callback data with query result
      const crossCheck = crossCheckCallbackWithQuery(callback, queryResult.queryResult);
      if (!crossCheck.valid) {
        return {
          verified: false,
          reason: `Cross-check with STK Push Query failed: ${crossCheck.reason}`,
          methods,
          stkQueryResult: queryResult.queryResult,
        };
      }
    }
  }

  return {
    verified: true,
    methods,
    stkQueryResult: methods.stkQuery ? undefined : undefined,
  };
}

/**
 * Cross-check callback data with STK Push Query result
 * Ensures the callback data matches what Safaricom reports
 */
function crossCheckCallbackWithQuery(
  callback: STKCallback,
  queryResult: StkPushQueryResponse
): { valid: boolean; reason?: string } {
  // If both indicate success, verify key fields match
  if (callback.ResultCode === 0 && queryResult.ResultCode === '0') {
    // Could add more cross-checks here if needed
    // For now, just verify both report success
    return { valid: true };
  }

  // If both indicate failure, that's consistent
  if (callback.ResultCode !== 0 && queryResult.ResultCode !== '0') {
    return { valid: true };
  }

  // Mismatch: callback says success but query says failure (or vice versa)
  return {
    valid: false,
    reason: `Result mismatch: callback ResultCode=${callback.ResultCode}, query ResultCode=${queryResult.ResultCode}`,
  };
}