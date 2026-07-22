import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import HLSPlayer from './HlsPlayer.jsx'

/**
 * HLSModal - Pseudo-modal universal que muestra el reproductor HLS.
 *
 * No usa window.open ni dialog nativo: es una capa flotante compatible
 * con todos los navegadores, sin popup-killers ni deprecaciones.
 *
 * @param {boolean}  isOpen   - Controla si la modal está visible
 * @param {Function} onClose  - Callback para cerrar la modal
 * @param {string}   src      - URL del manifiesto master.m3u8
 * @param {string}   [titulo] - Título opcional del vídeo
 */
export default function HLSModal({ isOpen, onClose, src, titulo }) {
  const overlayRef = useRef(null)

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Bloquear scroll del body mientras la modal está abierta
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo || 'Reproductor de vídeo'}
    >
      <div className="relative w-full max-w-4xl rounded-xl bg-gray-900 shadow-2xl overflow-hidden">
        {/* Barra superior */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          {titulo && (
            <h2 className="text-white font-semibold text-lg truncate pr-4">
              {titulo}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Cerrar reproductor"
          >
            ✕
          </button>
        </div>

        {/* Reproductor */}
        <div className="p-4">
          <HLSPlayer src={src} />
        </div>
      </div>
    </div>
  )
}

HLSModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  src: PropTypes.string,
  titulo: PropTypes.string,
}
