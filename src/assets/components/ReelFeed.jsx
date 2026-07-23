import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

const HEADER_HEIGHT_PX = 64
const DEFAULT_FOOTER_HEIGHT_PX = 41
const ITEM_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT_PX}px - var(--footer-h, ${DEFAULT_FOOTER_HEIGHT_PX}px))`

/**
 * ReelItem — single vertical HLS video that plays/pauses via IntersectionObserver.
 */
function ReelItem({ hlsManifestUrl }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)

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

  // Play when ≥50 % of the item is visible; pause otherwise.
  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay may be blocked by the browser — silently ignore.
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.5 },
    )

    observer.observe(container)
    return () => observer.disconnect()
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
          muted
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
  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div className="w-full">
      {items.map((item) => (
        <ReelItem key={item.id} hlsManifestUrl={item.hlsManifestUrl} />
      ))}
    </div>
  )
}
