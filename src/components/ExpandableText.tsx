import { useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  text: string
  children?: ReactNode
  className?: string
  previewClassName?: string
  label?: string
  style?: CSSProperties
}

export default function ExpandableText({ text, children, className = '', previewClassName = 'max-h-20', label = 'nội dung', style }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.trim().length > 220
  if (!isLong) return <p className={className} style={style}>{children ?? text}</p>

  return (
    <div>
      <div className={`${className} ${expanded ? '' : `${previewClassName} overflow-hidden`}`} style={style}>
        {children ?? text}
      </div>
      <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? `Thu gọn ${label}` : `Xem toàn bộ ${label}`}
      </button>
    </div>
  )
}
