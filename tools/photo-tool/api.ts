// What the photo tool's page and its dev-server handler (server.ts) send each other.
// Types only, so the browser page can import it without pulling in Node code.

import type { Crop } from '../../src/lib/photos.ts';

/** One entry of a place's `photos` list, as written in its YAML. */
export interface PhotoEntry {
  file: string;
  /** "" for R's own photos (license "own"): no credit is written to the YAML. */
  credit: string;
  license: string;
  /** How far down the photo the subject is, in % (where its 2:1 strip is cut). Absent = 50. */
  focus_y?: number;
}

export interface ToolPlace {
  /** "<prefecture>/<municipality>/<place-id>": the YAML's path under data/places/ (no .yaml) and
   * the photo folder's path under photos/places/. */
  path: string;
  id: string;
  name_ja: string;
  name_en?: string;
  municipality: string;
  /** The YAML's `photos` list as it is on disk. */
  photos: PhotoEntry[];
  /** Image files in the photo folder, sorted. */
  files: string[];
  folderExists: boolean;
}

/** A credit/license pair used somewhere in data/, and how many photos use it. */
export interface CreditPair {
  credit: string;
  license: string;
  count: number;
}

export interface PlacesResponse {
  places: ToolPlace[];
  credits: CreditPair[];
}

export interface SaveRequest {
  path: string;
  photos: PhotoEntry[];
}

/** A species' `pin_photo`, as written in species.yaml. */
export interface SpeciesPhoto {
  /** Always `<species id>.<ext>`. */
  file: string;
  /** "" for R's own photos (license "own"): no credit is written to the YAML. */
  credit: string;
  license: string;
  /** Absent = the largest centred square. */
  crop?: Crop;
}

export interface ToolSpecies {
  id: string;
  kind: 'bloom' | 'foliage';
  name_ja: string;
  name_en: string;
  /** The YAML's `pin_photo` as it is on disk. */
  pin_photo?: SpeciesPhoto;
  /** Files in photos/species/ named after this species (more than one is a mistake). */
  files: string[];
}

export interface SpeciesResponse {
  species: ToolSpecies[];
  /** Files in photos/species/ that match no species id (allowed: planting overrides). */
  unmatched: string[];
  credits: CreditPair[];
}

export interface SpeciesSaveRequest {
  id: string;
  /** null removes the species' `pin_photo`. */
  pin_photo: SpeciesPhoto | null;
}

export type SaveResponse =
  | { ok: true; changed: boolean; check: { ok: boolean; output: string } }
  | { ok: false; error: string };

/** Event the dev server sends after it rebuilt the data (a file in data/ or photos/ changed). */
export const DATA_REBUILT_EVENT = 'flora:data-rebuilt';
