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
 *         "reel"?: string,       // Origin: HLS folder presented as a vertical reel feed
 *         "img"?: string,        // Cover image filename (resolved from _imagenesSeccionesJson/)
 *         "backgroundColor"?: string  // Hex color for slicer card and section page background
 *       }
 *     ],
 *     "footer": {                // Footer fields — all optional
 *       "copyright"?: string,
 *       "author"?: string,
 *       "note"?: string,
 *       "links"?: [{ "href": string, "label"?: string }]
 *     },
 *     "carga": {                 // Splash/intro screen — all optional
 *       "img"?: string,          // Filename of the image shown on the intro screen (e.g. a GIF)
 *       "chargeTime"?: number,   // Seconds visible before auto-dismiss
 *       "textColor"?: string,    // Hex color for intro text
 *       "backgroundColor"?: string // Hex color for intro background
 *     }
 *   }
 *
 * Normalization rules:
 *   - backgroundColor values missing '#' get it prepended automatically.
 *   - Section type is inferred from the origin field present:
 *       reel present   → 'reel'
 *       video present  → 'video'
 *       folder present → 'folder'
 *       file present   → 'file'
 *   - Malformed or missing values are silently replaced by safe defaults.
 *   - Sections without a valid label or origin are skipped.
 */

export const RESERVED_METADATA_FIELDS = new Set(['title', 'img'])
const EMPTY_PARSED_ESTRUCTURA = Object.freeze({
  siteTitle: null,
  sections: [],
  footer: null,
  loadingImg: null,
  loading: null,
})

/**
 * Normalize a string by trimming and returning null if empty/non-string.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Normalize a hexadecimal color value by ensuring it starts with '#'.
 * Returns null if the value is blank or non-string.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeHexColor(value) {
  const trimmed = normalizeString(value)
  if (!trimmed) return null
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

/**
 * Normalize chargeTime to seconds.
 * Returns null if the value is invalid.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeChargeTime(value) {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN

  if (!Number.isFinite(numericValue) || numericValue < 0) return null
  return numericValue
}

/**
 * Infer the section type from an entry object.
 * Priority: reel → 'reel', video → 'video', folder → 'folder', file → 'file'.
 *
 * @param {{ folder?: string, video?: string, file?: string, reel?: string }} entry
 * @returns {'folder' | 'video' | 'file' | 'reel'}
 */
function resolveSectionType(entry) {
  if (entry.reel) return 'reel'
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
 *     type: 'folder' | 'video' | 'file' | 'reel',
 *     img: string,
 *     backgroundColor: string | null
 *   }>,
 *   footer: object | null,
 *   loadingImg: string | null,
 *   loading: {
 *     chargeTime: number | null,
 *     textColor: string | null,
 *     backgroundColor: string | null
 *   } | null
 * }}
 */
export function parseEstructuraJson(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_PARSED_ESTRUCTURA }
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
            (typeof entry.reel === 'string' && entry.reel.trim()) ||
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
              backgroundColor: normalizeHexColor(entry.backgroundColor),
            },
          ]
        } catch {
          return []
        }
      })
    : []

  const footer =
    raw.footer && typeof raw.footer === 'object' ? raw.footer : null

  const carga = raw.carga && typeof raw.carga === 'object' ? raw.carga : null

  const loadingImg =
    carga
      ? normalizeString(carga.img)
      : null

  const loading = carga
    ? {
        chargeTime: normalizeChargeTime(carga.chargeTime),
        textColor: normalizeHexColor(carga.textColor),
        backgroundColor: normalizeHexColor(carga.backgroundColor),
      }
    : null

  return { siteTitle, sections, footer, loadingImg, loading }
}
