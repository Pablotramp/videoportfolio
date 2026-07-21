/**
 * AudioPlayerPlaceholder
 *
 * Placeholder para el componente de audio (en desarrollo).
 *
 * Recibe la URL directa al archivo de audio y su clave R2.
 * Cuando el componente de audio esté disponible, este placeholder
 * deberá sustituirse por la integración real.
 *
 * Props:
 *   itemId   {string} Identificador único del item (nombre base del archivo)
 *   audioUrl {string} URL directa al archivo de audio (ej: .m4a)
 *   audioKey {string} Clave R2 del archivo (ej: "FiccionSonora/ep01.m4a")
 *
 * TODO: reemplazar este placeholder por la integración con el componente
 *       de audio cuando esté disponible.
 */
function AudioPlayerPlaceholder({ itemId, audioUrl, audioKey }) {
  return (
    <div
      className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-5 text-zinc-600"
      aria-label={`Audio: ${itemId ?? audioKey}`}
    >
      <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">
        audio · componente (pendiente)
      </p>
      <p className="m-0 font-medium text-zinc-800">{itemId ?? audioKey}</p>
      <dl className="m-0 grid gap-1 text-xs">
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">audioKey</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{audioKey ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">audioUrl</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{audioUrl ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

export default AudioPlayerPlaceholder
