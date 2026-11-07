'use client';

import React from 'react';
import { AlertOctagon, RotateCw, ShieldAlert, ArrowRight } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  guidance: string;
}

export default function ErrorState({ title, message, guidance }: ErrorStateProps) {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-rose-200 p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">{title}</h1>
            <p className="text-xs text-rose-600 font-medium mt-0.5">Ingestion System Error</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80 text-xs text-rose-900 font-medium leading-relaxed">
            {message}
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              Recovery Guidance:
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{guidance}</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Retry Data Ingestion
          </button>
        </div>
      </div>
    </div>
  );
}

