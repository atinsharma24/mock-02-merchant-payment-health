import React from 'react';
import DashboardClient from '../components/DashboardClient';
import ErrorState from '../components/ErrorState';
import { loadAndProcessData } from '../../lib/loadData';

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

  return (
    <DashboardClient
      initialPayments={result.data.payments}
      initialDataQuality={result.data.dataQuality}
    />
  );
}
