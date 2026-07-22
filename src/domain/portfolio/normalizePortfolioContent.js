import { slugify } from '../../assets/utils/naming.js'
import { parseEstructura } from '../../assets/utils/parseEstructura.js'
import { parseEstructuraJson } from '../../assets/utils/parseEstructuraJson.js'

export function normalizePortfolioContent(rawContent = {}) {
  const {
    sectionImagesByName = {},
    estructuraJson = null,
    estructuraText = null,
    r2BaseUrl = null,
    manifestSections = null,
  } = rawContent

  const parsedJson = parseEstructuraJson(estructuraJson)
  const hasJsonConfig = parsedJson.sections.length > 0

  const { siteTitle: txtSiteTitle, entries: estructuraEntries } = hasJsonConfig
    ? { siteTitle: null, entries: [] }
    : parseEstructura(estructuraText)

  const siteTitle = parsedJson.siteTitle ?? txtSiteTitle
  const resolvedFooter = parsedJson.footer

  let sections

  if (hasJsonConfig) {
    sections = parsedJson.sections.map((entry) => ({
      entryName: entry.origin,
      name: entry.label,
      slug: slugify(entry.label),
      type: entry.type,
      backgroundColor: entry.backgroundColor,
      previewImage: entry.img ? (sectionImagesByName[entry.img] ?? null) : null,
      order: entry.index,
    }))
  } else if (estructuraEntries.length > 0) {
    sections = estructuraEntries.map((entry, index) => ({
      entryName: entry.origin,
      name: entry.name,
      slug: slugify(entry.name),
      type: entry.type ?? 'folder',
      backgroundColor: null,
      previewImage: null,
      order: index,
    }))
  } else {
    sections = []
  }

  return {
    sections,
    footer: resolvedFooter,
    siteTitle,
    r2BaseUrl,
    sectionManifest: manifestSections,
  }
}
