import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import Hls from 'hls.js'

/**
 * HlsPlayer - Reproductor de vídeo HLS integrado en la pseudo-modal.
 *
 * Reproduce con `autoPlay` y `muted` para permitir reproducción automática
 * en secciones de tipo video sin bloquear por políticas del navegador.
 *
 * @param {string} src - URL del manifiesto master.m3u8
 */
export default function HlsPlayer({ src }) {
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
      autoPlay
      muted
      className="w-full max-h-[70vh] rounded-lg bg-black"
    />
  )
}

HlsPlayer.propTypes = {
  src: PropTypes.string.isRequired,
}
