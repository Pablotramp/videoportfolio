/**
 * Domain model — Content
 *
 * Represents a single content item within a Section (audio track, HLS video
 * stream, link, or HTML embed).
 *
 * Primary API:
 *   title       — display title (null when unavailable)
 *   type        — ContentType value ('audio' | 'video' | 'link' | 'html')
 *   entry       — string[] — R2 URLs (or link hrefs) needed to render this item
 *                  • video (HLS): [manifestUrl, ...segmentUrls]
 *                  • audio:       [audioUrl]
 *                  • link:        [href]
 *                  • html:        [htmlUrl]
 *   image       — R2 URL of the item cover image (null when unavailable)
 *   description — optional metadata as [[key, value], ...] pairs (from companion JSON)
 */

/** @type {Readonly<{ AUDIO: 'audio', VIDEO: 'video', LINK: 'link', HTML: 'html' }>} */
export const ContentType = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
  LINK: 'link',
  HTML: 'html',
})

export class Content {
  /**
   * @param {{
   *   title?: string | null,
   *   type: 'audio' | 'video' | 'link' | 'html',
   *   entry?: string[],
   *   image?: string | null,
   *   description?: Array<[string, string]> | null,
   * }} params
   */
  constructor({ title = null, type, entry = [], image = null, description = null }) {
    this.title = title
    this.type = type
    /** @type {string[]} */
    this.entry = entry
    this.image = image
    /** @type {Array<[string, string]> | null} */
    this.description = description
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  /**
   * Primary entry URL (first element of {@link entry}).
   * For HLS this is the manifest URL; for audio the audio URL; for links the href.
   *
   * @returns {string | null}
   */
  get primaryUrl() {
    return this.entry[0] ?? null
  }

  // ── Factory methods ───────────────────────────────────────────────────────

  /**
   * Build a Content from a scanner item produced by r2SectionScanner.
   *
   * Supports itemType values: 'hls', 'audio', 'file'.
   *
   * @param {{
   *   itemType: 'hls' | 'audio' | 'file',
   *   id: string,
   *   hlsManifestUrl?: string,
   *   hlsFileUrls?: string[],
   *   hlsFrameUrl?: string | null,
   *   audioUrl?: string,
   *   fileRef?: string,
   *   title?: string | null,
   * }} item
   * @returns {Content}
   */
  static fromScannerItem(item) {
    switch (item.itemType) {
      case 'hls': {
        const entry = [
          item.hlsManifestUrl,
          ...(Array.isArray(item.hlsFileUrls) ? item.hlsFileUrls : []),
        ].filter(Boolean)
        return new Content({
          type: ContentType.VIDEO,
          entry,
          image: item.hlsFrameUrl ?? null,
          title: item.title ?? null,
        })
      }

      case 'audio': {
        return new Content({
          type: ContentType.AUDIO,
          entry: item.audioUrl ? [item.audioUrl] : [],
        })
      }

      case 'file': {
        return new Content({
          type: ContentType.LINK,
          entry: item.fileRef ? [item.fileRef] : [],
        })
      }

      default:
        return new Content({
          type: item.itemType ?? 'unknown',
          entry: [],
        })
    }
  }
}
