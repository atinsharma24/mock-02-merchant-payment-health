import {
  RawPaymentAttempt,
  RawPaymentEvent,
  ValidPaymentAttempt,
  ValidPaymentEvent,
  DerivedPayment,
  DataQualitySummary,
  FinancialKPIs,
  MerchantBreakdownRow,
  ChannelBreakdownRow,
  MerchantId,
  Channel,
  EventType,
  FilterState,
  SupersededRecord,
  ExcludedFinalRecord,
  RejectedBusinessEvent,
} from './types';

const VALID_MERCHANTS: Set<string> = new Set(['M-101', 'M-202', 'M-303', 'M-404']);
const VALID_CHANNELS: Set<string> = new Set(['qr', 'link', 'terminal']);
const VALID_EVENT_TYPES: Set<string> = new Set(['CAPTURE', 'FAIL', 'REFUND']);

// Exact ISO UTC regex: YYYY-MM-DDTHH:MM:SSZ
const ISO_UTC_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/**
 * Shared case-sensitive ordinal comparator for tie-breaking events by ascending event_id.
 *
 * Interpretation of "ascending event_id":
 * In accordance with deterministic financial integrity rules, "ascending event_id" is defined as
 * strict lexicographical UTF-16 code-unit order (the same as ASCII order for fixture IDs) (e.g. 'A' [U+0041] < 'a' [U+0061]),
 * completely decoupled from host OS locale, collator tables, or case-folding rules.
 */
export function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Chronologically orders lifecycle events:
 * 1. Timestamp ascending (earliest first)
 * 2. Ascending event_id (case-sensitive UTF-16 code-unit ordinal comparator) for equal-timestamp ties
 */
export function compareEventsChronologically<T extends { event_at_ms: number; event_id: string }>(
  a: T,
  b: T
): number {
  if (a.event_at_ms !== b.event_at_ms) {
    return a.event_at_ms - b.event_at_ms;
  }
  return compareOrdinal(a.event_id, b.event_id);
}

/**
 * Validates real calendar date in exact format YYYY-MM-DDTHH:MM:SSZ.
 * Corrects Date.UTC's legacy behavior where years 0000-0099 were remapped to 1900-1999.
 * Validates proleptic Gregorian calendar leap years (e.g. 0000 is leap, 0096 is leap, 0100 is non-leap).
 */
export function parseIsoUtc(ts: string): { valid: boolean; ms: number } {
  const match = ISO_UTC_REGEX.exec(ts);
  if (!match) {
    return { valid: false, ms: 0 };
  }
  const [, yStr, mStr, dStr, hStr, minStr, sStr] = match;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  const h = parseInt(hStr, 10);
  const min = parseInt(minStr, 10);
  const s = parseInt(sStr, 10);

  if (m < 1 || m > 12) return { valid: false, ms: 0 };
  if (h > 23 || min > 59 || s > 59) return { valid: false, ms: 0 };

  const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d < 1 || d > daysInMonth[m - 1]) {
    return { valid: false, ms: 0 };
  }

  // Use explicit setUTCFullYear to prevent Date.UTC from treating years 0000-0099 as 1900-1999
  const dt = new Date(Date.UTC(y, m - 1, d, h, min, s));
  dt.setUTCFullYear(y);
  return { valid: true, ms: dt.getTime() };
}

/**
 * Validates positive base-10 safe integer cents.
 * Accepts leading zeroes (the digit regex permits them). Rejects decimal points,
 * exponents (1e5), negative/zero values, and numbers > MAX_SAFE_INTEGER.
 * A zero result with valid=false is an error sentinel; callers must check valid.
 */
export function parsePositiveInt(val: string): { valid: boolean; amount: number } {
  const trimmed = val.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return { valid: false, amount: 0 };
  }
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num <= 0) {
    return { valid: false, amount: 0 };
  }
  return { valid: true, amount: num };
}

export interface LifecycleProcessingResult {
  dataQuality: DataQualitySummary;
  payments: DerivedPayment[];
  paymentsMap: Map<string, DerivedPayment>;
}

/**
 * Pure pipeline: last physical revisions -> valid attempts/events -> per-payment
 * capture/status/refunds -> derived rows and audit collections. See doc/02-data-and-lifecycle.md.
 * Never validate before revision selection: a bad final revision must erase an earlier good one.
 * Input rows remain unchanged; temporary capture/refund arrays are sorted independently.
 */
export function processLifecycle(
  rawAttempts: RawPaymentAttempt[],
  rawEvents: RawPaymentEvent[]
): LifecycleProcessingResult {
  // --- 1. Deduplication for Attempts ---
  // Separately for each CSV, retain the last physical occurrence of every nonempty primary ID.
  // Earlier rows are superseded. Blank IDs cannot form groups.
  // If the selected final row is invalid, exclude it; DO NOT fall back to earlier valid rows.
  const supersededAttempts: SupersededRecord[] = [];
  const blankAttempts: ExcludedFinalRecord[] = [];
  const lastAttemptMap = new Map<string, { raw: RawPaymentAttempt; index: number }>();

  rawAttempts.forEach((raw, idx) => {
    const trimmedId = (raw.payment_id || '').trim();
    const sourceLoc = raw._line ? `Line ${raw._line}` : `Row ${idx + 1}`;

    if (!trimmedId) {
      blankAttempts.push({
        id: `blank-attempt-${idx + 1}`,
        type: 'attempt',
        raw: { ...raw },
        reason: 'Empty or whitespace-only payment_id',
        sourceLocation: sourceLoc,
      });
      return;
    }

    if (lastAttemptMap.has(trimmedId)) {
      const prev = lastAttemptMap.get(trimmedId)!;
      supersededAttempts.push({
        id: trimmedId,
        type: 'attempt',
        raw: { ...prev.raw },
        reason: 'Superseded by later physical row in export',
        sourceLocation: prev.raw._line ? `Line ${prev.raw._line}` : `Row ${prev.index + 1}`,
      });
    }

    // Always retain the last physical occurrence
    lastAttemptMap.set(trimmedId, { raw, index: idx });
  });

  // --- Validate Selected Final Attempts ---
  const validAttemptsMap = new Map<string, ValidPaymentAttempt>();
  const excludedFinalAttempts: ExcludedFinalRecord[] = [];

  lastAttemptMap.forEach(({ raw }) => {
    const pid = raw.payment_id.trim();
    const merchantId = (raw.merchant_id || '').trim() as MerchantId;
    const createdAtUtc = (raw.created_at_utc || '').trim();
    const amountCentsStr = (raw.amount_cents || '').trim();
    const channel = (raw.channel || '').trim() as Channel;
    const sourceLoc = raw._line ? `Line ${raw._line}` : undefined;

    // Check for malformed CSV quoting
    if (raw._malformedQuotes) {
      excludedFinalAttempts.push({
        id: pid,
        type: 'attempt',
        raw: { ...raw },
        reason: raw._malformedReason || 'Malformed CSV quoting syntax',
        sourceLocation: sourceLoc,
      });
      return;
    }

    // Check for column count contract (expected exactly 5 columns)
    if (raw._columnCount !== undefined && raw._columnCount !== 5) {
      excludedFinalAttempts.push({
        id: pid,
        type: 'attempt',
        raw: { ...raw },
        reason: `Invalid column count: expected 5 columns, received ${raw._columnCount}`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    if (!VALID_MERCHANTS.has(merchantId)) {
      excludedFinalAttempts.push({
        id: pid,
        type: 'attempt',
        raw: { ...raw },
        reason: `Invalid merchant_id: "${raw.merchant_id}" (must be M-101, M-202, M-303, M-404)`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    if (!VALID_CHANNELS.has(channel)) {
      excludedFinalAttempts.push({
        id: pid,
        type: 'attempt',
        raw: { ...raw },
        reason: `Invalid channel: "${raw.channel}" (must be qr, link, or terminal)`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    const dateResult = parseIsoUtc(createdAtUtc);
    if (!dateResult.valid) {
      excludedFinalAttempts.push({
        id: pid,
        type: 'attempt',
        raw: { ...raw },
        reason: `Invalid or impossible timestamp created_at_utc: "${raw.created_at_utc}"`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    const amtResult = parsePositiveInt(amountCentsStr);
    if (!amtResult.valid) {
      excludedFinalAttempts.push({
        id: pid,
        type: 'attempt',
        raw: { ...raw },
        reason: `Invalid amount_cents: "${raw.amount_cents}" (must be positive safe base-10 integer)`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    validAttemptsMap.set(pid, {
      payment_id: pid,
      merchant_id: merchantId,
      created_at_utc: createdAtUtc,
      created_at_ms: dateResult.ms,
      amount_cents: amtResult.amount,
      channel,
    });
  });

  // --- 2. Deduplication for Events ---
  // Retain the last physical occurrence of every nonempty event_id. Earlier rows are superseded.
  const supersededEvents: SupersededRecord[] = [];
  const blankEvents: ExcludedFinalRecord[] = [];
  const lastEventMap = new Map<string, { raw: RawPaymentEvent; index: number }>();

  rawEvents.forEach((raw, idx) => {
    const trimmedId = (raw.event_id || '').trim();
    const sourceLoc = raw._line ? `Line ${raw._line}` : `Row ${idx + 1}`;

    if (!trimmedId) {
      blankEvents.push({
        id: `blank-event-${idx + 1}`,
        type: 'event',
        raw: { ...raw },
        reason: 'Empty or whitespace-only event_id',
        sourceLocation: sourceLoc,
      });
      return;
    }

    if (lastEventMap.has(trimmedId)) {
      const prev = lastEventMap.get(trimmedId)!;
      supersededEvents.push({
        id: trimmedId,
        type: 'event',
        raw: { ...prev.raw },
        reason: 'Superseded by later physical row in export',
        sourceLocation: prev.raw._line ? `Line ${prev.raw._line}` : `Row ${prev.index + 1}`,
      });
    }

    lastEventMap.set(trimmedId, { raw, index: idx });
  });

  // --- Validate Selected Final Events ---
  const validCandidateEvents: ValidPaymentEvent[] = [];
  const excludedFinalEvents: ExcludedFinalRecord[] = [];

  lastEventMap.forEach(({ raw }) => {
    const eid = raw.event_id.trim();
    const pid = (raw.payment_id || '').trim();
    const eventType = (raw.event_type || '').trim() as EventType;
    const eventAtUtc = (raw.event_at_utc || '').trim();
    const amountCentsRaw = (raw.amount_cents || '').trim();
    const sourceLoc = raw._line ? `Line ${raw._line}` : undefined;

    // Check for malformed CSV quoting
    if (raw._malformedQuotes) {
      excludedFinalEvents.push({
        id: eid,
        type: 'event',
        raw: { ...raw },
        reason: raw._malformedReason || 'Malformed CSV quoting syntax',
        sourceLocation: sourceLoc,
      });
      return;
    }

    // Check for column count contract
    if (raw._columnCount !== undefined && raw._columnCount !== 5) {
      excludedFinalEvents.push({
        id: eid,
        type: 'event',
        raw: { ...raw },
        reason: `Invalid column count: expected 5 columns, received ${raw._columnCount}`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    // Check referenced payment existence
    if (!pid || !validAttemptsMap.has(pid)) {
      excludedFinalEvents.push({
        id: eid,
        type: 'event',
        raw: { ...raw },
        reason: `References nonexistent or excluded payment_id: "${raw.payment_id}"`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    if (!VALID_EVENT_TYPES.has(eventType)) {
      excludedFinalEvents.push({
        id: eid,
        type: 'event',
        raw: { ...raw },
        reason: `Invalid event_type: "${raw.event_type}" (must be CAPTURE, FAIL, or REFUND)`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    const dateResult = parseIsoUtc(eventAtUtc);
    if (!dateResult.valid) {
      excludedFinalEvents.push({
        id: eid,
        type: 'event',
        raw: { ...raw },
        reason: `Invalid or impossible event_at_utc timestamp: "${raw.event_at_utc}"`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    const attempt = validAttemptsMap.get(pid)!;
    if (dateResult.ms < attempt.created_at_ms) {
      excludedFinalEvents.push({
        id: eid,
        type: 'event',
        raw: { ...raw },
        reason: `Event timestamp (${eventAtUtc}) is before attempt creation timestamp (${attempt.created_at_utc})`,
        sourceLocation: sourceLoc,
      });
      return;
    }

    let parsedAmount: number | undefined;
    if (eventType === 'FAIL') {
      if (amountCentsRaw !== '') {
        excludedFinalEvents.push({
          id: eid,
          type: 'event',
          raw: { ...raw },
          reason: `FAIL event must have empty amount_cents, received: "${raw.amount_cents}"`,
          sourceLocation: sourceLoc,
        });
        return;
      }
    } else {
      // CAPTURE or REFUND
      const amtResult = parsePositiveInt(amountCentsRaw);
      if (!amtResult.valid) {
        excludedFinalEvents.push({
          id: eid,
          type: 'event',
          raw: { ...raw },
          reason: `${eventType} has invalid amount_cents: "${raw.amount_cents}" (must be positive safe base-10 integer)`,
          sourceLocation: sourceLoc,
        });
        return;
      }
      parsedAmount = amtResult.amount;
    }

    validCandidateEvents.push({
      event_id: eid,
      payment_id: pid,
      event_type: eventType,
      event_at_utc: eventAtUtc,
      event_at_ms: dateResult.ms,
      amount_cents: parsedAmount,
    });
  });

  // --- 3. Group Candidate Events by Payment ID ---
  // Empty buckets preserve valid attempts with no events: they still count and become pending.
  const eventsByPayment = new Map<string, ValidPaymentEvent[]>();
  validAttemptsMap.forEach((_, pid) => {
    eventsByPayment.set(pid, []);
  });
  validCandidateEvents.forEach((ev) => {
    eventsByPayment.get(ev.payment_id)?.push(ev);
  });

  // --- 4. Derive Status, Captures, Refunds and Business Rejections ---
  const rejectedBusinessEvents: RejectedBusinessEvent[] = [];
  const derivedPayments: DerivedPayment[] = [];
  const paymentsMap = new Map<string, DerivedPayment>();

  validAttemptsMap.forEach((attempt, pid) => {
    const events = eventsByPayment.get(pid) || [];

    // Eligible captures: amount must equal payment attempt amount
    const eligibleCaptures: ValidPaymentEvent[] = [];
    events.forEach((ev) => {
      if (ev.event_type === 'CAPTURE') {
        if (ev.amount_cents === attempt.amount_cents) {
          eligibleCaptures.push(ev);
        } else {
          rejectedBusinessEvents.push({
            event_id: ev.event_id,
            payment_id: pid,
            event_type: 'CAPTURE',
            amount_cents: ev.amount_cents,
            reason: `Ineligible capture amount ($${((ev.amount_cents || 0) / 100).toFixed(2)}) does not match attempt amount ($${(attempt.amount_cents / 100).toFixed(2)})`,
          });
        }
      }
    });

    let selectedCapture: ValidPaymentEvent | undefined;
    if (eligibleCaptures.length > 0) {
      // Sort chronologically earliest, breaking ties by ascending event_id (case-sensitive ordinal)
      eligibleCaptures.sort(compareEventsChronologically);
      selectedCapture = eligibleCaptures[0];

      // Any duplicate eligible captures are rejected without financial effect
      for (let i = 1; i < eligibleCaptures.length; i++) {
        rejectedBusinessEvents.push({
          event_id: eligibleCaptures[i].event_id,
          payment_id: pid,
          event_type: 'CAPTURE',
          amount_cents: eligibleCaptures[i].amount_cents,
          reason: 'Duplicate eligible capture: payment already captured by earlier capture event',
        });
      }
    }

    // Determine status:
    // A payment is captured if an eligible capture exists; otherwise failed if it has at least one valid FAIL; otherwise pending.
    // Status is derived from existence, not replayed as last-event-wins. Refunds never rewrite it.
    const hasFail = events.some((ev) => ev.event_type === 'FAIL');
    let status: 'captured' | 'failed' | 'pending';
    if (selectedCapture) {
      status = 'captured';
    } else if (hasFail) {
      status = 'failed';
    } else {
      status = 'pending';
    }

    // Refunds:
    // Refunds count only for captured payments, dated at or after the selected capture.
    // Consider them by ascending timestamp, breaking ties by ascending event_id (case-sensitive ordinal).
    // Accept an entire positive refund only when it fits within the remaining captured amount.
    // An over-limit refund is rejected without blocking later valid refunds.
    const refundEvents = events.filter((ev) => ev.event_type === 'REFUND');
    const acceptedRefunds: ValidPaymentEvent[] = [];
    let acceptedRefundCents = 0;

    if (status !== 'captured') {
      refundEvents.forEach((rf) => {
        rejectedBusinessEvents.push({
          event_id: rf.event_id,
          payment_id: pid,
          event_type: 'REFUND',
          amount_cents: rf.amount_cents,
          reason: `Refund rejected on uncaptured payment (payment status is ${status})`,
        });
      });
    } else {
      // Sort refunds chronologically, breaking ties by ascending event_id
      refundEvents.sort(compareEventsChronologically);

      let remainingCapturedCents = selectedCapture!.amount_cents!;
      refundEvents.forEach((rf) => {
        if (rf.event_at_ms < selectedCapture!.event_at_ms) {
          rejectedBusinessEvents.push({
            event_id: rf.event_id,
            payment_id: pid,
            event_type: 'REFUND',
            amount_cents: rf.amount_cents,
            reason: `Refund dated before selected capture (${rf.event_at_utc} < ${selectedCapture!.event_at_utc})`,
          });
          return;
        }

        // Validation guarantees a positive safe amount here. Each accepted sum is bounded
        // by this one safe capture, so Number arithmetic remains exact within a payment.
        const refundAmt = rf.amount_cents || 0;
        if (refundAmt <= remainingCapturedCents) {
          acceptedRefunds.push(rf);
          acceptedRefundCents += refundAmt;
          remainingCapturedCents -= refundAmt;
        } else {
          rejectedBusinessEvents.push({
            event_id: rf.event_id,
            payment_id: pid,
            event_type: 'REFUND',
            amount_cents: rf.amount_cents,
            // Rejection does not spend the balance; the next callback may accept a smaller refund.
            reason: `Refund amount ($${(refundAmt / 100).toFixed(2)}) exceeds remaining captured balance ($${(remainingCapturedCents / 100).toFixed(2)})`,
          });
        }
      });
    }

    const netCapturedCents = (selectedCapture ? selectedCapture.amount_cents! : 0) - acceptedRefundCents;

    const derived: DerivedPayment = {
      payment_id: pid,
      merchant_id: attempt.merchant_id,
      channel: attempt.channel,
      created_at_utc: attempt.created_at_utc,
      created_at_ms: attempt.created_at_ms,
      amount_cents: attempt.amount_cents,
      status,
      selected_capture: selectedCapture,
      accepted_refunds: acceptedRefunds,
      accepted_refund_cents: acceptedRefundCents,
      net_captured_cents: netCapturedCents,
    };

    derivedPayments.push(derived);
    paymentsMap.set(pid, derived);
  });

  const dataQuality: DataQualitySummary = {
    totalAttemptRows: rawAttempts.length,
    totalEventRows: rawEvents.length,
    supersededAttempts,
    supersededEvents,
    blankAttempts,
    blankEvents,
    excludedFinalAttempts,
    excludedFinalEvents,
    rejectedBusinessEvents,
    validAttemptsCount: validAttemptsMap.size,
    validCandidateEventsCount: validCandidateEvents.length,
  };

  return {
    dataQuality,
    payments: derivedPayments,
    paymentsMap,
  };
}

/**
 * Filter payments based on merchant, derived status, and case-insensitive search by payment ID.
 */
export function filterPayments(payments: DerivedPayment[], filters: FilterState): DerivedPayment[] {
  // All constraints combine with AND. Search is case-insensitive, unlike canonical ID grouping.
  return payments.filter((p) => {
    if (filters.merchant !== 'all' && p.merchant_id !== filters.merchant) {
      return false;
    }
    if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    if (filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.trim().toLowerCase();
      if (!p.payment_id.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Calculate the 6 mandatory financial KPIs for a filtered set of payments using exact BigInt accumulation:
 * (1) valid payment attempts
 * (2) captured attempts
 * (3) capture rate = captured / attempts (0% for zero attempts)
 * (4) gross captured USD
 * (5) accepted refunds USD
 * (6) net captured USD = gross - accepted refunds
 */
export function calculateKPIs(filteredPayments: DerivedPayment[]): FinancialKPIs {
  const validAttempts = filteredPayments.length;
  let capturedAttempts = 0;
  // Convert each individually safe value before summing; converting a rounded Number total
  // afterward cannot recover precision. Decimal strings keep the return shape portable.
  let grossCentsBig = 0n;
  let refundsCentsBig = 0n;

  for (const p of filteredPayments) {
    if (p.status === 'captured') {
      capturedAttempts++;
      grossCentsBig += BigInt(p.amount_cents);
      refundsCentsBig += BigInt(p.accepted_refund_cents);
    }
  }

  const netCentsBig = grossCentsBig - refundsCentsBig;
  const captureRatePercent = validAttempts > 0 ? (capturedAttempts / validAttempts) * 100 : 0;

  return {
    validAttempts,
    capturedAttempts,
    captureRatePercent,
    grossCapturedCents: grossCentsBig.toString(),
    acceptedRefundsCents: refundsCentsBig.toString(),
    netCapturedCents: netCentsBig.toString(),
  };
}

/**
 * Calculate merchant breakdown for the filtered set of payments using exact BigInt arithmetic.
 */
export function calculateMerchantBreakdown(filteredPayments: DerivedPayment[]): MerchantBreakdownRow[] {
  const merchants: MerchantId[] = ['M-101', 'M-202', 'M-303', 'M-404'];
  const map = new Map<
    MerchantId,
    { attempts: number; captured: number; grossBig: bigint; refundsBig: bigint }
  >();

  // Fixed categories intentionally remain visible as zero rows when filters remove their payments.
  merchants.forEach((m) => {
    map.set(m, { attempts: 0, captured: 0, grossBig: 0n, refundsBig: 0n });
  });

  filteredPayments.forEach((p) => {
    const entry = map.get(p.merchant_id);
    if (entry) {
      entry.attempts++;
      if (p.status === 'captured') {
        entry.captured++;
        entry.grossBig += BigInt(p.amount_cents);
        entry.refundsBig += BigInt(p.accepted_refund_cents);
      }
    }
  });

  return merchants.map((m) => {
    const e = map.get(m)!;
    const netBig = e.grossBig - e.refundsBig;
    const rate = e.attempts > 0 ? (e.captured / e.attempts) * 100 : 0;
    return {
      merchant_id: m,
      attemptsCount: e.attempts,
      capturedCount: e.captured,
      captureRatePercent: rate,
      grossCents: e.grossBig.toString(),
      refundsCents: e.refundsBig.toString(),
      netCents: netBig.toString(),
    };
  });
}

/**
 * Calculate channel breakdown for the filtered set of payments using exact BigInt arithmetic.
 */
export function calculateChannelBreakdown(filteredPayments: DerivedPayment[]): ChannelBreakdownRow[] {
  const channels: Channel[] = ['qr', 'link', 'terminal'];
  const map = new Map<
    Channel,
    { attempts: number; captured: number; grossBig: bigint; refundsBig: bigint }
  >();

  channels.forEach((c) => {
    map.set(c, { attempts: 0, captured: 0, grossBig: 0n, refundsBig: 0n });
  });

  filteredPayments.forEach((p) => {
    const entry = map.get(p.channel);
    if (entry) {
      entry.attempts++;
      if (p.status === 'captured') {
        entry.captured++;
        entry.grossBig += BigInt(p.amount_cents);
        entry.refundsBig += BigInt(p.accepted_refund_cents);
      }
    }
  });

  return channels.map((c) => {
    const e = map.get(c)!;
    const netBig = e.grossBig - e.refundsBig;
    const rate = e.attempts > 0 ? (e.captured / e.attempts) * 100 : 0;
    return {
      channel: c,
      attemptsCount: e.attempts,
      capturedCount: e.captured,
      captureRatePercent: rate,
      grossCents: e.grossBig.toString(),
      refundsCents: e.refundsBig.toString(),
      netCents: netBig.toString(),
    };
  });
}

/**
 * Exports the supplied derived payment subset as CSV (not original events/audit rows).
 * Current limitation: embedded quotes in IDs are not escaped and decimal formatting
 * uses Number arithmetic. See doc/07-verification-and-limitations.md before generalizing.
 */
export function exportPaymentsToCSV(payments: DerivedPayment[]): string {
  const headers = [
    'payment_id',
    'merchant_id',
    'channel',
    'created_at_utc',
    'derived_status',
    'amount_usd',
    'accepted_refunds_usd',
    'net_captured_usd',
  ];

  const lines = [headers.join(',')];
  payments.forEach((p) => {
    lines.push([
      `"${p.payment_id}"`,
      `"${p.merchant_id}"`,
      `"${p.channel}"`,
      `"${p.created_at_utc}"`,
      `"${p.status}"`,
      (p.amount_cents / 100).toFixed(2),
      (p.accepted_refund_cents / 100).toFixed(2),
      (p.net_captured_cents / 100).toFixed(2),
    ].join(','));
  });

  return lines.join('\n');
}

/**
 * Deterministically formats exact integer cents into USD currency string `$X,XXX.XX`.
 * Uses exact BigInt integer division and modulo to eliminate float representation errors
 * even for astronomical values exceeding Number.MAX_SAFE_INTEGER.
 */
export function formatUSD(centsInput: string | bigint | number): string {
  const cents = typeof centsInput === 'bigint' ? centsInput : BigInt(centsInput);
  const isNegative = cents < 0n;
  const abs = isNegative ? -cents : cents;
  const dollars = abs / 100n;
  const rem = abs % 100n;
  const remStr = rem < 10n ? `0${rem}` : `${rem}`;
  const formattedDollars = dollars.toLocaleString('en-US');
  return `${isNegative ? '-' : ''}$${formattedDollars}.${remStr}`;
}
