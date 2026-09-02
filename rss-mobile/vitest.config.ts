import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom provides DOMParser/document so domain code that parses HTML can be
    // unit-tested in Node, matching the WebView's native DOMParser at runtime.
    environment: 'jsdom',
    globals: false,
  },
})
