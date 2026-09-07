import { useState, useEffect } from 'react';

interface RulesetConfig {
  id: string;
  name: string;
  url: string;
}

// Registry for current and future rulesets
const RULESETS: RulesetConfig[] = [
  {
    id: 'agora',
    name: 'Agora Nomic',
    url: 'https://raw.githubusercontent.com/agoranomic/ruleset/main/ruleset.txt',
  },
  // Additional rulesets (Infinite Nomic, Suber's Nomic, etc.) can be appended here
];

export function App() {
  const [activeId, setActiveId] = useState<string>('agora');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeRuleset = RULESETS.find((r) => r.id === activeId) || RULESETS[0];

  const loadRuleset = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ruleset (HTTP ${response.status})`);
      }
      const text = await response.text();
      setContent(text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuleset(activeRuleset.url);
  }, [activeId]);

  // Compute word and character count
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const characters = content.length;
  const lines = content ? content.split('\n').length : 0;

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <h1>Intronomic Ruleset Analyzer</h1>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
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
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem',
              background: '#f1f5f9',
              padding: '1rem',
              borderRadius: '6px',
            }}
          >
            <div>
              <small>Total Words</small>
              <h2 style={{ margin: 0 }}>{words.toLocaleString()}</h2>
            </div>
            <div>
              <small>Characters</small>
              <h2 style={{ margin: 0 }}>{characters.toLocaleString()}</h2>
            </div>
            <div>
              <small>Total Lines</small>
              <h2 style={{ margin: 0 }}>{lines.toLocaleString()}</h2>
            </div>
          </div>

          <details style={{ background: '#fafafa', border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Debug View: Raw Content Preview
            </summary>
            <pre
              style={{
                marginTop: '1rem',
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '0.85rem',
                background: '#fff',
                padding: '0.5rem',
                border: '1px solid #eee',
              }}
            >
              {content}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

export default App;