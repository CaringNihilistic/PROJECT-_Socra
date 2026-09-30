import { useEffect, useRef, type RefObject } from 'react'

// Open dialogs, most recent last: only the top one handles keys (the evolution scene
// can open above the council episode).
const stack: object[] = []

/**
 * Keyboard behaviour for a full-screen pixel dialog: Esc runs `onEscape`, Tab stays
 * inside `ref`, and focus returns to whatever was focused when the dialog opened.
 */
export function useModalKeys(ref: RefObject<HTMLElement>, onEscape: () => void) {
  const id = useRef({})
  // Captured on the first render, before autoFocus moves focus into the dialog
  const openerRef = useRef(typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null))

  useEffect(() => {
    const me = id.current
    const opener = openerRef.current
    stack.push(me)
    return () => {
      stack.splice(stack.indexOf(me), 1)
      // Deferred: StrictMode's dev-only unmount/remount re-registers synchronously, and
      // restoring focus then would pull it off the dialog's autofocused button
      queueMicrotask(() => {
        if (!stack.includes(me) && opener?.isConnected) opener.focus()
      })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id.current) return
      if (e.key === 'Escape') onEscape()
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const inside = ref.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref, onEscape])
}
