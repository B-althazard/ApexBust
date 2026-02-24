import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'
import react from '@vitejs/plugin-react'

// GitHub Pages static hosting friendly:
// - base: './' makes asset URLs relative and works under repo subpaths
export default defineConfig({
  define: { __BUILD_VERSION__: JSON.stringify(`v${pkg.version} (${new Date().toISOString().slice(0,10)})`) },
  
  base: './',
  plugins: [react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png','icons/icon-512.png'],
      manifest: {"name": "ApexBust", "short_name": "ApexBust", "start_url": "./", "display": "standalone", "background_color": "#0b0f14", "theme_color": "#0b0f14", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"}, {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"}, {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"}, {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
      workbox: {
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    })
  ],
})
