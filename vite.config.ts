import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

const DATA_FILE = 'data.json'
const EXTERNAL_EVENT = 'flowmap:data-updated'

function dataSyncPlugin(): Plugin {
  // Track the exact content we last wrote to data.json. Any file-watcher
  // event whose resulting content matches this is a self-write echo and
  // MUST NOT be broadcast, regardless of timing. Content-based dedup is
  // robust against macOS fs.watch latency spikes; the timestamp-based
  // debounce we had before wasn't.
  let lastWrittenContent = ''

  return {
    name: 'data-sync',
    configureServer(server) {
      const filePath = path.resolve(__dirname, DATA_FILE)

      try {
        lastWrittenContent = fs.readFileSync(filePath, 'utf-8')
      } catch { /* file may not exist yet */ }

      server.middlewares.use('/api/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        // Collect raw bytes, then decode once. Decoding each chunk
        // individually corrupts multi-byte UTF-8 characters that straddle
        // TCP chunk boundaries (e.g. Chinese characters turning into U+FFFD).
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          try {
            JSON.parse(body)
            // Short-circuit identical writes (client saves back the same
            // content it just fetched via live-sync). No I/O, no watch event,
            // no broadcast loop.
            if (body === lastWrittenContent) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, skipped: true }))
              return
            }
            lastWrittenContent = body
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
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(filePath, 'utf-8'))
        } else {
          res.statusCode = 404
          res.end('Not found')
        }
      })

      // Watch data.json for external modifications (e.g. edits by an agent/CLI).
      // Broadcast only when on-disk content differs from what we last wrote —
      // timing-based debounces are unreliable on macOS.
      let settleTimer: ReturnType<typeof setTimeout> | null = null
      const SETTLE_MS = 150
      const scheduleBroadcast = () => {
        if (settleTimer) clearTimeout(settleTimer)
        settleTimer = setTimeout(() => {
          settleTimer = null
          let content: string
          try {
            content = fs.readFileSync(filePath, 'utf-8')
            JSON.parse(content)
          } catch {
            return
          }
          if (content === lastWrittenContent) return
          lastWrittenContent = content
          server.ws.send({
            type: 'custom',
            event: EXTERNAL_EVENT,
            data: { at: Date.now() },
          })
        }, SETTLE_MS)
      }
      const watcher = fs.watch(filePath, { persistent: false }, scheduleBroadcast)
      server.httpServer?.once('close', () => {
        if (settleTimer) clearTimeout(settleTimer)
        watcher.close()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dataSyncPlugin()],
  server: {
    host: '0.0.0.0',
    watch: {
      ignored: ['**/data.json'],
    },
    proxy: {
      // 把 /api/chat 转发到独立的 Node 后端（server/index.ts）。
      // 注意：dataSyncPlugin 已在 vite middleware 里挂了 /api/save 和 /data.json，
      // 所以这里只代理 /api/chat 这一条路径。
      '/api/chat': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
