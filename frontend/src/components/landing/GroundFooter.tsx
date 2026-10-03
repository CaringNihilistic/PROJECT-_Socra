import type { ReactNode } from 'react'
import { Sprite } from '../../pixel/Sprite'
import { FAR_HILLS, GRASS, SOIL } from './scenery'

/**
 * The bottom of the page lands on the ground: hills on the horizon, a grass edge, and soil
 * the footer text sits on. An Idea Egg rests in the grass, where every idea starts.
 */
export function GroundFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="relative mt-10">
      <div aria-hidden="true" className="relative h-12" style={{ backgroundImage: FAR_HILLS, backgroundSize: '192px 48px', backgroundRepeat: 'repeat-x', backgroundPosition: '24px bottom' }}>
        <div className="absolute bottom-0 left-[8%] hidden sm:block">
          <Sprite name="egg" size={64} />
        </div>
      </div>
      {/* The hill colour behind the grass fills the gaps under its ragged top */}
      <div aria-hidden="true" className="h-6" style={{ backgroundColor: '#221f3f', backgroundImage: GRASS, backgroundSize: '128px 24px', backgroundRepeat: 'repeat-x' }} />
      <div style={{ backgroundImage: SOIL, backgroundSize: '128px 128px' }}>{children}</div>
    </footer>
  )
}
