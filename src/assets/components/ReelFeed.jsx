import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const HEADER_HEIGHT_PX = 64
const DEFAULT_FOOTER_HEIGHT_PX = 41
const ITEM_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT_PX}px - var(--footer-h, ${DEFAULT_FOOTER_HEIGHT_PX}px))`
const CENTERING_VISIBILITY_THRESHOLD = 0.75
const CENTERING_DELAY_MS = 120

/**
 * ReelItem — single vertical HLS video that plays/pauses via IntersectionObserver.
 */
function ReelItem({ hlsManifestUrl, isMuted }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const wasIntersectingRef = useRef(false)
  const centerTimeoutRef = useRef(null)

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

  // Play when ≥50 % of the item is visible; pause otherwise.
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
      ref={containerRef}
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
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  )
}

/**
 * ReelFeed — vertical scrolling feed of 9:16 HLS videos.
 *
 * Each video autoplays when it enters the viewport (≥50 % visible) and
 * pauses when it leaves. Scroll is smooth and natural — no snap points.
 *
 * @param {{ items: Array<{ id: string, hlsManifestUrl: string }> }} props
 */
export default function ReelFeed({ items }) {
  const [isMuted, setIsMuted] = useState(true)
  const soundToggleLabel = isMuted ? 'Activar sonido' : 'Silenciar'

  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div className="relative w-full">
      {items.map((item) => (
        <ReelItem key={item.id} hlsManifestUrl={item.hlsManifestUrl} isMuted={isMuted} />
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
