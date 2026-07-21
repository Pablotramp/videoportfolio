import { useEffect, useState } from 'react'
import { scanFolderSection, scanVideoSection } from '../../infrastructure/content/r2/r2SectionScanner.js'

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
 * Intermediary hook: scans a portfolio section in Cloudflare R2 and
 * returns typed items for the appropriate content component.
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
 * @returns {{ contentType: string|null, items: Array, diagnostics: object|null, loading: boolean, error: Error|null }}
 */
export function useSection(section, r2BaseUrl) {
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
  }, [currentSectionKey, r2BaseUrl, section])

  if (!currentSectionKey) {
    return { ...DEFAULT_STATE, loading: false }
  }

  if (state.sectionKey !== currentSectionKey) {
    return { ...DEFAULT_STATE, sectionKey: currentSectionKey }
  }

  return state
}
