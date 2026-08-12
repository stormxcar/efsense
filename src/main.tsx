import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply saved theme before first paint to avoid flash
const savedTheme = (() => {
  try {
    const raw = localStorage.getItem('theme-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed?.state?.theme ?? 'dark'
    }
  } catch { /* ignore */ }
  return 'dark'
})()
document.documentElement.setAttribute('data-theme', savedTheme)

createRoot(document.getElementById('root')!).render(
  <App />
)
