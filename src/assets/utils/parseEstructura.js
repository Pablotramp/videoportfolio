/**
 * Parse the estructura.txt file format.
 *
 * Format:
 *   <Titulo del sitio>
 *   Nombre de seccion>origen
 *
 * Where origen can be:
 *   - no extension    → folder section
 *   - .json           → JSON section
 *   - .mp4 / .webm / .ogg / .ogv → video section
 *
 * Rules:
 *   - Lines are trimmed; empty lines are ignored.
 *   - The <Title> line is optional and may appear anywhere (only first occurrence used).
 *   - The separator is the first `>` character on the line.
 *   - Extensions are normalised to lowercase.
 *   - Malformed lines are silently skipped.
 *
 * @param {string | null | undefined} text - Raw text content of estructura.txt
 * @returns {{ siteTitle: string | null, entries: Array<{ name: string, origin: string, type: 'folder' | 'json' | 'video' }> }}
 */
export function parseEstructura(text) {
  if (!text || typeof text !== 'string') {
    return { siteTitle: null, entries: [] }
  }

  const lines = text.split('\n')
  let siteTitle = null
  const entries = []

  for (const rawLine of lines) {
    try {
      const line = rawLine.trim()
      if (!line) continue

      if (line.startsWith('<') && line.endsWith('>') && line.length > 2) {
        if (siteTitle === null) {
          const candidate = line.slice(1, -1).trim()
          if (candidate) siteTitle = candidate
        }
        continue
      }

      const separatorIndex = line.indexOf('>')
      if (separatorIndex < 1) continue

      const name = line.slice(0, separatorIndex).trim()
      const origin = line.slice(separatorIndex + 1).trim()
      if (!name || !origin) continue

      const type = resolveTypeFromOrigin(origin)
      entries.push({ name, origin, type })
    } catch {
      // defensive: skip any malformed line without breaking the render
    }
  }

  return { siteTitle, entries }
}

function resolveTypeFromOrigin(origin) {
  const lastDot = origin.lastIndexOf('.')
  if (lastDot === -1) return 'folder'
  const ext = origin.slice(lastDot + 1).toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'mp4' || ext === 'webm' || ext === 'ogg' || ext === 'ogv') return 'video'
  return 'folder'
}
