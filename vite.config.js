import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/projects/unravel-recursion/',
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Treat ?raw imports as returning an empty string default export in tests.
    // This prevents the tracer.py?raw loader from trying to read the file at
    // import time when Pyodide is mocked.
    server: {
      deps: {
        inline: [/codemirror/, /@codemirror/, /d3/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/engine/pyodide.js'], // loaded from CDN, tested separately
    },
  },
})
