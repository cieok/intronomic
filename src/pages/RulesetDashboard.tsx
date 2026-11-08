import React, { useState, useMemo } from 'react';
import {
  HELP_TEXTS,
  calculateJaccardSimilarity,
  formatSizeComparison,
  getDistinctTopWords,
} from '../utils/rulesetAnalysis';
import { getDateColor, formatRelativeAge } from '../utils/dateUtils';

interface RulesetDashboardProps {
  rulesets: any[];
  dataMap: Record<string, any>;
  activeTabId: string | null;
  onSelectRuleset: (id: string) => void;
}

export function RulesetDashboard({
  rulesets,
  dataMap,
  activeTabId,
  onSelectRuleset,
}: RulesetDashboardProps) {
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [showTopWordsHelp, setShowTopWordsHelp] = useState<boolean>(false);
  const [showUniqueWordsHelp, setShowUniqueWordsHelp] = useState<boolean>(false);
  const [selectedTopWord, setSelectedTopWord] = useState<string | null>(null);
  const [similarityFilter, setSimilarityFilter] = useState<'All' | 'Games' | 'Templates'>('All');
  const [phraseLength, setPhraseLength] = useState<number>(1);
  const [gameSort, setGameSort] = useState<'players' | 'date'>('players');

  // Separated & sorted games list by number of players or latest update
  const sortedGames = useMemo(() => {
    const games = rulesets.filter((r) => r.category === 'Games');
    return games
      .map((r) => {
        const metrics = dataMap[r.id];
        return {
          ruleset: r,
          metrics,
          players: metrics?.players ?? 0,
          lastModified: metrics?.lastModified ? new Date(metrics.lastModified).getTime() : 0,
        };
      })
      .sort((a, b) => {
        if (gameSort === 'players') {
          if (b.players !== a.players) return b.players - a.players;
          return b.lastModified - a.lastModified;
        } else {
          if (b.lastModified !== a.lastModified) return b.lastModified - a.lastModified;
          return b.players - a.players;
        }
      });
  }, [rulesets, dataMap, gameSort]);

  const templateRulesets = useMemo(() => {
    return rulesets.filter((r) => r.category === 'Templates');
  }, [rulesets]);

  const maxRulesetWords = useMemo(() => {
    let max = 0;
    rulesets.forEach((r) => {
      const metrics = dataMap[r.id];
      if (metrics && !metrics.loading && !metrics.error && metrics.words > max) {
        max = metrics.words;
      }
    });
    return max || 1;
  }, [rulesets, dataMap]);

  const getScaledSizePct = (words: number) => {
    if (!words || words <= 0) return 0;
    const sqrtVal = Math.sqrt(words);
    const sqrtMax = Math.sqrt(maxRulesetWords);
    return Math.min(100, Math.max(0, (sqrtVal / sqrtMax) * 100));
  };

  const currentRuleset = rulesets.find((r) => r.id === activeTabId) || null;
  const currentMetrics = currentRuleset ? dataMap[currentRuleset.id] : null;

  const dateColor = useMemo(() => getDateColor(currentMetrics?.lastModified), [currentMetrics?.lastModified]);
  const relativeAge = useMemo(() => formatRelativeAge(currentMetrics?.lastModified), [currentMetrics?.lastModified]);

  const comparisons = useMemo(() => {
    if (!currentRuleset || !currentMetrics || currentMetrics.loading || currentMetrics.error) return [];

    return rulesets
      .filter((r) => r.id !== currentRuleset.id)
      .filter((r) => similarityFilter === 'All' || r.category === similarityFilter)
      .map((other) => {
        const otherMetrics = dataMap[other.id];
        if (!otherMetrics || otherMetrics.loading || otherMetrics.error) {
          return {
            ruleset: other,
            score: null,
            sizeText: null,
            otherWords: 0,
            indicatorColor: 'inherit',
            error: otherMetrics?.error || 'Loading...',
          };
        }

        const score = calculateJaccardSimilarity(currentMetrics.wordSet, otherMetrics.wordSet);
        const sizeText = formatSizeComparison(currentMetrics.words, otherMetrics.words);
        const indicatorColor = getDateColor(otherMetrics.lastModified);

        return { ruleset: other, score, sizeText, otherWords: otherMetrics.words, indicatorColor, error: null };
      })
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  }, [currentRuleset, currentMetrics, dataMap, rulesets, similarityFilter]);

  const uniqueWordsWithCounts = useMemo(() => {
    if (!currentRuleset || !currentMetrics || currentMetrics.loading || currentMetrics.error) return [];

    const otherWordsSet = new Set<string>();
    rulesets.forEach((r) => {
      if (r.id !== currentRuleset.id && dataMap[r.id] && !dataMap[r.id].loading) {
        dataMap[r.id].wordSet.forEach((w) => otherWordsSet.add(w));
      }
    });

    const uniqueList: { word: string; count: number }[] = [];
    currentMetrics.wordSet.forEach((word) => {
      const containsDigit = /\d/.test(word);
      const isHttp = word.startsWith('http');
      if (word.length > 1 && !containsDigit && !isHttp && !otherWordsSet.has(word)) {
        uniqueList.push({ word, count: currentMetrics.wordCounts.get(word) || 1 });
      }
    });

    return uniqueList.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  }, [currentRuleset, currentMetrics, dataMap, rulesets]);

  const extractNgrams = (content: string, n: number) => {
    const tokens = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !/\d/.test(w) && !w.startsWith('http'));

    const counts = new Map<string, number>();
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(' ');
      counts.set(ngram, (counts.get(ngram) || 0) + 1);
    }
    return counts;
  };

  const topWords = useMemo(() => {
    if (!currentRuleset || !currentMetrics || currentMetrics.loading || currentMetrics.error) return [];

    const n = Math.max(1, phraseLength);
    const currentNgrams = extractNgrams(currentMetrics.content || '', n);
    const otherNgramCounts = new Map<string, number>();
    let otherTotalNgrams = 0;

    rulesets.forEach((r) => {
      if (r.id !== currentRuleset.id && dataMap[r.id] && !dataMap[r.id].loading) {
        const ngrams = extractNgrams(dataMap[r.id].content || '', n);
        ngrams.forEach((count, phrase) => {
          otherNgramCounts.set(phrase, (otherNgramCounts.get(phrase) || 0) + count);
          otherTotalNgrams += count;
        });
      }
    });

    if (otherTotalNgrams === 0) return [];

    let currentTotalNgrams = 0;
    currentNgrams.forEach((c) => (currentTotalNgrams += c));

    const scoredList: { word: string; score: number; count: number }[] = [];
    currentNgrams.forEach((countInCurrent, phrase) => {
      const isValidWord = n === 1 ? phrase.length > 2 : true;
      if (countInCurrent >= 2 && isValidWord) {
        const countInOthers = otherNgramCounts.get(phrase) || 0;
        const frequencyInCurrent = (countInCurrent + 1) / (currentTotalNgrams + 1);
        const frequencyInOthers = (countInOthers + 1) / (otherTotalNgrams + 1);
        const score = frequencyInCurrent / frequencyInOthers;

        if (score >= 1.5) {
          scoredList.push({ word: phrase, count: countInCurrent, score });
        }
      }
    });

    return scoredList.sort((a, b) => b.score - a.score).slice(0, 150);
  }, [currentRuleset, currentMetrics, dataMap, rulesets, phraseLength]);

  const akaListWords = useMemo(() => {
    return getDistinctTopWords(topWords, currentRuleset?.name || '', 4);
  }, [topWords, currentRuleset]);

  const currentSizePct = getScaledSizePct(currentMetrics?.words || 0);

  return (
    <div className="layout-body">
      <aside className="sidebar-nav">
        <div className="nav-group">
          <div className="group-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span>Games</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`sort-btn ${gameSort === 'players' ? 'active' : ''}`}
                onClick={() => setGameSort('players')}
                style={{ fontSize: '0.75rem', padding: '2px 6px', cursor: 'pointer' }}
                title="Sort by number of players"
              >
                👥 Players
              </button>
              <button
                className={`sort-btn ${gameSort === 'date' ? 'active' : ''}`}
                onClick={() => setGameSort('date')}
                style={{ fontSize: '0.75rem', padding: '2px 6px', cursor: 'pointer' }}
                title="Sort by latest update"
              >
                🕒 Updated
              </button>
            </div>
          </div>
          <div className="nav-list">
            {sortedGames.map(({ ruleset, metrics }, index) => {
              const isActive = ruleset.id === activeTabId;
              const playerCount = metrics?.players ?? null;
              const ageText = formatRelativeAge(metrics?.lastModified);
              const ageColor = getDateColor(metrics?.lastModified);

              return (
                <button
                  key={ruleset.id}
                  onClick={() => onSelectRuleset(ruleset.id)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>
                      <span style={{ opacity: 0.6, marginRight: '6px', fontSize: '0.8rem' }}>#{index + 1}</span>
                      {ruleset.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', opacity: 0.85, width: '100%', justifyContent: 'space-between' }}>
                    <span>{playerCount !== null ? `👥 ${playerCount}` : '👥 —'}</span>
                    {ageText && <span style={{ color: ageColor !== 'inherit' ? ageColor : 'inherit' }}>🗓️ {ageText}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {templateRulesets.length > 0 && (
          <div className="nav-group" style={{ marginTop: '16px' }}>
            <div className="group-label">Templates</div>
            <div className="nav-list">
              {templateRulesets.map((ruleset) => (
                <button
                  key={ruleset.id}
                  onClick={() => onSelectRuleset(ruleset.id)}
                  className={`nav-item ${ruleset.id === activeTabId ? 'active' : ''}`}
                >
                  {ruleset.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="main-content">
        {!activeTabId || !currentRuleset ? (
          <div className="card welcome-card">
            <h2>Welcome to IntroNomic</h2>
            <p>Select a game or template from the left sidebar to compare nomic rulesets across games and templates.</p>
          </div>
        ) : !currentMetrics || currentMetrics.loading ? (
          <p>Loading ruleset data...</p>
        ) : currentMetrics.error ? (
          <div className="card error-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <h3 style={{ color: '#d90429', marginBottom: '0.75rem' }}>Error Loading {currentRuleset.name}</h3>
            <p className="error-text">{currentMetrics.error}</p>
          </div>
        ) : (
          <div>
            <div className="header-container">
              <div>
                <h2 className="title-primary">{currentRuleset.name}</h2>
                {akaListWords.length > 0 && (
                  <p className="aka-subtitle">
                    aka {akaListWords.map((word) => `${word.charAt(0).toUpperCase() + word.slice(1)} Nomic`).join(' aka ') + ' 😉'}
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <h3>Top Phrases in Ruleset</h3>
              <div className="words-container top-words-container">
                {topWords.map(({ word, score, count }) => (
                  <span key={word} onClick={() => setSelectedTopWord(selectedTopWord === word ? null : word)} className="word-badge help-cursor">
                    <span>{word}</span>
                    <span className="count-pill">{count}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Similarity to Other Nomics</h3>
              <div className="comparisons-list">
                {comparisons.map(({ ruleset, score, sizeText, otherWords, indicatorColor, error }) => (
                  <div key={ruleset.id} className="comparison-item">
                    <button onClick={() => onSelectRuleset(ruleset.id)}>{ruleset.name}</button>
                    <span>{score !== null ? `${score.toFixed(1)}% match` : error}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <button onClick={() => setShowRawText(!showRawText)} className="preview-toggle-button">
                📄 {showRawText ? 'Hide' : 'Show'} Ruleset Preview
              </button>
              {showRawText && <pre className="raw-text-preview">{currentMetrics.content}</pre>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}