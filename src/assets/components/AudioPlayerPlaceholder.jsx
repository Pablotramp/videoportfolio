import { useEffect, useRef, useState } from 'react'

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
 * @param {string}   [props.audioKey]  - R2 key (shown as subtitle).
 * @param {string}   [props.coverUrl]  - Full URL of the cover image (may be null).
 * @param {boolean}  props.isActive    - Whether this item is currently selected.
 * @param {Function} props.onActivate  - Called when the user activates this item.
 */
function AudioPlayerPlaceholder({ itemId, audioUrl, audioKey, coverUrl, isActive, onActivate }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

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

  const displayName = itemId ?? audioKey ?? '—'

  return (
    <div
      className={`grid gap-3 rounded border border-black/20 bg-white/80 p-4 text-zinc-800 transition-transform duration-300 ${
        isPlaying ? 'relative z-10 scale-[1.04]' : 'scale-100'
      } ${!isActive ? 'cursor-pointer' : ''}`}
      aria-label={`Audio: ${displayName}`}
      onClick={!isActive ? onActivate : undefined}
    >
      {coverUrl && (
        <img
          src={coverUrl}
          alt={displayName}
          className="w-full rounded object-cover"
          style={{ aspectRatio: '1 / 1' }}
          loading="lazy"
        />
      )}

      <p className="m-0 text-sm font-medium">{displayName}</p>

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

      {isActive && (
        <p className="m-0 truncate text-xs text-zinc-500">{audioKey ?? audioUrl ?? '—'}</p>
      )}
    </div>
  )
}

export default AudioPlayerPlaceholder
