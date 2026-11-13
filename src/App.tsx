import { useState, useEffect } from 'react';
import './App.css';
import Dice from './components/Dice';
import ExternalLinks from './components/ExternalLinks';
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
      <div className="top-utility-bar">
        <a
          href="https://discord.gg/xCTnRFtxN"
          target="_blank"
          rel="noopener noreferrer"
          className="discord-top-btn"
          aria-label="Join NomicHub Discord"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 127.14 96.36"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
          </svg>
          <span>NomicHub Discord</span>
        </a>
      </div>

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