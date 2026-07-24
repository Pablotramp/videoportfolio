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
  const [isPlaying, setIsPlaying] = useState(false)
  const [metadataTitle, setMetadataTitle] = useState(null)

  // Pause and reset when this item is deactivated (another item was selected).
  // Calling el.pause() fires the 'pause' event → handleStop → setIsPlaying(false),
  // so no direct setState call is needed here.
  useEffect(() => {
    if (!isActive) {
      const el = audioRef.current
      if (el) {
        el.pause()
        el.currentTime = 0
      }
    }
  }, [isActive])

  // Track actual playback state from the audio element's own events.
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const handlePlay = () => {
      onActivate?.()
      setIsPlaying(true)
    }

    // On pause or end: mark as not playing and jump back to the beginning so
    // the next play always starts fresh.
    const handleStop = () => {
      setIsPlaying(false)
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

  return (
    <div
      className={`audio-card grid gap-3 rounded border border-black/20 bg-white p-3 text-zinc-800 transition-transform duration-300 sm:p-4 ${
        isPlaying ? 'relative z-10 scale-[1.04]' : 'scale-100'
      } ${!isActive ? 'cursor-pointer' : ''}`}
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
