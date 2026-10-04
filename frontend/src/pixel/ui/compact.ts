import { createContext, useContext } from 'react'

/**
 * True inside a narrow column on a wide screen (the landing page's demo). Tailwind's `sm:` and
 * `lg:` variants follow the viewport, not the column, so components that have a phone layout
 * read this and keep to it.
 */
export const CompactContext = createContext(false)

/** Returns a filter for viewport-variant classes: dropped in a compact column, kept elsewhere. */
export function useWide(): (classes: string) => string {
  const compact = useContext(CompactContext)
  return (classes) => (compact ? '' : classes)
}
