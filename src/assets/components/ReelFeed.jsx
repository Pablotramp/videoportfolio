import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'

const HEADER_HEIGHT_PX = 64
const DEFAULT_FOOTER_HEIGHT_PX = 41
const SLIDE_HEIGHT = `calc(100dvh - ${HEADER_HEIGHT_PX}px - var(--footer-h, ${DEFAULT_FOOTER_HEIGHT_PX}px))`
const SLIDE_HEIGHT_STYLE = { height: SLIDE_HEIGHT }
const AUTO_ADVANCE_MS = 5000
const SWIPE_HINT_DURATION_MS = 2400
const WHEEL_DEBOUNCE_MS = 550
const WHEEL_DELTA_THRESHOLD = 8
const PRIMARY_MOUSE_BUTTON = 0
const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SUPPORTS_FINE_POINTER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

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
  const normalizedItems = useMemo(() => (Array.isArray(items) ? items : []), [items])
  const itemCount = normalizedItems.length
  const [activeIndex, setActiveIndex] = useState(0)
  // activeIndexRef mirrors activeIndex so scroll/timer callbacks can read the
  // current index without becoming stale closures that require re-registration.
  const activeIndexRef = useRef(0)
  const [dismissedSwipeHintKey, setDismissedSwipeHintKey] = useState(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [supportsFinePointer] = useState(SUPPORTS_FINE_POINTER)
  const swipeHintDescriptionId = useId()

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

  const soundToggleLabel = isMuted ? 'Activar sonido' : 'Silenciar'
  const swipeHintKey = useMemo(() => {
    if (itemCount <= 1 || PREFERS_REDUCED_MOTION) return null
    return normalizedItems.map((item, index) => item.id ?? `slide-${index}`).join('|')
  }, [itemCount, normalizedItems])
  const showSwipeHint = swipeHintKey !== null && dismissedSwipeHintKey !== swipeHintKey

  useEffect(() => {
    if (!showSwipeHint || swipeHintKey === null) return undefined
    const timer = setTimeout(() => {
      setDismissedSwipeHintKey(swipeHintKey)
    }, SWIPE_HINT_DURATION_MS)

    return () => clearTimeout(timer)
  }, [showSwipeHint, swipeHintKey])

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
      const isFocused = document.activeElement === slider
      if (!isFocused && !slider.matches(':hover')) return
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

  if (itemCount === 0) return null

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
        aria-describedby={itemCount > 1 ? swipeHintDescriptionId : undefined}
        tabIndex={0}
        onKeyDown={handleKeyboardNavigation}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {normalizedItems.map((item, index) => (
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

      {itemCount > 1 && (
        <p id={swipeHintDescriptionId} className="sr-only">
          Desliza lateralmente para cambiar de video.
        </p>
      )}

      {showSwipeHint && (
        <div
          aria-hidden="true"
          className="reel-swipe-hint pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
        >
          <div className="reel-swipe-hint__icon rounded-full border border-white/20 bg-black/35 p-6 text-white shadow-[0_0_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
              <path
                d="M30 48h36"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M41 34 27 48l14 14"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m55 34 14 14-14 14"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Global mute / unmute button — fixed to the bottom-right of the viewport */}
      <button
        type="button"
        onClick={() => setIsMuted((value) => !value)}
        aria-label={soundToggleLabel}
        className="fixed right-4 bottom-[calc(var(--footer-h,41px)+1rem)] z-50 rounded-full border border-white/30 bg-black/90 p-2.5 text-white backdrop-blur-sm"
      >
        {isMuted ? (
          /* Speaker muted */
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM11 5.73 8.76 7.97 11 10.2V5.73Z" />
          </svg>
        ) : (
          /* Speaker active */
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>
    </div>
  )
}
