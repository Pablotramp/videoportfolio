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

import { fetchBucketKeys, toObjectUrl } from './r2Utils.js'

const AUDIO_EXTENSIONS = new Set(['m4a', 'mp3', 'aac', 'ogg', 'opus', 'flac', 'wav'])

function getExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : ''
}

function getBaseName(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.slice(0, lastDot) : filename
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, '')
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

  const rootManifestFilename = directFiles.find((filename) => filename.endsWith('.m3u8'))
  const hasRootSegments = directFiles.some((filename) => filename.endsWith('.ts'))

  if (rootManifestFilename && hasRootSegments) {
    const hlsFolder = trimTrailingSlash(folderPrefix)

    return {
      contentType: 'hls',
      items: [
        {
          id: hlsFolder,
          itemType: 'hls',
          hlsFolder,
          hlsManifestUrl: toObjectUrl(baseUrl, `${folderPrefix}${rootManifestFilename}`),
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
    const hasM3u8 = subRelKeys.some((k) => k.endsWith('.m3u8'))
    const hasTs = subRelKeys.some((k) => k.endsWith('.ts'))
    if (hasM3u8 && hasTs) hlsFolders.push({ subfolder, subRelKeys })
  }

  if (hlsFolders.length > 0) {
    const items = hlsFolders.map(({ subfolder, subRelKeys }) => {
      // The first .m3u8 found is used as the entry point for the HLS stream.
      // This assumes each HLS subfolder contains a single master playlist.
      // If multiple .m3u8 files exist (e.g. master + variant playlists), the
      // video-hls-packager component should resolve the correct manifest.
      const m3u8Rel = subRelKeys.find((k) => k.endsWith('.m3u8'))
      const hlsFolder = `${folderPrefix}${subfolder}`
      return {
        id: subfolder,
        itemType: 'hls',
        hlsFolder,
        hlsManifestUrl: m3u8Rel ? toObjectUrl(baseUrl, `${folderPrefix}${m3u8Rel}`) : null,
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
 * @param {string} baseUrl    - Public R2 base URL (no trailing slash)
 * @param {string} folderName - Section entryName (= folder name in R2)
 * @returns {Promise<{ contentType: 'audio'|'hls'|'unknown', items: Array }>}
 */
export async function scanFolderSection(baseUrl, folderName) {
  const folderPrefix = `${folderName.trim()}/`
  let keys

  try {
    keys = await fetchBucketKeys(baseUrl, folderPrefix)
  } catch (error) {
    console.warn(
      `[r2:scanner:folder] No se pudo listar la carpeta "${folderName}".`,
      error,
    )
    return { contentType: 'unknown', items: [] }
  }

  if (keys.length === 0) {
    return { contentType: 'unknown', items: [] }
  }

  return classifyFolder(baseUrl, keys, folderPrefix)
}

/**
 * Scan a video-type section (single HLS stream).
 *
 * The entryName maps to a folder in R2 that contains one .m3u8 manifest
 * and its .ts segments.
 *
 * @param {string} baseUrl    - Public R2 base URL (no trailing slash)
 * @param {string} videoName  - Section entryName (= HLS folder name in R2)
 * @returns {Promise<{ contentType: 'hls', items: Array }>}
 */
export async function scanVideoSection(baseUrl, videoName) {
  const folderPrefix = `${videoName.trim()}/`
  let keys

  try {
    keys = await fetchBucketKeys(baseUrl, folderPrefix)
  } catch (error) {
    console.warn(
      `[r2:scanner:video] No se pudo listar la carpeta de vídeo "${videoName}".`,
      error,
    )
    return { contentType: 'hls', items: [] }
  }

  const m3u8Key = keys.find((k) => k.endsWith('.m3u8'))
  if (!m3u8Key) {
    console.warn(
      `[r2:scanner:video] No se encontró ningún .m3u8 en la carpeta "${videoName}".`,
    )
    return { contentType: 'hls', items: [] }
  }

  return {
    contentType: 'hls',
    items: [
      {
        id: videoName,
        itemType: 'hls',
        hlsFolder: videoName,
        hlsManifestUrl: toObjectUrl(baseUrl, m3u8Key),
      },
    ],
  }
}
