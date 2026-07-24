import { useEffect, useMemo, useRef, useState } from 'react'

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * AudioPlayerPlaceholder — audio card with optional cover image.
 *
 * Behaviour:
 *  - Shows a cover image when one is available (homonymous file in R2).
 *  - The card scales up proportionally while the audio is actually playing.
 *  - Audio controls are only shown for the active (selected) item; they remain
 *    visible while paused, but disappear and the position resets to 0 when
 *    another item is activated.
 *  - Clicking an inactive card calls `onActivate` to make it the active item.
 *
 * @param {object}   props
 * @param {string}   props.itemId      - Human-readable item identifier / title.
 * @param {string}   props.audioUrl    - Full URL of the audio file.
 * @param {string}   [props.itemTitle] - Optional preferred title (manifest/custom).
 * @param {string}   [props.metadataUrl] - Optional JSON URL ({ title }) for subtitle.
 * @param {string}   [props.coverUrl]  - Full URL of the cover image (may be null).
 * @param {boolean}  props.isActive    - Whether this item is currently selected.
 * @param {Function} props.onActivate  - Called when the user activates this item.
 */
function AudioPlayerPlaceholder({
  itemId,
  audioUrl,
  itemTitle = null,
  metadataUrl = null,
  coverUrl,
  isActive,
  onActivate,
}) {
  const audioRef = useRef(null)
  const [metadataTitle, setMetadataTitle] = useState(null)

  // Play/pause and reset based on whether this card is the active one.
  // When activated, auto-play immediately. When deactivated, pause and reset.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (isActive) {
      el.play().catch(() => {
        // Autoplay may be blocked by the browser — silently ignore.
      })
    } else {
      el.pause()
      el.currentTime = 0
    }
  }, [isActive])

  // Track actual playback state from the audio element's own events.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const handlePlay = () => {
      onActivate?.()
    }

    // On pause or end: jump back to the beginning so the next play starts fresh.
    const handleStop = () => {
      el.currentTime = 0
    }

    el.addEventListener('play', handlePlay)
    el.addEventListener('pause', handleStop)
    el.addEventListener('ended', handleStop)

    return () => {
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('pause', handleStop)
      el.removeEventListener('ended', handleStop)
    }
  }, [onActivate])

  useEffect(() => {
    let cancelled = false

    async function loadMetadataTitle() {
      if (!metadataUrl) {
        setMetadataTitle(null)
        return
      }
      try {
        const response = await fetch(metadataUrl)
        if (!response.ok) {
          if (!cancelled) setMetadataTitle(null)
          return
        }
        const json = await response.json()
        const resolvedTitle = getTrimmedString(json?.title) || null
        if (!cancelled) setMetadataTitle(resolvedTitle)
      } catch (error) {
        console.warn('[audio:metadatos] No se pudo cargar el título.', error)
        if (!cancelled) setMetadataTitle(null)
      }
    }

    loadMetadataTitle()

    return () => {
      cancelled = true
    }
  }, [metadataUrl])

  const subtitle = useMemo(() => {
    const preferredTitle = getTrimmedString(itemTitle)
    if (preferredTitle) return preferredTitle
    const metadataValue = getTrimmedString(metadataTitle)
    if (metadataValue) return metadataValue
    return null
  }, [itemTitle, metadataTitle])

  const accessibilityLabel = subtitle
    ? `Audio: ${subtitle}`
    : `Audio: ${getTrimmedString(itemId) || 'pista'}`

  const cardClass = [
    'audio-card grid gap-3 rounded border border-black/20 bg-white p-3 text-zinc-800 sm:p-4',
    isActive ? 'audio-card--active' : 'cursor-pointer',
  ].join(' ')

  return (
    <div
      className={cardClass}
      aria-label={accessibilityLabel}
      onClick={!isActive ? onActivate : undefined}
    >
      {subtitle && <h3 className="m-0 text-center text-sm font-medium leading-snug text-zinc-700">{subtitle}</h3>}

      {coverUrl && (
        <img
          src={coverUrl}
          alt={subtitle ?? 'Carátula de audio'}
          className="audio-card__cover block h-auto w-full rounded object-contain"
          loading="lazy"
        />
      )}

      {/* Audio element — always in the DOM; controls and visibility follow isActive */}
      <audio
        ref={audioRef}
        preload="none"
        controls={isActive}
        className="w-full"
        style={isActive ? undefined : { display: 'none' }}
      >
        <source src={audioUrl} />
        Tu navegador no soporta reproducción de audio.
      </audio>
    </div>
  )
}

export default AudioPlayerPlaceholder
