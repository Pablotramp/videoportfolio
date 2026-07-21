import { createR2PortfolioSource } from './r2/r2PortfolioSource.js'

function createErrorSource(message) {
  return {
    id: 'invalid-source',
    async load() {
      throw new Error(message)
    },
  }
}

export function createPortfolioSourceFromEnv(env = import.meta.env) {
  const safeEnv = env ?? {}
  const configuredSource = (safeEnv.VITE_PORTFOLIO_SOURCE ?? 'cloudflare-r2').toLowerCase().trim()

  if (configuredSource === 'cloudflare-r2') {
    return createR2PortfolioSource({
      publicUrl: safeEnv.VITE_R2_PUBLIC_URL,
    })
  }

  return createErrorSource(
    `VITE_PORTFOLIO_SOURCE="${configuredSource}" no es válido. Este proyecto solo soporta "cloudflare-r2".`,
  )
}

export const portfolioSource = createPortfolioSourceFromEnv()
