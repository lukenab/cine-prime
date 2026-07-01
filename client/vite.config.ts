import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    host: 'localhost',
    port: 3000,
    proxy: {
      '/bookingseat': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ['react-player']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
})