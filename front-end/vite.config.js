import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Necesario para que corra bien en Dokploy / contenedores
    headers: {
      // Evita que el navegador cachee los archivos servidos en desarrollo,
      // así los cambios de código se ven al recargar sin necesidad de incógnito.
      'Cache-Control': 'no-store'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
