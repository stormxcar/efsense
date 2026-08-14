import { useEffect, useState } from 'react'
import { Clock3, Lightbulb, Search, Trash2, X } from 'lucide-react'

type Suggestion = string | { label: string; value: string }

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
  storageKey: string
  suggestions?: Suggestion[]
}

function loadHistory(storageKey: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

export default function AdminListSearch({ value, onChange, placeholder, storageKey, suggestions = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setHistory(loadHistory(storageKey)), 0)
    return () => window.clearTimeout(timer)
  }, [open, storageKey])

  const remember = (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    const next = [trimmed, ...history.filter(item => item !== trimmed)].slice(0, 8)
    setHistory(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const selectTerm = (term: string) => {
    onChange(term)
    remember(term)
    setOpen(false)
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(storageKey)
  }

  const normalizedSuggestions = suggestions.map(item => typeof item === 'string' ? { label: item, value: item } : item)
  const filteredSuggestions = normalizedSuggestions.filter(item => !value.trim() || `${item.label} ${item.value}`.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6)

  return (
    <div className="relative w-full max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      <input
        value={value}
        onChange={event => { onChange(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        onKeyDown={event => { if (event.key === 'Enter') remember(value); if (event.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        className="input h-9 w-full pl-9 pr-8 text-sm"
        aria-label={placeholder}
      />
      {value && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(''); setOpen(true) }} aria-label="Xóa nội dung tìm kiếm"><X size={14} style={{ color: 'var(--text-muted)' }} /></button>}

      {open && (
        <div className="absolute left-0 right-0 top-11 z-50 rounded-xl border p-3 shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[.68rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}><Clock3 size={12} /> Tìm gần đây</p>
            {history.length > 0 && <button type="button" className="flex items-center gap-1 text-[.68rem] text-blue-400 hover:underline" onMouseDown={event => event.preventDefault()} onClick={clearHistory}><Trash2 size={12} /> Xóa lịch sử</button>}
          </div>
          {history.length > 0 ? <div className="mb-3 flex flex-wrap gap-1.5">{history.map(item => <button key={item} type="button" className="max-w-full truncate rounded-full border px-2.5 py-1 text-xs hover:border-blue-400/60" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} onMouseDown={event => event.preventDefault()} onClick={() => selectTerm(item)}>{item}</button>)}</div> : <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>Chưa có lịch sử tìm kiếm.</p>}
          {filteredSuggestions.length > 0 && <>
            <p className="mb-2 flex items-center gap-1.5 text-[.68rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}><Lightbulb size={12} /> Gợi ý tìm nhanh</p>
            <div className="space-y-1">{filteredSuggestions.map(item => <button key={`${item.label}-${item.value}`} type="button" className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-xs hover:bg-white/5" onMouseDown={event => event.preventDefault()} onClick={() => selectTerm(item.value)}>{item.label}</button>)}</div>
          </>}
        </div>
      )}
    </div>
  )
}
