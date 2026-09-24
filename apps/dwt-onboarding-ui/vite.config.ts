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
      '@dwt/mfe-software-provider-signup': resolve(
        root,
        'packages/dwt-mfe-software-provider-signup/src/index.ts',
      ),
      '@dwt/mfe-operator-signup': resolve(root, 'packages/dwt-mfe-operator-signup/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    fs: { allow: [root] },
    proxy: {
      '/bff': 'http://127.0.0.1:8787',
    },
  },
})
