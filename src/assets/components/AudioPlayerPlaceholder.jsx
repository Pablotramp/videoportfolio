function AudioPlayerPlaceholder({ itemId, audioUrl, audioKey }) {
  return (
    <div
      className="grid gap-3 rounded border border-black/20 bg-white/80 p-4 text-zinc-800"
      aria-label={`Audio: ${itemId ?? audioKey}`}
    >
      <p className="m-0 text-sm font-medium">{itemId ?? audioKey}</p>
      <audio controls preload="none" className="w-full">
        <source src={audioUrl} />
        Tu navegador no soporta reproducción de audio.
      </audio>
      <p className="m-0 truncate text-xs text-zinc-500">{audioKey ?? audioUrl ?? '—'}</p>
    </div>
  )
}

export default AudioPlayerPlaceholder
