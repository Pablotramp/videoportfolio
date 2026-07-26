import { useEffect, useMemo, useState } from 'react'
import { fetchJson, toObjectUrl } from '../../infrastructure/content/r2/r2Utils.js'

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getFileExtension(fileRef) {
  const sanitized = getTrimmedString(fileRef)
  const lastDot = sanitized.lastIndexOf('.')
  return lastDot === -1 ? '' : sanitized.slice(lastDot + 1).toLowerCase()
}

function getContentFolderKey(fileRef) {
  const sanitized = getTrimmedString(fileRef)
  if (!sanitized) return ''
  const segments = sanitized.split('/')
  const fileName = segments.pop() ?? ''
  const lastDot = fileName.lastIndexOf('.')
  const baseName = lastDot === -1 ? fileName : fileName.slice(0, lastDot)
  return [...segments, baseName].filter(Boolean).join('/')
}

function normalizeLinkItems(rawLinks, r2BaseUrl, contentFolderKey) {
  if (!Array.isArray(rawLinks)) return []

  return rawLinks.flatMap((entry, index) => {
    const href = getTrimmedString(entry?.link)
    if (!href) return []

    const title = getTrimmedString(entry?.title) || `Enlace ${index + 1}`
    const platform = getTrimmedString(entry?.platform) || getTrimmedString(entry?.plataform)
    const imgName = getTrimmedString(entry?.img)
    const imageUrl =
      imgName && r2BaseUrl && contentFolderKey
        ? toObjectUrl(r2BaseUrl, `${contentFolderKey}/${imgName}`)
        : null

    return [
      {
        id: `${href}-${index}`,
        href,
        title,
        platform,
        imageUrl,
      },
    ]
  })
}

function SpotifyBadge() {
  return (
    <span className="pointer-events-none absolute top-0 right-0 z-10 block h-12 w-12 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1ed760] p-2 text-black shadow-lg ring-4 ring-white/80">
      <svg viewBox="0 0 168 168" aria-hidden="true" className="h-full w-full fill-current">
        <path d="m83.996 0c-46.319 0-83.996 37.677-83.996 83.996 0 46.32 37.677 83.996 83.996 83.996s84.004-37.676 84.004-83.996c0-46.319-37.685-83.996-84.004-83.996zm38.51 121.123c-1.503 2.465-4.727 3.243-7.193 1.739-19.7-12.03-44.505-14.754-73.726-8.101-2.812.641-5.612-1.121-6.254-3.932-.642-2.812 1.118-5.611 3.931-6.254 31.978-7.289 59.366-4.178 81.479 9.322 2.465 1.503 3.244 4.724 1.763 7.226zm10.272-22.853c-1.893 3.077-5.927 4.043-9.004 2.152-22.556-13.858-56.94-17.869-83.624-9.746-3.463 1.053-7.127-.898-8.18-4.361-1.053-3.463.897-7.126 4.361-8.18 30.48-9.288 68.404-4.79 94.316 11.121 3.079 1.892 4.042 5.926 2.131 9.014zm.882-23.802c-27.054-16.071-71.681-17.555-97.511-10.225-4.148 1.176-8.47-1.237-9.646-5.385-1.175-4.149 1.236-8.47 5.385-9.646 29.638-8.405 78.912-6.783 109.74 11.531 3.693 2.194 4.906 6.969 2.712 10.663-2.194 3.672-6.972 4.881-10.68 2.684z" />
      </svg>
    </span>
  )
}

function PlatformBadge({ platform }) {
  const normalizedPlatform = getTrimmedString(platform).toLowerCase()
  if (!normalizedPlatform) return null
  if (normalizedPlatform === 'spotify') return <SpotifyBadge />
  return null
}

function LinkCard({ item }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col overflow-visible rounded-2xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
      aria-label={item.title}
    >
      <div className="relative overflow-visible rounded-t-2xl">
        <div className="aspect-[4/5] overflow-hidden rounded-t-2xl bg-zinc-200">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-100 px-6 text-center text-sm text-zinc-500">
              Sin imagen
            </div>
          )}
        </div>
        <PlatformBadge platform={item.platform} />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <p className="m-0 text-base font-medium leading-snug text-zinc-900">{item.title}</p>
        {item.platform && (
          <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-500">{item.platform}</p>
        )}
      </div>
    </a>
  )
}

function FileViewerPlaceholder({ fileRef, r2BaseUrl }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const extension = useMemo(() => getFileExtension(fileRef), [fileRef])
  const contentFolderKey = useMemo(() => getContentFolderKey(fileRef), [fileRef])

  useEffect(() => {
    let cancelled = false

    async function loadFileSection() {
      if (!r2BaseUrl || !fileRef) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          setError(new Error('Falta la referencia del archivo o la URL base del contenido.'))
        }
        return
      }

      if (extension !== 'json') {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          setError(
            new Error(
              extension === 'html'
                ? 'Las secciones file basadas en HTML aún no están soportadas.'
                : 'La extensión del archivo de sección no está soportada.',
            ),
          )
        }
        return
      }

      setLoading(true)
      setError(null)

      try {
        const fileUrl = toObjectUrl(r2BaseUrl, fileRef)
        const json = await fetchJson(fileUrl, `sección file ${fileRef}`)
        const normalizedItems = normalizeLinkItems(json?.links, r2BaseUrl, contentFolderKey)

        if (!cancelled) {
          setItems(normalizedItems)
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          setError(loadError)
        }
      }
    }

    loadFileSection()

    return () => {
      cancelled = true
    }
  }, [contentFolderKey, extension, fileRef, r2BaseUrl])

  if (loading) {
    return <p className="m-0 text-sm uppercase tracking-[0.18em] opacity-60">Cargando enlaces…</p>
  }

  if (error) {
    return (
      <div
        className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-6 text-zinc-600"
        aria-label={`Archivo: ${fileRef}`}
      >
        <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">archivo · visor</p>
        <p className="m-0 font-medium text-zinc-800">{fileRef}</p>
        <p className="m-0 text-sm text-red-700">{error.message}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="grid gap-3 rounded border border-dashed border-zinc-400 bg-zinc-100 p-6 text-zinc-600">
        <p className="m-0 text-xs uppercase tracking-[0.18em] text-zinc-400">archivo · enlaces</p>
        <p className="m-0 text-sm">No se encontraron enlaces válidos en esta sección.</p>
      </div>
    )
  }

  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 p-0 md:gap-6">
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <LinkCard item={item} />
        </li>
      ))}
    </ul>
  )
}

export default FileViewerPlaceholder
