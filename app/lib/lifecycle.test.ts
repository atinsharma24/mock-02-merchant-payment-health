import { describe, it, expect } from 'vitest';
import { loadAndProcessData } from './loadData';
import {
  calculateKPIs,
  calculateMerchantBreakdown,
  calculateChannelBreakdown,
  exportPaymentsToCSV,
  filterPayments,
  formatUSD,
} from './lifecycle';

describe('Payment Health Lifecycle Engine - Canonical Dataset Ingestion', () => {
  // Exercise the actual ingestion path from app/data/
  const loadResult = loadAndProcessData();
  expect(loadResult.success).toBe(true);
  expect(loadResult.data).toBeDefined();

  const { dataQuality, payments } = loadResult.data!;

  it('correctly processes canonical dataset and matches exact expected assessment results', () => {
    // Check Data Quality counts
    expect(dataQuality.totalAttemptRows).toBe(227);
    expect(dataQuality.totalEventRows).toBe(265);
    expect(dataQuality.supersededAttempts.length).toBe(9);
    expect(dataQuality.supersededEvents.length).toBe(2);
    expect(dataQuality.blankAttempts.length).toBe(2);
    expect(dataQuality.blankEvents.length).toBe(1);
    expect(dataQuality.excludedFinalAttempts.length).toBe(11);
    expect(dataQuality.excludedFinalEvents.length).toBe(14);
    expect(dataQuality.rejectedBusinessEvents.length).toBe(17);

    // Check Valid Payments count and breakdown
    expect(payments.length).toBe(205);
    const captured = payments.filter((p) => p.status === 'captured').length;
    const failed = payments.filter((p) => p.status === 'failed').length;
    const pending = payments.filter((p) => p.status === 'pending').length;

    expect(captured).toBe(135);
    expect(failed).toBe(42);
    expect(pending).toBe(28);

    // Check Financial KPIs
    const kpis = calculateKPIs(payments);
    expect(kpis.validAttempts).toBe(205);
    expect(kpis.capturedAttempts).toBe(135);
    expect(kpis.captureRatePercent.toFixed(2)).toBe('65.85');
    expect(kpis.grossCapturedCents).toBe('6100539'); // $61,005.39
    expect(kpis.acceptedRefundsCents).toBe('1150483'); // $11,504.83
    expect(kpis.netCapturedCents).toBe('4950056'); // $49,500.56
    expect(formatUSD(kpis.grossCapturedCents)).toBe('$61,005.39');
    expect(formatUSD(kpis.acceptedRefundsCents)).toBe('$11,504.83');
    expect(formatUSD(kpis.netCapturedCents)).toBe('$49,500.56');

    // Check Merchant Breakdown
    const breakdown = calculateMerchantBreakdown(payments);
    const m101 = breakdown.find((b) => b.merchant_id === 'M-101')!;
    const m202 = breakdown.find((b) => b.merchant_id === 'M-202')!;
    const m303 = breakdown.find((b) => b.merchant_id === 'M-303')!;
    const m404 = breakdown.find((b) => b.merchant_id === 'M-404')!;

    expect(m101.attemptsCount).toBe(61);
    expect(m101.capturedCount).toBe(33);
    expect(m101.grossCents).toBe('1685319');
    expect(m101.refundsCents).toBe('410873');
    expect(m101.netCents).toBe('1274446');

    expect(m202.attemptsCount).toBe(44);
    expect(m202.capturedCount).toBe(35);
    expect(m202.grossCents).toBe('1358875');
    expect(m202.refundsCents).toBe('74393');
    expect(m202.netCents).toBe('1284482');

    expect(m303.attemptsCount).toBe(43);
    expect(m303.capturedCount).toBe(27);
    expect(m303.grossCents).toBe('1156778');
    expect(m303.refundsCents).toBe('289379');
    expect(m303.netCents).toBe('867399');

    expect(m404.attemptsCount).toBe(57);
    expect(m404.capturedCount).toBe(40);
    expect(m404.grossCents).toBe('1899567');
    expect(m404.refundsCents).toBe('375838');
    expect(m404.netCents).toBe('1523729');
  });

  it('calculates channel breakdown accurately', () => {
    const channelBreakdown = calculateChannelBreakdown(payments);
    expect(channelBreakdown.length).toBe(3);
    const qr = channelBreakdown.find((c) => c.channel === 'qr')!;
    const link = channelBreakdown.find((c) => c.channel === 'link')!;
    const terminal = channelBreakdown.find((c) => c.channel === 'terminal')!;

    const totalAttempts = qr.attemptsCount + link.attemptsCount + terminal.attemptsCount;
    const totalCaptured = qr.capturedCount + link.capturedCount + terminal.capturedCount;
    const totalNet = BigInt(qr.netCents) + BigInt(link.netCents) + BigInt(terminal.netCents);

    expect(totalAttempts).toBe(205);
    expect(totalCaptured).toBe(135);
    expect(totalNet.toString()).toBe('4950056');
  });

  it('exports filtered payments as valid RFC-4180 CSV', () => {
    const csv = exportPaymentsToCSV(payments.slice(0, 5));
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(6); // 1 header + 5 rows
    expect(lines[0]).toBe('payment_id,merchant_id,channel,created_at_utc,derived_status,amount_usd,accepted_refunds_usd,net_captured_usd');
  });

  it('correctly filters by single merchant and updates all 6 KPIs and breakdown', () => {
    const filteredM101 = filterPayments(payments, {
      merchant: 'M-101',
      status: 'all',
      searchQuery: '',
    });
    expect(filteredM101.length).toBe(61);
    const kpisM101 = calculateKPIs(filteredM101);
    expect(kpisM101.validAttempts).toBe(61);
    expect(kpisM101.capturedAttempts).toBe(33);
    expect(kpisM101.captureRatePercent.toFixed(2)).toBe('54.10');
    expect(formatUSD(kpisM101.grossCapturedCents)).toBe('$16,853.19');
    expect(formatUSD(kpisM101.acceptedRefundsCents)).toBe('$4,108.73');
    expect(formatUSD(kpisM101.netCapturedCents)).toBe('$12,744.46');

    // Merchant breakdown for filtered set must reflect 0 for other merchants
    const breakdown = calculateMerchantBreakdown(filteredM101);
    const m101 = breakdown.find((b) => b.merchant_id === 'M-101')!;
    const m202 = breakdown.find((b) => b.merchant_id === 'M-202')!;
    expect(m101.attemptsCount).toBe(61);
    expect(m202.attemptsCount).toBe(0);
    expect(m202.netCents).toBe('0');
  });

  it('correctly filters by status', () => {
    const capturedOnly = filterPayments(payments, {
      merchant: 'all',
      status: 'captured',
      searchQuery: '',
    });
    expect(capturedOnly.length).toBe(135);
    const kpisCaptured = calculateKPIs(capturedOnly);
    expect(kpisCaptured.validAttempts).toBe(135);
    expect(kpisCaptured.capturedAttempts).toBe(135);
    expect(kpisCaptured.captureRatePercent).toBe(100);

    const failedOnly = filterPayments(payments, {
      merchant: 'all',
      status: 'failed',
      searchQuery: '',
    });
    expect(failedOnly.length).toBe(42);
    const kpisFailed = calculateKPIs(failedOnly);
    expect(kpisFailed.validAttempts).toBe(42);
    expect(kpisFailed.capturedAttempts).toBe(0);
    expect(kpisFailed.captureRatePercent).toBe(0);
    expect(kpisFailed.grossCapturedCents).toBe('0');
    expect(kpisFailed.netCapturedCents).toBe('0');

    const pendingOnly = filterPayments(payments, {
      merchant: 'all',
      status: 'pending',
      searchQuery: '',
    });
    expect(pendingOnly.length).toBe(28);
    const kpisPending = calculateKPIs(pendingOnly);
    expect(kpisPending.validAttempts).toBe(28);
    expect(kpisPending.capturedAttempts).toBe(0);
    expect(kpisPending.captureRatePercent).toBe(0);
  });

  it('correctly filters by payment ID search', () => {
    const specificPayment = filterPayments(payments, {
      merchant: 'all',
      status: 'all',
      searchQuery: 'PMT-00001',
    });
    expect(specificPayment.length).toBe(1);
    expect(specificPayment[0].payment_id).toBe('PMT-00001');

    // Partial search
    const partial = filterPayments(payments, {
      merchant: 'all',
      status: 'all',
      searchQuery: '0000',
    });
    expect(partial.length).toBe(9); // PMT-00001 through PMT-00009
  });

  it('handles zero matches gracefully with all 6 KPIs zeroed and 0.00% capture rate', () => {
    const zeroMatches = filterPayments(payments, {
      merchant: 'all',
      status: 'all',
      searchQuery: 'NONEXISTENT-PAYMENT-ID',
    });
    expect(zeroMatches.length).toBe(0);
    const kpisZero = calculateKPIs(zeroMatches);
    expect(kpisZero.validAttempts).toBe(0);
    expect(kpisZero.capturedAttempts).toBe(0);
    expect(kpisZero.captureRatePercent).toBe(0);
    expect(kpisZero.grossCapturedCents).toBe('0');
    expect(kpisZero.acceptedRefundsCents).toBe('0');
    expect(kpisZero.netCapturedCents).toBe('0');
    expect(formatUSD(kpisZero.netCapturedCents)).toBe('$0.00');

    const breakdownZero = calculateMerchantBreakdown(zeroMatches);
    expect(breakdownZero.every((b) => b.attemptsCount === 0 && b.netCents === '0')).toBe(true);
  });
});
