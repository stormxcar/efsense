export interface ReadingHistoryItem {
  id: string
  slug: string
  title: string
  cover_image: string | null
  visited_at: string
}

const SEARCH_KEY = 'football-stories-search-history'
const READING_KEY = 'football-stories-reading-history'

function readList<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

export function getSearchHistory() {
  return readList<string>(SEARCH_KEY)
}

export function saveSearchHistory(query: string) {
  const clean = query.trim()
  if (!clean) return
  const next = [clean, ...getSearchHistory().filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6)
  localStorage.setItem(SEARCH_KEY, JSON.stringify(next))
}

export function clearSearchHistory() {
  localStorage.removeItem(SEARCH_KEY)
}

export function removeSearchHistory(query: string) {
  const next = getSearchHistory().filter(item => item.toLowerCase() !== query.toLowerCase())
  localStorage.setItem(SEARCH_KEY, JSON.stringify(next))
}

export function getReadingHistory() {
  return readList<ReadingHistoryItem>(READING_KEY)
}

export function saveReadingHistory(item: Omit<ReadingHistoryItem, 'visited_at'>) {
  const next = [
    { ...item, visited_at: new Date().toISOString() },
    ...getReadingHistory().filter(entry => entry.id !== item.id),
  ].slice(0, 8)
  localStorage.setItem(READING_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('football-stories:reading-history-changed'))
}
