import { sourceBuildId } from './scripts/build-info.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: () => sourceBuildId(),
  env: { NEXT_PUBLIC_RAIDVAULT_BUILD: sourceBuildId() },
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Cache-Control', value: 'no-store, max-age=0' },
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }]
  },
}

export default nextConfig
