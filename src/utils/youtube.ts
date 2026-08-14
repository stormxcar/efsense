export function getYouTubeVideoId(input: string) {
  const validId = (value: string | null) => value && /^[\w-]{11}$/.test(value) ? value : null
  try {
    const value = input.trim()
    if (/^[\w-]{11}$/.test(value)) return value
    const url = new URL(value)
    if (url.hostname === 'youtu.be') return validId(url.pathname.slice(1).split('/')[0] ?? null)
    if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
      if (url.pathname === '/watch') return validId(url.searchParams.get('v'))
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) return validId(parts[1] ?? null)
    }
  } catch {
    return null
  }
  return null
}
