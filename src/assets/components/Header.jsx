import { useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

function Header({ sections = [], siteTitle = null }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const location = useLocation()
  const drawerRef = useRef(null)
  const closeButtonRef = useRef(null)

  const activeSection = useMemo(
    () => sections.find((section) => location.pathname === `/seccion/${section.slug}`) ?? null,
    [location.pathname, sections],
  )
  const headerSubtleTextClass = 'text-stone-300'
  const controlButtonClass = 'border-white/20 hover:bg-white hover:text-black'
  const squareControlClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border p-0'
  const activeLinkClass = 'border-white bg-white text-black'
  const inactiveLinkClass = 'border-white/20 hover:bg-white hover:text-black'

  const toggleDrawer = () => {
    setIsDrawerOpen((previous) => !previous)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
  }

  useFocusTrap(isDrawerOpen, drawerRef, closeDrawer, closeButtonRef)

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black text-stone-100">
      <div className="mx-auto flex w-full max-w-[1248px] items-center justify-between gap-4 px-6 py-4">
        {activeSection
          ? <p className={`m-0 truncate text-sm uppercase tracking-[0.18em] ${headerSubtleTextClass}`}>{activeSection.name}</p>
          : siteTitle
            ? <p className={`m-0 truncate text-sm uppercase tracking-[0.18em] ${headerSubtleTextClass}`}>{siteTitle}</p>
            : <span aria-hidden="true" />
        }

        {/* Wrapper relativo: el desplegable se posiciona desde aquí */}
        <div className="relative ml-auto flex items-center gap-2">
          <Link
            to="/"
            className={`${squareControlClass} ${controlButtonClass}`}
            aria-label="Volver al inicio"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <title>Inicio</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 9.75V21h13.5V9.75" />
            </svg>
          </Link>
          <button
            type="button"
            className={`${squareControlClass} ${controlButtonClass}`}
            aria-expanded={isDrawerOpen}
            aria-controls="content-drawer"
            aria-label="Abrir menú de secciones"
            onClick={toggleDrawer}
          >
            <span className="grid gap-1" aria-hidden="true">
              <span className="h-px w-4 bg-current" />
              <span className="h-px w-4 bg-current" />
              <span className="h-px w-4 bg-current" />
            </span>
          </button>

          {isDrawerOpen && (
            <>
              {/* Overlay para cerrar al hacer clic fuera */}
              <div
                className="fixed inset-0 z-40"
                aria-hidden="true"
                onClick={closeDrawer}
              />
              <aside
                id="content-drawer"
                ref={drawerRef}
                aria-modal="true"
                role="dialog"
                className="absolute right-0 top-full z-50 mt-1 max-h-[80vh] w-72 max-w-[90vw] overflow-y-auto border border-white/15 bg-black p-6 text-stone-100 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-6 flex justify-end">
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className={`rounded border px-3 py-1 text-xs uppercase ${controlButtonClass}`}
                    onClick={closeDrawer}
                  >
                    Cerrar
                  </button>
                </div>
                <nav aria-label="Secciones del contenido">
                  <ul className="m-0 grid list-none gap-3 p-0 text-sm uppercase tracking-[0.12em]">
                    {sections.map((section) => {
                      const isActive = location.pathname === `/seccion/${section.slug}`

                      return (
                        <li key={section.entryName}>
                          <Link
                            className={`block rounded border px-3 py-3 no-underline transition ${
                              isActive
                                ? activeLinkClass
                                : inactiveLinkClass
                            }`}
                            to={`/seccion/${section.slug}`}
                            onClick={closeDrawer}
                          >
                            {section.name}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </nav>
              </aside>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
