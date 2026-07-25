import { useCallback, useEffect, useMemo, useState } from 'react'
import HlsModal from './HlsModal.jsx'
import HlsPlayer from './HlsPlayer.jsx'

const HEADER_HEIGHT_PX = 64
const DEFAULT_FOOTER_HEIGHT_PX = 41
// Height of the inline player = full viewport minus header and footer.
// The section-page--fullheight already reserves the header; the player is
// rendered without an inner padding wrapper so it can fill the entire section.
const INLINE_PLAYER_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT_PX}px - var(--footer-h, ${DEFAULT_FOOTER_HEIGHT_PX}px))`

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function HlsPlayerPlaceholder({
  itemId,
  hlsManifestUrl,
  hlsFrameUrl,
  hlsMetadataUrl,
  itemTitle = null,
  inline = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [metadataTitle, setMetadataTitle] = useState(null)
  const [isMuted, setIsMuted] = useState(true)

  const soundToggleLabel = isMuted ? 'Activar sonido' : 'Silenciar'
  const handleOpen = useCallback(() => setIsOpen(true), [])
  const handleClose = useCallback(() => setIsOpen(false), [])
  const handleKeyDown = useCallback(
    (event) => {
      const isSpace = event.key === ' ' || event.code === 'Space'
      if (event.key === 'Enter' || isSpace) {
        event.preventDefault()
        handleOpen()
      }
    },
    [handleOpen],
  )

  useEffect(() => {
    let cancelled = false

    async function loadMetadataTitle() {
      if (!hlsMetadataUrl) {
        setMetadataTitle(null)
        return
      }

      try {
        const response = await fetch(hlsMetadataUrl)
        if (!response.ok) {
          throw new Error(
            `Metadata fetch failed (${response.status} ${response.statusText})`,
          )
        }
        const json = await response.json()
        const resolvedTitle = getTrimmedString(json?.title) || null
        if (!cancelled) setMetadataTitle(resolvedTitle)
      } catch (error) {
        console.warn('[hls:metadata] No se pudo cargar la metadata de título.', error)
        if (!cancelled) setMetadataTitle(null)
      }
    }

    loadMetadataTitle()

    return () => {
      cancelled = true
    }
  }, [hlsMetadataUrl])

  const title = useMemo(() => {
    const trimmedItemTitle = getTrimmedString(itemTitle)
    if (trimmedItemTitle) return trimmedItemTitle
    const trimmedMetadataTitle = getTrimmedString(metadataTitle)
    if (trimmedMetadataTitle) return trimmedMetadataTitle
    return null
  }, [itemTitle, metadataTitle])

  if (!hlsManifestUrl) {
    return (
      <div className="grid gap-2 rounded border border-red-300 bg-red-50 p-4 text-red-700">
        <p className="m-0 text-sm font-medium">No se encontró el manifiesto HLS.</p>
      </div>
    )
  }

  if (inline) {
    return (
      <div className="relative w-full bg-black" style={{ height: INLINE_PLAYER_HEIGHT }}>
        <p className="sr-only">{isMuted ? 'Vídeo en reproducción automática en silencio.' : 'Vídeo en reproducción automática con sonido.'}</p>
        <HlsPlayer
          src={hlsManifestUrl}
          muted={isMuted}
          autoPlay
          controls={false}
          className="w-full h-full"
          style={{ objectFit: 'contain' }}
        />

        {/* Botón de silencio / sonido — misma posición y estilo que en ReelFeed */}
        <button
          type="button"
          onClick={() => setIsMuted((v) => !v)}
          aria-label={soundToggleLabel}
          className="fixed right-4 bottom-[calc(var(--footer-h,41px)+1rem)] z-50 rounded-full border border-white/30 bg-black/90 p-2.5 text-white backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {isMuted ? (
            /* Altavoz silenciado */
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM11 5.73 8.76 7.97 11 10.2V5.73Z" />
            </svg>
          ) : (
            /* Altavoz activo */
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  return (
    <>
      <article
        onClick={handleOpen}
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl bg-gray-800 shadow-lg transition-transform duration-200 hover:scale-[1.02] hover:shadow-xl"
        role="button"
        tabIndex={0}
        aria-label={title ? `Reproducir: ${title}` : `Reproducir: ${itemId ?? 'video'}`}
        onKeyDown={handleKeyDown}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
          {hlsFrameUrl ? (
            <img
              src={hlsFrameUrl}
              alt={title ?? itemId ?? 'Video'}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="rounded-full bg-black/60 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {title && (
          <div className="p-4">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white">{title}</h3>
          </div>
        )}
      </article>

      <HlsModal
        isOpen={isOpen}
        onClose={handleClose}
        src={hlsManifestUrl}
        titulo={title ?? undefined}
        muted={false}
        autoPlay
      />
    </>
  )
}

export default HlsPlayerPlaceholder
