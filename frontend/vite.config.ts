import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget =
  ((globalThis as any).process?.env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})