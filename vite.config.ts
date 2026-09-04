import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { Connect } from 'vite'

/**
 * The soundtrack sits beside the project rather than inside it.
 *
 * Twenty-three tracks come to 85 MB even re-encoded for the web. Dropping them
 * in `public/` would work, and would also mean every `npm run build` — which is
 * the only typecheck this project has, and is run constantly — recopied all of
 * it into `dist/`. So the folder stays where it is: served from there at
 * `/ost/` by the dev and preview servers, and *hard-linked* into the build
 * output by `publish` below, which costs nothing whatever the tracks weigh.
 *
 * Links rather than copies because Vite empties `outDir` before each build, so
 * there is never anything there to reuse — a copy would be paid in full on
 * every typecheck. `dist/` is disposable and nothing ever writes into it, which
 * is what makes sharing the inodes safe.
 *
 * The copy is not optional. Production has no dev server and no middleware —
 * Vercel and anything like it serve `dist/` as flat files — so a track that is
 * not in `dist/ost/` is a 404, and a 404 is silence.
 *
 * Range requests are honoured because they are what makes a cue start
 * immediately: without them the browser has to pull a whole track before it can
 * play a second of it, and a cue that arrives eight seconds after the click it
 * belongs to is worse than no cue at all.
 */
const OST_DIR = 'ost'
const OST_ROUTE = '/ost/'

function ostAssets(): Plugin {
  const root = path.resolve(process.cwd(), OST_DIR)
  let outDir = ''

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

  /**
   * Puts the folder in the build output, for free where the platform allows it.
   *
   * A hard link first, a copy only if the filesystem refuses one — a separate
   * device or a Windows account without the privilege. Either way the build
   * output ends up holding all 23 tracks, which is the part that matters:
   * production has no middleware, so what is not in `dist/ost/` does not exist.
   */
  function publish(): void {
    let tracks: string[]
    try {
      tracks = fs.readdirSync(root).filter((name) => name.toLowerCase().endsWith('.mp3'))
    } catch {
      console.warn(`[ost-assets] No ${OST_DIR}/ directory; the build will have no soundtrack`)
      return
    }
    if (tracks.length === 0) {
      console.warn(`[ost-assets] ${OST_DIR}/ holds no tracks; the build will have no soundtrack`)
      return
    }

    const dest = path.join(outDir, OST_DIR)
    fs.mkdirSync(dest, { recursive: true })

    let linked = 0
    let copied = 0
    for (const name of tracks) {
      const from = path.join(root, name)
      const to = path.join(dest, name)
      const size = fs.statSync(from).size
      try {
        if (fs.statSync(to).size === size) continue
      } catch {
        // Not there, which after Vite has emptied outDir is every one of them.
      }
      try {
        fs.linkSync(from, to)
        linked += 1
      } catch {
        fs.copyFileSync(from, to)
        copied += 1
      }
    }
    const how = copied === 0 ? `${linked} linked` : `${linked} linked, ${copied} copied`
    console.info(`[ost-assets] ${tracks.length} tracks published to ${OST_DIR}/ (${how})`)
  }

  return {
    name: 'ost-assets',
    configResolved(config: ResolvedConfig) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
    writeBundle() {
      publish()
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ostAssets()],
})
