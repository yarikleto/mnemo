import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: { external: ['electron', 'chokidar', 'fsevents', 'jszip', 'gray-matter'] }
          }
        }
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          build: { outDir: 'dist-electron/preload' }
        }
      },
      renderer: {}
    })
  ],
  build: { outDir: 'dist' }
})
