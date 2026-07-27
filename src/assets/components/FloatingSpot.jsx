import { useCallback, useEffect, useRef, useState } from 'react'
import SpotLink from './SpotLink.jsx'
import getSpotImageUrl from '../utils/getSpotImageUrl.js'

const FOOTER_HEIGHT_PX = 41
// Initial bottom offset so the spot clears the footer and doesn't overlap the breadcrumb dots
const INITIAL_BOTTOM_OFFSET = `calc(var(--footer-h, ${FOOTER_HEIGHT_PX}px) + 5rem)`

/**
 * FloatingSpot — draggable fixed overlay that shows the configured spot.
 *
 * Rendered above every other UI element (z-60). Follows the pointer when dragged.
 * Never leaves the visible viewport. The `onReadyChange` callback from SpotLink
 * is used to keep the container hidden until the SVG has loaded, avoiding layout
 * flash.
 *
 * @param {{ spot: object }} props
 */
export default function FloatingSpot({ spot }) {
  const hasSpot = getSpotImageUrl(spot) !== ''
  const [isReady, setIsReady] = useState(false)

  // Position stored as { left, top } in px, initialised once the element mounts
  // so we can read the real rendered size.
  const [pos, setPos] = useState(null)
  const containerRef = useRef(null)
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    pointerId: null,
  })

  // Compute initial px position from the CSS bottom/left defaults once the
  // element is visible (isReady) so we have real offsetHeight/offsetWidth.
  useEffect(() => {
    if (!isReady || pos !== null) return
    const el = containerRef.current
    if (!el) return

    const footerH = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--footer-h') || String(FOOTER_HEIGHT_PX),
    ) || FOOTER_HEIGHT_PX

    const initialBottom = footerH + 80 // 5rem ≈ 80px
    const initialTop = window.innerHeight - el.offsetHeight - initialBottom
    const initialLeft = 16 // 1rem

    setPos({
      left: Math.max(0, initialLeft),
      top: Math.max(0, initialTop),
    })
  }, [isReady, pos])

  const clampPosition = useCallback((left, top) => {
    const el = containerRef.current
    if (!el) return { left, top }
    const maxLeft = window.innerWidth - el.offsetWidth
    const maxTop = window.innerHeight - el.offsetHeight
    return {
      left: Math.min(Math.max(left, 0), maxLeft),
      top: Math.min(Math.max(top, 0), maxTop),
    }
  }, [])

  const handlePointerDown = useCallback((event) => {
    if (!event.isPrimary) return
    // Allow clicks on the inner link/image to pass through without starting a drag
    if (
      event.target instanceof Element &&
      event.target.closest('a,button')
    ) {
      return
    }
    const el = containerRef.current
    if (!el || pos === null) return

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: pos.left,
      startTop: pos.top,
      pointerId: event.pointerId,
    }
    el.setPointerCapture(event.pointerId)
    event.preventDefault()
  }, [pos])

  const handlePointerMove = useCallback((event) => {
    const drag = dragStateRef.current
    if (!drag.isDragging || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    setPos(clampPosition(drag.startLeft + deltaX, drag.startTop + deltaY))
  }, [clampPosition])

  const handlePointerEnd = useCallback((event) => {
    const drag = dragStateRef.current
    if (!drag.isDragging || drag.pointerId !== event.pointerId) return
    dragStateRef.current = { ...dragStateRef.current, isDragging: false, pointerId: null }
    containerRef.current?.releasePointerCapture(event.pointerId)
  }, [])

  if (!hasSpot) return null

  // While the SVG hasn't loaded yet keep the container invisible (not unmounted)
  // so SpotLink can still do its fetch and report readiness.
  const visibilityStyle = isReady && pos !== null ? 'visible' : 'invisible'

  return (
    <div
      ref={containerRef}
      className={`floating-spot fixed z-[60] ${visibilityStyle} touch-none select-none`}
      style={
        pos !== null
          ? { left: pos.left, top: pos.top }
          : { left: '1rem', bottom: INITIAL_BOTTOM_OFFSET }
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* Drag-handle pill above the spot image */}
      <div
        className="mx-auto mb-1 h-1 w-8 cursor-grab rounded-full bg-black/20 active:cursor-grabbing"
        aria-hidden="true"
      />
      <div className="cursor-grab active:cursor-grabbing">
        <SpotLink spot={spot} onReadyChange={setIsReady} />
      </div>
    </div>
  )
}
