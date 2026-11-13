/**
 * Daraja M-Pesa API Client
 * Handles authentication, STK Push initiation, and password generation
 */

import {
  DarajaConfig,
  DarajaAuthResponse,
  STKPushRequest,
  STKPushResponse,
  STKPushErrorResponse,
  DarajaCallbackPayload,
  STKCallback,
  DARAJA_BASE_URLS,
  DARAJA_ENDPOINTS,
  extractMpesaReceipt,
  MpesaReceiptData,
  StkPushQueryRequest,
  StkPushQueryResponse,
} from "./types";

// Re-export types for consumers of this module
export type { StkPushQueryResponse, StkPushQueryRequest } from "./types";

/**
 * In-memory token cache (per server instance)
 * In production with multiple instances, consider Redis or Supabase for shared cache
 */
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/** Test hook: drop the cached OAuth token so tests start from a clean slate. */
export function resetDarajaTokenCache(): void {
  tokenCache = null;
}

/**
 * Generate the STK Push password
 * Password = base64(shortcode + passkey + timestamp)
 * Timestamp format: YYYYMMDDHHmmss
 */
export function generateStkPassword(
  shortCode: string,
  passkey: string,
  timestamp: string
): string {
  const data = shortCode + passkey + timestamp;
  return Buffer.from(data).toString('base64');
}

/**
 * Generate current timestamp in Daraja format: YYYYMMDDHHmmss
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Get valid access token from Daraja OAuth endpoint
 * Caches token for 55 minutes (tokens expire in 1 hour)
 */
export async function getAccessToken(config: DarajaConfig): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const baseUrl = DARAJA_BASE_URLS[config.environment];
  const authUrl = `${baseUrl}${DARAJA_ENDPOINTS.auth}`;

  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString('base64');

  const response = await fetch(authUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    // Daraja recommends timeout of 30s for auth
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Daraja auth failed (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as DarajaAuthResponse;

  // Cache token (expires_in is in seconds, typically 3600)
  const expiresIn = parseInt(data.expires_in, 10) * 1000;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn,
  };

  return data.access_token;
}

/**
 * Initiate STK Push to customer's phone
 * Returns the Daraja response with CheckoutRequestID and MerchantRequestID
 */
export async function initiateStkPush(
  config: DarajaConfig,
  params: {
    phoneNumber: string; // 2547XXXXXXXX format
    amount: number; // in KES (integer)
    accountReference: string; // order number
    transactionDesc: string;
  }
): Promise<STKPushResponse> {
  const accessToken = await getAccessToken(config);
  const baseUrl = DARAJA_BASE_URLS[config.environment];
  const stkPushUrl = `${baseUrl}${DARAJA_ENDPOINTS.stkPush}`;

  const timestamp = generateTimestamp();
  const password = generateStkPassword(
    config.businessShortCode,
    config.passkey,
    timestamp
  );

  const request: STKPushRequest = {
    BusinessShortCode: config.businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: params.amount,
    PartyA: params.phoneNumber,
    PartyB: config.businessShortCode,
    PhoneNumber: params.phoneNumber,
    CallBackURL: config.callbackUrl,
    AccountReference: params.accountReference,
    TransactionDesc: params.transactionDesc,
  };

  const response = await fetch(stkPushUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    // Daraja recommends timeout of 60s for STK Push
    signal: AbortSignal.timeout(60_000),
  });

  const responseText = await response.text();

  let data: STKPushResponse | STKPushErrorResponse;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Daraja STK Push returned invalid JSON: ${responseText}`);
  }

  if (!response.ok) {
    const error = data as STKPushErrorResponse;
    throw new Error(
      `Daraja STK Push failed (${response.status}): ${error.errorMessage || error.errorCode || responseText}`
    );
  }

  const result = data as STKPushResponse;

  if (result.ResponseCode !== '0') {
    throw new Error(
      `Daraja STK Push rejected: ${result.ResponseDescription} (${result.ResponseCode})`
    );
  }

  return result;
}

/**
 * Query STK Push status using CheckoutRequestID
 * This provides independent verification of the transaction status
 * directly from Safaricom, protecting against callback spoofing.
 */
export async function initiateStkPushQuery(
  config: DarajaConfig,
  checkoutRequestId: string
): Promise<StkPushQueryResponse> {
  const accessToken = await getAccessToken(config);
  const baseUrl = DARAJA_BASE_URLS[config.environment];
  const queryUrl = `${baseUrl}${DARAJA_ENDPOINTS.query}`;

  const timestamp = generateTimestamp();
  const password = generateStkPassword(
    config.businessShortCode,
    config.passkey,
    timestamp
  );

  const request: StkPushQueryRequest = {
    BusinessShortCode: config.businessShortCode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    // Daraja recommends timeout of 60s for queries
    signal: AbortSignal.timeout(60_000),
  });

  const responseText = await response.text();

  let data: StkPushQueryResponse;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Daraja STK Push Query returned invalid JSON: ${responseText}`);
  }

  if (!response.ok) {
    throw new Error(
      `Daraja STK Push Query failed (${response.status}): ${responseText}`
    );
  }

  return data;
}

/**
 * Parse and validate Daraja callback payload
 * Returns structured callback data or throws on invalid structure
 */
export function parseCallback(payload: unknown): STKCallback {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid callback: payload is not an object');
  }

  const body = (payload as DarajaCallbackPayload).Body;
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid callback: missing Body');
  }

  const callback = body.stkCallback;
  if (!callback || typeof callback !== 'object') {
    throw new Error('Invalid callback: missing stkCallback');
  }

  const requiredFields = [
    'MerchantRequestID',
    'CheckoutRequestID',
    'ResultCode',
    'ResultDesc',
  ] as const;

  for (const field of requiredFields) {
    if (!(field in callback) || callback[field] === undefined) {
      throw new Error(`Invalid callback: missing ${field}`);
    }
  }

  return {
    MerchantRequestID: String(callback.MerchantRequestID),
    CheckoutRequestID: String(callback.CheckoutRequestID),
    ResultCode: Number(callback.ResultCode),
    ResultDesc: String(callback.ResultDesc),
    CallbackMetadata: callback.CallbackMetadata
      ? {
          Item: callback.CallbackMetadata.Item.map((item) => ({
            Name: String(item.Name),
            Value: item.Value,
          })),
        }
      : undefined,
  };
}

/**
 * Extract M-Pesa receipt data from successful callback
 */
export function getMpesaReceiptFromCallback(callback: STKCallback): MpesaReceiptData | null {
  return extractMpesaReceipt(callback);
}

/**
 * Validate that a callback matches an expected order
 * This is an additional security check beyond the database constraint
 */
export function validateCallbackMatchesOrder(
  callback: STKCallback,
  expectedCheckoutRequestId: string,
  expectedAmount: number
): { valid: boolean; reason?: string } {
  if (callback.CheckoutRequestID !== expectedCheckoutRequestId) {
    return { valid: false, reason: 'CheckoutRequestID mismatch' };
  }

  if (callback.ResultCode === 0) {
    const receipt = extractMpesaReceipt(callback);
    if (!receipt) {
      return { valid: false, reason: 'Missing callback metadata for successful payment' };
    }
    if (receipt.amount !== expectedAmount) {
      return { valid: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${receipt.amount}` };
    }
  }

  return { valid: true };
}