import { useEffect, useRef } from 'react'

function AudioPlayerPlaceholder({ itemId, audioUrl, audioKey }) {
  const audioRef = useRef(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    function handlePlay() {
      document.querySelectorAll('audio').forEach((other) => {
        if (other !== el) other.pause()
      })
    }

    el.addEventListener('play', handlePlay)
    return () => el.removeEventListener('play', handlePlay)
  }, [])

  return (
    <div
      className="grid gap-3 rounded border border-black/20 bg-white/80 p-4 text-zinc-800"
      aria-label={`Audio: ${itemId ?? audioKey}`}
    >
      <p className="m-0 text-sm font-medium">{itemId ?? audioKey}</p>
      <audio ref={audioRef} controls preload="none" className="w-full">
        <source src={audioUrl} />
        Tu navegador no soporta reproducción de audio.
      </audio>
      <p className="m-0 truncate text-xs text-zinc-500">{audioKey ?? audioUrl ?? '—'}</p>
    </div>
  )
}

export default AudioPlayerPlaceholder
