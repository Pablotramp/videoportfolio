import { useEffect, useState } from 'react'
import { getPortfolio } from './getPortfolio.js'

const DEFAULT_PORTFOLIO = {
  sections: [],
  footer: null,
  sectionImages: {},
  siteTitle: null,
  r2BaseUrl: null,
}

export function usePortfolio(source) {
  const [portfolio, setPortfolio] = useState({
    ...DEFAULT_PORTFOLIO,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadPortfolio() {
      try {
        setPortfolio((currentPortfolio) => ({
          ...currentPortfolio,
          loading: true,
          error: null,
        }))

        const nextPortfolio = await getPortfolio(source)

        if (cancelled) {
          return
        }

        setPortfolio({
          ...nextPortfolio,
          loading: false,
          error: null,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setPortfolio({
          ...DEFAULT_PORTFOLIO,
          loading: false,
          error,
        })
      }
    }

    loadPortfolio()

    return () => {
      cancelled = true
    }
  }, [source])

  return portfolio
}
