import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppProviders } from '../providers/app-providers';

export const metadata: Metadata = {
  title: 'VisaFlow — Real-Time Operations Platform',
  description: 'Mission-critical visa appointment operations console',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
