import "./globals.css";
import type { Metadata, Viewport } from 'next'
import { PwaStatus } from '../pwa/pwa-status'

export const metadata: Metadata = {
  title: "RaidVault — Stash",
  description: "Local-first ARC Raiders stash companion",
  applicationName: 'RaidVault',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-180.png' },
  appleWebApp: { capable: true, title: 'RaidVault', statusBarStyle: 'default' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111827' }

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <PwaStatus />
        {children}
      </body>
    </html>
  );
}
