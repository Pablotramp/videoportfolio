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
import { useCallback, useEffect, useMemo, useRef } from 'react'

const DEFAULT_INTRO_DISMISS_TIMEOUT_MS = 5000

function IntroPage({ title, loadingImg, chargeTime, textColor, backgroundColor, isExiting = false, onDismiss }) {
  const containerRef = useRef(null)
  const onDismissRef = useRef(onDismiss)
  const dismissedRef = useRef(false)
  const dismissTimeoutIdRef = useRef(null)

  const dismissTimeoutMs = useMemo(
    () =>
      Number.isFinite(chargeTime)
        ? Math.max(0, chargeTime * 1000)
        : DEFAULT_INTRO_DISMISS_TIMEOUT_MS,
    [chargeTime],
  )

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
    }, dismissTimeoutMs)
    return () => {
      if (dismissTimeoutIdRef.current !== null) {
        window.clearTimeout(dismissTimeoutIdRef.current)
        dismissTimeoutIdRef.current = null
      }
    }
  }, [dismissIntro, dismissTimeoutMs])

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col cursor-pointer overflow-hidden transition-opacity duration-500 ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={dismissIntro}
      aria-label="Pantalla de introducción. Pulsa para continuar."
      role="button"
      tabIndex={0}
      style={{
        backgroundColor,
        color: textColor,
      }}
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
          className="m-0 text-center font-serif text-5xl font-semibold tracking-tight md:text-7xl"
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
