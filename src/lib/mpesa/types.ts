/**
 * Daraja API types for M-Pesa STK Push
 * Based on Safaricom Daraja API documentation
 */

export interface DarajaConfig {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  callbackUrl: string;
}

export interface DarajaAuthResponse {
  access_token: string;
  expires_in: string;
}

export interface STKPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: 'CustomerPayBillOnline';
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface STKPushErrorResponse {
  requestId: string;
  errorCode: string;
  errorMessage: string;
}

export interface CallbackMetadataItem {
  Name: string;
  Value: string | number;
}

export interface CallbackMetadata {
  Item: CallbackMetadataItem[];
}

export interface STKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: CallbackMetadata;
}

export interface DarajaCallbackPayload {
  Body: {
    stkCallback: STKCallback;
  };
}

export interface MpesaReceiptData {
  mpesaReceiptNumber: string;
  transactionDate: string;
  phoneNumber: string;
  amount: number;
}

export function extractMpesaReceipt(callback: STKCallback): MpesaReceiptData | null {
  if (!callback.CallbackMetadata) return null;

  const items = callback.CallbackMetadata.Item;
  const getValue = (name: string) => {
    const item = items.find((i) => i.Name === name);
    return item?.Value;
  };

  const receiptNumber = getValue('MpesaReceiptNumber');
  const transactionDate = getValue('TransactionDate');
  const phoneNumber = getValue('PhoneNumber');
  const amount = getValue('Amount');

  if (!receiptNumber || !transactionDate || !phoneNumber || amount === undefined) {
    return null;
  }

  return {
    mpesaReceiptNumber: String(receiptNumber),
    transactionDate: String(transactionDate),
    phoneNumber: String(phoneNumber),
    amount: Number(amount),
  };
}

export const DARAJA_BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
} as const;

export const DARAJA_ENDPOINTS = {
  auth: '/oauth/v1/generate?grant_type=client_credentials',
  stkPush: '/mpesa/stkpush/v1/processrequest',
  query: '/mpesa/stkpushquery/v1/query',
} as const;