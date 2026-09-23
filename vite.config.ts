import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'V79 Hub',
        short_name: 'V79 Hub',
        description: 'One secure starting point for the V79 Digital business technology ecosystem.',
        theme_color: '#020617',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [{
          src: 'icon.svg',
          sizes: '192x192 512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }]
      }
    })
  ],
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
