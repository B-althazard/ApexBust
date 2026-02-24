import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages static hosting friendly:
// - base: './' makes asset URLs relative and works under repo subpaths
export default defineConfig({
  base: './',
  plugins: [react()],
})
