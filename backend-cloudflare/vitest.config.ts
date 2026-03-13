import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      ustaxes: path.resolve(__dirname, '../src'),
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
    isolate: true
  }
})
