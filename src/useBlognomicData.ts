import { useState, useEffect } from 'react';

export function useBlognomicData() {
  const [players, setPlayers] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/blognomic')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data: unknown) => {
        const result = data as { players?: number; error?: string };
        if (result.players !== undefined) {
          setPlayers(result.players);
        } else {
          setError(result.error || 'Invalid data format');
        }
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { players, loading, error };
}