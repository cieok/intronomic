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
      .then((data) => {
        if (data.players !== undefined) {
          setPlayers(data.players);
        } else {
          setError(data.error || 'Invalid data format');
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { players, loading, error };
}