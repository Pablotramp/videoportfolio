import {
  fetchBucketKeys,
  createKeyResolver,
  fetchJson,
  toObjectUrl,
} from './r2Utils.js'

const COVER_IMAGE_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'avif']

function getSectionImageCandidates(_section, imgName) {
  const trimmed = typeof imgName === 'string' ? imgName.trim() : ''
  if (!trimmed) return []

  const dotIndex = trimmed.lastIndexOf('.')
  const hasExtension = dotIndex > 0
  const baseName = hasExtension ? trimmed.slice(0, dotIndex) : trimmed
  const extension = hasExtension ? trimmed.slice(dotIndex + 1) : ''
  const candidates = new Set(hasExtension ? [trimmed] : [])

  const baseVariants = [
    baseName,
    baseName.toLowerCase(),
    baseName.charAt(0).toUpperCase() + baseName.slice(1),
  ].filter(Boolean)

  const extensionVariants = hasExtension
    ? [extension, extension.toLowerCase(), extension.toUpperCase()]
    : COVER_IMAGE_EXTENSIONS

  for (const baseVariant of baseVariants) {
    if (!baseVariant) continue
    if (hasExtension) {
      for (const extensionVariant of extensionVariants) {
        if (!extensionVariant) continue
        candidates.add(`${baseVariant}.${extensionVariant}`)
      }
    } else {
      for (const fallbackExtension of COVER_IMAGE_EXTENSIONS) {
        candidates.add(`${baseVariant}.${fallbackExtension}`)
      }
    }
  }

  return [...candidates]
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

function mergeManifestImageKeys(sectionImages, manifestFiles) {
  const safeSectionImages =
    sectionImages && typeof sectionImages === 'object' ? sectionImages : {}
  const mergedKeys = []
  const seenKeys = new Set()

  function addKey(value) {
    if (typeof value !== 'string') return
    const normalized = value.trim()
    if (!normalized || seenKeys.has(normalized)) return
    seenKeys.add(normalized)
    mergedKeys.push(normalized)
  }

  for (const value of Object.values(safeSectionImages)) addKey(value)
  for (const value of manifestFiles) addKey(value)

  return mergedKeys
}

function getMappedSectionImageKey(sectionImages, imgName) {
  if (!sectionImages || typeof sectionImages !== 'object') return ''
  const mappedValue = sectionImages[imgName]
  return typeof mappedValue === 'string' ? mappedValue.trim() : ''
}

/**
 * Resolve section cover images using _manifest.json.
 *
 * @param {string} baseUrl
 * @param {object[]} sections  - Raw sections array from _estructura.json
 * @param {Record<string, string>} sectionImages - Map of img filename → bucket key
 * @param {string[]} manifestFiles - Flat key list from manifest.files
 *   (bucket object keys, including root-level filenames and prefixed paths).
 * @returns {Record<string, string>}  Map of img filename → full public URL
 */
function resolveImagesFromManifest(baseUrl, sections, sectionImages, manifestFiles = []) {
  const result = {}
  const manifestKeys = mergeManifestImageKeys(sectionImages, manifestFiles)
  let manifestResolver = null

  for (const section of sections) {
    if (typeof section.img !== 'string' || !section.img.trim()) continue
    const imgName = section.img.trim()
    const sectionCandidates = getSectionImageCandidates(section, imgName)
    const directMappedKey = getMappedSectionImageKey(sectionImages, imgName)
    if (!manifestResolver && manifestKeys.length > 0) {
      manifestResolver = createKeyResolver(manifestKeys)
    }
    let resolvedKey = null

    if (directMappedKey) {
      resolvedKey = manifestResolver
        ? manifestResolver.resolveKey(directMappedKey)
        : directMappedKey
    }

    if (!resolvedKey && manifestResolver) {
      resolvedKey = sectionCandidates
        .map((candidate) => manifestResolver.resolveKey(candidate))
        .find(Boolean)
    }

    if (resolvedKey) {
      console.info(
        `[r2:manifest:image] "${section.section ?? imgName}" — portada "${imgName}" resuelta como "${resolvedKey}" (manifest).`,
      )
      result[imgName] = toObjectUrl(baseUrl, resolvedKey)
    } else {
      console.warn(
        `[r2:manifest:image] "${section.section ?? imgName}" — portada "${imgName}" no encontrada en manifest. Usando convención.`,
      )
      const rawFallbackCandidate =
        typeof sectionCandidates[0] === 'string' ? sectionCandidates[0].trim() : ''
      const fallbackCandidate = rawFallbackCandidate || imgName
      result[imgName] = toObjectUrl(baseUrl, fallbackCandidate)
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
 * Normalize hostnames for comparisons, ignoring a leading www. prefix.
 *
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname = '') {
  return hostname.trim().toLowerCase().replace(/^www\./, '')
}

/**
 * Decide whether a fetch failure is worth retrying against an equivalent URL.
 * Network-level failures (including the browser's generic "Failed to fetch")
 * are treated as recoverable because they may come from a www/apex mismatch.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isRecoverableFetchError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return error instanceof TypeError || /failed to fetch|network\s*error/i.test(message)
}

/**
 * Build candidate base URLs for content fetches, adding the current origin when
 * it matches the configured hostname except for a leading www. prefix.
 *
 * @param {string} baseUrl
 * @returns {string[]}
 */
function getBaseUrlCandidates(baseUrl) {
  const candidates = [baseUrl]

  if (typeof window === 'undefined' || !window.location?.origin) {
    return candidates
  }

  try {
    const configuredUrl = new URL(baseUrl)
    const currentUrl = new URL(window.location.origin)
    const sameHost = normalizeHostname(configuredUrl.hostname) === normalizeHostname(currentUrl.hostname)

    if (!sameHost) {
      return candidates
    }

    const configuredPath = configuredUrl.pathname.replace(/\/$/, '')
    const fallbackBaseUrl = `${currentUrl.origin}${configuredPath}`.replace(/\/$/, '')

    if (!candidates.includes(fallbackBaseUrl)) {
      candidates.push(fallbackBaseUrl)
    }
  } catch {
    return candidates
  }

  return candidates
}

/**
 * Create an actionable error for required JSON files after every candidate URL
 * has failed, including the attempted URLs and the original fetch detail.
 *
 * @param {string} label
 * @param {string[]} attemptedUrls
 * @param {unknown} originalError
 * @returns {Error}
 */
function createContentFetchError(label, attemptedUrls, originalError) {
  const attempts = attemptedUrls.map((attemptedUrl) => `  - ${attemptedUrl}`).join('\n')
  const checks = [
    '  - que el dominio apunte al bucket público del contenido',
    '  - que responda correctamente por HTTPS',
    '  - que permita peticiones desde el navegador',
  ].join('\n')
  const detail =
    originalError instanceof Error && originalError.message
      ? ` Detalle original: ${originalError.message}`
      : ''

  return new Error([
    `No se pudo acceder a ${label} en ninguna de estas URLs:`,
    attempts,
    'Verifica lo siguiente:',
    checks,
    `Detalle adicional:${detail || ' No hubo más información disponible.'}`,
  ].join('\n'))
}

/**
 * Fetch a required JSON file by trying each equivalent base URL candidate until
 * one succeeds. Throws an actionable error when every candidate fails.
 *
 * @param {string} baseUrl
 * @param {string} fileName
 * @returns {Promise<{ data: object, resolvedBaseUrl: string }>}
 */
async function fetchRequiredJsonWithFallback(baseUrl, fileName) {
  const candidateBaseUrls = getBaseUrlCandidates(baseUrl)
  let lastError = null

  for (const candidateBaseUrl of candidateBaseUrls) {
    try {
      return {
        data: await fetchJson(`${candidateBaseUrl}/${fileName}`, fileName),
        resolvedBaseUrl: candidateBaseUrl,
      }
    } catch (error) {
      lastError = error
      if (!isRecoverableFetchError(error)) {
        throw error
      }
    }
  }

  throw createContentFetchError(
    fileName,
    candidateBaseUrls.map((candidateBaseUrl) => `${candidateBaseUrl}/${fileName}`),
    lastError,
  )
}

/**
 * Fetch an optional JSON file by trying each equivalent base URL candidate.
 * Returns null when every candidate fails with a recoverable network error.
 *
 * @param {string} baseUrl
 * @param {string} fileName
 * @returns {Promise<{ data: object, resolvedBaseUrl: string } | null>}
 */
async function fetchOptionalJsonWithFallback(baseUrl, fileName) {
  const candidateBaseUrls = getBaseUrlCandidates(baseUrl)

  for (const candidateBaseUrl of candidateBaseUrls) {
    try {
      return {
        data: await fetchJson(`${candidateBaseUrl}/${fileName}`, fileName),
        resolvedBaseUrl: candidateBaseUrl,
      }
    } catch (error) {
      if (!isRecoverableFetchError(error)) {
        return null
      }
    }
  }

  return null
}

/**
 * Normalize a public bucket URL, defaulting to HTTPS when the protocol is omitted.
 * Existing HTTP/HTTPS URLs are preserved to support local/dev bucket proxies.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizePublicUrl(value) {
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

      if (typeof publicUrl !== 'string') {
        throw new Error('VITE_R2_PUBLIC_URL debe ser una cadena de texto.')
      }
      if (!publicUrl.trim()) {
        throw createR2ConfigError()
      }

      const normalizedPublicUrl = normalizePublicUrl(publicUrl)
      const configuredBaseUrl = normalizedPublicUrl.replace(/\/$/, '')

      const estructuraResult = await fetchRequiredJsonWithFallback(configuredBaseUrl, '_estructura.json')
      const estructuraJson = estructuraResult.data
      const resolvedBaseUrl = estructuraResult.resolvedBaseUrl

      const sections = Array.isArray(estructuraJson.sections) ? estructuraJson.sections : []

      // ── Try _manifest.json first ────────────────────────────────────────────
      const manifestResult = await fetchOptionalJsonWithFallback(resolvedBaseUrl, '_manifest.json')
      const manifest = manifestResult?.data ?? null
      const contentBaseUrl = manifestResult?.resolvedBaseUrl ?? resolvedBaseUrl

      if (manifestResult) {
        console.info('[r2:manifest] _manifest.json cargado correctamente.')
      } else {
        console.info(
          '[r2:manifest] _manifest.json no disponible. Usando descubrimiento por listado de bucket (?list-type=2).',
        )
      }

      let sectionImagesByName = {}

      if (manifest) {
        // ── Manifest path: resolve images from sectionImages + files ───────────
        const manifestSectionImages =
          manifest.sectionImages && typeof manifest.sectionImages === 'object'
            ? manifest.sectionImages
            : {}
        const manifestFiles = Array.isArray(manifest.files) ? manifest.files : []

        sectionImagesByName = resolveImagesFromManifest(
          contentBaseUrl,
          sections,
          manifestSectionImages,
          manifestFiles,
        )
      } else {
        // ── Legacy path: bucket listing (?list-type=2) ────────────────────────
        let bucketKeys = []

        try {
          bucketKeys = await fetchBucketKeys(contentBaseUrl)
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
            const resolvedImageKey = await resolveSectionImageKey(contentBaseUrl, section, resolver, hasListing)
            sectionImagesByName[imgName] = toObjectUrl(contentBaseUrl, resolvedImageKey)
          }
        }
      }

      return {
        estructuraJson,
        sectionImagesByName,
        footer: null,
        r2BaseUrl: contentBaseUrl,
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
