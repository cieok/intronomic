import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cloudflare()
  ],
  // Scope rollupOptions to the client environment so it doesn't break the Worker build
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: './index.html',
          },
        },
      },
    },
  },
});