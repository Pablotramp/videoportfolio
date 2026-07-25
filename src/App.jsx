import { useCallback, useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import MainLayout from './assets/layouts/MainLayout.jsx'
import { usePortfolio } from './application/portfolio/usePortfolio.js'
import Home from './pages/Home.jsx'
import IntroPage from './pages/IntroPage.jsx'
import SeccionPage from './pages/SeccionPage.jsx'

const INTRO_FADE_OUT_DURATION_MS = 500

function App() {
  const portfolio = usePortfolio()
  const location = useLocation()
  const [showIntro, setShowIntro] = useState(true)
  const [introExiting, setIntroExiting] = useState(false)

  const isHome = location.pathname === '/'
  const isFullBleedHome = !portfolio.loading && !portfolio.error && isHome
  const hasSiteTitle = Boolean(portfolio.siteTitle)

  const currentSection = !portfolio.loading && !portfolio.error
    ? (portfolio.sections.find((s) => location.pathname === `/seccion/${s.slug}`) ?? null)
    : null
  const isSectionPage = currentSection !== null

  // Update document title from _estructura.json
  useEffect(() => {
    if (portfolio.siteTitle) {
      document.title = portfolio.siteTitle
    }
  }, [portfolio.siteTitle])

  // Update favicon from _estructura.json when faviconUrl is available
  useEffect(() => {
    if (!portfolio.faviconUrl) return
    const existing = document.querySelector("link[rel~='icon']")
    const link = existing ?? (() => {
      const newLink = document.createElement('link')
      newLink.rel = 'icon'
      document.head.appendChild(newLink)
      return newLink
    })()
    link.href = portfolio.faviconUrl
  }, [portfolio.faviconUrl])

  let content = (
    <Routes>
      <Route path="/" element={<Home sections={portfolio.sections} />} />
      <Route
        path="/seccion/:slug"
        element={<SeccionPage sections={portfolio.sections} r2BaseUrl={portfolio.r2BaseUrl} sectionManifest={portfolio.sectionManifest} manifestFiles={portfolio.manifestFiles} />}
      />
    </Routes>
  )

  if (portfolio.loading) {
    content = (
      <section className="grid gap-4 border border-black/10 bg-white px-8 py-10" aria-busy="true" aria-live="polite">
        <p className="m-0 text-xs uppercase tracking-[0.22em] text-zinc-500">Cargando</p>
        <h1 className="m-0 font-serif text-4xl font-semibold">Preparando contenido…</h1>
        <p className="m-0 text-zinc-700">Estamos reuniendo el contenido desde Cloudflare R2.</p>
      </section>
    )
  } else if (portfolio.error) {
    content = (
      <section className="grid gap-4 border border-black/10 bg-white px-8 py-10" role="alert">
        <p className="m-0 text-xs uppercase tracking-[0.22em] text-zinc-500">Error</p>
        <h1 className="m-0 font-serif text-4xl font-semibold">No se pudo cargar el portfolio</h1>
        <p className="m-0 text-zinc-700">
          {portfolio.error.message || 'Revisa la variable VITE_R2_PUBLIC_URL y asegúrate de que apunte al dominio público del bucket de contenido.'}
        </p>
      </section>
    )
  }

  const dismissIntro = useCallback(() => {
    setIntroExiting(true)
  }, [])

  useEffect(() => {
    if (!introExiting) return
    const timeoutId = window.setTimeout(() => {
      setShowIntro(false)
    }, INTRO_FADE_OUT_DURATION_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [introExiting])

  return (
    <>
      {/* Intro screen: shown once on initial load while siteTitle is available */}
      {showIntro && !portfolio.loading && hasSiteTitle && (
        <IntroPage
          title={portfolio.siteTitle}
          loadingImg={portfolio.loadingImg}
          chargeTime={portfolio.loadingChargeTime}
          textColor={portfolio.loadingTextColor}
          backgroundColor={portfolio.loadingBackgroundColor}
          fadeOutDurationMs={INTRO_FADE_OUT_DURATION_MS}
          isExiting={introExiting}
          onDismiss={dismissIntro}
        />
      )}
      <MainLayout
        footer={portfolio.footer}
        sections={portfolio.sections}
        siteTitle={portfolio.siteTitle}
        fullBleed={isFullBleedHome || isSectionPage}
      >
        {content}
      </MainLayout>
    </>
  )
}

export default App
