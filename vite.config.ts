import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

const DATA_FILE = 'data.json'

function dataSyncPlugin(): Plugin {
  return {
    name: 'data-sync',
    configureServer(server) {
      server.middlewares.use('/api/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            JSON.parse(body)
            const filePath = path.resolve(__dirname, DATA_FILE)
            fs.writeFileSync(filePath, body, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.statusCode = 400
            res.end('Invalid JSON')
          }
        })
      })

      server.middlewares.use('/data.json', (_req, res) => {
        const filePath = path.resolve(__dirname, DATA_FILE)
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(filePath, 'utf-8'))
        } else {
          res.statusCode = 404
          res.end('Not found')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dataSyncPlugin()],
})
