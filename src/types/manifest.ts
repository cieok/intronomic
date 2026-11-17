/**
 * Metadata returned by GET /api/manifest.
 * Keys are the same IDs used by your rulesets (e.g. "agora", "nomicron").
 */
export interface ManifestEntry {
  players?: number;          // Optional for backwards compatibility if old cache keys exist
  player_counts?: number[];  // Rolling array of the last 4 player counts
  lastModified?: string;
}

export type Manifest = Record<string, ManifestEntry>;