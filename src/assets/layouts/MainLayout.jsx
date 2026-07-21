import { useEffect, useRef } from 'react'
import Header from '../components/Header.jsx'

function getFooterHref(link = {}) {
  return link.href ?? link.url ?? ''
}

function getFooterLabel(link = {}) {
  return link.label ?? link.text ?? link.title ?? getFooterHref(link)
}

function MainLayout({ footer, sections, siteTitle, children, fullBleed = false }) {
  const footerRef = useRef(null)

  const footerTextFields = Object.entries(footer ?? {}).filter(
    ([fieldName, value]) => fieldName !== 'links' && (typeof value === 'string' || typeof value === 'number'),
  )
  const footerLinks = Array.isArray(footer?.links) ? footer.links : []
  const hasFooterContent = footerTextFields.length > 0 || footerLinks.length > 0

  useEffect(() => {
    const root = document.documentElement
    if (!hasFooterContent || !footerRef.current) {
      root.style.setProperty('--footer-h', '0px')
      return
    }
    const el = footerRef.current
    const update = () => root.style.setProperty('--footer-h', `${el.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasFooterContent])

  const mainPaddingBottom = hasFooterContent
    ? 'calc(var(--footer-h, 41px) + 1.5rem)'
    : '2.5rem'

  return (
    <div className="min-h-screen w-full bg-stone-50 text-zinc-950 antialiased">
      <Header sections={sections} siteTitle={siteTitle} />
      <main
        className={fullBleed ? 'w-full' : 'mx-auto w-full max-w-[1248px] px-6 pt-10'}
        style={!fullBleed ? { paddingBottom: mainPaddingBottom } : undefined}
      >
        {children}
      </main>
      {hasFooterContent && (
        <footer ref={footerRef} className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-black text-stone-100">
          <div className="mx-auto flex w-full max-w-[1248px] flex-wrap items-center justify-center gap-x-4 gap-y-1 px-6 py-2 text-center text-sm text-stone-400">
            {footerTextFields.map(([fieldName, value], index) => (
              <span key={fieldName} className="flex items-center gap-4">
                {index > 0 && <span className="text-stone-600" aria-hidden="true">|</span>}
                <span title={fieldName}>{String(value)}</span>
              </span>
            ))}
            {footerLinks.length > 0 && (
              <>
                {footerTextFields.length > 0 && <span className="text-stone-600" aria-hidden="true">|</span>}
                <nav aria-label="Footer links">
                  <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 uppercase tracking-[0.1em]">
                    {footerLinks.filter((link) => getFooterHref(link)).map((link) => (
                      <li key={`${getFooterHref(link)}-${getFooterLabel(link)}`}>
                        <a
                          className="text-stone-200 no-underline hover:text-white"
                          href={getFooterHref(link)}
                          target={getFooterHref(link).startsWith('http') ? '_blank' : undefined}
                          rel="noreferrer"
                        >
                          {getFooterLabel(link)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}

export default MainLayout
