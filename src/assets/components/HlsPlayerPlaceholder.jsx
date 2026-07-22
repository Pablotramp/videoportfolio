import { useCallback, useState } from 'react'
import HlsModal from './HlsModal.jsx'
import HlsPlayer from './HlsPlayer.jsx'

function HlsPlayerPlaceholder({ itemId, hlsManifestUrl, hlsFrameUrl, inline = false }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => setIsOpen(true), [])
  const handleClose = useCallback(() => setIsOpen(false), [])

  const title = itemId ?? 'Video'

  if (!hlsManifestUrl) {
    return (
      <div className="grid gap-2 rounded border border-red-300 bg-red-50 p-4 text-red-700">
        <p className="m-0 text-sm font-medium">No se encontró el manifiesto HLS.</p>
      </div>
    )
  }

  if (inline) {
    return (
      <div className="grid gap-3 rounded border border-black/20 bg-black/20 p-4">
        <p className="m-0 text-sm font-medium">{title}</p>
        <HlsPlayer src={hlsManifestUrl} />
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
        aria-label={`Reproducir: ${title}`}
        onKeyDown={(event) => {
          const isSpace = event.key === ' ' || event.code === 'Space'
          if (event.key === 'Enter' || isSpace) {
            event.preventDefault()
            handleOpen()
          }
        }}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
          {hlsFrameUrl ? (
            <img
              src={hlsFrameUrl}
              alt={title}
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

        <div className="p-4">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white">{title}</h3>
        </div>
      </article>

      <HlsModal isOpen={isOpen} onClose={handleClose} src={hlsManifestUrl} titulo={title} />
    </>
  )
}

export default HlsPlayerPlaceholder
