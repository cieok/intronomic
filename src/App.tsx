import { useState, useEffect } from 'react';

interface RulesetConfig {
  id: string;
  name: string;
  fetchUrl: string;
  linkUrl: string;
  isJsonApi?: boolean;
}

const RULESETS: RulesetConfig[] = [
  {
    id: 'agora',
    name: 'Agora Nomic (FLR)',
    fetchUrl: 'https://agoranomic.org/ruleset/flr-fresh.txt',
    linkUrl: 'https://agoranomic.org/ruleset/flr-fresh.txt',
  },
  {
    id: 'blognomic',
    name: 'BlogNomic',
    fetchUrl: 'https://wiki.blognomic.com/api.php?action=parse&page=Ruleset&format=json&prop=wikitext&origin=*',
    linkUrl: 'https://wiki.blognomic.com/index.php?title=Ruleset',
    isJsonApi: true,
  },
  {
    id: 'curiosity',
    name: 'Curiosity nomic',
    fetchUrl: 'https://raw.githubusercontent.com/cieok/curiosity/main/README.md',
    linkUrl: 'https://github.com/cieok/curiosity/blob/main/README.md',
  },
];

interface MetricData {
  words: number;
  characters: number;
  lines: number;
  content: string;
  loading: boolean;
  error: string | null;
}

export function App() {
  const [dataMap, setDataMap] = useState<Record<string, MetricData>>(() => {
    const initialMap: Record<string, MetricData> = {};
    RULESETS.forEach((r) => {
      initialMap[r.id] = { words: 0, characters: 0, lines: 0, content: '', loading: true, error: null };
    });
    return initialMap;
  });

  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  const fetchMetrics = async (ruleset: RulesetConfig): Promise<Omit<MetricData, 'loading' | 'error'>> => {
    const res = await fetch(ruleset.fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    let text = '';
    if (ruleset.isJsonApi) {
      const json = await res.json();
      text = json?.parse?.wikitext?.['*'] || '';
    } else {
      text = await res.text();
    }

    return {
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      characters: text.length,
      lines: text ? text.split('\n').length : 0,
      content: text,
    };
  };

  useEffect(() => {
    RULESETS.forEach((ruleset) => {
      fetchMetrics(ruleset)
        .then((data) => {
          setDataMap((prev) => ({
            ...prev,
            [ruleset.id]: { ...data, loading: false, error: null },
          }));
        })
        .catch((err) => {
          setDataMap((prev) => ({
            ...prev,
            [ruleset.id]: { ...prev[ruleset.id], loading: false, error: err.message },
          }));
        });
    });
  }, []);

  const activeRuleset = RULESETS.find((r) => r.id === activePreviewId);
  const activeContent = activePreviewId ? dataMap[activePreviewId]?.content : '';

  return (
    <div style={{ maxWidth: '1000px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <h1>Intronomic Ruleset Comparison</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: '0.75rem' }}>Ruleset</th>
            <th style={{ padding: '0.75rem' }}>Status</th>
            <th style={{ padding: '0.75rem' }}>Total Words</th>
            <th style={{ padding: '0.75rem' }}>Total Characters</th>
            <th style={{ padding: '0.75rem' }}>Total Lines</th>
            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Preview</th>
          </tr>
        </thead>
        <tbody>
          {RULESETS.map((ruleset) => {
            const metrics = dataMap[ruleset.id] || { loading: true, words: 0, characters: 0, lines: 0, content: '', error: null };
            return (
              <tr key={ruleset.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                  <a
                    href={ruleset.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                  >
                    {ruleset.name}
                  </a>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {metrics.loading ? 'Loading...' : metrics.error ? `Error: ${metrics.error}` : 'Loaded'}
                </td>
                <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{metrics.words.toLocaleString()}</td>
                <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{metrics.characters.toLocaleString()}</td>
                <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{metrics.lines.toLocaleString()}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {!metrics.loading && !metrics.error && (
                    <button
                      onClick={() => setActivePreviewId(ruleset.id)}
                      title={`View Preview for ${ruleset.name}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      📄
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal View for Ruleset Preview */}
      {activePreviewId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setActivePreviewId(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{activeRuleset?.name} - Preview</h3>
              <button
                onClick={() => setActivePreviewId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>
            <pre
              style={{
                flex: 1,
                overflowY: 'auto',
                background: '#f8fafc',
                padding: '1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {activeContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;