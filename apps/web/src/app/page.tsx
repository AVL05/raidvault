export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">
        RaidVault Development Screen
      </h1>
      <p className="mb-8 text-lg text-gray-600">
        M0 — Foundation. This is a minimal development screen.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Development Status</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>✓ pnpm monorepo initialized</li>
          <li>✓ Next.js App Router configured</li>
          <li>✓ Tailwind CSS configured</li>
          <li>✓ ESLint configured</li>
          <li>✓ TypeScript strict mode</li>
          <li>✓ No game integration</li>
          <li>✓ No AI/Providers/Rules Engine</li>
        </ul>
      </div>
    </main>
  );
}