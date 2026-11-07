import React from 'react';
import DashboardClient from '../components/DashboardClient';
import ErrorState from '../components/ErrorState';
import { loadAndProcessData } from '../../lib/loadData';

// Re-ingest on full server requests rather than freezing this local-file snapshot at build time.
// Client-side filters reuse props and do not trigger another filesystem read.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const result = loadAndProcessData();

  if (!result.success || !result.data) {
    return (
      <ErrorState
        title={result.error?.title || 'Data Ingestion Error'}
        message={result.error?.message || 'Failed to ingest payment export files.'}
        guidance={result.error?.guidance || 'Please verify the export files in app/data/ and try again.'}
      />
    );
  }

  // Pass plain derived records/audits; the engine lookup Map is deliberately not a client prop.
  return (
    <DashboardClient
      initialPayments={result.data.payments}
      initialDataQuality={result.data.dataQuality}
    />
  );
}
