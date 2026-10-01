import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'RaidVault', short_name: 'RaidVault',
    description: 'Unofficial local-first ARC Raiders companion',
    start_url: '/', scope: '/', display: 'standalone', lang: 'en',
    theme_color: '#171B19', background_color: '#171B19',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
