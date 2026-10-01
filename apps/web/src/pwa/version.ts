import { version } from '../../package.json'

export const APP_VERSION = version
export const APP_BUILD = process.env.NEXT_PUBLIC_RAIDVAULT_BUILD ?? 'development'
