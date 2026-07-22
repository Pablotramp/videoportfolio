import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

/**
 * HlsPlayer - Reproductor de vídeo HLS integrado.
 *
 * @param {string} src - URL del manifiesto master.m3u8
 */
export default function HlsPlayer({
  src,
  muted = true,
  autoPlay = true,
  className = 'w-full max-h-[70vh] rounded-lg bg-black',
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let hls = null

    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari soporta HLS nativamente
      video.src = src
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      controls
      autoPlay={autoPlay}
      muted={muted}
      className={className}
    />
  )
}
