import fs from 'fs';
import path from 'path';
import { parseCSVRecords, validateHeaders } from './csv';
import { processLifecycle } from './lifecycle';
import {
  RawPaymentAttempt,
  RawPaymentEvent,
  LoadDataResult,
} from './types';

/**
 * Expected schema headers per BRIEF.md data contract:
 * payment_attempts.csv: payment_id, merchant_id, created_at_utc, amount_cents, channel
 * payment_events.csv: event_id, payment_id, event_type, event_at_utc, amount_cents
 */
export const EXPECTED_ATTEMPTS_HEADER = [
  'payment_id',
  'merchant_id',
  'created_at_utc',
  'amount_cents',
  'channel',
];

export const EXPECTED_EVENTS_HEADER = [
  'event_id',
  'payment_id',
  'event_type',
  'event_at_utc',
  'amount_cents',
];

/**
 * Canonical runtime data directory: app/data/
 * The repository root data/ directory contains the original reference export.
 * app/data/ is the authoritative canonical copy used for ingestion and test execution.
 */
export function getCanonicalDataDir(): string {
  // Check if we are running from repository root (app/data exists)
  const rootDataDir = path.resolve(process.cwd(), 'app', 'data');
  if (fs.existsSync(rootDataDir)) {
    return rootDataDir;
  }
  // If running with process.cwd() inside app/ (data exists)
  const appDataDir = path.resolve(process.cwd(), 'data');
  if (fs.existsSync(appDataDir)) {
    return appDataDir;
  }
  // Fallback to relative to __dirname
  return path.resolve(__dirname, '..', '..', 'data');
}

/**
 * Server-only filesystem boundary by usage: do not import this module into a client component.
 * Expected I/O/schema failures become analyst-facing result objects; individual bad rows
 * instead proceed to lifecycle validation and appear in data-quality collections.
 */
export function loadAndProcessData(): LoadDataResult {
  const canonicalDir = getCanonicalDataDir();
  const attemptsPath = path.join(canonicalDir, 'payment_attempts.csv');
  const eventsPath = path.join(canonicalDir, 'payment_events.csv');

  // Check file presence
  if (!fs.existsSync(attemptsPath) || !fs.existsSync(eventsPath)) {
    const missing = [];
    if (!fs.existsSync(attemptsPath)) missing.push('payment_attempts.csv');
    if (!fs.existsSync(eventsPath)) missing.push('payment_events.csv');

    return {
      success: false,
      error: {
        title: 'Export CSV Files Missing',
        message: `The required payment export file(s) could not be located: ${missing.join(', ')}.`,
        guidance:
          'Ensure payment_attempts.csv and payment_events.csv are present in the canonical app/data/ directory and that file permissions allow read access.',
      },
    };
  }

  let attemptsCsv: string;
  let eventsCsv: string;

  try {
    attemptsCsv = fs.readFileSync(attemptsPath, 'utf-8');
    eventsCsv = fs.readFileSync(eventsPath, 'utf-8');
  } catch {
    return {
      success: false,
      error: {
        title: 'Cannot Read Export Files',
        message: 'A permissions or I/O error occurred while reading the payment export files.',
        guidance:
          'Check file system permissions on payment_attempts.csv and payment_events.csv to ensure the application process has read access.',
      },
    };
  }

  // Parse CSV records with structural and line tracking
  const attemptRecords = parseCSVRecords(attemptsCsv);
  const eventRecords = parseCSVRecords(eventsCsv);

  if (attemptRecords.length === 0) {
    return {
      success: false,
      error: {
        title: 'Empty Export File',
        message: 'payment_attempts.csv is completely empty.',
        guidance:
          'Verify that the payment_attempts.csv export contains a valid header row and payment attempt records.',
      },
    };
  }

  if (eventRecords.length === 0) {
    return {
      success: false,
      error: {
        title: 'Empty Export File',
        message: 'payment_events.csv is completely empty.',
        guidance:
          'Verify that the payment_events.csv export contains a valid header row and event records.',
      },
    };
  }

  // Validate exact expected headers
  const actualAttemptsHeader = attemptRecords[0].fields;
  const attemptsHeaderValidation = validateHeaders(actualAttemptsHeader, EXPECTED_ATTEMPTS_HEADER);
  if (!attemptsHeaderValidation.valid) {
    return {
      success: false,
      error: {
        title: 'Invalid Attempts Export Header',
        message: `payment_attempts.csv header schema error: ${attemptsHeaderValidation.error}`,
        guidance:
          'Expected exact header: payment_id,merchant_id,created_at_utc,amount_cents,channel. Verify export schema configuration.',
      },
    };
  }

  const actualEventsHeader = eventRecords[0].fields;
  const eventsHeaderValidation = validateHeaders(actualEventsHeader, EXPECTED_EVENTS_HEADER);
  if (!eventsHeaderValidation.valid) {
    return {
      success: false,
      error: {
        title: 'Invalid Events Export Header',
        message: `payment_events.csv header schema error: ${eventsHeaderValidation.error}`,
        guidance:
          'Expected exact header: event_id,payment_id,event_type,event_at_utc,amount_cents. Verify export schema configuration.',
      },
    };
  }

  // Map data rows (skipping header row 0). Keep structural metadata through deduplication;
  // missing fields remain raw empty strings and must never become valid monetary zeroes.
  const rawAttempts: RawPaymentAttempt[] = attemptRecords.slice(1).map((r) => ({
    payment_id: r.fields[0] ?? '',
    merchant_id: r.fields[1] ?? '',
    created_at_utc: r.fields[2] ?? '',
    amount_cents: r.fields[3] ?? '',
    channel: r.fields[4] ?? '',
    _line: r.line,
    _columnCount: r.fields.length,
    _malformedQuotes: r.malformedQuotes,
    _malformedReason: r.malformedReason,
  }));

  const rawEvents: RawPaymentEvent[] = eventRecords.slice(1).map((r) => ({
    event_id: r.fields[0] ?? '',
    payment_id: r.fields[1] ?? '',
    event_type: r.fields[2] ?? '',
    event_at_utc: r.fields[3] ?? '',
    amount_cents: r.fields[4] ?? '',
    _line: r.line,
    _columnCount: r.fields.length,
    _malformedQuotes: r.malformedQuotes,
    _malformedReason: r.malformedReason,
  }));

  const processingResult = processLifecycle(rawAttempts, rawEvents);

  return {
    success: true,
    data: {
      dataQuality: processingResult.dataQuality,
      payments: processingResult.payments,
    },
  };
}
