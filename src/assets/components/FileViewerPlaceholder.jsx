import { useEffect, useMemo, useState } from 'react'
import { fetchJson, toObjectUrl } from '../../infrastructure/content/r2/r2Utils.js'

const DEFAULT_LINK_TITLE_PREFIX = 'Enlace'
const EMPTY_IMAGE_LABEL = 'Sin imagen'
const SPOTIFY_BRAND_COLOR = '#1ed760'
const SPOTIFY_DEEP_LINK_PROMPT = '¿Quieres abrir este enlace en la app de Spotify?'
const SPOTIFY_DEEP_LINK_REGEX = /^spotify:[a-zA-Z]+:[a-zA-Z0-9]+$/
const SPOTIFY_ID_REGEX = /^[a-zA-Z0-9]{22}$/
const SPOTIFY_ALLOWED_RESOURCE_TYPES = new Set([
  'album',
  'artist',
  'episode',
  'playlist',
  'show',
  'track',
])
const CARD_IMAGE_MAX_HEIGHT_CLASS = 'max-h-72'

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

function isSpotifyPlatform(platform) {
  return getTrimmedString(platform).toLowerCase() === 'spotify'
}

function isSpotifyHost(hostname) {
  const normalizedHost = getTrimmedString(hostname).toLowerCase()
  return (
    normalizedHost === 'spotify.com' ||
    normalizedHost === 'open.spotify.com' ||
    normalizedHost.endsWith('.spotify.com')
  )
}

function getSpotifyDeepLink(href) {
  const sanitizedHref = getTrimmedString(href)
  if (!sanitizedHref) return null

  if (sanitizedHref.toLowerCase().startsWith('spotify:')) {
    return SPOTIFY_DEEP_LINK_REGEX.test(sanitizedHref) ? sanitizedHref : null
  }

  try {
    const parsed = new URL(sanitizedHref)
    if (!isSpotifyHost(parsed.hostname)) return null

    const pathSegments = parsed.pathname.split('/').filter(Boolean)
    if (pathSegments.length !== 2) return null

    const [resourceType, spotifyResourceId] = pathSegments
    if (!SPOTIFY_ALLOWED_RESOURCE_TYPES.has(resourceType.toLowerCase())) return null
    if (!SPOTIFY_ID_REGEX.test(spotifyResourceId)) return null

    return `spotify:${resourceType.toLowerCase()}:${spotifyResourceId}`
  } catch {
    return null
  }
}

function SpotifyBadge() {
  return (
    <span
      className="flex w-8 shrink-0 self-stretch items-center text-current"
      style={{
        color: SPOTIFY_BRAND_COLOR,
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" fill="none">
        <circle cx="12" cy="12" r="12" fill="currentColor" />
        <path
          d="M17.696 14.028a.744.744 0 0 1-1.025.246c-2.354-1.441-5.319-1.767-8.81-.969a.744.744 0 1 1-.332-1.451c3.884-.889 7.217-.504 9.917 1.149a.744.744 0 0 1 .25 1.025Z"
          fill="#0a0a0a"
        />
        <path
          d="M19.163 10.745a.932.932 0 0 1-1.282.311c-2.694-1.646-6.799-2.123-9.986-1.162a.931.931 0 0 1-.537-1.783c3.642-1.102 8.168-.567 11.495 1.466a.932.932 0 0 1 .31 1.168Z"
          fill="#0a0a0a"
        />
        <path
          d="M19.284 7.638c-3.089-1.835-8.194-2.004-11.142-1.108a1.117 1.117 0 1 1-.648-2.138c3.39-1.028 9.028-.831 12.93 1.484a1.116 1.116 0 1 1-1.14 1.762Z"
          fill="#0a0a0a"
        />
      </svg>
    </span>
  )
}

function PlatformBadge({ platform }) {
  if (isSpotifyPlatform(platform)) return <SpotifyBadge />
  return null
}

function LinkCard({ item }) {
  function handleClick(event) {
    if (!isSpotifyPlatform(item.platform)) return

    const deepLink = getSpotifyDeepLink(item.href)
    if (!deepLink || typeof window === 'undefined') return

    const shouldOpenSpotifyApp = window.confirm(SPOTIFY_DEEP_LINK_PROMPT)
    if (!shouldOpenSpotifyApp) return

    event.preventDefault()
    window.location.href = deepLink
  }

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col overflow-visible rounded-2xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950 focus-visible:ring-2 focus-visible:ring-white"
      aria-label={item.title}
      onClick={handleClick}
    >
      <div className="relative overflow-visible rounded-t-2xl">
        {item.platform && <span className="sr-only">Disponible en {item.platform}</span>}
        <div className="flex items-center justify-center overflow-hidden rounded-t-2xl bg-zinc-200 p-4">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className={`${CARD_IMAGE_MAX_HEIGHT_CLASS} w-auto max-w-full object-contain transition duration-300 group-hover:scale-105`}
              loading="lazy"
            />
          ) : (
            <div className="flex w-full items-center justify-center rounded-xl bg-zinc-100 px-6 py-14 text-center text-sm text-zinc-500">
              {EMPTY_IMAGE_LABEL}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-stretch gap-3 px-4 py-4">
        <PlatformBadge platform={item.platform} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="m-0 text-base font-medium leading-snug text-zinc-900">{item.title}</p>
          {item.platform && (
            <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-500">{item.platform}</p>
          )}
        </div>
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
