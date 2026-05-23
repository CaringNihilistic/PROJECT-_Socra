import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    watch: {
      // Docker on Windows doesn't propagate fs events — use polling so HMR works
      usePolling: true,
      interval: 300,
    },
  },
})
