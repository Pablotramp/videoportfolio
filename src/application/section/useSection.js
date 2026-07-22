import { useEffect, useState } from 'react'
import { scanFolderSection, scanVideoSection } from '../../infrastructure/content/r2/r2SectionScanner.js'
import { toObjectUrl } from '../../infrastructure/content/r2/r2Utils.js'

const DEFAULT_STATE = {
  sectionKey: null,
  contentType: null,
  items: [],
  diagnostics: null,
  loading: true,
  error: null,
}

function getSectionKey(section, r2BaseUrl) {
  if (!section || !r2BaseUrl) return null
  return `${section.type}:${section.entryName}:${r2BaseUrl}`
}

/**
 * Build typed item descriptors from a _manifest.json section entry.
 * Relative bucket keys are expanded to full public URLs using r2BaseUrl.
 *
 * @param {{ contentType: string, items: Array }} manifestSection
 * @param {string} r2BaseUrl - Public bucket base URL (no trailing slash)
 * @returns {Array}
 */
function buildItemsFromManifest(manifestSection, r2BaseUrl) {
  if (!Array.isArray(manifestSection.items)) return []

  return manifestSection.items.map((item) => {
    if (item.itemType === 'hls') {
      return {
        ...item,
        hlsManifestUrl: item.hlsManifestKey
          ? toObjectUrl(r2BaseUrl, item.hlsManifestKey)
          : (item.hlsManifestUrl ?? ''),
      }
    }

    if (item.itemType === 'audio') {
      return {
        ...item,
        audioUrl: item.audioKey
          ? toObjectUrl(r2BaseUrl, item.audioKey)
          : (item.audioUrl ?? ''),
      }
    }

    return item
  })
}

/**
 * Intermediary hook: scans a portfolio section in Cloudflare R2 and
 * returns typed items for the appropriate content component.
 *
 * When sectionManifest is provided (loaded from _manifest.json) and contains
 * an entry for the current section, the manifest is used directly and no
 * bucket listing (?list-type=2) is performed.  Falls back to live scanning
 * when manifest data is absent.
 *
 * Routing logic:
 *   section.type === 'video'  → scanVideoSection → items with itemType 'hls'
 *                               → HlsPlayerPlaceholder (→ video-hls-packager)
 *
 *   section.type === 'folder' → scanFolderSection → items with itemType 'hls' or 'audio'
 *                               → HlsPlayerPlaceholder  (HLS subfolders)
 *                               → AudioPlayerPlaceholder (.m4a files)
 *
 *   section.type === 'file'   → no R2 scan; returns single file item
 *                               → FileViewerPlaceholder (→ file component)
 *
 * @param {{ type: string, entryName: string, name: string } | null} section
 * @param {string | null} r2BaseUrl
 * @param {Record<string, { contentType: string, items: Array }> | null} [sectionManifest]
 * @returns {{ contentType: string|null, items: Array, diagnostics: object|null, loading: boolean, error: Error|null }}
 */
export function useSection(section, r2BaseUrl, sectionManifest) {
  const currentSectionKey = getSectionKey(section, r2BaseUrl)
  const [state, setState] = useState(() => ({
    ...DEFAULT_STATE,
    sectionKey: currentSectionKey,
    loading: Boolean(section && r2BaseUrl),
  }))

  useEffect(() => {
    if (!section || !r2BaseUrl) {
      return undefined
    }

    let cancelled = false

    async function scan() {
      // ── Manifest path: use pre-classified data, no network listing needed ──
      const manifestSection =
        sectionManifest && section.entryName
          ? (sectionManifest[section.entryName] ?? null)
          : null

      if (manifestSection) {
        const items = buildItemsFromManifest(manifestSection, r2BaseUrl)
        if (!cancelled) {
          setState({
            sectionKey: currentSectionKey,
            contentType: manifestSection.contentType ?? null,
            items,
            diagnostics: null,
            loading: false,
            error: null,
          })
        }
        return
      }

      // ── Legacy path: live bucket scanning (?list-type=2) ─────────────────
      setState(DEFAULT_STATE)

      try {
        let result

        if (section.type === 'video') {
          result = await scanVideoSection(r2BaseUrl, section.entryName)
        } else if (section.type === 'folder') {
          result = await scanFolderSection(r2BaseUrl, section.entryName)
        } else if (section.type === 'file') {
          // File-type sections reference a single document — no folder scan needed.
          result = {
            contentType: 'file',
            items: [{ id: section.entryName, itemType: 'file', fileRef: section.entryName }],
          }
        } else {
          result = { contentType: section.type ?? 'unknown', items: [] }
        }

        if (!cancelled) {
          setState({
            sectionKey: currentSectionKey,
            contentType: result.contentType ?? null,
            items: Array.isArray(result.items) ? result.items : [],
            diagnostics: result.diagnostics ?? null,
            loading: false,
            error: null,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            sectionKey: currentSectionKey,
            contentType: null,
            items: [],
            diagnostics: null,
            loading: false,
            error,
          })
        }
      }
    }

    scan()

    return () => {
      cancelled = true
    }
  }, [currentSectionKey, r2BaseUrl, section, sectionManifest])

  if (!currentSectionKey) {
    return { ...DEFAULT_STATE, loading: false }
  }

  if (state.sectionKey !== currentSectionKey) {
    return { ...DEFAULT_STATE, sectionKey: currentSectionKey }
  }

  return state
}
