import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@dwt/govuk': resolve(root, 'packages/dwt-govuk/src/index.ts'),
      '@dwt/mfe-create-movement': resolve(root, 'packages/dwt-mfe-create-movement/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    fs: { allow: [root] },
  },
})
