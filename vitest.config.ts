import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __API_ORIGIN__: JSON.stringify('http://test.local') },
})
