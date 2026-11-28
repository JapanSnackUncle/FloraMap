/// <reference types="vitest/config" />
import { execFile } from 'node:child_process';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { PRELOAD_GLYPHS } from './src/basemap-assets.ts';
import { DATA_REBUILT_EVENT } from './tools/photo-tool/api.ts';
import { photoTool } from './tools/photo-tool/server.ts';

// In `npm run dev`, rebuild public/data/places.json (and the pin photos) whenever a file in data/
// or photos/ changes, print any data errors in the terminal, and tell the open pages
// (DATA_REBUILT_EVENT): the app reloads itself, the photo tool refreshes its lists and keeps any
// unsaved edits.
function rebuildDataOnChange(): Plugin {
  return {
    name: 'flora-rebuild-data',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(['data', 'photos']);
      server.watcher.on('all', (_event, file) => {
        const rel = relative(process.cwd(), file);
        if (!rel.startsWith(`data${sep}`) && !rel.startsWith(`photos${sep}`)) return;
        execFile(process.execPath, ['scripts/build-data.ts'], (error, stdout, stderr) => {
          if (error) server.config.logger.error(stderr || error.message);
          else {
            server.config.logger.info(stdout.trim());
            server.ws.send({ type: 'custom', event: DATA_REBUILT_EVENT });
          }
        });
      });
    },
  };
}

// In builds, add preload hints to index.html so files the map needs start downloading with the
// app's JavaScript instead of one after another (measured 2026-11-29: the map worker started only
// after the app's JavaScript had run, and the label fonts only after the first tiles arrived).
//   - MapLibre's worker script (its file name has a content hash, so it's looked up in the bundle).
//   - The opening view's label fonts (PRELOAD_GLYPHS).
// `as="fetch"` + `crossorigin`: MapLibre fetches fonts the same way, so the browser hands the
// preloaded copy straight over. The worker can't take a preloaded copy directly (Chrome rejects
// `as="worker"`: tried 2026-11-29), but it finds the file already in the HTTP cache; Chrome still
// logs a harmless "preloaded but not used" warning for it.
function preloadHints(): Plugin {
  let base = '/';
  return {
    name: 'flora-preload-hints',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const worker = Object.keys(ctx.bundle ?? {}).find((f) =>
          /maplibre-gl-worker-[\w-]+\.mjs$/.test(f),
        );
        if (!worker) throw new Error('preloadHints: MapLibre worker not found in the bundle');
        return [worker, ...PRELOAD_GLYPHS].map((path) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'fetch', crossorigin: '', href: `${base}${path}` },
          injectTo: 'head',
        }));
      },
    },
  };
}

// In `npm run dev` and `npm run preview`, serve tiles/*.pmtiles at /tiles/. The basemap is
// too big for public/ (it would be copied into every build), and PMTiles readers fetch
// byte ranges, so this answers HTTP Range requests with just those bytes.
function serveLocalTiles(): Plugin {
  const dir = join(process.cwd(), 'tiles');
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const file = normalize(join(dir, decodeURIComponent((req.url ?? '/').split('?')[0]!)));
    if (!file.startsWith(dir + sep) || !file.endsWith('.pmtiles')) return next();
    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      res.statusCode = 404;
      res.end('Tile file not found. See "Basemap tiles" in README.md.');
      return;
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
    if (!m) {
      res.setHeader('Content-Length', size);
      createReadStream(file).pipe(res);
      return;
    }
    const start = Number(m[1]);
    const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
    if (start > end) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    createReadStream(file, { start, end }).pipe(res);
  };
  return {
    name: 'flora-serve-tiles',
    configureServer: (server) => void server.middlewares.use('/tiles', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/tiles', handler),
  };
}

export default defineConfig({
  plugins: [react(), rebuildDataOnChange(), serveLocalTiles(), photoTool(), preloadHints()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
