import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En développement, l'API Django tourne sur :8000 ; les cookies de session restent sur la même origine.
// API_PROXY : autre API locale (tests de bout en bout sur une base jetable).
const api = process.env.API_PROXY ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/media': api,
      '/apercu': api,
      '/sitemap.xml': api,
      '/robots.txt': api,
    },
  },
})
