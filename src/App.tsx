import React, { useState, useMemo, useEffect } from 'react';
import './App.css';
import {
  INITIAL_RULESETS,
  HELP_TEXTS,
  calculateJaccardSimilarity,
  formatSizeComparison,
  getDistinctTopWords,
} from './utils/rulesetAnalysis';
import { getDateColor, formatRelativeAge } from './utils/dateUtils';
import { useRulesetData } from './useRulesetData';
import Dice from './pages/Dice';

// Helper to determine active section based on the current URL path
const getSectionFromPath = (path: string): 'rulesets' | 'dice' | 'links' => {
  const cleanPath = path.toLowerCase();
  if (cleanPath.includes('dice')) return 'dice';
  if (cleanPath.includes('links')) return 'links';
  return 'rulesets';
};

export function App() {
  const { rulesets, dataMap } = useRulesetData();

  // Initialize section directly from current window pathname on load
  const [currentSection, setCurrentSection] = useState<'rulesets' | 'dice' | 'links'>(() =>
    getSectionFromPath(window.location.pathname)
  );
  
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [showTopWordsHelp, setShowTopWordsHelp] = useState<boolean>(false);
  const [showUniqueWordsHelp, setShowUniqueWordsHelp] = useState<boolean>(false);
  const [selectedTopWord, setSelectedTopWord] = useState<string | null>(null);
  const [similarityFilter, setSimilarityFilter] = useState<'All' | 'Games' | 'Templates'>('All');
  
  const [phraseLength, setPhraseLength] = useState<number>(1);

  // Function to switch tabs and update the URL cleanly without a page reload
  const navigateToSection = (section: 'rulesets' | 'dice' | 'links') => {
    setCurrentSection(section);
    const targetPath = section === 'rulesets' ? '/' : `/${section}.html`;
    
    // Only push state if the URL is different to prevent duplicate history entries
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ section }, '', targetPath);
    }
  };

  // Listen to browser Back / Forward button navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentSection(getSectionFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectRuleset = (id: string) => {
    setActiveTabId(id);
    navigateToSection('rulesets');
    setShowRawText(false);
    setSelectedTopWord(null);
  };

  const groupedRulesets = useMemo(() => {
    return {
      Games: rulesets.filter((r) => r.category === 'Games'),
      Templates: rulesets.filter((r) => r.category === 'Templates'),
    };
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

  const dateColor = useMemo(() => {
    return getDateColor(currentMetrics?.lastModified);
  }, [currentMetrics?.lastModified]);

  const relativeAge = useMemo(() => {
    return formatRelativeAge(currentMetrics?.lastModified);
  }, [currentMetrics?.lastModified]);

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

        return {
          ruleset: other,
          score,
          sizeText,
          otherWords: otherMetrics.words,
          indicatorColor,
          error: null,
        };
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
        uniqueList.push({
          word,
          count: currentMetrics.wordCounts.get(word) || 1,
        });
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
          scoredList.push({
            word: phrase,
            count: countInCurrent,
            score,
          });
        }
      }
    });

    return scoredList.sort((a, b) => b.score - a.score).slice(0, 150);
  }, [currentRuleset, currentMetrics, dataMap, rulesets, phraseLength]);

  const akaListWords = useMemo(() => {
    return getDistinctTopWords(topWords, currentRuleset?.name || '', 4);
  }, [topWords, currentRuleset]);

  const handleExportTs = () => {
    const localRulesets = rulesets.filter(
      (r) => r.fetchUrl.startsWith('./') || r.fetchUrl.startsWith('blob:')
    );

    const exportData = localRulesets.map((r) => {
      const metrics = dataMap[r.id];
      return {
        id: r.id,
        name: r.name,
        linkUrl: r.linkUrl,
        homeUrl: r.homeUrl,
        content: metrics?.content || '',
        metrics: {
          words: metrics?.words || 0,
          characters: metrics?.characters || 0,
          uniqueWordCount: metrics?.wordSet?.size || 0,
          wordSet: metrics?.wordSet ? Array.from(metrics.wordSet) : [],
          wordCounts: metrics?.wordCounts ? Object.fromEntries(metrics.wordCounts) : {},
        },
      };
    });

    const tsContent = `// Auto-generated precomputed ruleset data (Local files only)
export interface PrecomputedRuleset {
  id: string;
  name: string;
  linkUrl: string;
  homeUrl: string;
  content: string;
  metrics: {
    words: number;
    characters: number;
    uniqueWordCount: number;
    wordSet: string[];
    wordCounts: Record<string, number>;
  };
}

export const PRECOMPUTED_RULESETS: PrecomputedRuleset[] = ${JSON.stringify(exportData, null, 2)};
`;

    const blob = new Blob([tsContent], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'precomputedRulesets.ts';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentSizePct = getScaledSizePct(currentMetrics?.words || 0);

  const sizeBarStyle: React.CSSProperties = {
    backgroundColor: '#00b4d8',
    backgroundImage: 'linear-gradient(to right, #0077b6, #00b4d8)',
  };

  return (
    <div className="app-container">
      {/* Header featuring clear primary sections */}
      <header className="app-header">
        <div className="header-title-area">
          <h1>IntroNomic</h1>
          <p className="app-subtitle">All about nomic-like games, ruleset analyses, and comparisons</p>
        </div>
        
        <nav className="site-nav-tabs">
          <button
            className={`nav-tab-btn ${currentSection === 'rulesets' ? 'active' : ''}`}
            onClick={() => navigateToSection('rulesets')}
          >
            📋 Rulesets & Analysis
          </button>
          <button
            className={`nav-tab-btn ${currentSection === 'dice' ? 'active' : ''}`}
            onClick={() => navigateToSection('dice')}
          >
            🎲 NIST Beacon Dice
          </button>
          <button
            className={`nav-tab-btn ${currentSection === 'links' ? 'active' : ''}`}
            onClick={() => navigateToSection('links')}
          >
            🔗 External Resources
          </button>
        </nav>
      </header>

      {/* SECTION 1: RULESETS & COMPARISON VIEW */}
      {currentSection === 'rulesets' && (
        <div className="layout-body">
          <aside className="sidebar-nav">
            {Object.entries(groupedRulesets).map(([category, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={category} className="nav-group">
                  <div className="group-label">{category}</div>
                  <div className="nav-list">
                    {items.map((ruleset) => {
                      const isActive = ruleset.id === activeTabId;
                      return (
                        <button
                          key={ruleset.id}
                          onClick={() => handleSelectRuleset(ruleset.id)}
                          className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                          {ruleset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </aside>

          <main className="main-content">
            {!activeTabId || !currentRuleset ? (
              <div className="card welcome-card">
                <h2>Welcome to IntroNomic</h2>
                <p>Select a game or template from the left sidebar to compare nomic rulesets across games and templates.</p>
                <p>Try the "NIST Beacon Dice" tab to generate cryptographically verifiable random numbers and simulate dice rolls.</p>
                <p>Visit the "External Resources" tab for deeper documentation, community leaderboards, and infrastructure.</p>
              </div>
            ) : !currentMetrics || currentMetrics.loading ? (
              <p>Loading ruleset data...</p>
            ) : currentMetrics.error ? (
              <p className="error-text">
                Error loading {currentRuleset.name}: {currentMetrics.error}
              </p>
            ) : (
              <div>
                <div className="header-container">
                  <div>
                    <h2 className="title-primary">{currentRuleset.name}</h2>
                    {akaListWords.length > 0 && (
                      <p className="aka-subtitle">
                        aka{' '}
                        {akaListWords
                          .map((word) => `${word.charAt(0).toUpperCase() + word.slice(1)} Nomic`)
                          .join(' aka ') + ' 😉'}
                      </p>
                    )}
                    {currentRuleset.category !== 'Templates' && relativeAge && (
                      <p className="last-changed-subtitle">
                        Current ruleset is{' '}
                        <span className="last-changed-value" style={{ color: dateColor }}>
                          {relativeAge}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="header-links">
                    {currentRuleset.category === 'Templates' ? (
                      <span className="template-badge">Template</span>
                    ) : (
                      currentRuleset.homeUrl !== '#' && (
                        <a href={currentRuleset.homeUrl} target="_blank" rel="noreferrer" className="external-link">
                          View Game ↗
                        </a>
                      )
                    )}

                    {currentRuleset.linkUrl !== '#' && (
                      <a href={currentRuleset.linkUrl} target="_blank" rel="noreferrer" className="external-link">
                        View Ruleset ↗
                      </a>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="section-header similarity-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0 }}>Top Phrases in Ruleset</h3>
                      <button
                        onClick={() => setShowTopWordsHelp(!showTopWordsHelp)}
                        className="help-button"
                        title={HELP_TEXTS.topWords(currentRuleset.name)}
                      >
                        ?
                      </button>
                    </div>

                    <div className="similarity-filter-group" style={{ alignItems: 'center', gap: '8px' }}>
                      <label htmlFor="phrase-length-input" style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #666)' }}>
                        Phrase length (words):
                      </label>
                      <input
                        id="phrase-length-input"
                        type="number"
                        min={1}
                        max={20}
                        value={phraseLength}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setPhraseLength(isNaN(val) || val < 1 ? 1 : val);
                          setSelectedTopWord(null);
                        }}
                        style={{
                          width: '56px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color, #ccc)',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                        }}
                      />
                    </div>
                  </div>

                  {showTopWordsHelp && (
                    <p className="help-text" title={HELP_TEXTS.topWords(currentRuleset.name)}>
                      {HELP_TEXTS.topWords(currentRuleset.name)}
                    </p>
                  )}

                  <div className="words-container top-words-container">
                    {topWords.length > 0 ? (
                      topWords.map(({ word, score, count }) => {
                        const textContent = `Appears ${count} times. ${score.toFixed(1)}x more frequent than in normalized ruleset.`;
                        const isSelected = selectedTopWord === word;

                        return (
                          <span
                            key={word}
                            title={textContent}
                            onClick={() => setSelectedTopWord(isSelected ? null : word)}
                            className={`word-badge help-cursor ${isSelected ? 'selected-badge' : ''}`}
                          >
                            <span>{word}</span>
                            <span className="count-pill">{count}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="empty-words-text">
                        No top phrases found for {phraseLength}-word phrase{phraseLength > 1 ? 's' : ''}.
                      </span>
                    )}
                  </div>

                  {selectedTopWord && (() => {
                    const activeItem = topWords.find((item) => item.word === selectedTopWord);
                    if (!activeItem) return null;
                    const detailText = `Appears ${activeItem.count} times. ${activeItem.score.toFixed(1)}x more frequent than in normalized ruleset.`;

                    return (
                      <div className="help-text top-word-detail" title={detailText}>
                        <span>
                          <strong>{activeItem.word}:</strong> {detailText}
                        </span>
                        <button onClick={() => setSelectedTopWord(null)} className="close-detail-button">
                          ✕
                        </button>
                      </div>
                    );
                  })()}
                </div>

                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Ruleset size</div>
                    <div className="metric-value">{currentMetrics.words.toLocaleString()} words</div>
                    <div className="progress-bar-track size-bar-track" style={{ marginTop: '8px' }}>
                      <div
                        className="progress-bar-fill size-bar-fill"
                        style={{
                          ...sizeBarStyle,
                          '--progress-width': `${currentSizePct}%`,
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Unique words</div>
                    <div className="metric-value highlight">
                      {currentMetrics.wordSet.size.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="section-header similarity-header">
                    <h3 className="similarity-header-title">Similarity to Other Nomics</h3>
                    <div className="similarity-filter-group">
                      {(['All', 'Games', 'Templates'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setSimilarityFilter(filter)}
                          className={`similarity-filter-button ${similarityFilter === filter ? 'active' : ''}`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="comparisons-list">
                    {comparisons.length > 0 ? (
                      comparisons.map(({ ruleset, score, sizeText, otherWords, indicatorColor, error }) => {
                        const otherSizePct = getScaledSizePct(otherWords);
                        return (
                          <div key={ruleset.id} className="comparison-item">
                            <div className="comparison-header">
                              <div className="comparison-title-container">
                                <button
                                  onClick={() => handleSelectRuleset(ruleset.id)}
                                  className="comparison-title-button"
                                >
                                  {ruleset.name}
                                </button>
                                {ruleset.category === 'Templates' ? (
                                  <span className="template-badge badge-template-small">Template</span>
                                ) : (
                                  <span
                                    className="badge-game"
                                    style={{
                                      color: indicatorColor !== 'inherit' ? indicatorColor : 'var(--text-secondary, #666)',
                                      background: indicatorColor !== 'inherit' ? `${indicatorColor}15` : 'rgba(0,0,0,0.05)',
                                      fontWeight: indicatorColor !== 'inherit' ? 600 : 400,
                                    }}
                                  >
                                    Game
                                  </span>
                                )}
                              </div>
                              <span>{score !== null ? `${score.toFixed(1)}% match` : error}</span>
                            </div>

                            {score !== null && (
                              <div className="progress-bar-track">
                                <div
                                  className="progress-bar-fill"
                                  style={{ '--progress-width': `${Math.min(100, Math.max(0, score))}%` } as React.CSSProperties}
                                />
                              </div>
                            )}

                            {score !== null && sizeText !== null && (
                              <div style={{ marginTop: '6px' }}>
                                <div className="comparison-size">Size: {sizeText} ({otherWords.toLocaleString()} words)</div>
                                <div className="progress-bar-track size-bar-track" style={{ height: '4px', marginTop: '4px' }}>
                                  <div
                                    className="progress-bar-fill size-bar-fill"
                                    style={{
                                      ...sizeBarStyle,
                                      '--progress-width': `${otherSizePct}%`,
                                    } as React.CSSProperties}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="empty-words-text">No matching rulesets found for this filter.</span>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0 }}>Unique Words in Ruleset</h3>
                    <button
                      onClick={() => setShowUniqueWordsHelp(!showUniqueWordsHelp)}
                      className="help-button"
                      title={HELP_TEXTS.uniqueWords(currentRuleset.name)}
                    >
                      ?
                    </button>
                  </div>

                  {showUniqueWordsHelp && (
                    <p className="help-text" title={HELP_TEXTS.uniqueWords(currentRuleset.name)}>
                      {HELP_TEXTS.uniqueWords(currentRuleset.name)}
                    </p>
                  )}

                  <div className="words-container unique-words-container">
                    {uniqueWordsWithCounts.length > 0 ? (
                      uniqueWordsWithCounts.map(({ word, count }) => (
                        <span key={word} className="word-badge">
                          <span>{word}</span>
                          <span className="count-pill">{count}</span>
                        </span>
                      ))
                    ) : (
                      <span className="empty-words-text">No unique words found.</span>
                    )}
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

            <div className="export-trigger-container">
              <button onClick={handleExportTs} aria-label="Export" className="export-trigger-button">
                .
              </button>
            </div>
          </main>
        </div>
      )}

      {/* SECTION 2: DICE VIEW */}
      {currentSection === 'dice' && <Dice />}

      {/* SECTION 3: EXTERNAL RESOURCES VIEW */}
      {currentSection === 'links' && (
        <div className="card external-resources-card">
          <h2>External Resources & Community Links</h2>
          <p className="resources-intro">
            Explore nomic leaderboards, guides and infrastructure backing IntroNomic.
          </p>

          <div className="resources-grid">
            <div className="resource-item">
              <h3>🏆 Nomic Leaderboards (Fandom)</h3>
              <p>Browse active community rankings on Fandom wiki.</p>
              <a href="https://nomic.fandom.com/wiki/Leaderboards" target="_blank" rel="noreferrer" className="resource-link">
                Visit Fandom Leaderboards ↗
              </a>
            </div>

            <div className="resource-item">
              <h3>📖 Introduction to Nomic</h3>
              <p>New to the concept of self-modifying rule-based games? Read this small guide from an experienced player.</p>
              <a href="https://kiako.me/nomic/" target="_blank" rel="noreferrer" className="resource-link">
                Read Introduction Guide ↗
              </a>
            </div>

            <div className="resource-item">
              <h3>💻 GitHub Code Repository</h3>
              <p>Check out the source code, inspect analysis utility functions, contribute ruleset definitions, or file issues on the official GitHub repository for this project.</p>
              <a href="https://github.com/cieok/nomicinfra" target="_blank" rel="noreferrer" className="resource-link">
                View Repository on GitHub ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;