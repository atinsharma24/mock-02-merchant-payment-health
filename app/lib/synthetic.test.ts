import { describe, it, expect } from 'vitest';
import {
  processLifecycle,
  calculateKPIs,
  calculateMerchantBreakdown,
  formatUSD,
  parseIsoUtc,
  compareOrdinal,
} from './lifecycle';
import { validateHeaders, parseCSVRecords } from './csv';
import { EXPECTED_ATTEMPTS_HEADER, EXPECTED_EVENTS_HEADER } from './loadData';
import { RawPaymentAttempt, RawPaymentEvent } from './types';

describe('Hand-computable Boundary Edge Cases & Readiness Regressions', () => {
  it('1. Header validation: validates exact contract and detects malformed/renamed headers', () => {
    // Valid headers
    expect(validateHeaders(['payment_id', 'merchant_id', 'created_at_utc', 'amount_cents', 'channel'], EXPECTED_ATTEMPTS_HEADER).valid).toBe(true);
    expect(validateHeaders(['event_id', 'payment_id', 'event_type', 'event_at_utc', 'amount_cents'], EXPECTED_EVENTS_HEADER).valid).toBe(true);

    // Missing column
    const missing = validateHeaders(['payment_id', 'merchant_id', 'created_at_utc', 'amount_cents'], EXPECTED_ATTEMPTS_HEADER);
    expect(missing.valid).toBe(false);
    expect(missing.error).toContain('column count mismatch');

    // Renamed column
    const renamed = validateHeaders(['payment_id', 'merchant_code', 'created_at_utc', 'amount_cents', 'channel'], EXPECTED_ATTEMPTS_HEADER);
    expect(renamed.valid).toBe(false);
    expect(renamed.error?.toLowerCase()).toContain('column 2 mismatch');
  });

  it('1b. Final-occurrence-before-validation: malformed final row supersedes earlier valid row and is excluded without fallback', () => {
    const rawAttempts: RawPaymentAttempt[] = [
      {
        // Earlier valid attempt
        payment_id: 'PMT-TEST-SUPER',
        merchant_id: 'M-101',
        created_at_utc: '2026-10-01T10:00:00Z',
        amount_cents: '5000',
        channel: 'qr',
        _line: 2,
        _columnCount: 5,
      },
      {
        // Later malformed revision with identifiable primary ID (only 2 columns)
        payment_id: 'PMT-TEST-SUPER',
        merchant_id: 'M-101',
        created_at_utc: '',
        amount_cents: '',
        channel: '',
        _line: 15,
        _columnCount: 2, // Invalid column count
      },
    ];

    const result = processLifecycle(rawAttempts, []);
    // Earlier valid row must be superseded
    expect(result.dataQuality.supersededAttempts.length).toBe(1);
    expect(result.dataQuality.supersededAttempts[0].id).toBe('PMT-TEST-SUPER');

    // Final candidate must be excluded
    expect(result.dataQuality.excludedFinalAttempts.length).toBe(1);
    expect(result.dataQuality.excludedFinalAttempts[0].id).toBe('PMT-TEST-SUPER');
    expect(result.dataQuality.excludedFinalAttempts[0].reason).toContain('Invalid column count');

    // Must NOT fall back to earlier valid row!
    expect(result.payments.length).toBe(0);
    expect(result.paymentsMap.has('PMT-TEST-SUPER')).toBe(false);
  });

  it('2. Deterministic ordinal comparator and mixed-case equal-timestamp refund test', () => {
    // Ordinal comparator test: Unicode code-point collation ('A' [65] < 'B' [66] < 'a' [97] < 'b' [98])
    expect(compareOrdinal('E-CAP-A', 'E-CAP-B')).toBe(-1);
    expect(compareOrdinal('E-ref-B', 'E-ref-a')).toBe(-1); // 'B' (66) < 'a' (97)
    expect(compareOrdinal('E-ref-a', 'E-ref-B')).toBe(1);

    // Business scenario where ordering determines which refund is accepted:
    // Captured for $100 (10000 cents).
    // Two refunds arrive at the exact same timestamp:
    // E-ref-B ($50) and E-ref-a ($80).
    // Under ASCII ordinal sort: E-ref-B comes first and consumes $50.
    // Then E-ref-a arrives: $80 > remaining $50 -> E-ref-a is REJECTED!
    const rawAttempts: RawPaymentAttempt[] = [
      {
        payment_id: 'PMT-REF-TIE',
        merchant_id: 'M-101',
        created_at_utc: '2026-10-01T10:00:00Z',
        amount_cents: '10000', // $100.00
        channel: 'qr',
      },
    ];

    const rawEvents: RawPaymentEvent[] = [
      {
        event_id: 'E-CAP-1',
        payment_id: 'PMT-REF-TIE',
        event_type: 'CAPTURE',
        event_at_utc: '2026-10-01T10:05:00Z',
        amount_cents: '10000',
      },
      // E-ref-a listed first in file, but E-ref-B has lower ASCII code ('B' < 'a')
      {
        event_id: 'E-ref-a',
        payment_id: 'PMT-REF-TIE',
        event_type: 'REFUND',
        event_at_utc: '2026-10-01T10:10:00Z',
        amount_cents: '8000', // $80.00
      },
      {
        event_id: 'E-ref-B',
        payment_id: 'PMT-REF-TIE',
        event_type: 'REFUND',
        event_at_utc: '2026-10-01T10:10:00Z',
        amount_cents: '5000', // $50.00
      },
    ];

    const result = processLifecycle(rawAttempts, rawEvents);
    const pmt = result.payments[0];

    // E-ref-B must be accepted
    expect(pmt.accepted_refunds.length).toBe(1);
    expect(pmt.accepted_refunds[0].event_id).toBe('E-ref-B');
    expect(pmt.accepted_refund_cents).toBe(5000);
    expect(pmt.net_captured_cents).toBe(5000); // 10000 - 5000

    // E-ref-a must be rejected for exceeding remaining balance
    expect(result.dataQuality.rejectedBusinessEvents.length).toBe(1);
    expect(result.dataQuality.rejectedBusinessEvents[0].event_id).toBe('E-ref-a');
    expect(result.dataQuality.rejectedBusinessEvents[0].reason).toContain('exceeds remaining captured balance');
  });

  it('3. Exact aggregate money calculations: 9007199254740991 + 2 cents totals 9007199254740993 and displays $90,071,992,547,409.93', () => {
    // Demonstration that IEEE 754 float math fails:
    expect(9007199254740991 + 2).toBe(9007199254740992); // Float loses precision!

    const rawAttempts: RawPaymentAttempt[] = [
      {
        payment_id: 'PMT-MAX-SAFE',
        merchant_id: 'M-101',
        created_at_utc: '2026-10-01T10:00:00Z',
        amount_cents: '9007199254740991', // Max safe integer
        channel: 'terminal',
      },
      {
        payment_id: 'PMT-TWO',
        merchant_id: 'M-101',
        created_at_utc: '2026-10-01T10:00:00Z',
        amount_cents: '2',
        channel: 'terminal',
      },
    ];

    const rawEvents: RawPaymentEvent[] = [
      {
        event_id: 'EVT-MAX-SAFE',
        payment_id: 'PMT-MAX-SAFE',
        event_type: 'CAPTURE',
        event_at_utc: '2026-10-01T10:05:00Z',
        amount_cents: '9007199254740991',
      },
      {
        event_id: 'EVT-TWO',
        payment_id: 'PMT-TWO',
        event_type: 'CAPTURE',
        event_at_utc: '2026-10-01T10:05:00Z',
        amount_cents: '2',
      },
    ];

    const result = processLifecycle(rawAttempts, rawEvents);
    const kpis = calculateKPIs(result.payments);

    // Exact BigInt accumulation
    expect(kpis.grossCapturedCents).toBe('9007199254740993');
    expect(kpis.netCapturedCents).toBe('9007199254740993');

    // Exact USD formatting
    expect(formatUSD(kpis.grossCapturedCents)).toBe('$90,071,992,547,409.93');
    expect(formatUSD(kpis.netCapturedCents)).toBe('$90,071,992,547,409.93');

    // Merchant breakdown exact accumulation
    const breakdown = calculateMerchantBreakdown(result.payments);
    const m101 = breakdown.find((b) => b.merchant_id === 'M-101')!;
    expect(m101.grossCents).toBe('9007199254740993');
    expect(m101.netCents).toBe('9007199254740993');
  });

  it('4. Calendar-year parsing: year 0099 attempt followed by year 0100 capture, plus leap-year validations', () => {
    // Year 0099 vs Year 0100 chronological ordering
    const ts0099 = parseIsoUtc('0099-12-31T23:59:59Z');
    const ts0100 = parseIsoUtc('0100-01-01T00:00:00Z');
    expect(ts0099.valid).toBe(true);
    expect(ts0100.valid).toBe(true);
    expect(ts0099.ms < ts0100.ms).toBe(true);

    // Lifecycle processing with year 0099 and year 0100
    const rawAttempts: RawPaymentAttempt[] = [
      {
        payment_id: 'PMT-YEAR-99',
        merchant_id: 'M-202',
        created_at_utc: '0099-12-31T23:59:59Z',
        amount_cents: '1000',
        channel: 'qr',
      },
    ];
    const rawEvents: RawPaymentEvent[] = [
      {
        event_id: 'EVT-YEAR-100',
        payment_id: 'PMT-YEAR-99',
        event_type: 'CAPTURE',
        event_at_utc: '0100-01-01T00:00:00Z',
        amount_cents: '1000',
      },
    ];

    const result = processLifecycle(rawAttempts, rawEvents);
    expect(result.payments.length).toBe(1);
    expect(result.payments[0].status).toBe('captured'); // Valid capture because 0100 is after 0099!
    expect(result.dataQuality.excludedFinalEvents.length).toBe(0);

    // Leap year rules:
    // Year 0000: Leap year (0 % 400 === 0)
    expect(parseIsoUtc('0000-02-29T12:00:00Z').valid).toBe(true);
    expect(parseIsoUtc('0000-02-30T12:00:00Z').valid).toBe(false);

    // Year 0096: Leap year (96 % 4 === 0)
    expect(parseIsoUtc('0096-02-29T12:00:00Z').valid).toBe(true);

    // Year 0100: Non-leap century year (100 % 100 === 0 && 100 % 400 !== 0)
    expect(parseIsoUtc('0100-02-29T12:00:00Z').valid).toBe(false);
    expect(parseIsoUtc('0100-02-28T12:00:00Z').valid).toBe(true);

    // Year 2024: Leap year
    expect(parseIsoUtc('2024-02-29T12:00:00Z').valid).toBe(true);

    // Year 2026: Non-leap year
    expect(parseIsoUtc('2026-02-29T12:00:00Z').valid).toBe(false);
    expect(parseIsoUtc('2026-02-30T12:00:00Z').valid).toBe(false);
  });
});
