/**
 * R2 Section Scanner
 *
 * Scans section folders in Cloudflare R2 and classifies their contents
 * into typed items (HLS video folders or audio files).
 *
 * This module acts as the intermediary between the _estructura.json
 * structure and the content rendering components:
 *
 *   HLS folder items  → passed to HlsPlayerPlaceholder (→ video-hls-packager)
 *   Audio file items  → passed to AudioPlayerPlaceholder (→ audio component)
 *   File-type sections → passed to FileViewerPlaceholder (→ file component)
 *
 * Unlike the old section loader, this scanner does NOT resolve title metadata
 * from companion JSON files — that responsibility belongs to the content
 * components themselves.
 */

import { fetchBucketKeys, toBucketListingUrl, toObjectUrl } from './r2Utils.js'

const AUDIO_EXTENSIONS = new Set(['m4a', 'mp3', 'aac', 'ogg', 'opus', 'flac', 'wav'])
const HLS_SEGMENT_EXTENSIONS = new Set(['ts', 'm4s'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif'])
const JSON_EXTENSION = 'json'

function getExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : ''
}

function getBaseName(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.slice(0, lastDot) : filename
}

/**
 * Remove a single trailing slash from a folder-like key prefix.
 *
 * @param {string} value
 * @returns {string}
 */
function trimTrailingSlash(value) {
  return value.replace(/\/$/, '')
}

function getTopLevelEntries(relativeKeys) {
  const entries = []
  const seen = new Set()

  for (const key of relativeKeys) {
    if (!key) continue
    const [entryName] = key.split('/')
    if (!entryName || seen.has(entryName)) continue
    seen.add(entryName)
    entries.push(entryName)
  }

  return entries
}

function buildScanDiagnostics(baseUrl, folderPrefix, keys, error = null) {
  const relativeKeys = keys.map((key) => key.slice(folderPrefix.length)).filter(Boolean)

  return {
    folderPrefix,
    listingUrl: toBucketListingUrl(baseUrl, folderPrefix),
    foundEntries: getTopLevelEntries(relativeKeys),
    foundKeys: keys,
    errorMessage: error instanceof Error ? error.message : null,
  }
}

/**
 * Check whether a group of keys contains HLS media segment files.
 *
 * @param {string[]} keys
 * @returns {boolean}
 */
function hasHlsSegments(keys) {
  return keys.some((key) => HLS_SEGMENT_EXTENSIONS.has(getExtension(key)))
}

/**
 * Pick the preferred HLS playlist from a group of keys.
 * Prioritises "master.m3u8" and otherwise falls back to the first playlist found.
 *
 * @param {string[]} keys
 * @returns {string | null}
 */
function pickPreferredM3u8(keys) {
  let fallback = null

  for (const key of keys) {
    if (!key.endsWith('.m3u8')) continue
    if (getBaseName(key).toLowerCase() === 'master') return key
    if (!fallback) fallback = key
  }

  return fallback
}

function isImageKey(key) {
  return IMAGE_EXTENSIONS.has(getExtension(key))
}

function isJsonKey(key) {
  return getExtension(key) === JSON_EXTENSION
}

function getFinalPathSegment(path) {
  const segments = path.split('/')
  return segments[segments.length - 1] ?? path
}

function getStreamMetadata(baseUrl, streamKeys, hlsManifestKey) {
  const sanitizedManifestKey = typeof hlsManifestKey === 'string' ? hlsManifestKey : ''
  const hlsFiles = streamKeys.filter((key) => key && key !== sanitizedManifestKey)
  const frameCandidate =
    hlsFiles.find(
      (key) =>
        isImageKey(key) && getBaseName(getFinalPathSegment(key)).toLowerCase() === 'frame',
    ) ?? null
  const metadataCandidate =
    hlsFiles.find((key) => getFinalPathSegment(key).toLowerCase() === 'metadata.json') ??
    hlsFiles.find((key) => isJsonKey(key)) ??
    null

  return {
    hlsManifestKey: sanitizedManifestKey,
    hlsFiles,
    hlsFileUrls: hlsFiles.map((key) => toObjectUrl(baseUrl, key)),
    hlsFrameKey: frameCandidate,
    hlsFrameUrl: frameCandidate ? toObjectUrl(baseUrl, frameCandidate) : null,
    hlsMetadataKey: metadataCandidate,
    hlsMetadataUrl: metadataCandidate ? toObjectUrl(baseUrl, metadataCandidate) : null,
  }
}

/**
 * Classify and build typed item descriptors from the bucket keys
 * belonging to a section folder.
 *
 * Detection priority:
 *   1. Audio files (.m4a etc.) directly in the folder → contentType 'audio'
 *   2. HLS files (.m3u8 + .ts) directly in the folder → contentType 'hls'
 *   3. Subfolders containing .m3u8 + .ts files        → contentType 'hls'
 *   4. Neither found                                   → contentType 'unknown'
 *
 * @param {string}   baseUrl      - Public bucket base URL (no trailing slash)
 * @param {string[]} keys         - All keys under the folder prefix
 * @param {string}   folderPrefix - e.g. "FiccionSonora/"
 * @returns {{ contentType: 'audio'|'hls'|'unknown', items: Array }}
 */
function classifyFolder(baseUrl, keys, folderPrefix) {
  const relativeKeys = keys.map((k) => k.slice(folderPrefix.length))
  const directFiles = relativeKeys.filter((k) => k.length > 0 && !k.includes('/'))

  // ── Audio detection ────────────────────────────────────────────────────────
  const audioFiles = directFiles.filter((f) => AUDIO_EXTENSIONS.has(getExtension(f)))

  if (audioFiles.length > 0) {
    const items = audioFiles.map((filename) => {
      const audioKey = `${folderPrefix}${filename}`
      return {
        id: getBaseName(filename),
        itemType: 'audio',
        audioKey,
        audioUrl: toObjectUrl(baseUrl, audioKey),
      }
    })
    return { contentType: 'audio', items }
  }

  const rootM3u8Filename = pickPreferredM3u8(directFiles)
  const hasRootHlsSegments = hasHlsSegments(directFiles)

  if (rootM3u8Filename && hasRootHlsSegments) {
    const rootFolderKey = trimTrailingSlash(folderPrefix)
    const hlsManifestKey = `${folderPrefix}${rootM3u8Filename}`
    const streamKeys = keys.filter((key) => key.startsWith(folderPrefix))
    const streamMetadata = getStreamMetadata(baseUrl, streamKeys, hlsManifestKey)

    return {
      contentType: 'hls',
      items: [
        {
          id: rootFolderKey,
          itemType: 'hls',
          hlsFolder: rootFolderKey,
          ...streamMetadata,
          hlsManifestUrl: toObjectUrl(baseUrl, hlsManifestKey),
        },
      ],
    }
  }

  // ── HLS video detection ────────────────────────────────────────────────────
  // Group relative keys by their first path segment (= sub-folder name)
  const subfolderMap = new Map()
  for (const relKey of relativeKeys) {
    const slashIndex = relKey.indexOf('/')
    if (slashIndex === -1) continue
    const subfolder = relKey.slice(0, slashIndex)
    if (!subfolder) continue
    if (!subfolderMap.has(subfolder)) subfolderMap.set(subfolder, [])
    subfolderMap.get(subfolder).push(relKey)
  }

  const hlsFolders = []
  for (const [subfolder, subRelKeys] of subfolderMap) {
    const m3u8Rel = pickPreferredM3u8(subRelKeys)
    if (m3u8Rel && hasHlsSegments(subRelKeys)) hlsFolders.push({ subfolder, m3u8Rel })
  }

  if (hlsFolders.length > 0) {
    const items = hlsFolders.map(({ subfolder, m3u8Rel }) => {
      const hlsFolder = `${folderPrefix}${subfolder}`
      const streamPrefix = `${subfolder}/`
      const streamRelKeys = subfolderMap.get(subfolder) ?? []
      const streamKeys = streamRelKeys
        .filter((relKey) => relKey.startsWith(streamPrefix))
        .map((relKey) => `${folderPrefix}${relKey}`)
      const hlsManifestKey = `${folderPrefix}${m3u8Rel}`
      const streamMetadata = getStreamMetadata(baseUrl, streamKeys, hlsManifestKey)
      return {
        id: subfolder,
        itemType: 'hls',
        hlsFolder,
        ...streamMetadata,
        hlsManifestUrl: toObjectUrl(baseUrl, hlsManifestKey),
      }
    })
    return { contentType: 'hls', items }
  }

  return { contentType: 'unknown', items: [] }
}

/**
 * Scan a folder-type section and classify its contents.
 *
 * A folder section may contain either:
 *   - Audio files (.m4a etc.) directly in the folder
 *   - HLS sub-folders (each subfolder = one video stream)
 *
 * @param {string}   baseUrl       - Public R2 base URL (no trailing slash)
 * @param {string}   folderName    - Section entryName (= folder name in R2)
 * @param {string[]|null} [preloadedKeys] - Keys already known (e.g. from manifest.files).
 *   When provided the bucket listing fetch is skipped entirely.
 * @returns {Promise<{ contentType: 'audio'|'hls'|'unknown', items: Array }>}
 */
export async function scanFolderSection(baseUrl, folderName, preloadedKeys = null) {
  const folderPrefix = `${folderName.trim()}/`
  let keys

  if (Array.isArray(preloadedKeys)) {
    keys = preloadedKeys
  } else {
    try {
      keys = await fetchBucketKeys(baseUrl, folderPrefix)
    } catch (error) {
      console.warn(
        `[r2:scanner:folder] No se pudo listar la carpeta "${folderName}".`,
        error,
      )
      return {
        contentType: 'unknown',
        items: [],
        diagnostics: buildScanDiagnostics(baseUrl, folderPrefix, [], error),
      }
    }
  }

  const diagnostics = buildScanDiagnostics(baseUrl, folderPrefix, keys)
  if (keys.length === 0) {
    return { contentType: 'unknown', items: [], diagnostics }
  }

  return { ...classifyFolder(baseUrl, keys, folderPrefix), diagnostics }
}

/**
 * Scan a video-type section (single HLS stream).
 *
 * The entryName maps to a folder in R2 that contains one .m3u8 manifest
 * and its .ts segments.
 *
 * @param {string}        baseUrl       - Public R2 base URL (no trailing slash)
 * @param {string}        videoName     - Section entryName (= HLS folder name in R2)
 * @param {string[]|null} [preloadedKeys] - Keys already known (e.g. from manifest.files).
 *   When provided the bucket listing fetch is skipped entirely.
 * @returns {Promise<{ contentType: 'hls', items: Array }>}
 */
export async function scanVideoSection(baseUrl, videoName, preloadedKeys = null) {
  const folderPrefix = `${videoName.trim()}/`
  let keys

  if (Array.isArray(preloadedKeys)) {
    keys = preloadedKeys
  } else {
    try {
      keys = await fetchBucketKeys(baseUrl, folderPrefix)
    } catch (error) {
      console.warn(
        `[r2:scanner:video] No se pudo listar la carpeta de vídeo "${videoName}".`,
        error,
      )
      return {
        contentType: 'hls',
        items: [],
        diagnostics: buildScanDiagnostics(baseUrl, folderPrefix, [], error),
      }
    }
  }

  const diagnostics = buildScanDiagnostics(baseUrl, folderPrefix, keys)
  const m3u8Key = pickPreferredM3u8(keys)
  if (!m3u8Key) {
    console.warn(
      `[r2:scanner:video] No se encontró ningún .m3u8 en la carpeta "${videoName}".`,
    )
    return { contentType: 'hls', items: [], diagnostics }
  }

  return {
    contentType: 'hls',
    diagnostics,
    items: [
      {
        id: videoName,
        itemType: 'hls',
        hlsFolder: videoName,
        ...getStreamMetadata(
          baseUrl,
          keys.filter((key) => key.startsWith(folderPrefix)),
          m3u8Key,
        ),
        hlsManifestUrl: toObjectUrl(baseUrl, m3u8Key),
      },
    ],
  }
}
