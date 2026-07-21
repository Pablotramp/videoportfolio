/**
 * Parse and normalize _estructura.json.
 *
 * JSON CONTRACT (_estructura.json):
 * ─────────────────────────────────
 *   {
 *     "title": string,           // Site title — also rendered in the intro screen
 *     "sections": [
 *       {
 *         "section": string,     // Display label shown in menu and slicer
 *         "folder"?: string,     // Origin: folder name in R2 → multimedia section
 *         "video"?: string,      // Origin: HLS folder for autoplay video sections
 *         "file"?: string,       // Origin: editorial index/map file (normally JSON)
 *         "img"?: string,        // Cover image filename (resolved from _imagenesSeccionesJson/)
 *         "backgroundColor"?: string  // Hex color for slicer card and section page background
 *       }
 *     ],
 *     "footer": {                // Footer fields — all optional
 *       "copyright"?: string,
 *       "author"?: string,
 *       "note"?: string,
 *       "links"?: [{ "href": string, "label"?: string }]
 *     }
 *   }
 *
 * Normalization rules:
 *   - backgroundColor values missing '#' get it prepended automatically.
 *   - Section type is inferred from the origin field present:
 *       video present  → 'video'
 *       folder present → 'folder'
 *       file present   → 'file'
 *   - Malformed or missing values are silently replaced by safe defaults.
 *   - Sections without a valid label or origin are skipped.
 */

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg', 'm3u8'])

export const RESERVED_METADATA_FIELDS = new Set(['title', 'img'])

/**
 * Normalize a backgroundColor value by ensuring it starts with '#'.
 * Returns null if the value is blank or non-string.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeColor(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

/**
 * Infer the section type from an entry object.
 * Priority: video → 'video', folder → 'folder', file → 'file'.
 *
 * @param {{ folder?: string, video?: string, file?: string }} entry
 * @returns {'folder' | 'video' | 'file'}
 */
function resolveSectionType(entry) {
  if (entry.video) return 'video'
  if (entry.folder) return 'folder'
  if (entry.file) return 'file'
  return 'folder'
}

/**
 * Parse and normalize the raw object loaded from _estructura.json.
 *
 * @param {unknown} raw - Parsed JSON object (or null/undefined if file is absent)
 * @returns {{
 *   siteTitle: string | null,
 *   sections: Array<{
 *     index: number,
 *     label: string,
 *     origin: string,
 *     type: 'folder' | 'video' | 'file',
 *     img: string,
 *     backgroundColor: string | null
 *   }>,
 *   footer: object | null
 * }}
 */
export function parseEstructuraJson(raw) {
  if (!raw || typeof raw !== 'object') {
    return { siteTitle: null, sections: [], footer: null }
  }

  const siteTitle =
    typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : null

  const sections = Array.isArray(raw.sections)
    ? raw.sections.flatMap((entry, index) => {
        try {
          const label =
            typeof entry.section === 'string' ? entry.section.trim() : ''
          if (!label) return []

          const origin =
            (typeof entry.video === 'string' && entry.video.trim()) ||
            (typeof entry.folder === 'string' && entry.folder.trim()) ||
            (typeof entry.file === 'string' && entry.file.trim()) ||
            ''
          if (!origin) return []

          const type = resolveSectionType(entry)

          return [
            {
              index,
              label,
              origin,
              type,
              img: typeof entry.img === 'string' ? entry.img.trim() : '',
              backgroundColor: normalizeColor(entry.backgroundColor),
            },
          ]
        } catch {
          return []
        }
      })
    : []

  const footer =
    raw.footer && typeof raw.footer === 'object' ? raw.footer : null

  return { siteTitle, sections, footer }
}
