import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
declare const process: { env: Record<string, string | undefined> }
const devApiTarget = process.env.VITE_DEV_API_URL ?? 'http://localhost:3001'

export default defineConfig({
  // Needed for GitHub Pages: https://supernovam.github.io/lesson-tracker/
  base: '/lesson-tracker/',
  plugins: [react()],
  server: {
    // Route API requests from the React app to the local Express server.
    proxy: {
      '/api': devApiTarget,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
