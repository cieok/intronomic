import { useState } from 'react';

interface Rule {
  id: number;
  text: string;
  votes: number;
}

export function App() {
  const [rules, setRules] = useState<Rule[]>([
    { id: 101, text: 'All players must always abide by the current rules.', votes: 5 }
  ]);
  const [input, setInput] = useState('');

  const addRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setRules([...rules, { id: Date.now(), text: input, votes: 1 }]);
    setInput('');
  };

  return (
    <main style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Intronomic</h1>
      <form onSubmit={addRule} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          style={{ flex: 1, padding: '8px' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Propose a rule..."
        />
        <button type="submit" style={{ padding: '8px 16px' }}>Propose</button>
      </form>
      <ul>
        {rules.map(rule => (
          <li key={rule.id} style={{ marginBottom: '10px' }}>
            {rule.text} <strong>({rule.votes} votes)</strong>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;