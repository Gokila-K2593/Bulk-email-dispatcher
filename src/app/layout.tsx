import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bulk Email Dispatcher Dashboard',
  description: 'High-performance bulk email job processing manager',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
