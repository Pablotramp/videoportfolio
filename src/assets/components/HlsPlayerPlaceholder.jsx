/**
 * HlsPlayerPlaceholder
 *
 * Placeholder para el componente video-hls-packager (en desarrollo).
 *
 * Recibe la referencia a la carpeta HLS en R2 y la URL del manifest .m3u8.
 * Cuando video-hls-packager esté disponible como componente, este placeholder
 * deberá sustituirse por la integración real.
 *
 * Props:
 *   itemId         {string}      Identificador único del item (nombre de la carpeta)
 *   hlsFolder      {string}      Ruta de la carpeta HLS en R2 (ej: "Animacion/capitulo-01")
 *   hlsManifestUrl {string|null} URL completa al archivo .m3u8
 *   r2BaseUrl      {string}      URL base del bucket R2 (sin barra final)
 *
 * TODO: reemplazar este placeholder por la integración con video-hls-packager
 *       cuando el componente esté disponible.
 */
function HlsPlayerPlaceholder({ itemId, hlsFolder, hlsManifestUrl, r2BaseUrl }) {
  return (
    <div
      className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-6 text-zinc-600"
      aria-label={`Video HLS: ${itemId ?? hlsFolder}`}
    >
      <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">
        video · hls-packager (pendiente)
      </p>
      <p className="m-0 font-medium text-zinc-800">{itemId ?? hlsFolder}</p>
      <dl className="m-0 grid gap-1 text-xs">
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">hlsFolder</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{hlsFolder ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">manifest</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{hlsManifestUrl ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">r2BaseUrl</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{r2BaseUrl ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

export default HlsPlayerPlaceholder
