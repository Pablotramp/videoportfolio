import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import MainLayout from './assets/layouts/MainLayout.jsx'
import { usePortfolio } from './application/portfolio/usePortfolio.js'
import Home from './pages/Home.jsx'
import IntroPage from './pages/IntroPage.jsx'
import SeccionPage from './pages/SeccionPage.jsx'

function App() {
  const portfolio = usePortfolio()
  const location = useLocation()
  const [showIntro, setShowIntro] = useState(true)

  const isHome = location.pathname === '/'
  const isFullBleedHome = !portfolio.loading && !portfolio.error && isHome
  const hasSiteTitle = Boolean(portfolio.siteTitle)

  const currentSection = !portfolio.loading && !portfolio.error
    ? (portfolio.sections.find((s) => location.pathname === `/seccion/${s.slug}`) ?? null)
    : null
  const isSectionPage = currentSection !== null

  let content = (
    <Routes>
      <Route path="/" element={<Home sections={portfolio.sections} />} />
      <Route
        path="/seccion/:slug"
        element={<SeccionPage sections={portfolio.sections} r2BaseUrl={portfolio.r2BaseUrl} sectionManifest={portfolio.sectionManifest} />}
      />
    </Routes>
  )

  if (portfolio.loading) {
    content = (
      <section className="grid gap-4 border border-black/10 bg-white px-8 py-10" aria-busy="true" aria-live="polite">
        <p className="m-0 text-xs uppercase tracking-[0.22em] text-zinc-500">Cargando</p>
        <h1 className="m-0 font-serif text-4xl font-semibold">Preparando portfolio…</h1>
        <p className="m-0 text-zinc-700">Estamos reuniendo el contenido desde Cloudflare R2.</p>
      </section>
    )
  } else if (portfolio.error) {
    content = (
      <section className="grid gap-4 border border-black/10 bg-white px-8 py-10" role="alert">
        <p className="m-0 text-xs uppercase tracking-[0.22em] text-zinc-500">Error</p>
        <h1 className="m-0 font-serif text-4xl font-semibold">No se pudo cargar el portfolio</h1>
        <p className="m-0 text-zinc-700">
          {portfolio.error.message || 'Revisa la variable VITE_R2_PUBLIC_URL en .env.local e inténtalo de nuevo.'}
        </p>
      </section>
    )
  }

  return (
    <>
      {/* Intro screen: shown once on initial load while siteTitle is available */}
      {showIntro && !portfolio.loading && hasSiteTitle && (
        <IntroPage title={portfolio.siteTitle} onDismiss={() => setShowIntro(false)} />
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
