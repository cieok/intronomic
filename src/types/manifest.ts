/**
 * Metadata returned by GET /api/manifest.
 * Keys are the same IDs used by your rulesets (e.g. "agora", "nomicron").
 */
export interface ManifestEntry {
  players?: number;
  lastModified?: string;
}

export type Manifest = Record<string, ManifestEntry>;