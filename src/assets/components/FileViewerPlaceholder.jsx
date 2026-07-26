import { useEffect, useMemo, useState } from 'react'
import { fetchJson, toObjectUrl } from '../../infrastructure/content/r2/r2Utils.js'

const DEFAULT_LINK_TITLE_PREFIX = 'Enlace'
const EMPTY_IMAGE_LABEL = 'Sin imagen'
const SPOTIFY_BRAND_COLOR = '#1ed760'
const SPOTIFY_BADGE_POSITION_PERCENTAGE = '66.67%'

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getFileExtension(fileRef) {
  const sanitized = getTrimmedString(fileRef)
  const lastDot = sanitized.lastIndexOf('.')
  return lastDot === -1 ? '' : sanitized.slice(lastDot + 1).toLowerCase()
}

function getContentFolderKey(fileRef) {
  const sanitized = getTrimmedString(fileRef)
  if (!sanitized) return ''
  const segments = sanitized.split('/')
  const fileName = segments.pop() ?? ''
  const lastDot = fileName.lastIndexOf('.')
  const baseName = lastDot === -1 ? fileName : fileName.slice(0, lastDot)
  return [...segments, baseName].filter(Boolean).join('/')
}

function normalizeLinkItems(rawLinks, r2BaseUrl, contentFolderKey) {
  if (!Array.isArray(rawLinks)) return []

  return rawLinks.flatMap((entry, index) => {
    const href = getTrimmedString(entry?.link)
    if (!href) return []

    const title = getTrimmedString(entry?.title) || `${DEFAULT_LINK_TITLE_PREFIX} ${index + 1}`
    const platform = getTrimmedString(entry?.platform) || getTrimmedString(entry?.plataform)
    const imgName = getTrimmedString(entry?.img)
    const imageUrl =
      imgName && r2BaseUrl && contentFolderKey
        ? toObjectUrl(r2BaseUrl, `${contentFolderKey}/${imgName}`)
        : null

    return [
      {
        id: `${index}-${title}-${imgName || href}`,
        href,
        title,
        platform,
        imageUrl,
      },
    ]
  })
}

function SpotifyBadge() {
  return (
    <span
      className="pointer-events-none absolute z-10 block h-9 w-9 text-current"
      style={{
        top: SPOTIFY_BADGE_POSITION_PERCENTAGE,
        left: SPOTIFY_BADGE_POSITION_PERCENTAGE,
        color: SPOTIFY_BRAND_COLOR,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" fill="none">
        <path
          d="M18.767 10.168a.75.75 0 0 1-1.031.248c-2.791-1.71-7.059-2.097-12.685-1.149a.75.75 0 0 1-.249-1.48c6.024-1.016 10.663-.569 13.717 1.301a.75.75 0 0 1 .248 1.03Z"
          fill="currentColor"
        />
        <path
          d="M20.24 6.89a.938.938 0 0 1-1.288.308C15.757 5.236 10.889 4.66 6.44 5.66a.937.937 0 0 1-.412-1.829c4.942-1.111 10.218-.484 13.903 1.704a.938.938 0 0 1 .309 1.288Z"
          fill="currentColor"
        />
        <path
          d="M17.312 13.818a.625.625 0 0 1-.86.208c-2.397-1.469-5.4-1.802-8.928-.99a.625.625 0 0 1-.28-1.219c3.85-.886 7.157-.51 9.862 1.149a.625.625 0 0 1 .206.852Z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}

function PlatformBadge({ platform }) {
  const normalizedPlatform = getTrimmedString(platform).toLowerCase()
  if (!normalizedPlatform) return null
  if (normalizedPlatform === 'spotify') return <SpotifyBadge />
  return null
}

function LinkCard({ item }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col overflow-visible rounded-2xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950 focus-visible:ring-2 focus-visible:ring-white"
      aria-label={item.title}
    >
      <div className="relative overflow-visible rounded-t-2xl">
        {item.platform && <span className="sr-only">Disponible en {item.platform}</span>}
        <div className="aspect-[4/5] overflow-hidden rounded-t-2xl bg-zinc-200">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-100 px-6 text-center text-sm text-zinc-500">
              {EMPTY_IMAGE_LABEL}
            </div>
          )}
        </div>
        <PlatformBadge platform={item.platform} />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <p className="m-0 text-base font-medium leading-snug text-zinc-900">{item.title}</p>
        {item.platform && (
          <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-500">{item.platform}</p>
        )}
      </div>
    </a>
  )
}

function FileViewerPlaceholder({ fileRef, r2BaseUrl }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const extension = useMemo(() => getFileExtension(fileRef), [fileRef])
  const contentFolderKey = useMemo(() => getContentFolderKey(fileRef), [fileRef])

  useEffect(() => {
    let cancelled = false

    async function loadFileSection() {
      if (!r2BaseUrl || !fileRef) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          setError(new Error('Falta la referencia del archivo o la URL base del contenido.'))
        }
        return
      }

      if (extension !== 'json') {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          setError(
            new Error(
              extension === 'html'
                ? 'Las secciones file basadas en HTML aún no están soportadas.'
                : 'La extensión del archivo de sección no está soportada.',
            ),
          )
        }
        return
      }

      setLoading(true)
      setError(null)

      try {
        const fileUrl = toObjectUrl(r2BaseUrl, fileRef)
        const json = await fetchJson(fileUrl, `sección file ${fileRef}`)
        const normalizedItems = normalizeLinkItems(json?.links, r2BaseUrl, contentFolderKey)

        if (!cancelled) {
          setItems(normalizedItems)
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          setError(loadError)
        }
      }
    }

    loadFileSection()

    return () => {
      cancelled = true
    }
  }, [contentFolderKey, extension, fileRef, r2BaseUrl])

  if (loading) {
    return <p className="m-0 text-sm uppercase tracking-[0.18em] opacity-60">Cargando enlaces…</p>
  }

  if (error) {
    return (
      <div
        className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-6 text-zinc-600"
        aria-label={`Archivo: ${fileRef}`}
      >
        <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">archivo · visor</p>
        <p className="m-0 font-medium text-zinc-800">{fileRef}</p>
        <p className="m-0 text-sm text-red-700">{error.message}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-6 text-zinc-600">
        <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">archivo · enlaces</p>
        <p className="m-0 text-sm">No se encontraron enlaces válidos en esta sección.</p>
      </div>
    )
  }

  return (
    <ul
      className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6 p-0 md:gap-7"
      aria-label="Enlaces disponibles"
    >
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <LinkCard item={item} />
        </li>
      ))}
    </ul>
  )
}

export default FileViewerPlaceholder
