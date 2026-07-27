import { useEffect, useMemo, useState } from 'react'

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
const ALLOWED_SPOT_LINK_PROTOCOLS = new Set(['https:', 'http:', 'spotify:'])

function sanitizeSpotHref(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null

  if (trimmed.toLowerCase().startsWith('spotify:')) {
    return SPOTIFY_DEEP_LINK_REGEX.test(trimmed) ? trimmed : null
  }

  try {
    const parsed = new URL(trimmed)
    return ALLOWED_SPOT_LINK_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

function getSpotifyDeepLink(href) {
  if (!href) return null
  if (href.toLowerCase().startsWith('spotify:')) return href

  try {
    const parsed = new URL(href)
    const hostname = parsed.hostname.trim().toLowerCase()
    const isSpotifyHost =
      hostname === 'spotify.com' ||
      hostname === 'open.spotify.com' ||
      hostname.endsWith('.spotify.com')
    if (!isSpotifyHost) return null

    const [resourceType, spotifyResourceId] = parsed.pathname.split('/').filter(Boolean)
    if (!resourceType || !spotifyResourceId) return null
    if (!SPOTIFY_ALLOWED_RESOURCE_TYPES.has(resourceType.toLowerCase())) return null
    if (!SPOTIFY_ID_REGEX.test(spotifyResourceId)) return null
    return `spotify:${resourceType.toLowerCase()}:${spotifyResourceId}`
  } catch {
    return null
  }
}

export default function SpotLink({ spot, onReadyChange }) {
  const [svgDataUrl, setSvgDataUrl] = useState(null)
  const [svgSourceUrl, setSvgSourceUrl] = useState(null)

  const spotHref = useMemo(() => sanitizeSpotHref(spot?.link), [spot?.link])
  const spotifyDeepLink = useMemo(() => getSpotifyDeepLink(spotHref), [spotHref])
  const spotImgUrl = typeof spot?.imgUrl === 'string' ? spot.imgUrl.trim() : ''
  const isReady = Boolean(spotImgUrl && svgDataUrl && svgSourceUrl === spotImgUrl)

  useEffect(() => {
    onReadyChange?.(isReady)
  }, [isReady, onReadyChange])

  useEffect(() => {
    if (!spotImgUrl) return undefined

    const controller = new AbortController()

    async function loadSpotSvg() {
      try {
        const response = await fetch(spotImgUrl, { signal: controller.signal })
        if (!response.ok) throw new Error('No se pudo cargar el SVG del spot.')
        const text = (await response.text()).trim()
        if (!/<svg[\s>]/i.test(text)) throw new Error('El TXT del spot no contiene un SVG válido.')
        setSvgDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`)
        setSvgSourceUrl(spotImgUrl)
      } catch (error) {
        if (error?.name === 'AbortError') return
        setSvgDataUrl(null)
        setSvgSourceUrl(null)
      }
    }

    loadSpotSvg()

    return () => controller.abort()
  }, [spotImgUrl])

  if (!isReady) return null

  const image = (
    <img
      src={svgDataUrl}
      alt={spot?.platform ? `Anuncio ${spot.platform}` : 'Anuncio'}
      className="h-auto w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
      style={{
        maxHeight: 'var(--spot-max-h, 7rem)',
        maxWidth: 'min(100%, var(--spot-max-w, 20rem))',
      }}
      loading="lazy"
    />
  )

  return (
    <div className="flex w-full items-end justify-center md:justify-end">
      {spotHref ? (
        <a
          href={spotHref}
          target={spotHref.startsWith('http') ? '_blank' : undefined}
          rel={spotHref.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="inline-flex"
          aria-label={spot?.platform ? `Abrir ${spot.platform}` : 'Abrir anuncio'}
          onClick={(event) => {
            if (!spotifyDeepLink || spotifyDeepLink === spotHref || typeof window === 'undefined') return
            event.preventDefault()
            window.location.href = spotifyDeepLink
          }}
        >
          {image}
        </a>
      ) : (
        image
      )}
    </div>
  )
}
