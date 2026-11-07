export type MerchantId = 'M-101' | 'M-202' | 'M-303' | 'M-404';
export type Channel = 'qr' | 'link' | 'terminal';
export type EventType = 'CAPTURE' | 'FAIL' | 'REFUND';
export type DerivedStatus = 'captured' | 'failed' | 'pending';

// Raw export values are untrusted strings; TypeScript types do not replace runtime validation.
export interface RawPaymentAttempt {
  payment_id: string;
  merchant_id: string;
  created_at_utc: string;
  amount_cents: string;
  channel: string;
  _line?: number;
  _columnCount?: number;
  _malformedQuotes?: boolean;
  _malformedReason?: string;
}

export interface RawPaymentEvent {
  event_id: string;
  payment_id: string;
  event_type: string;
  event_at_utc: string;
  amount_cents: string;
  _line?: number;
  _columnCount?: number;
  _malformedQuotes?: boolean;
  _malformedReason?: string;
}

export interface ValidPaymentAttempt {
  payment_id: string;
  merchant_id: MerchantId;
  created_at_utc: string;
  created_at_ms: number;
  amount_cents: number; // positive safe base-10 integer cents
  channel: Channel;
}

export interface ValidPaymentEvent {
  event_id: string;
  payment_id: string;
  event_type: EventType;
  event_at_utc: string;
  event_at_ms: number;
  amount_cents?: number; // undefined for FAIL, positive safe integer for CAPTURE/REFUND
}

// Dashboard model: contains applied financial events, not a complete FAIL/rejection history.
// Per-payment refund totals are bounded by one safe capture; aggregate totals use strings below.
export interface DerivedPayment {
  payment_id: string;
  merchant_id: MerchantId;
  channel: Channel;
  created_at_utc: string;
  created_at_ms: number;
  amount_cents: number;
  status: DerivedStatus;
  selected_capture?: ValidPaymentEvent;
  accepted_refunds: ValidPaymentEvent[];
  accepted_refund_cents: number;
  net_captured_cents: number;
}

export interface SupersededRecord {
  id: string;
  type: 'attempt' | 'event';
  raw: Record<string, string | number | boolean | undefined>;
  reason: string;
  sourceLocation?: string;
}

export interface ExcludedFinalRecord {
  id: string;
  type: 'attempt' | 'event';
  raw: Record<string, string | number | boolean | undefined>;
  reason: string;
  sourceLocation?: string;
}

export interface RejectedBusinessEvent {
  event_id: string;
  payment_id: string;
  event_type: EventType;
  amount_cents?: number;
  reason: string;
}

export interface DataQualitySummary {
  totalAttemptRows: number;
  totalEventRows: number;
  supersededAttempts: SupersededRecord[];
  supersededEvents: SupersededRecord[];
  blankAttempts: ExcludedFinalRecord[];
  blankEvents: ExcludedFinalRecord[];
  excludedFinalAttempts: ExcludedFinalRecord[];
  excludedFinalEvents: ExcludedFinalRecord[];
  rejectedBusinessEvents: RejectedBusinessEvent[];
  validAttemptsCount: number;
  validCandidateEventsCount: number;
}

/**
 * Exact monetary aggregates stored as exact decimal integer strings
 * to ensure 100% precision beyond Number.MAX_SAFE_INTEGER while remaining
 * fully JSON-serializable across Next.js Server-to-Client component boundaries.
 */
export interface FinancialKPIs {
  validAttempts: number;
  capturedAttempts: number;
  captureRatePercent: number; // e.g. 65.85
  grossCapturedCents: string; // Exact integer string (can exceed 2^53-1)
  acceptedRefundsCents: string;
  netCapturedCents: string;
}

export interface MerchantBreakdownRow {
  merchant_id: MerchantId;
  attemptsCount: number;
  capturedCount: number;
  captureRatePercent: number;
  grossCents: string; // Exact integer string
  refundsCents: string;
  netCents: string;
}

export interface ChannelBreakdownRow {
  channel: Channel;
  attemptsCount: number;
  capturedCount: number;
  captureRatePercent: number;
  grossCents: string;
  refundsCents: string;
  netCents: string;
}

export interface FilterState {
  merchant: 'all' | MerchantId;
  status: 'all' | DerivedStatus;
  searchQuery: string;
}

export interface IngestionErrorDetails {
  title: string;
  message: string;
  guidance: string;
}

export interface LoadDataResult {
  success: boolean;
  data?: {
    dataQuality: DataQualitySummary;
    payments: DerivedPayment[];
  };
  error?: IngestionErrorDetails;
}
