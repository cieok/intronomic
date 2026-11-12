import { useCallback, useEffect, useState } from 'react';
import type { Manifest } from './types/manifest';

interface UseManifestResult {
  manifest: Manifest;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useManifest(): UseManifestResult {
  const [manifest, setManifest] = useState<Manifest>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/manifest', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Manifest request failed: HTTP ${response.status}`);
      }

      const data: unknown = await response.json();

      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Manifest response must be a JSON object');
      }

      setManifest(data as Manifest);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { manifest, loading, error, refresh };
}