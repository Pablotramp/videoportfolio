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
import { useEffect } from 'react'

function IntroPage({ title, loadingImg, onDismiss }) {
  useEffect(() => {
    const dismissTimeoutId = window.setTimeout(() => {
      onDismiss()
    }, 5000)

    function handleKey(event) {
      if (event.key === 'Enter') {
        onDismiss()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(dismissTimeoutId)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white text-black cursor-pointer overflow-hidden"
      onClick={onDismiss}
      aria-label="Pantalla de introducción. Pulsa para continuar."
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDismiss()
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
