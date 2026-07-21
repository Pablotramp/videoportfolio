import { useEffect, useRef } from 'react'

/**
 * Traps focus within `containerRef` while `isActive` is true.
 * Presses ESC calls `onClose`. Focuses `initialFocusRef` on activation.
 *
 * @param {boolean} isActive - Whether the trap should be active.
 * @param {React.RefObject} containerRef - Container that receives focus trap.
 * @param {Function} onClose - Called when ESC is pressed.
 * @param {React.RefObject} [initialFocusRef] - Element to focus on activation.
 */
export function useFocusTrap(isActive, containerRef, onClose, initialFocusRef) {
  // Keep onClose stable in the event handler without restarting the effect
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isActive) return undefined

    initialFocusRef?.current?.focus()

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab' || !containerRef.current) return

      const focusableElements = containerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      const focusable = Array.from(focusableElements)
      if (focusable.length === 0) return

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [isActive, containerRef, initialFocusRef])
}
