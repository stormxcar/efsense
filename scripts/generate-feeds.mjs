import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readEnv() {
  try {
    const raw = await readFile(path.join(root, '.env'), 'utf8')
    return Object.fromEntries(raw.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : []
    }))
  } catch {
    return {}
  }
}

const escapeXml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const env = await readEnv()
const siteUrl = (env.VITE_SITE_URL || 'https://footballstories.vn').replace(/\/$/, '')
const supabaseUrl = env.VITE_SUPABASE_URL
const apiKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
let posts = []

if (supabaseUrl && apiKey) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/posts?select=title,slug,excerpt,cover_image,og_image,published_at,updated_at&status=eq.published&order=published_at.desc&limit=500`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    })
    if (response.ok) posts = await response.json()
  } catch {
    // Static routes are still emitted so builds remain deterministic offline.
  }
}

const staticRoutes = ['', '/series', '/search', '/media', '/doc-nhieu-tuan-nay']
const sitemapEntries = [
  ...staticRoutes.map(route => `<url><loc>${siteUrl}${route}</loc><changefreq>daily</changefreq></url>`),
  ...posts.map(post => `<url><loc>${siteUrl}/posts/${escapeXml(post.slug)}</loc><lastmod>${escapeXml(post.updated_at || post.published_at)}</lastmod><changefreq>weekly</changefreq></url>`),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`

const rssItems = posts.slice(0, 50).map(post => `<item>
  <title>${escapeXml(post.title)}</title>
  <link>${siteUrl}/posts/${escapeXml(post.slug)}</link>
  <guid isPermaLink="true">${siteUrl}/posts/${escapeXml(post.slug)}</guid>
  <description>${escapeXml(post.excerpt)}</description>
  <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
  ${(post.og_image || post.cover_image) ? `<enclosure url="${escapeXml(post.og_image || post.cover_image)}" type="image/jpeg" />` : ''}
</item>`).join('\n')
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">
<channel>
  <title>Football Stories</title>
  <link>${siteUrl}</link>
  <description>Sau mỗi tỷ số là một câu chuyện.</description>
  <language>vi-VN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${rssItems}
</channel>
</rss>\n`

await mkdir(path.join(root, 'public'), { recursive: true })
await Promise.all([
  writeFile(path.join(root, 'public', 'sitemap.xml'), sitemap),
  writeFile(path.join(root, 'public', 'rss.xml'), rss),
])
console.log(`Generated sitemap.xml and rss.xml with ${posts.length} published posts.`)
