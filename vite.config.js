import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' }
  },
  build: {
    outDir: 'dist',
    // Copy public folder contents to dist (includes _redirects for CF Pages)
    copyPublicDir: true,
  },
})
