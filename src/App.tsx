import React, { useState, useEffect } from 'react';
import './App.css';
import Dice from './pages/Dice';
import ExternalLinks from './pages/ExternalLinks';
import { RulesetAnalysisView } from './components/RulesetAnalysisView';

const getSectionFromPath = (path: string): 'rulesets' | 'dice' | 'links' => {
  const cleanPath = path.toLowerCase();
  if (cleanPath.includes('dice')) return 'dice';
  if (cleanPath.includes('links')) return 'links';
  return 'rulesets';
};

export function App() {
  const [currentSection, setCurrentSection] = useState<'rulesets' | 'dice' | 'links'>(() =>
    getSectionFromPath(window.location.pathname)
  );

  const navigateToSection = (section: 'rulesets' | 'dice' | 'links') => {
    setCurrentSection(section);
    const targetPath = section === 'rulesets' ? '/' : `/${section}.html`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ section }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentSection(getSectionFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title-area">
          <h1>NomicHub</h1>
          <p className="app-subtitle">All about nomic-like games, especially the stuff you cannot find elsewhere</p>
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

      {/* Renders views cleanly with no arguments passed */}
      {currentSection === 'rulesets' && <RulesetAnalysisView />}
      {currentSection === 'dice' && <Dice />}
      {currentSection === 'links' && <ExternalLinks />}
    </div>
  );
}

export default App;