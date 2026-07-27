import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SpotLink from '../assets/components/SpotLink.jsx'

const HEADER_HEIGHT = 64
const FOOTER_HEIGHT = 41
const AUTOPLAY_MS = 4500
const INTERACTION_PAUSE_MS = 2200
const WHEEL_DEBOUNCE_MS = 550
const DEFAULT_MEDIA_BACKGROUND = '#0a0a0a'
const SPOT_SLOT_HEIGHT = 'clamp(4rem, 12vh, 7.5rem)'
const SPOT_MAX_HEIGHT = 'clamp(3rem, 10vh, 6rem)'
const HOME_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT}px - var(--footer-h, ${FOOTER_HEIGHT}px))`
const SLIDE_HEIGHT = `calc(${HOME_HEIGHT} - var(--spot-space, 0px))`
const HOME_LAYOUT_STYLE = {
  minHeight: `calc(100vh - ${HEADER_HEIGHT}px - var(--footer-h, ${FOOTER_HEIGHT}px))`,
  height: HOME_HEIGHT,
}
const SLIDE_HEIGHT_STYLE = { height: SLIDE_HEIGHT }
const SLIDE_LAYOUT_STYLE = { height: SLIDE_HEIGHT }
const PRIMARY_MOUSE_BUTTON = 0
const SUPPORTS_FINE_POINTER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches
const BREADCRUMBS_STYLE = {
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
  left: '50%',
  transform: 'translateX(-50%)',
}

/**
 * Debug switch — set to `true` to enable the image-error fallback panel.
 *
 * When enabled, any section that has an image configured in _estructura.json
 * but fails to load will show the Section object's debug data in place of
 * the cover image.  Keep set to `false` in production (contains sensitive data).
 */
const SECTION_IMAGE_DEBUG = false

function Home({ sections, spot }) {
  const sliderRef = useRef(null)
  const slideRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [spotVisible, setSpotVisible] = useState(false)
  const activeIndexRef = useRef(0)
  const [isInteracting, setIsInteracting] = useState(false)
  const interactionTimerRef = useRef(null)
  const wheelLockedRef = useRef(false)
  const wheelTimerRef = useRef(null)
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    pointerId: null,
  })
  const [failedImages, setFailedImages] = useState(() => new Set())
  const [supportsFinePointer] = useState(SUPPORTS_FINE_POINTER)

  const sectionCount = sections.length
  const hasSpotConfigured = typeof spot?.imgUrl === 'string' && spot.imgUrl.trim() !== ''
  const homeStyle = {
    ...HOME_LAYOUT_STYLE,
    '--spot-space': spotVisible ? SPOT_SLOT_HEIGHT : '0px',
    '--spot-max-h': spotVisible ? SPOT_MAX_HEIGHT : '0px',
    '--spot-max-w': '20rem',
  }

  const handleImageError = useCallback((entryName) => {
    setFailedImages((previous) => new Set([...previous, entryName]))
  }, [])

  const updateIndex = useCallback((index) => {
    activeIndexRef.current = index
    setActiveIndex(index)
  }, [])

  const scrollToIndex = useCallback(
    (index) => {
      if (sectionCount === 0) return
      const safeIndex = Math.min(Math.max(index, 0), sectionCount - 1)
      slideRefs.current[safeIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
      updateIndex(safeIndex)
    },
    [sectionCount, updateIndex],
  )

  const markInteraction = useCallback(() => {
    setIsInteracting(true)
    clearTimeout(interactionTimerRef.current)
    interactionTimerRef.current = setTimeout(() => setIsInteracting(false), INTERACTION_PAUSE_MS)
  }, [])

  const handlePointerDown = useCallback((event) => {
    if (!event.isPrimary) return
    if (event.pointerType === 'mouse' && event.button !== PRIMARY_MOUSE_BUTTON) return
    if (
      event.target instanceof Element &&
      event.target.closest(
        'button,a,input,select,textarea,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"]',
      )
    ) {
      return
    }
    const slider = sliderRef.current
    if (!slider) return
    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: slider.scrollLeft,
      pointerId: event.pointerId,
    }
    slider.setPointerCapture(event.pointerId)
    // Bypass CSS scroll-behavior:smooth so the element follows the pointer instantly.
    slider.style.scrollBehavior = 'auto'
    markInteraction()
  }, [markInteraction])

  const handlePointerMove = useCallback((event) => {
    const slider = sliderRef.current
    const dragState = dragStateRef.current
    if (!slider || !dragState.isDragging || dragState.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragState.startX
    slider.scrollLeft = dragState.startScrollLeft - deltaX
  }, [])

  const handlePointerEnd = useCallback((event) => {
    const slider = sliderRef.current
    const dragState = dragStateRef.current
    if (!dragState.isDragging || dragState.pointerId !== event.pointerId) return
    dragStateRef.current = {
      isDragging: false,
      startX: 0,
      startScrollLeft: 0,
      pointerId: null,
    }
    if (slider?.hasPointerCapture(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId)
    }
    // Restore smooth-scroll after drag so subsequent programmatic scrolls animate.
    if (slider) {
      slider.style.scrollBehavior = ''
    }
  }, [])

  function setSlideRef(index) {
    return (node) => {
      slideRefs.current[index] = node
    }
  }

  function handleKeyDown(event) {
    if (sectionCount === 0) return

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault()
      scrollToIndex(Math.min(activeIndex + 1, sectionCount - 1))
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault()
      scrollToIndex(Math.max(activeIndex - 1, 0))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      scrollToIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      scrollToIndex(sectionCount - 1)
    }
  }

  function handleClickNavigate(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    if (x > rect.width / 2) {
      scrollToIndex(Math.min(activeIndex + 1, sectionCount - 1))
    } else {
      scrollToIndex(Math.max(activeIndex - 1, 0))
    }
    markInteraction()
  }

  // Track active slide from horizontal scroll position
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider || sectionCount === 0) return undefined

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const width = slider.clientWidth || 1
        const index = Math.round(slider.scrollLeft / width)
        updateIndex(Math.max(0, Math.min(index, sectionCount - 1)))
      })
    }

    slider.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      slider.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [sectionCount, updateIndex])

  // Autoplay — pauses while user is interacting
  useEffect(() => {
    if (sectionCount <= 1 || isInteracting) return undefined
    const id = setInterval(() => {
      const next = (activeIndexRef.current + 1) % sectionCount
      slideRefs.current[next]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
      updateIndex(next)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [sectionCount, isInteracting, updateIndex])

  // Native wheel listener — non-passive so we can call preventDefault
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider || sectionCount === 0) return undefined

    const onWheel = (event) => {
      if (Math.abs(event.deltaY) < 8 && Math.abs(event.deltaX) < 8) return
      event.preventDefault()
      if (wheelLockedRef.current) return

      wheelLockedRef.current = true
      clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = setTimeout(() => {
        wheelLockedRef.current = false
      }, WHEEL_DEBOUNCE_MS)

      const current = activeIndexRef.current
      if (event.deltaY > 0 || event.deltaX > 0) {
        const next = Math.min(current + 1, sectionCount - 1)
        slideRefs.current[next]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
        updateIndex(next)
      } else {
        const next = Math.max(current - 1, 0)
        slideRefs.current[next]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
        updateIndex(next)
      }
      markInteraction()
    }

    slider.addEventListener('wheel', onWheel, { passive: false })
    return () => slider.removeEventListener('wheel', onWheel)
  }, [sectionCount, updateIndex, markInteraction])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(interactionTimerRef.current)
      clearTimeout(wheelTimerRef.current)
    }
  }, [])

  return (
    <section className="flex w-full flex-col" id="secciones" style={homeStyle}>
      <div className="relative" style={SLIDE_HEIGHT_STYLE}>
        <div
          ref={sliderRef}
          className={`section-slider flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth touch-pan-x select-none ${
            supportsFinePointer ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          aria-label="Carrusel horizontal de secciones"
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsInteracting(true)}
          onMouseLeave={() => {
            clearTimeout(interactionTimerRef.current)
            setIsInteracting(false)
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          tabIndex={0}
          style={SLIDE_HEIGHT_STYLE}
        >
          {sections.map((section, index) => {
            const imageErrored = SECTION_IMAGE_DEBUG && section.hasConfiguredImage && failedImages.has(section.entryName)
            const hasBackground = Boolean(section.previewImage || section.backgroundColor)
            const overlayTextClass = hasBackground ? 'text-white' : 'text-zinc-950'
            const openButtonClass = hasBackground
              ? 'border-white text-white hover:bg-white hover:text-black'
              : 'border-black text-black hover:bg-black hover:text-white'
            const sectionSurfaceColor =
              section.backgroundColor ?? (section.previewImage ? DEFAULT_MEDIA_BACKGROUND : undefined)

            return (
              <article
                key={section.entryName}
                ref={setSlideRef(index)}
                className="section-slide relative min-w-full snap-start"
                aria-label={section.name}
                style={{
                  ...SLIDE_LAYOUT_STYLE,
                  backgroundColor: sectionSurfaceColor,
                }}
              >
                <div
                  className="section-slide__media relative z-10"
                  style={{ backgroundColor: sectionSurfaceColor }}
                >
                  {!imageErrored && section.previewImage && (
                    <img
                      src={section.previewImage}
                      alt={section.name}
                      onError={SECTION_IMAGE_DEBUG ? () => handleImageError(section.entryName) : undefined}
                    />
                  )}
                </div>

                {/* Debug fallback — shown instead of the cover image when it fails to load
                    and SECTION_IMAGE_DEBUG is enabled. Contains sensitive data; keep disabled
                    in production (set SECTION_IMAGE_DEBUG = false). */}
                {imageErrored && (
                  <div className="absolute inset-0 z-10 overflow-auto bg-black/80 p-4 font-mono text-xs text-green-400">
                    <p className="mb-2 text-yellow-300 uppercase tracking-widest">
                      ⚠ imagen no cargada — objeto Section
                    </p>
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(
                        typeof section.toDebugInfo === 'function'
                          ? section.toDebugInfo()
                          : section,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}

                {/* Click-navigation overlay — sits below the CTA so links remain clickable */}
                <div
                  className="absolute inset-0 z-[5] cursor-pointer"
                  onClick={handleClickNavigate}
                  aria-hidden="true"
                />

                <div
                  className={`section-slide__content relative z-10 ${overlayTextClass}`}
                >
                  <div className="section-slide__content-inner">
                    <h2 className="m-0 font-serif text-4xl font-semibold tracking-tight md:text-5xl">{section.name}</h2>
                    <Link
                      className={`inline-flex w-fit items-center justify-center border px-4 py-2 text-sm uppercase tracking-[0.1em] no-underline transition ${openButtonClass}`}
                      aria-label={`Abrir ${section.name}`}
                      to={`/seccion/${section.slug}`}
                    >
                      Abrir
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Bullets — always bottom-centered on every breakpoint */}
        <nav
          className="pointer-events-none absolute z-20 flex justify-center"
          aria-label="Paginación de secciones"
          style={BREADCRUMBS_STYLE}
        >
          <ul className="pointer-events-auto m-0 flex list-none items-center gap-2 rounded-full bg-black/40 px-3 py-2">
            {sections.map((section, index) => {
              const isActive = index === activeIndex

              return (
                <li key={section.entryName}>
                  <button
                    type="button"
                    className={`h-2.5 w-2.5 rounded-full border transition ${
                      isActive ? 'border-white bg-white' : 'border-white/50 bg-transparent'
                    }`}
                    aria-label={`Ir a ${section.name}`}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => {
                      scrollToIndex(index)
                      markInteraction()
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {hasSpotConfigured && (
        <div className="home-spot-slot">
          <SpotLink spot={spot} onReadyChange={setSpotVisible} />
        </div>
      )}
    </section>
  )
}

export default Home
