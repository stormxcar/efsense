import { type ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

/**
 * Tooltip – lightweight CSS-only component.
 * Wraps any element and shows a styled tooltip on hover/focus.
 */
export default function Tooltip({
  content,
  children,
  placement = 'top',
  className = '',
}: TooltipProps) {
  if (!content) return <>{children}</>

  return (
    <span className={`tooltip-wrapper ${className}`}>
      {children}
      <span className="tooltip-box" data-placement={placement} role="tooltip">
        {content}
      </span>
    </span>
  )
}
