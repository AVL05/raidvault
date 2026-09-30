import "./globals.css";

export const metadata = {
  title: "RaidVault — Stash",
  description: "Local-first ARC Raiders stash companion",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}