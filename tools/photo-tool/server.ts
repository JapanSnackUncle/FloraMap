// The photo tool's dev-server handler (Vite plugin; `npm run dev` only, never in a build).
// The page can't touch files itself, so it asks here:
//   GET  /__photo-tool/places               every place, its `photos` list and its folder's files
//   GET  /__photo-tool/img/<path>/<file>     an original from photos/places/
//   POST /__photo-tool/save                 {path, photos}: rewrite that place's `photos` list,
//                                           then run the data check and return its output
// Only the `photos` block of a place YAML is ever written (see photo-data.ts).

import { execFile } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, normalize, relative, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';
import { parse } from 'yaml';
import type { PhotoEntry, PlacesResponse, SaveRequest, SaveResponse, ToolPlace } from './api.ts';
import {
  collectCreditPairs,
  IMAGE_EXTENSIONS,
  photoListProblems,
  setPlacePhotos,
} from './photo-data.ts';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const PLACES_DIR = join(DATA_DIR, 'places');
const PHOTOS_DIR = join(ROOT, 'photos', 'places');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function yamlFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? yamlFilesIn(p) : n.endsWith('.yaml') ? [p] : [];
  });
}

/** "<prefecture>/<municipality>/<place-id>" for a place YAML path. */
const placePath = (yamlFile: string) =>
  relative(PLACES_DIR, yamlFile)
    .replace(/\.yaml$/, '')
    .split(sep)
    .join('/');

function imageFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((n) => IMAGE_EXTENSIONS.includes(extname(n).toLowerCase()))
    .filter((n) => statSync(join(folder, n)).isFile())
    .sort((a, b) => a.localeCompare(b));
}

function listPlaces(): PlacesResponse {
  const places: ToolPlace[] = [];
  const parsed: unknown[] = [];
  for (const file of yamlFilesIn(PLACES_DIR)) {
    let doc: Record<string, unknown>;
    try {
      doc = parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch {
      continue; // a broken file shows up in the data check, not here
    }
    parsed.push(doc);
    const path = placePath(file);
    const folder = join(PHOTOS_DIR, ...path.split('/'));
    places.push({
      path,
      id: String(doc.id ?? path.split('/').pop()),
      name_ja: String(doc.name_ja ?? ''),
      name_en: typeof doc.name_en === 'string' ? doc.name_en : undefined,
      municipality: String(doc.municipality ?? ''),
      photos: Array.isArray(doc.photos) ? (doc.photos as PhotoEntry[]) : [],
      files: imageFiles(folder),
      folderExists: existsSync(folder),
    });
  }
  const species = join(DATA_DIR, 'species.yaml');
  if (existsSync(species)) parsed.push(parse(readFileSync(species, 'utf8')));
  places.sort((a, b) => a.path.localeCompare(b.path));
  return { places, credits: collectCreditPairs(parsed) };
}

/** The place YAML for a path from the page, or null if it isn't one (no "..", no other folders). */
function placeFileFor(path: unknown): string | null {
  if (typeof path !== 'string' || !/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(path)) return null;
  const file = join(PLACES_DIR, ...path.split('/')) + '.yaml';
  return existsSync(file) ? file : null;
}

function runCheck(): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ['scripts/build-data.ts', '--check'],
      { cwd: ROOT },
      (error, stdout, stderr) =>
        resolve({ ok: !error, output: `${stdout}${stderr}`.trim() || String(error ?? '') }),
    ),
  );
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function save(req: Connect.IncomingMessage): Promise<SaveResponse> {
  let body: SaveRequest;
  try {
    body = JSON.parse(await readBody(req)) as SaveRequest;
  } catch {
    return { ok: false, error: 'could not read the request' };
  }
  const file = placeFileFor(body.path);
  if (!file) return { ok: false, error: `no place file for "${String(body.path)}"` };
  if (!Array.isArray(body.photos)) return { ok: false, error: 'photos must be a list' };
  const photos: PhotoEntry[] = body.photos.map((p) => ({
    file: String(p.file ?? ''),
    credit: String(p.credit ?? '').trim(),
    license: String(p.license ?? '').trim(),
    ...(p.focus_y === undefined || p.focus_y === null ? {} : { focus_y: Number(p.focus_y) }),
  }));
  const folder = join(PHOTOS_DIR, ...body.path.split('/'));
  const problems = photoListProblems(photos, imageFiles(folder));
  if (problems.length) return { ok: false, error: problems.join('\n') };

  // Read the file now, not when the page loaded, so edits made since (by hand or in the data
  // chat) are kept: only the photos block is replaced.
  const before = readFileSync(file, 'utf8');
  let after: string;
  try {
    after = setPlacePhotos(before, photos);
  } catch (e) {
    return {
      ok: false,
      error: `the YAML file can't be read, so nothing was written: ${String(e)}`,
    };
  }
  if (after !== before) writeFileSync(file, after, 'utf8');
  return { ok: true, changed: after !== before, check: await runCheck() };
}

function sendJson(res: Parameters<Connect.NextHandleFunction>[1], value: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  const url = (req.url ?? '/').split('?')[0]!;
  if (req.method === 'GET' && url === '/places') return sendJson(res, listPlaces());
  if (req.method === 'POST' && url === '/save') {
    save(req).then(
      (r) => sendJson(res, r),
      (e: unknown) => sendJson(res, { ok: false, error: String(e) } satisfies SaveResponse, 500),
    );
    return;
  }
  if (req.method === 'GET' && url.startsWith('/img/')) {
    const file = normalize(join(PHOTOS_DIR, decodeURIComponent(url.slice('/img/'.length))));
    const type = CONTENT_TYPES[extname(file).toLowerCase()];
    if (!file.startsWith(PHOTOS_DIR + sep) || !type || !existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(file).pipe(res);
    return;
  }
  next();
};

export function photoTool(): Plugin {
  return {
    name: 'flora-photo-tool',
    apply: 'serve',
    configureServer: (server) => void server.middlewares.use('/__photo-tool', handler),
  };
}
