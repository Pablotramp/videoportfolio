/**
 * IntroPage — Pantalla de introducción que muestra el título del sitio.
 *
 * CONTRATO DE INTENCIONES — Animación futura:
 *   El título se muestra centrado (posición estática por ahora).
 *   En una versión futura, se animará desde el centro del viewport hasta
 *   su posición final en la barra de navegación (navbar).
 *   El elemento lleva id="intro-title" para permitir que la animación CSS
 *   lo identifique y aplique la transición FLIP (centro → navbar).
 *
 * Interacción actual:
 *   - Clic o toque en cualquier parte → se cierra la intro.
 *   - Tecla Enter o Escape → se cierra la intro.
 */
import { useCallback, useEffect, useRef } from 'react'

const INTRO_DISMISS_TIMEOUT_MS = 5000

function IntroPage({ title, loadingImg, onDismiss }) {
  const containerRef = useRef(null)
  const onDismissRef = useRef(onDismiss)
  const dismissedRef = useRef(false)
  const dismissTimeoutIdRef = useRef(null)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  const dismissIntro = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    if (dismissTimeoutIdRef.current !== null) {
      window.clearTimeout(dismissTimeoutIdRef.current)
      dismissTimeoutIdRef.current = null
    }
    onDismissRef.current()
  }, [])

  useEffect(() => {
    containerRef.current?.focus()

    dismissTimeoutIdRef.current = window.setTimeout(() => {
      dismissIntro()
    }, INTRO_DISMISS_TIMEOUT_MS)
    return () => {
      if (dismissTimeoutIdRef.current !== null) {
        window.clearTimeout(dismissTimeoutIdRef.current)
        dismissTimeoutIdRef.current = null
      }
    }
  }, [dismissIntro])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-white text-black cursor-pointer overflow-hidden"
      onClick={dismissIntro}
      aria-label="Pantalla de introducción. Pulsa para continuar."
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape' || event.key === ' ') {
          event.preventDefault()
          dismissIntro()
        }
      }}
    >
      <div className="flex h-1/2 w-full items-center justify-center px-6">
        <h1
          id="intro-title"
          className="m-0 text-center font-serif text-5xl font-semibold tracking-tight text-black md:text-7xl"
        >
          {title}
        </h1>
      </div>
      <div className="flex h-1/2 w-full items-center justify-center px-6 pb-6">
        {loadingImg && (
          <img
            src={loadingImg}
            alt=""
            className="max-w-full max-h-full"
            style={{ width: 'auto', height: 'auto' }}
          />
        )}
      </div>
    </div>
  )
}

export default IntroPage
