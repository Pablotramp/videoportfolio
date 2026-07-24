import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

/**
 * HlsPlayer - Reproductor de vídeo HLS integrado.
 *
 * @param {string} src - URL del manifiesto master.m3u8
 * @param {boolean} [controls=true] - Mostrar controles nativos del navegador
 */
export default function HlsPlayer({
  src,
  muted = true,
  autoPlay = true,
  controls = true,
  className = 'w-full max-h-[70vh] rounded-lg bg-black',
  style = undefined,
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

  // Sync muted state imperatively — React no actualiza el atributo muted del DOM después del montaje
  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted
  }, [muted])

  return (
    <video
      ref={videoRef}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      className={className}
      style={style}
    />
  )
}
