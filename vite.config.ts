import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { Connect } from 'vite'

/**
 * The soundtrack sits beside the project rather than inside it.
 *
 * Twenty-three tracks at 320 kbps come to 224 MB. Dropping them in `public/`
 * would work, and would also mean every `npm run build` — which is the only
 * typecheck this project has, and is run constantly — copied a quarter of a
 * gigabyte into `dist/`. So the folder stays where it is and is served from
 * there, at `/ost/`, by the dev and preview servers.
 *
 * Range requests are honoured because they are what makes a cue start
 * immediately: without them the browser has to pull a whole 20 MB track before
 * it can play a second of it, and a cue that arrives eight seconds after the
 * click it belongs to is worse than no cue at all.
 */
const OST_DIR = "Hans Zimmer - Interstellar OST (Deluxe) 2014 [MP3 @ 320 kbps]"
const OST_ROUTE = '/ost/'

function ostAssets(): Plugin {
  const root = path.resolve(process.cwd(), OST_DIR)

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith(OST_ROUTE)) return next()

    // Only ever a bare filename out of the one directory: anything carrying a
    // separator is refused rather than resolved, so the route cannot be walked
    // out of the folder it serves.
    const name = decodeURIComponent(url.slice(OST_ROUTE.length).split('?')[0])
    if (name.includes('/') || name.includes('\\') || !name.toLowerCase().endsWith('.mp3')) {
      res.statusCode = 404
      return res.end('Not an OST track')
    }

    const file = path.join(root, name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(file)
    } catch {
      res.statusCode = 404
      return res.end('No such track')
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    const range = req.headers.range
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range)
    if (match) {
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Number(match[2]) : stat.size - 1
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${stat.size}`)
        return res.end()
      }
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      res.setHeader('Content-Length', String(end - start + 1))
      return fs.createReadStream(file, { start, end }).pipe(res)
    }

    res.statusCode = 200
    res.setHeader('Content-Length', String(stat.size))
    return fs.createReadStream(file).pipe(res)
  }

  return {
    name: 'ost-assets',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ostAssets()],
})
