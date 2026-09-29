import type { ButtonHTMLAttributes } from 'react'

/** A battle-menu style option, used for suggested answers. */
export function MenuChoice({ type = 'button', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`flex items-center gap-2.5 min-h-[48px] px-3.5 py-2 text-left font-read text-base text-px-screen bg-px-night border-[3px] border-px-edge hover:border-px-xp focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-px-plan disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      <span aria-hidden="true" className="font-pixel text-[10px] text-px-xp">▶</span>
      {children}
    </button>
  )
}
