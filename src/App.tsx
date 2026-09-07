import { useState, useEffect } from 'react';

interface RulesetConfig {
  id: string;
  name: string;
  url: string;
}

const RULESETS: RulesetConfig[] = [
  {
    id: 'agora',
    name: 'Agora Nomic (FLR)',
    url: 'https://agoranomic.org/ruleset/flr-fresh.txt',
  },
  {
    id: 'curiosity',
    name: 'Curiosity Nomic',
    url: 'https://raw.githubusercontent.com/cieok/curiosity/main/README.md',
  },
];

export function App() {
  const [activeId, setActiveId] = useState<string>('agora');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeRuleset = RULESETS.find((r) => r.id === activeId) || RULESETS[0];

  useEffect(() => {
    async function fetchRuleset() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(activeRuleset.url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const text = await res.text();
        setContent(text);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch ruleset';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchRuleset();
  }, [activeId]);

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lines = content ? content.split('\n').length : 0;

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <h1>Intronomic Ruleset Analyzer</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {RULESETS.map((ruleset) => (
          <button
            key={ruleset.id}
            onClick={() => setActiveId(ruleset.id)}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: activeId === ruleset.id ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {ruleset.name}
          </button>
        ))}
      </div>

      {loading && <p>Loading ruleset from {activeRuleset.name}...</p>}

      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: 'flex', gap: '2rem', background: '#f1f5f9', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
            <div>
              <small style={{ color: '#64748b' }}>Total Words</small>
              <h2 style={{ margin: 0 }}>{words.toLocaleString()}</h2>
            </div>
            <div>
              <small style={{ color: '#64748b' }}>Total Lines</small>
              <h2 style={{ margin: 0 }}>{lines.toLocaleString()}</h2>
            </div>
          </div>

          <details style={{ background: '#fafafa', border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Debug View: Raw Content Preview
            </summary>
            <pre style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.85rem', background: '#fff', padding: '0.5rem', border: '1px solid #eee' }}>
              {content}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

export default App;