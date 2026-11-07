'use client';

import React, { useState, useMemo } from 'react';
import {
  DerivedPayment,
  DataQualitySummary,
  FilterState,
  MerchantId,
  DerivedStatus,
} from '../../lib/types';
import {
  calculateKPIs,
  calculateMerchantBreakdown,
  calculateChannelBreakdown,
  filterPayments,
  formatUSD,
  exportPaymentsToCSV,
} from '../../lib/lifecycle';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  QrCode,
  Link as LinkIcon,
  CreditCard,
  Layers,
  Radio,
} from 'lucide-react';

interface DashboardClientProps {
  initialPayments: DerivedPayment[];
  initialDataQuality: DataQualitySummary;
}

export default function DashboardClient({
  initialPayments,
  initialDataQuality,
}: DashboardClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    merchant: 'all',
    status: 'all',
    searchQuery: '',
  });

  const [showDataQuality, setShowDataQuality] = useState(false);
  const [dqTab, setDqTab] = useState<'all' | 'superseded' | 'excluded' | 'business'>('all');
  const [breakdownView, setBreakdownView] = useState<'merchant' | 'channel'>('merchant');
  const [selectedPayment, setSelectedPayment] = useState<DerivedPayment | null>(null);

  // One derived subset is shared by cards, both breakdowns, rows, and export.
  // useMemo avoids recalculation on unrelated UI changes; it is not required for correctness.
  // Filtered payments
  const filteredPayments = useMemo(() => {
    return filterPayments(initialPayments, filters);
  }, [initialPayments, filters]);

  // KPIs for currently filtered payments
  const kpis = useMemo(() => {
    return calculateKPIs(filteredPayments);
  }, [filteredPayments]);

  // Merchant breakdown consistent with filtered set
  const merchantBreakdown = useMemo(() => {
    return calculateMerchantBreakdown(filteredPayments);
  }, [filteredPayments]);

  // Channel breakdown consistent with filtered set
  const channelBreakdown = useMemo(() => {
    return calculateChannelBreakdown(filteredPayments);
  }, [filteredPayments]);

  const hasActiveFilters =
    filters.merchant !== 'all' || filters.status !== 'all' || filters.searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilters({
      merchant: 'all',
      status: 'all',
      searchQuery: '',
    });
  };

  // Browser-only download: business helper returns text, while Blob/DOM initiate the file save.
  // Current cleanup limitation: this handler removes the anchor but does not revoke its object URL.
  const handleExportCSV = () => {
    const csvContent = exportPaymentsToCSV(filteredPayments);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: DerivedStatus) => {
    switch (status) {
      case 'captured':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Captured
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending
          </span>
        );
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'qr':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
            <QrCode className="w-3.5 h-3.5 text-slate-500" /> QR
          </span>
        );
      case 'link':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
            <LinkIcon className="w-3.5 h-3.5 text-slate-500" /> Link
          </span>
        );
      case 'terminal':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
            <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Terminal
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{channel}</span>;
    }
  };

  // Audit scope is the entire ingested snapshot, intentionally independent of active filters.
  const totalAnomalies =
    initialDataQuality.supersededAttempts.length +
    initialDataQuality.supersededEvents.length +
    initialDataQuality.blankAttempts.length +
    initialDataQuality.blankEvents.length +
    initialDataQuality.excludedFinalAttempts.length +
    initialDataQuality.excludedFinalEvents.length +
    initialDataQuality.rejectedBusinessEvents.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              SP
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Merchant Payment Health Monitor
              </h1>
              <p className="text-xs text-slate-500">
                Authoritative lifecycle & reconciliation console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Data Contract Ingested
            </div>

            <button
              id="data-quality-toggle"
              onClick={() => setShowDataQuality(!showDataQuality)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                showDataQuality
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Data Quality Audit</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-amber-200 text-amber-900 font-bold">
                {totalAnomalies}
              </span>
              {showDataQuality ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Data Quality Summary Panel (Criterion A) */}
        {showDataQuality && (
          <section
            aria-label="Data Quality Audit"
            className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm space-y-4 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Authoritative Ingestion & Data Quality Summary
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audits deduplication, invalid column formats, impossible calendar dates, and business rule rejections
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setDqTab('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dqTab === 'all' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({totalAnomalies})
                </button>
                <button
                  onClick={() => setDqTab('superseded')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dqTab === 'superseded' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Superseded ({initialDataQuality.supersededAttempts.length + initialDataQuality.supersededEvents.length})
                </button>
                <button
                  onClick={() => setDqTab('excluded')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dqTab === 'excluded' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Excluded Final ({initialDataQuality.excludedFinalAttempts.length + initialDataQuality.excludedFinalEvents.length + initialDataQuality.blankAttempts.length + initialDataQuality.blankEvents.length})
                </button>
                <button
                  onClick={() => setDqTab('business')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dqTab === 'business' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rejected Events ({initialDataQuality.rejectedBusinessEvents.length})
                </button>
              </div>
            </div>

            {/* Quick summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">Total Attempts Input</div>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {initialDataQuality.totalAttemptRows}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({initialDataQuality.validAttemptsCount} valid)
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">Total Events Input</div>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {initialDataQuality.totalEventRows}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({initialDataQuality.validCandidateEventsCount} valid)
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">Superseded Duplicates</div>
                <div className="text-base font-bold text-indigo-700 mt-1">
                  {initialDataQuality.supersededAttempts.length + initialDataQuality.supersededEvents.length}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({initialDataQuality.supersededAttempts.length} att, {initialDataQuality.supersededEvents.length} evt)
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">Rejected Business Events</div>
                <div className="text-base font-bold text-amber-700 mt-1">
                  {initialDataQuality.rejectedBusinessEvents.length}{' '}
                  <span className="text-xs font-normal text-slate-500">anomalies safely isolated</span>
                </div>
              </div>
            </div>

            {/* Detailed list of anomalies */}
            <div className="max-h-60 overflow-y-auto space-y-2 text-xs border border-slate-200 rounded-lg p-2 bg-slate-50">
              {(dqTab === 'all' || dqTab === 'superseded') && (
                <>
                  {initialDataQuality.supersededAttempts.map((s, idx) => (
                    <div key={`sup-att-${idx}`} className="flex items-start justify-between p-2 bg-white rounded border border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800">Superseded Attempt: </span>
                        <code className="text-indigo-600 font-mono">{s.id}</code>
                        <span className="text-slate-500 ml-2">({s.reason})</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Attempt</span>
                    </div>
                  ))}
                  {initialDataQuality.supersededEvents.map((s, idx) => (
                    <div key={`sup-evt-${idx}`} className="flex items-start justify-between p-2 bg-white rounded border border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800">Superseded Event: </span>
                        <code className="text-indigo-600 font-mono">{s.id}</code>
                        <span className="text-slate-500 ml-2">({s.reason})</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Event</span>
                    </div>
                  ))}
                </>
              )}

              {(dqTab === 'all' || dqTab === 'excluded') && (
                <>
                  {initialDataQuality.blankAttempts.map((b, idx) => (
                    <div key={`blank-att-${idx}`} className="flex items-start justify-between p-2 bg-rose-50/60 rounded border border-rose-200">
                      <div>
                        <span className="font-semibold text-rose-800">Blank Payment ID Row: </span>
                        <span className="text-rose-600">{b.reason}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Excluded</span>
                    </div>
                  ))}
                  {initialDataQuality.blankEvents.map((b, idx) => (
                    <div key={`blank-evt-${idx}`} className="flex items-start justify-between p-2 bg-rose-50/60 rounded border border-rose-200">
                      <div>
                        <span className="font-semibold text-rose-800">Blank Event ID Row: </span>
                        <span className="text-rose-600">{b.reason}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Excluded</span>
                    </div>
                  ))}
                  {initialDataQuality.excludedFinalAttempts.map((e, idx) => (
                    <div key={`ex-att-${idx}`} className="flex items-start justify-between p-2 bg-rose-50/60 rounded border border-rose-200">
                      <div>
                        <span className="font-semibold text-rose-800">Excluded Final Payment: </span>
                        <code className="text-rose-900 font-mono font-bold">{e.id}</code>
                        <span className="text-rose-700 ml-2">— {e.reason}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Excluded</span>
                    </div>
                  ))}
                  {initialDataQuality.excludedFinalEvents.map((e, idx) => (
                    <div key={`ex-evt-${idx}`} className="flex items-start justify-between p-2 bg-rose-50/60 rounded border border-rose-200">
                      <div>
                        <span className="font-semibold text-rose-800">Excluded Final Event: </span>
                        <code className="text-rose-900 font-mono font-bold">{e.id}</code>
                        <span className="text-rose-700 ml-2">— {e.reason}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Excluded</span>
                    </div>
                  ))}
                </>
              )}

              {(dqTab === 'all' || dqTab === 'business') && (
                <>
                  {initialDataQuality.rejectedBusinessEvents.map((r, idx) => (
                    <div key={`rbe-${idx}`} className="flex items-start justify-between p-2 bg-amber-50/70 rounded border border-amber-200">
                      <div>
                        <span className="font-semibold text-amber-900">Rejected Business Event: </span>
                        <code className="text-amber-800 font-mono font-bold">{r.event_id}</code>
                        <span className="text-slate-600 ml-1">(Payment: <code className="font-mono">{r.payment_id}</code>)</span>
                        <span className="text-amber-800 ml-2">— {r.reason}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">{r.event_type}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        {/* Financial KPI Cards (Acceptance Criterion B) */}
        <section aria-label="Financial KPI Cards" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Financial KPIs {hasActiveFilters && <span className="text-indigo-600 normal-case">(Filtered Set)</span>}
            </h2>
            <div className="text-xs text-slate-500 font-medium">
              Integer Cent Accumulation • Exact USD (2 Decimals)
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* KPI 1: Valid Attempts */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">Valid Attempts</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {kpis.validAttempts}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Total valid attempts</div>
            </div>

            {/* KPI 2: Captured Attempts */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">Captured Attempts</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600">
                {kpis.capturedAttempts}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Successfully captured</div>
            </div>

            {/* KPI 3: Capture Rate */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">Capture Rate</div>
              <div className="mt-2 text-2xl font-extrabold text-indigo-600">
                {kpis.captureRatePercent.toFixed(2)}%
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {kpis.validAttempts === 0 ? '0% for zero attempts' : `${kpis.capturedAttempts} / ${kpis.validAttempts}`}
              </div>
            </div>

            {/* KPI 4: Gross Captured USD */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">Gross Captured</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {formatUSD(kpis.grossCapturedCents)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Eligible capture amounts</div>
            </div>

            {/* KPI 5: Accepted Refunds USD */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500">Accepted Refunds</div>
              <div className="mt-2 text-2xl font-extrabold text-rose-600">
                {formatUSD(kpis.acceptedRefundsCents)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Valid chronological refunds</div>
            </div>

            {/* KPI 6: Net Captured USD */}
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-500 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-indigo-50/40">
              <div className="text-xs font-bold text-indigo-900">Net Captured</div>
              <div className="mt-2 text-2xl font-black text-indigo-700">
                {formatUSD(kpis.netCapturedCents)}
              </div>
              <div className="mt-1 text-[11px] text-indigo-600 font-semibold">Gross minus refunds</div>
            </div>
          </div>
        </section>

        {/* Interactive Filters (Criterion C) */}
        <section aria-label="Filters" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Merchant Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="filter-merchant" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  Merchant:
                </label>
                <select
                  id="filter-merchant"
                  value={filters.merchant}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      merchant: e.target.value as 'all' | MerchantId,
                    }))
                  }
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                >
                  <option value="all">All Merchants</option>
                  <option value="M-101">M-101</option>
                  <option value="M-202">M-202</option>
                  <option value="M-303">M-303</option>
                  <option value="M-404">M-404</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="filter-status" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  Status:
                </label>
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value as 'all' | DerivedStatus,
                    }))
                  }
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                >
                  <option value="all">All Statuses</option>
                  <option value="captured">Captured</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Search by Payment ID */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id="filter-search"
                  type="text"
                  placeholder="Search payment ID (e.g. PMT-00001)..."
                  value={filters.searchQuery}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      searchQuery: e.target.value,
                    }))
                  }
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            {/* Clear / Reset button */}
            <div className="flex items-center justify-between md:justify-end gap-2">
              <span className="text-xs text-slate-500">
                Showing <strong className="text-slate-800">{filteredPayments.length}</strong> of{' '}
                {initialPayments.length}
              </span>
              {hasActiveFilters && (
                <button
                  id="reset-filters-btn"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Breakdown Section (Acceptance Criterion D + Optional Channel Breakdown) */}
        <section aria-label="Breakdown" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {breakdownView === 'merchant' ? 'Merchant Health Breakdown' : 'Payment Channel Breakdown'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center text-xs font-semibold">
                <button
                  onClick={() => setBreakdownView('merchant')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    breakdownView === 'merchant'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Merchant
                </button>
                <button
                  onClick={() => setBreakdownView('channel')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    breakdownView === 'channel'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Channel
                </button>
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">• Aggregated for active filters</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {breakdownView === 'merchant' ? (
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Merchant</th>
                    <th className="px-4 py-2.5 text-right">Attempts</th>
                    <th className="px-4 py-2.5 text-right">Captured</th>
                    <th className="px-4 py-2.5 text-right">Capture Rate</th>
                    <th className="px-4 py-2.5 text-right">Gross Captured</th>
                    <th className="px-4 py-2.5 text-right">Accepted Refunds</th>
                    <th className="px-4 py-2.5 text-right">Net Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {merchantBreakdown.map((mb) => {
                    const isSelected = filters.merchant === mb.merchant_id;
                    return (
                      <tr
                        key={mb.merchant_id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-indigo-50/50 font-semibold' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {mb.merchant_id}
                          {isSelected && (
                            <span className="ml-2 text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                              Filtered
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{mb.attemptsCount}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-700 font-medium">
                          {mb.capturedCount}
                        </td>
                        <td className="px-4 py-2.5 text-right text-indigo-700 font-medium">
                          {mb.captureRatePercent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-800">
                          {formatUSD(mb.grossCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-rose-700">
                          {formatUSD(mb.refundsCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                          {formatUSD(mb.netCents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Channel</th>
                    <th className="px-4 py-2.5 text-right">Attempts</th>
                    <th className="px-4 py-2.5 text-right">Captured</th>
                    <th className="px-4 py-2.5 text-right">Capture Rate</th>
                    <th className="px-4 py-2.5 text-right">Gross Captured</th>
                    <th className="px-4 py-2.5 text-right">Accepted Refunds</th>
                    <th className="px-4 py-2.5 text-right">Net Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {channelBreakdown.map((cb) => (
                    <tr key={cb.channel} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-slate-900">
                        {getChannelBadge(cb.channel)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{cb.attemptsCount}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-700 font-medium">
                        {cb.capturedCount}
                      </td>
                      <td className="px-4 py-2.5 text-right text-indigo-700 font-medium">
                        {cb.captureRatePercent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-800">
                        {formatUSD(cb.grossCents)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-rose-700">
                        {formatUSD(cb.refundsCents)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {formatUSD(cb.netCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Payment Attempts Table (Acceptance Criterion C) */}
        <section aria-label="Payment Table" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Payment Attempts & Lifecycle Status</h2>
              <p className="text-xs text-slate-500">
                Detailed record log reflecting canonical deductions and refund ceilings
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {filteredPayments.length} {filteredPayments.length === 1 ? 'record' : 'records'}
              </span>
              {filteredPayments.length > 0 && (
                <button
                  id="export-csv-btn"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Export Filtered CSV
                </button>
              )}
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            /* Clear Empty State */
            <div className="py-16 px-4 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No matching payments found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No payment attempts match the active filter criteria. Try adjusting your search term,
                selecting &quot;All Merchants&quot;, or choosing &quot;All Statuses&quot;.
              </p>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Payment ID</th>
                    <th className="px-4 py-3 text-left">Merchant</th>
                    <th className="px-4 py-3 text-left">Channel</th>
                    <th className="px-4 py-3 text-left">Created At (UTC)</th>
                    <th className="px-4 py-3 text-left">Derived Status</th>
                    <th className="px-4 py-3 text-right">Original Amount</th>
                    <th className="px-4 py-3 text-right">Accepted Refunds</th>
                    <th className="px-4 py-3 text-right">Net Captured</th>
                    <th className="px-4 py-3 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPayments.map((p) => (
                    <tr key={p.payment_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-medium text-slate-900">
                        {p.payment_id}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{p.merchant_id}</td>
                      <td className="px-4 py-2.5">{getChannelBadge(p.channel)}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-600 text-[11px]">
                        {p.created_at_utc}
                      </td>
                      <td className="px-4 py-2.5">{getStatusBadge(p.status)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                        {formatUSD(p.amount_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {p.accepted_refund_cents > 0 ? (
                          <span className="text-rose-600">
                            -{formatUSD(p.accepted_refund_cents)}
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({p.accepted_refunds.length})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">$0.00</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {formatUSD(p.net_captured_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => setSelectedPayment(p)}
                          className="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Details contain selected capture and accepted refunds only, not all raw lifecycle events.
            This overlay currently lacks dialog focus management/Escape handling; see doc chapter 7. */}
        {/* Payment Detail Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Payment Audit Details</h3>
                  <code className="text-xs font-mono text-indigo-600">{selectedPayment.payment_id}</code>
                </div>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Merchant</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedPayment.merchant_id}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Channel</span>
                  <div className="font-bold text-slate-900 mt-0.5 capitalize">{selectedPayment.channel}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Derived Status</span>
                  <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Original Attempt Amount</span>
                  <div className="font-bold text-slate-900 mt-0.5">{formatUSD(selectedPayment.amount_cents)}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Accepted Refunds</span>
                  <div className="font-bold text-rose-600 mt-0.5">{formatUSD(selectedPayment.accepted_refund_cents)}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">Net Captured</span>
                  <div className="font-bold text-indigo-700 mt-0.5">{formatUSD(selectedPayment.net_captured_cents)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">Lifecycle Events Applied</h4>
                {selectedPayment.selected_capture ? (
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                    <div className="flex items-center justify-between text-emerald-800 font-semibold">
                      <span>Authoritative Capture Event:</span>
                      <code className="font-mono">{selectedPayment.selected_capture.event_id}</code>
                    </div>
                    <div className="text-emerald-700 text-[11px] mt-1 flex justify-between">
                      <span>Timestamp: {selectedPayment.selected_capture.event_at_utc}</span>
                      <span>Amount: {formatUSD(selectedPayment.selected_capture.amount_cents || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                    No eligible capture event recorded
                  </div>
                )}

                {selectedPayment.accepted_refunds.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Accepted Chronological Refunds ({selectedPayment.accepted_refunds.length}):
                    </span>
                    {selectedPayment.accepted_refunds.map((rf) => (
                      <div key={rf.event_id} className="p-2 bg-rose-50/70 border border-rose-200 rounded text-xs flex justify-between items-center">
                        <div>
                          <code className="font-mono font-semibold text-rose-900">{rf.event_id}</code>
                          <span className="text-slate-500 text-[11px] ml-2">{rf.event_at_utc}</span>
                        </div>
                        <span className="font-bold text-rose-700">-{formatUSD(rf.amount_cents || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
