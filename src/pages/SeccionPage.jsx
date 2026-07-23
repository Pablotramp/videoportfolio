import { Link, useParams } from 'react-router-dom'
import { useSection } from '../application/section/useSection.js'
import HlsPlayerPlaceholder from '../assets/components/HlsPlayerPlaceholder.jsx'
import AudioPlayerPlaceholder from '../assets/components/AudioPlayerPlaceholder.jsx'
import FileViewerPlaceholder from '../assets/components/FileViewerPlaceholder.jsx'
import ReelFeed from '../assets/components/ReelFeed.jsx'

const DEFAULT_SECTION_BACKGROUND = '#f8f7f4'
const MAX_DEBUG_ITEMS = 25

function isDarkHexColor(color) {
  if (typeof color !== 'string') return false
  const normalized = color.trim().replace('#', '')
  const isValid = /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)
  if (!isValid) return false
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized
  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance < 0.52
}

function renderDebugList(items, emptyLabel) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="m-0 text-xs opacity-70">{emptyLabel}</p>
  }

  const visibleItems = items.slice(0, MAX_DEBUG_ITEMS)
  const hiddenCount = items.length - visibleItems.length

  return (
    <div className="grid gap-2">
      <ul className="m-0 list-disc pl-5 text-xs opacity-80">
        {visibleItems.map((item) => (
          <li key={item} className="break-all font-mono">
            {item}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="m-0 text-xs opacity-70">… y {hiddenCount} elemento(s) más.</p>
      )}
    </div>
  )
}

/**
 * SeccionPage — Dispatcher intermediario de contenido de sección.
 *
 * Lee el tipo de sección desde _estructura.json (vía useSection) y despacha
 * los items al componente de contenido correspondiente:
 *
 *   type 'video'  + items HLS  → HlsPlayerPlaceholder inline (reproductor real directo)
 *   type 'folder' + items HLS  → HlsPlayerPlaceholder (cards reales + modal)
 *   type 'folder' + items audio→ AudioPlayerPlaceholder (reproductor real nativo)
 *   type 'reel'   + items HLS  → ReelFeed (feed vertical estilo Instagram Reels)
 *   type 'file'                → FileViewerPlaceholder
 */
function SeccionPage({ sections, r2BaseUrl, sectionManifest, manifestFiles }) {
  const { slug } = useParams()
  const section = sections.find((entry) => entry.slug === slug)

  const { contentType, items, diagnostics, loading, error } = useSection(section ?? null, r2BaseUrl, sectionManifest ?? null, manifestFiles ?? null)

  if (!section) {
    return (
      <section className="grid gap-4 border border-black/10 bg-white px-8 py-10">
        <p className="m-0 text-xs uppercase tracking-[0.22em] text-zinc-500">404</p>
        <h1 className="m-0 font-serif text-4xl font-semibold">Sección no encontrada</h1>
        <p className="m-0 text-zinc-700">
          Revisa el slug o vuelve al inicio para seguir configurando la plantilla.
        </p>
        <Link
          className="inline-flex w-fit items-center justify-center border border-black px-4 py-2 text-sm uppercase tracking-[0.1em] no-underline transition hover:bg-black hover:text-white"
          to="/"
        >
          Volver al inicio
        </Link>
      </section>
    )
  }

  const sectionSurfaceColor = section.backgroundColor ?? DEFAULT_SECTION_BACKGROUND
  const sectionTextClass = isDarkHexColor(sectionSurfaceColor) ? 'text-stone-100' : 'text-zinc-950'

  // Video-type sections with HLS content use a full-height player layout
  // (no inner padding container) to maximise visible area.
  const isFullHeightVideo =
    !loading && !error && section.type === 'video' && contentType === 'hls' && items.length > 0

  // Reel-type sections use a full-width vertical feed (no padding wrapper).
  const isReelFeed =
    !loading && !error && section.type === 'reel' && contentType === 'hls' && items.length > 0

  return (
    <section
      className={`section-page--fullheight w-full ${sectionTextClass}`}
      style={{ backgroundColor: sectionSurfaceColor }}
    >
      {/* Full-height inline video player — no padding wrapper */}
      {isFullHeightVideo && (
        <HlsPlayerPlaceholder
          itemId={items[0].id}
          hlsManifestUrl={items[0].hlsManifestUrl}
          hlsFrameUrl={items[0].hlsFrameUrl}
          hlsMetadataUrl={items[0].hlsMetadataUrl}
          itemTitle={items[0].title ?? null}
          inline
        />
      )}

      {/* Reel-type sections: vertical scrolling feed — no padding wrapper */}
      {isReelFeed && <ReelFeed items={items} />}

      {/* All other states / content types use a padded container that also
          provides clearance so content never slides under the fixed footer. */}
      {!isFullHeightVideo && !isReelFeed && (
        <div
          className="mx-auto grid w-full max-w-[1248px] gap-6 px-6 pt-8 md:pt-10"
          style={{ paddingBottom: 'calc(var(--footer-h, 41px) + 1.5rem)' }}
        >
          {loading && (
            <p className="text-sm uppercase tracking-[0.18em] opacity-60">
              Escaneando contenido…
            </p>
          )}

          {!loading && error && (
            <p className="text-sm text-red-600">{error.message}</p>
          )}

          {/* File-type sections → FileViewerPlaceholder */}
          {!loading && !error && section.type === 'file' && (
            <FileViewerPlaceholder fileRef={section.entryName} r2BaseUrl={r2BaseUrl} />
          )}

          {/* HLS items in 'folder' sections: render cards */}
          {!loading &&
            !error &&
            section.type === 'folder' &&
            contentType === 'hls' &&
            items.length > 0 && (
            <ul className="m-0 grid list-none gap-6 p-0">
              {items.map((item) => (
                <li key={item.id}>
                  <HlsPlayerPlaceholder
                    itemId={item.id}
                    hlsManifestUrl={item.hlsManifestUrl}
                    hlsFrameUrl={item.hlsFrameUrl}
                    hlsMetadataUrl={item.hlsMetadataUrl}
                    itemTitle={item.title ?? null}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Audio items (type 'folder' with audio files) */}
          {!loading && !error && contentType === 'audio' && items.length > 0 && (
            <ul className="m-0 grid list-none gap-4 p-0">
              {items.map((item) => (
                <li key={item.id}>
                  <AudioPlayerPlaceholder
                    itemId={item.id}
                    audioUrl={item.audioUrl}
                    audioKey={item.audioKey}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Empty or unrecognised content */}
          {!loading && !error && section.type !== 'file' && items.length === 0 && (
            <div className="grid gap-4 rounded border border-black/10 bg-white/70 p-4 text-zinc-900">
              <p className="m-0 text-sm opacity-70">
                {contentType === 'unknown'
                  ? 'Tipo de contenido no reconocido en la carpeta R2.'
                  : 'No se encontró contenido en esta sección.'}
              </p>

              {diagnostics && (
                <dl className="m-0 grid gap-3 text-xs">
                  <div className="grid gap-1">
                    <dt className="font-mono uppercase tracking-[0.12em] opacity-60">
                      Prefijo buscado
                    </dt>
                    <dd className="m-0 break-all font-mono">{diagnostics.folderPrefix ?? '—'}</dd>
                  </div>

                  <div className="grid gap-1">
                    <dt className="font-mono uppercase tracking-[0.12em] opacity-60">
                      URL de búsqueda
                    </dt>
                    <dd className="m-0 break-all font-mono">
                      {diagnostics.listingUrl ? (
                        <a
                          className="underline"
                          href={diagnostics.listingUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {diagnostics.listingUrl}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>

                  <div className="grid gap-1">
                    <dt className="font-mono uppercase tracking-[0.12em] opacity-60">
                      Carpetas / archivos encontrados
                    </dt>
                    <dd className="m-0">
                      {renderDebugList(
                        diagnostics.foundEntries,
                        'El listado de R2 no devolvió carpetas ni archivos para ese prefijo.',
                      )}
                    </dd>
                  </div>

                  <div className="grid gap-1">
                    <dt className="font-mono uppercase tracking-[0.12em] opacity-60">
                      Claves devueltas por R2
                    </dt>
                    <dd className="m-0">
                      {renderDebugList(
                        diagnostics.foundKeys,
                        'R2 no devolvió ninguna clave para esa búsqueda.',
                      )}
                    </dd>
                  </div>

                  {diagnostics.errorMessage && (
                    <div className="grid gap-1">
                      <dt className="font-mono uppercase tracking-[0.12em] text-red-700">
                        Error del listado
                      </dt>
                      <dd className="m-0 break-all font-mono text-red-700">
                        {diagnostics.errorMessage}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default SeccionPage
