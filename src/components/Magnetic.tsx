import { useRef, type PointerEvent, type ReactNode } from 'react'

export default function Magnetic({ children, strength = 0.22 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)

  const move = (event: PointerEvent<HTMLSpanElement>) => {
    const node = ref.current
    if (!node || event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = node.getBoundingClientRect()
    const x = (event.clientX - (rect.left + rect.width / 2)) * strength
    const y = (event.clientY - (rect.top + rect.height / 2)) * strength
    node.style.setProperty('--magnetic-x', `${x}px`)
    node.style.setProperty('--magnetic-y', `${y}px`)
  }

  const reset = () => {
    ref.current?.style.setProperty('--magnetic-x', '0px')
    ref.current?.style.setProperty('--magnetic-y', '0px')
  }

  return <span ref={ref} className="magnetic-wrap" onPointerMove={move} onPointerLeave={reset}>{children}</span>
}
