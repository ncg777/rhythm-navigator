import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Use BASE_URL for GitHub Pages (/<repo>/), default to '/'
const base = process.env.BASE_URL || '/'

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'Rhythm Navigator',
        short_name: 'Rhythm Navigator',
        theme_color: '#0f172a',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: { enabled: false }
    })
  ],
  server: { port: 5173 }
})