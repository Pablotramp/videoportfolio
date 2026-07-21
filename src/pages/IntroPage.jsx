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

function IntroPage({ title, onDismiss }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Enter' || event.key === 'Escape') {
        onDismiss()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer"
      onClick={onDismiss}
      aria-label="Pantalla de introducción. Pulsa para continuar."
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDismiss()
      }}
    >
      <h1
        id="intro-title"
        className="m-0 px-6 text-center font-serif text-5xl font-semibold tracking-tight text-stone-100 md:text-7xl"
      >
        {title}
      </h1>
    </div>
  )
}

export default IntroPage
