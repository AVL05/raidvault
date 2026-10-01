import "./globals.css";
import type { Metadata, Viewport } from 'next'
import { AppShell } from '../ui/app-shell'
import { PwaStatus } from '../pwa/pwa-status'

export const metadata: Metadata = {
  title: "RaidVault — Local ARC Companion",
  description: "Local-first ARC Raiders stash companion",
  applicationName: 'RaidVault',
  icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icons/apple-180.png' },
  appleWebApp: { capable: true, title: 'RaidVault', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#171B19' }

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell onlineHint={<PwaStatus />}>{children}</AppShell>
      </body>
    </html>
  );
}
