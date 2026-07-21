import {
  fetchBucketKeys,
  createKeyResolver,
  fetchJson,
  fetchManifest,
  extractManifestKeys,
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

async function resolveSectionImageKey(baseUrl, section, resolver, hasKeyIndex, keyIndexLabel) {
  const imgName = section.img.trim()
  const candidates = getSectionImageCandidates(section, imgName)

  if (hasKeyIndex) {
    for (const candidate of candidates) {
      const resolvedKey = resolver.resolveKey(candidate)
      if (resolvedKey) {
        logSectionImageResolution(section, imgName, resolvedKey, keyIndexLabel)
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

function createR2ConfigError() {
  return new Error(
    'R2 source requiere VITE_R2_PUBLIC_URL con la URL pública del bucket (ej: https://pub-XXXX.r2.dev).',
  )
}

/**
 * Cloudflare R2 portfolio source.
 *
 * Loads _estructura.json as the single source of truth for site structure.
 * Resolves section cover images (img field) against the bucket.
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

      const baseUrl = publicUrl.replace(/\/$/, '')

      const estructuraJson = await fetchJson(`${baseUrl}/_estructura.json`, '_estructura.json')

      const sections = Array.isArray(estructuraJson.sections) ? estructuraJson.sections : []
      let bucketKeys = []
      let keyIndexLabel = 'listado del bucket'

      const manifest = await fetchManifest(baseUrl)
      const manifestKeys = extractManifestKeys(manifest)
      if (manifestKeys.length > 0) {
        bucketKeys = manifestKeys
        keyIndexLabel = 'árbol de _manifest.json'
      }

      if (bucketKeys.length === 0) {
        try {
          bucketKeys = await fetchBucketKeys(baseUrl)
        } catch (error) {
          console.warn(
            '[r2:listing:warning] No se pudo leer _manifest.json ni listar el bucket. Se usará resolución directa por nombre.',
            error,
          )
        }
      }

      const resolver = createKeyResolver(bucketKeys)
      const hasKeyIndex = bucketKeys.length > 0

      const sectionImagesByName = {}
      for (const section of sections) {
        if (typeof section.img === 'string' && section.img.trim()) {
          const imgName = section.img.trim()
          const resolvedImageKey = await resolveSectionImageKey(
            baseUrl,
            section,
            resolver,
            hasKeyIndex,
            keyIndexLabel,
          )
          sectionImagesByName[imgName] = toObjectUrl(baseUrl, resolvedImageKey)
        }
      }

      return {
        estructuraJson,
        sectionImagesByName,
        footer: null,
        r2BaseUrl: baseUrl,
      }
    },
  }
}
