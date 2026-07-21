/**
 * FileViewerPlaceholder
 *
 * Placeholder para el visor de archivos (en desarrollo).
 *
 * Recibe la referencia al archivo de la sección (campo "file" de _estructura.json)
 * y la URL base del bucket R2.
 * Cuando el componente de visor de archivos esté disponible, este placeholder
 * deberá sustituirse por la integración real.
 *
 * Props:
 *   fileRef   {string} Nombre/ruta del archivo referenciado (del campo "file" en _estructura.json)
 *   r2BaseUrl {string} URL base del bucket R2 (sin barra final)
 *
 * TODO: reemplazar este placeholder por la integración con el componente
 *       de visor de archivos cuando esté disponible.
 */
function FileViewerPlaceholder({ fileRef, r2BaseUrl }) {
  return (
    <div
      className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-6 text-zinc-600"
      aria-label={`Archivo: ${fileRef}`}
    >
      <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">
        archivo · visor (pendiente)
      </p>
      <p className="m-0 font-medium text-zinc-800">{fileRef}</p>
      <dl className="m-0 grid gap-1 text-xs">
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">fileRef</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{fileRef ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-mono text-zinc-400">r2BaseUrl</dt>
          <dd className="m-0 truncate font-mono text-zinc-600">{r2BaseUrl ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

export default FileViewerPlaceholder
