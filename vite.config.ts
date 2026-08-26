import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'logo-warehouse.png', 'icon-180.png', 'icon-120.png'],
        manifest: {
          name: 'Warehouse Elnusa BSD - Presence System',
          short_name: 'ElnusaAbsensi',
          description: 'Warehouse ELNUSA BSD Integrated Presence & Warehouse Management System',
          theme_color: '#2563eb',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'logo-warehouse.png',
              sizes: 'any',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-120.png',
              sizes: '120x120',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-180.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
          globIgnores: ['**/vendor-leaflet*.js', '**/leaflet*.js', '**/react-leaflet*.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/firebaseinstallations\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/__/],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-recharts': ['recharts'],
            'vendor-leaflet': ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
    },
  };
});
