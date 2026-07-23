import {
  fetchBucketKeys,
  createKeyResolver,
  fetchJson,
  toObjectUrl,
} from './r2Utils.js'

function getSectionImageCandidates(section, imgName) {
  const folder =
    (typeof section.folder === 'string' && section.folder.trim().replace(/^\/+|\/+$/g, '')) ||
    (typeof section.video === 'string' &&
      !/\.[a-z0-9]+$/i.test(section.video.trim()) &&
      section.video.trim().replace(/^\/+|\/+$/g, '')) ||
    ''

  return [
    imgName,
    `_imagenesSeccionesJson/${imgName}`,
    folder ? `${folder}/${imgName}` : null,
  ].filter((candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index)
}

async function canProbeObject(url) {
  try {
    const headResponse = await fetch(url, { method: 'HEAD' })
    if (headResponse.ok) return true
    if (![405, 501].includes(headResponse.status)) return false
  } catch {
    // Some public buckets/proxies may reject HEAD even when GET works.
  }

  try {
    const getResponse = await fetch(url)
    return getResponse.ok
  } catch {
    return false
  }
}

function logSectionImageResolution(section, imgName, selectedKey, strategy) {
  console.info(
    `[r2:section:image] "${section.section ?? imgName}" — portada "${imgName}" resuelta como "${selectedKey}" (${strategy}).`,
  )
}

async function resolveSectionImageKey(baseUrl, section, resolver, hasListing) {
  const imgName = section.img.trim()
  const candidates = getSectionImageCandidates(section, imgName)

  if (hasListing) {
    for (const candidate of candidates) {
      const resolvedKey = resolver.resolveKey(candidate)
      if (resolvedKey) {
        logSectionImageResolution(section, imgName, resolvedKey, 'listado del bucket')
        return resolvedKey
      }
    }
  } else {
    for (const candidate of candidates) {
      if (await canProbeObject(toObjectUrl(baseUrl, candidate))) {
        logSectionImageResolution(section, imgName, candidate, 'probe directa sin listado')
        return candidate
      }
    }
  }

  const fallbackKey = candidates[0]
  logSectionImageResolution(section, imgName, fallbackKey, 'fallback por convención')
  return fallbackKey
}

/**
 * Resolve section cover images using the sectionImages map from _manifest.json.
 *
 * @param {string} baseUrl
 * @param {object[]} sections  - Raw sections array from _estructura.json
 * @param {Record<string, string>} sectionImages - Map of img filename → bucket key
 * @returns {Record<string, string>}  Map of img filename → full public URL
 */
function resolveImagesFromManifest(baseUrl, sections, sectionImages) {
  const result = {}

  for (const section of sections) {
    if (typeof section.img !== 'string' || !section.img.trim()) continue
    const imgName = section.img.trim()
    const resolvedKey = sectionImages[imgName]

    if (resolvedKey) {
      console.info(
        `[r2:manifest:image] "${section.section ?? imgName}" — portada "${imgName}" resuelta como "${resolvedKey}" (manifest).`,
      )
      result[imgName] = toObjectUrl(baseUrl, resolvedKey)
    } else {
      console.warn(
        `[r2:manifest:image] "${section.section ?? imgName}" — portada "${imgName}" no encontrada en manifest.sectionImages. Usando convención.`,
      )
      result[imgName] = toObjectUrl(baseUrl, imgName)
    }
  }

  return result
}

function createR2ConfigError() {
  return new Error(
    'R2 source requiere VITE_R2_PUBLIC_URL con la URL pública del bucket (ej: https://pub-XXXX.r2.dev).',
  )
}

/**
 * Normalize a public bucket URL, defaulting to HTTPS when the protocol is omitted.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizePublicUrl(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/**
 * Cloudflare R2 portfolio source.
 *
 * Loads _estructura.json as the single source of truth for site structure.
 * When _manifest.json is present it is used to:
 *   1. Resolve section cover images without querying the bucket listing (?list-type=2).
 *   2. Provide pre-classified section content items to useSection so that no
 *      per-section bucket listing is needed at runtime.
 *
 * _manifest.json contract:
 * ─────────────────────────────────────────────────────────────────────────────
 * {
 *   "version": 1,
 *
 *   // Flat list of every object key in the bucket.
 *   // Used to classify section content without any ?list-type=2 call.
 *   "files": [
 *     "Sketches/Capitulo1/master.m3u8",
 *     "Sketches/Capitulo1/1080p_000.ts",
 *     "Sketches/track.m4a",
 *     ...
 *   ],
 *
 *   // Optional: map of cover-image filename → resolved bucket key.
 *   // Skips the ?list-type=2 call for image resolution too.
 *   "sectionImages": {
 *     "<img-filename-from-estructura>": "<resolved-bucket-key>"
 *   },
 *
 *   // Optional: pre-classified content per section.
 *   // When present for a section, overrides both `files` and live listing.
 *   "sections": {
 *     "<entryName>": {
 *       "contentType": "hls" | "audio" | "file" | "unknown",
 *       "items": [
 *         // HLS stream
 *         { "id": "...", "itemType": "hls", "hlsFolder": "...", "hlsManifestKey": "folder/master.m3u8" },
 *         // Audio track
 *         { "id": "...", "itemType": "audio", "audioKey": "folder/track.m4a" },
 *         // File / document
 *         { "id": "...", "itemType": "file", "fileRef": "..." }
 *       ]
 *     }
 *   }
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * If _manifest.json is absent or invalid the source falls back to the legacy
 * bucket-listing approach (?list-type=2) so that existing deployments continue
 * to work without any migration.
 */
export function createR2PortfolioSource(config = {}) {
  return {
    id: 'cloudflare-r2',
    async load() {
      const runtimeEnv = import.meta.env ?? {}
      const publicUrl = config.publicUrl ?? runtimeEnv.VITE_R2_PUBLIC_URL

      if (!publicUrl) {
        throw createR2ConfigError()
      }

      const normalizedPublicUrl = normalizePublicUrl(publicUrl)
      if (!normalizedPublicUrl) {
        throw createR2ConfigError()
      }
      const baseUrl = normalizedPublicUrl.replace(/\/$/, '')

      const estructuraJson = await fetchJson(`${baseUrl}/_estructura.json`, '_estructura.json')

      const sections = Array.isArray(estructuraJson.sections) ? estructuraJson.sections : []

      // ── Try _manifest.json first ────────────────────────────────────────────
      let manifest = null
      try {
        manifest = await fetchJson(`${baseUrl}/_manifest.json`, '_manifest.json')
        console.info('[r2:manifest] _manifest.json cargado correctamente.')
      } catch {
        console.info(
          '[r2:manifest] _manifest.json no disponible. Usando descubrimiento por listado de bucket (?list-type=2).',
        )
      }

      let sectionImagesByName = {}

      if (manifest && manifest.sectionImages && typeof manifest.sectionImages === 'object') {
        // ── Manifest path: resolve images without bucket listing ──────────────
        sectionImagesByName = resolveImagesFromManifest(baseUrl, sections, manifest.sectionImages)
      } else {
        // ── Legacy path: bucket listing (?list-type=2) ────────────────────────
        let bucketKeys = []

        try {
          bucketKeys = await fetchBucketKeys(baseUrl)
        } catch (error) {
          console.warn(
            '[r2:listing:warning] No se pudo listar el bucket. Se usará resolución directa por nombre.',
            error,
          )
        }

        const resolver = createKeyResolver(bucketKeys)
        const hasListing = bucketKeys.length > 0

        for (const section of sections) {
          if (typeof section.img === 'string' && section.img.trim()) {
            const imgName = section.img.trim()
            const resolvedImageKey = await resolveSectionImageKey(baseUrl, section, resolver, hasListing)
            sectionImagesByName[imgName] = toObjectUrl(baseUrl, resolvedImageKey)
          }
        }
      }

      return {
        estructuraJson,
        sectionImagesByName,
        footer: null,
        r2BaseUrl: baseUrl,
        manifestSections:
          manifest && manifest.sections && typeof manifest.sections === 'object'
            ? manifest.sections
            : null,
        manifestFiles:
          manifest && Array.isArray(manifest.files) ? manifest.files : null,
      }
    },
  }
}
