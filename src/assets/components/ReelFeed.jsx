import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

const HEADER_HEIGHT_PX = 64
const DEFAULT_FOOTER_HEIGHT_PX = 41
const SLIDE_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT_PX}px - var(--footer-h, ${DEFAULT_FOOTER_HEIGHT_PX}px))`
const SLIDE_HEIGHT_STYLE = { height: SLIDE_HEIGHT }
const AUTO_ADVANCE_MS = 5000
const WHEEL_DEBOUNCE_MS = 550
const WHEEL_DELTA_THRESHOLD = 8
const PRIMARY_MOUSE_BUTTON = 0
const SUPPORTS_FINE_POINTER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

const BREADCRUMBS_STYLE = {
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--footer-h, 41px) + 0.75rem)',
  left: '50%',
  transform: 'translateX(-50%)',
}

/**
 * ReelSlide — single reel video slide managing its own HLS instance.
 *
 * Plays when `isActive` is true; pauses and resets when false.
 * Fires `onPlay` / `onPause` / `onEnded` to let the parent track playback state.
 */
function ReelSlide({ item, isActive, isMuted, onPlay, onPause, onEnded, slideRef }) {
  const videoRef = useRef(null)

  // Attach HLS source once
  useEffect(() => {
    const video = videoRef.current
    if (!video || !item.hlsManifestUrl) return

    let hls = null
    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(item.hlsManifestUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = item.hlsManifestUrl
    }

    return () => {
      if (hls) hls.destroy()
    }
  }, [item.hlsManifestUrl])

  // Sync muted state
  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = isMuted
  }, [isMuted])

  // Play / pause + reset based on whether this slide is the active one
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      video.play().catch(() => {
        // Autoplay may be blocked by the browser — silently ignore.
      })
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [isActive])

  return (
    <div
      ref={slideRef}
      className="relative flex min-w-full snap-start items-center justify-center bg-black"
      style={SLIDE_HEIGHT_STYLE}
    >
      {/* 9:16 column centred inside the row */}
      <div className="relative h-full overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
        <video
          ref={videoRef}
          playsInline
          className="h-full w-full object-cover"
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
        />
      </div>
    </div>
  )
}

/**
 * ReelFeed — horizontal carousel of 9:16 HLS videos.
 *
 * Only one video plays at a time. Behaviour:
 *  - Switching slides pauses and resets the previous video.
 *  - When the active video ends, the carousel automatically advances to the next slide.
 *  - While a video is actively playing, the automatic timer is suspended.
 *  - Manual navigation (rueda, arrastre, teclado, dots) always works regardless of playback state.
 *
 * @param {{ items: Array<{ id: string, hlsManifestUrl: string }> }} props
 */
export default function ReelFeed({ items }) {
  const [activeIndex, setActiveIndex] = useState(0)
  // activeIndexRef mirrors activeIndex so scroll/timer callbacks can read the
  // current index without becoming stale closures that require re-registration.
  const activeIndexRef = useRef(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [supportsFinePointer] = useState(SUPPORTS_FINE_POINTER)

  const sliderRef = useRef(null)
  const slideRefs = useRef([])
  const wheelLockedRef = useRef(false)
  const wheelTimerRef = useRef(null)
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    pointerId: null,
  })

  const itemCount = Array.isArray(items) ? items.length : 0
  const soundToggleLabel = isMuted ? 'Activar sonido' : 'Silenciar'

  const updateIndex = useCallback((index) => {
    activeIndexRef.current = index
    setActiveIndex(index)
  }, [])

  const scrollToIndex = useCallback(
    (index) => {
      if (itemCount === 0) return
      const safeIndex = Math.min(Math.max(index, 0), itemCount - 1)
      slideRefs.current[safeIndex]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'start',
        block: 'nearest',
      })
      updateIndex(safeIndex)
    },
    [itemCount, updateIndex],
  )

  const handleKeyboardNavigation = useCallback(
    (event) => {
      if (itemCount <= 0) return
      if (dragStateRef.current.isDragging) return

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault()
        scrollToIndex(Math.min(activeIndexRef.current + 1, itemCount - 1))
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        scrollToIndex(Math.max(activeIndexRef.current - 1, 0))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        scrollToIndex(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        scrollToIndex(itemCount - 1)
      }
    },
    [itemCount, scrollToIndex],
  )

  useEffect(() => {
    const slider = sliderRef.current
    if (!slider || itemCount === 0) return undefined

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const width = slider.clientWidth || 1
        const index = Math.round(slider.scrollLeft / width)
        updateIndex(Math.max(0, Math.min(index, itemCount - 1)))
      })
    }

    slider.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      slider.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [itemCount, updateIndex])

  useEffect(() => {
    const slider = sliderRef.current
    if (!slider || itemCount <= 1) return undefined

    const onWheel = (event) => {
      if (
        Math.abs(event.deltaY) < WHEEL_DELTA_THRESHOLD &&
        Math.abs(event.deltaX) < WHEEL_DELTA_THRESHOLD
      ) {
        return
      }
      event.preventDefault()
      if (wheelLockedRef.current) return

      wheelLockedRef.current = true
      clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = setTimeout(() => {
        wheelLockedRef.current = false
      }, WHEEL_DEBOUNCE_MS)

      const current = activeIndexRef.current
      if (event.deltaY > 0 || event.deltaX > 0) {
        scrollToIndex(Math.min(current + 1, itemCount - 1))
      } else {
        scrollToIndex(Math.max(current - 1, 0))
      }
    }

    slider.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      slider.removeEventListener('wheel', onWheel)
      clearTimeout(wheelTimerRef.current)
    }
  }, [itemCount, scrollToIndex])

  // Auto-advance timer — suspended while a video is actively playing.
  // Wraps around to slide 0 so the carousel loops continuously (same as Home.jsx).
  useEffect(() => {
    if (isVideoPlaying || itemCount <= 1) return undefined
    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % itemCount
      scrollToIndex(next)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [isVideoPlaying, itemCount, scrollToIndex])

  const handlePlay = useCallback(() => {
    setIsVideoPlaying(true)
  }, [])

  const handlePause = useCallback(() => {
    setIsVideoPlaying(false)
  }, [])

  // When the active video ends, advance to the next slide immediately.
  // Wraps around to slide 0 after the last video (carousel loops continuously).
  const handleEnded = useCallback(() => {
    setIsVideoPlaying(false)
    const next = (activeIndexRef.current + 1) % itemCount
    scrollToIndex(next)
  }, [itemCount, scrollToIndex])

  const handlePointerDown = useCallback((event) => {
    if (!event.isPrimary) return
    if (event.pointerType === 'mouse' && event.button !== PRIMARY_MOUSE_BUTTON) return
    if (event.target instanceof Element && event.target.closest('button,a,input,select,textarea')) {
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
  }, [])

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
  }, [])

  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div className="relative w-full">
      {/* Horizontal scrollable carousel */}
      <div
        ref={sliderRef}
        className={`reel-carousel flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth touch-pan-x ${
          supportsFinePointer ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={SLIDE_HEIGHT_STYLE}
        role="region"
        aria-label="Carrusel de videos"
        aria-live="polite"
        tabIndex={0}
        onKeyDown={handleKeyboardNavigation}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {items.map((item, index) => (
          <ReelSlide
            key={item.id}
            slideRef={(node) => {
              slideRefs.current[index] = node
            }}
            item={item}
            isActive={index === activeIndex}
            isMuted={isMuted}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
          />
        ))}
      </div>

      {/* Dot indicators */}
      {itemCount > 1 && (
        <nav
          className="pointer-events-none absolute z-20 flex justify-center"
          aria-label="Paginación de videos"
          style={BREADCRUMBS_STYLE}
        >
          <ul className="pointer-events-auto m-0 flex list-none items-center gap-2 rounded-full bg-black/40 px-3 py-2">
            {items.map((item, index) => {
              const isActive = index === activeIndex
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`h-2.5 w-2.5 rounded-full border transition ${
                      isActive ? 'border-white bg-white' : 'border-white/50 bg-transparent'
                    }`}
                    aria-label={`Ir al video ${index + 1}`}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => scrollToIndex(index)}
                  />
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {/* Global mute / unmute button — fixed to the bottom-right of the viewport */}
      <button
        type="button"
        onClick={() => setIsMuted((value) => !value)}
        aria-label={soundToggleLabel}
        className="fixed right-4 bottom-[calc(var(--footer-h,41px)+1rem)] z-50 rounded-full border border-white/30 bg-black/90 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm"
      >
        {soundToggleLabel}
      </button>
    </div>
  )
}
