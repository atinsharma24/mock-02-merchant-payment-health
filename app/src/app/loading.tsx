import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 animate-pulse">
      {/* Top Navigation Bar Skeleton */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="h-7 w-32 bg-slate-200 rounded-lg" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 h-24 flex flex-col justify-between">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-6 w-24 bg-slate-200 rounded" />
              <div className="h-2 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Filter Bar Skeleton */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 h-16 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="h-8 w-32 bg-slate-200 rounded-lg" />
            <div className="h-8 w-32 bg-slate-200 rounded-lg" />
            <div className="h-8 w-48 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-4 w-24 bg-slate-100 rounded" />
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

