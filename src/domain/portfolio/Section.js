/**
 * Domain model — Section
 *
 * Represents a main portfolio section as defined in _estructura.json.
 *
 * Primary API (OOP):
 *   name       — display label
 *   type       — SectionType value ('folder' | 'video' | 'file' | 'reel')
 *   entry      — [entryName, fullR2Url] tuple (key = folder/file name, value = full R2 URL)
 *   image      — full R2 URL for the cover image (null when not configured)
 *   bgcolor    — hex background color (null when not configured)
 *   contents   — Content[] (populated lazily after section scan)
 *   hasImg     — whether 'img' was set in _estructura.json (even when URL resolution failed)
 *
 * Legacy read aliases (backward-compatible getters):
 *   entryName       → entry[0]
 *   previewImage    → image
 *   backgroundColor → bgcolor
 *
 * Derived helpers:
 *   hasConfiguredImage — true when hasImg is true (use for conditional image-error handling)
 */

/** @type {Readonly<{ FOLDER: 'folder', VIDEO: 'video', FILE: 'file', REEL: 'reel' }>} */
export const SectionType = Object.freeze({
  FOLDER: 'folder',
  VIDEO: 'video',
  FILE: 'file',
  REEL: 'reel',
})

export class Section {
  /**
   * @param {{
   *   name: string,
   *   type: 'folder' | 'video' | 'file' | 'reel',
   *   entry: [string, string],
   *   image?: string | null,
   *   bgcolor?: string | null,
   *   contents?: import('./Content.js').Content[],
   *   hasImg?: boolean,
   *   slug: string,
   *   order: number,
   * }} params
   */
  constructor({
    name,
    type,
    entry,
    image = null,
    bgcolor = null,
    contents = [],
    hasImg = false,
    slug,
    order,
  }) {
    this.name = name
    this.type = type
    /** @type {[string, string]} */
    this.entry = entry
    this.image = image
    this.bgcolor = bgcolor
    /** @type {import('./Content.js').Content[]} */
    this.contents = contents
    this.hasImg = hasImg
    this.slug = slug
    this.order = order
  }

  // ── Legacy aliases ────────────────────────────────────────────────────────

  /** Folder/file name in R2 — first element of {@link entry}. */
  get entryName() {
    return this.entry[0]
  }

  /** Full R2 URL of the cover image — alias for {@link image}. */
  get previewImage() {
    return this.image
  }

  /** Hex background color — alias for {@link bgcolor}. */
  get backgroundColor() {
    return this.bgcolor
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  /**
   * True when a cover image was explicitly configured in _estructura.json.
   * Use this to decide whether to show an image-error debug fallback.
   */
  get hasConfiguredImage() {
    return this.hasImg
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  /**
   * Plain serializable representation including computed getter values.
   * Useful for debug output and JSON.stringify().
   *
   * @returns {object}
   */
  toDebugInfo() {
    return {
      name: this.name,
      type: this.type,
      entryName: this.entryName,
      entry: this.entry,
      image: this.image,
      bgcolor: this.bgcolor,
      slug: this.slug,
      order: this.order,
      hasImg: this.hasImg,
      hasConfiguredImage: this.hasConfiguredImage,
    }
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Build a Section from a normalized plain object (as produced by
   * normalizePortfolioContent before this class existed).
   *
   * @param {{
   *   entryName: string,
   *   name: string,
   *   slug: string,
   *   type: string,
   *   backgroundColor: string | null,
   *   previewImage: string | null,
   *   order: number,
   *   hasImg?: boolean,
   * }} plain
   * @param {string | null} r2BaseUrl
   * @returns {Section}
   */
  static fromPlain(plain, r2BaseUrl = null) {
    const fullUrl = r2BaseUrl
      ? `${r2BaseUrl.replace(/\/$/, '')}/${plain.entryName}`
      : plain.entryName
    return new Section({
      name: plain.name,
      type: plain.type,
      entry: [plain.entryName, fullUrl],
      image: plain.previewImage ?? null,
      bgcolor: plain.backgroundColor ?? null,
      hasImg: plain.hasImg ?? false,
      slug: plain.slug,
      order: plain.order,
    })
  }
}
