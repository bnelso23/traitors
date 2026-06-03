import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/defaults': {
        target: 'http://localhost:3001',
        bypass: (req, res, proxyOptions) => {
          const publicPath = path.join(__dirname, 'public', req.url);
          if (fs.existsSync(publicPath)) {
            return req.url;
          }
        }
      },
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  }
})
