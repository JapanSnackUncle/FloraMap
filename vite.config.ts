/// <reference types="vitest/config" />
import { execFile } from 'node:child_process';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// In `npm run dev`, rebuild public/data/places.json whenever a file in data/ changes,
// print any data errors in the terminal, and reload the page.
function rebuildDataOnChange(): Plugin {
  return {
    name: 'flora-rebuild-data',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add('data');
      server.watcher.on('all', (_event, file) => {
        if (!relative(process.cwd(), file).startsWith(`data${sep}`)) return;
        execFile(process.execPath, ['scripts/build-data.ts'], (error, stdout, stderr) => {
          if (error) server.config.logger.error(stderr || error.message);
          else {
            server.config.logger.info(stdout.trim());
            server.ws.send({ type: 'full-reload' });
          }
        });
      });
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
  plugins: [react(), rebuildDataOnChange(), serveLocalTiles()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
