import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En développement, l'API Django tourne sur :8000 ; les cookies de session restent sur la même origine.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
      '/apercu': 'http://127.0.0.1:8000',
      '/sitemap.xml': 'http://127.0.0.1:8000',
      '/robots.txt': 'http://127.0.0.1:8000',
    },
  },
})
