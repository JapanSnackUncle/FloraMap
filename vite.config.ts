/// <reference types="vitest/config" />
import { execFile } from 'node:child_process';
import { relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
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

export default defineConfig({
  plugins: [react(), rebuildDataOnChange()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
