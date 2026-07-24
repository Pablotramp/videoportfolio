import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const HEADER_HEIGHT_PX = 64
const DEFAULT_FOOTER_HEIGHT_PX = 41
const ITEM_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT_PX}px - var(--footer-h, ${DEFAULT_FOOTER_HEIGHT_PX}px))`
const CENTERING_VISIBILITY_THRESHOLD = 0.75
const CENTERING_DELAY_MS = 120

/**
 * ReelItem — single vertical HLS video that plays/pauses via IntersectionObserver.
 *
 * When the video ends the `onEnded` callback is fired so the parent can advance
 * to the next item. When the item leaves the viewport the video is paused and
 * its position is reset to the beginning.
 */
const ReelItem = forwardRef(function ReelItem({ hlsManifestUrl, isMuted, onEnded }, forwardedRef) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const wasIntersectingRef = useRef(false)
  const centerTimeoutRef = useRef(null)

  // Merge forwarded ref (used by ReelFeed for programmatic scrolling) with the
  // local ref needed by the IntersectionObserver.
  function setContainerRef(node) {
    containerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  // Attach HLS source to the video element.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !hlsManifestUrl) return

    let hls = null

    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(hlsManifestUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = hlsManifestUrl
    }

    return () => {
      if (hls) hls.destroy()
    }
  }, [hlsManifestUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  // Play when ≥50 % of the item is visible; pause + reset when it leaves.
  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!wasIntersectingRef.current) {
            // Capture stable values now; do not read mutable refs inside the callback.
            const snapshotContainer = container
            const snapshotRatio = entry.intersectionRatio
            centerTimeoutRef.current = window.setTimeout(() => {
              if (!wasIntersectingRef.current) return
              if (snapshotRatio >= CENTERING_VISIBILITY_THRESHOLD) {
                snapshotContainer.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }, CENTERING_DELAY_MS)
          }
          wasIntersectingRef.current = true
          video.play().catch(() => {
            // Autoplay may be blocked by the browser — silently ignore.
          })
        } else {
          if (centerTimeoutRef.current) {
            clearTimeout(centerTimeoutRef.current)
            centerTimeoutRef.current = null
          }
          wasIntersectingRef.current = false
          video.pause()
          // Reset playback position so the next visit starts from the beginning.
          video.currentTime = 0
        }
      },
      { threshold: 0.5 },
    )

    observer.observe(container)
    return () => {
      if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={setContainerRef}
      className="relative flex w-full items-center justify-center bg-black"
      style={{ height: ITEM_HEIGHT }}
    >
      {/* 9:16 column centred inside the row */}
      <div
        className="relative h-full overflow-hidden"
        style={{ aspectRatio: '9 / 16' }}
      >
        <video
          ref={videoRef}
          playsInline
          onEnded={onEnded}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  )
})

/**
 * ReelFeed — vertical scrolling feed of 9:16 HLS videos.
 *
 * Each video autoplays when it enters the viewport (≥50 % visible) and
 * pauses + resets when it leaves. Videos do NOT loop — when one finishes
 * the feed automatically scrolls to the next item. The user can also scroll
 * manually at any time.
 *
 * @param {{ items: Array<{ id: string, hlsManifestUrl: string }> }} props
 */
export default function ReelFeed({ items }) {
  const [isMuted, setIsMuted] = useState(true)
  const itemRefs = useRef([])
  const soundToggleLabel = isMuted ? 'Activar sonido' : 'Silenciar'

  const handleEnded = useCallback(
    (index) => {
      const nextIndex = index + 1
      if (nextIndex < items.length) {
        itemRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },
    [items.length],
  )

  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div className="relative w-full">
      {items.map((item, index) => (
        <ReelItem
          key={item.id}
          ref={(node) => {
            itemRefs.current[index] = node
          }}
          hlsManifestUrl={item.hlsManifestUrl}
          isMuted={isMuted}
          onEnded={() => handleEnded(index)}
        />
      ))}
      {/* Global mute / unmute button — fixed to the bottom-right of the viewport */}
      <button
        type="button"
        onClick={() => setIsMuted((value) => !value)}
        aria-label={soundToggleLabel}
        className="fixed right-4 bottom-[calc(var(--footer-h,41px)+1rem)] z-50 rounded-full border border-white/30 bg-black/90 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm"
      >
        {soundToggleLabel}
      </button>
    </div>
  )
}
