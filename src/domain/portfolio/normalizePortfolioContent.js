import { slugify } from '../../assets/utils/naming.js'
import { parseEstructura } from '../../assets/utils/parseEstructura.js'
import { parseEstructuraJson } from '../../assets/utils/parseEstructuraJson.js'
import { Section } from './Section.js'

export function normalizePortfolioContent(rawContent = {}) {
  const {
    sectionImagesByName = {},
    estructuraJson = null,
    estructuraText = null,
    r2BaseUrl = null,
    manifestSections = null,
    manifestFiles = null,
  } = rawContent

  const parsedJson = parseEstructuraJson(estructuraJson)
  const hasJsonConfig = parsedJson.sections.length > 0

  const { siteTitle: txtSiteTitle, entries: estructuraEntries } = hasJsonConfig
    ? { siteTitle: null, entries: [] }
    : parseEstructura(estructuraText)

  const siteTitle = parsedJson.siteTitle ?? txtSiteTitle
  const resolvedFooter = parsedJson.footer
  const baseUrl = typeof r2BaseUrl === 'string' ? r2BaseUrl.replace(/\/$/, '') : null

  let sections

  if (hasJsonConfig) {
    sections = parsedJson.sections.map(
      (entry) =>
        new Section({
          name: entry.label,
          type: entry.type,
          entry: [entry.origin, baseUrl ? `${baseUrl}/${entry.origin}` : entry.origin],
          image: entry.img ? (sectionImagesByName[entry.img] ?? null) : null,
          bgcolor: entry.backgroundColor,
          hasImg: Boolean(entry.img),
          slug: slugify(entry.label),
          order: entry.index,
        }),
    )
  } else if (estructuraEntries.length > 0) {
    sections = estructuraEntries.map(
      (entry, index) =>
        new Section({
          name: entry.name,
          type: entry.type ?? 'folder',
          entry: [entry.origin, baseUrl ? `${baseUrl}/${entry.origin}` : entry.origin],
          image: null,
          bgcolor: null,
          hasImg: false,
          slug: slugify(entry.name),
          order: index,
        }),
    )
  } else {
    sections = []
  }

  return {
    sections,
    footer: resolvedFooter,
    siteTitle,
    r2BaseUrl,
    sectionManifest: manifestSections,
    manifestFiles,
  }
}
