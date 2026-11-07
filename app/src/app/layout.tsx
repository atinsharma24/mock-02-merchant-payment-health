import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Merchant Payment Health Monitor',
  description: 'Merchant support analyst payment health console',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}

