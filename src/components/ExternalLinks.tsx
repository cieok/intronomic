export function ExternalLinks() {
  return (
    <div className="card external-resources-card">
      <h2>External Resources & Community Links</h2>
      <p className="resources-intro">
        Explore nomic leaderboards, guides, reddit communities, Wikipedia documentation, and infrastructure backing IntroNomic.
      </p>

      <div className="resources-grid">
        <div className="resource-item">
          <h3>💬 NomicHub Discord</h3>
          <p>Join the NomicHub Discord server to chat with players across games, share experiences, plan new games, and give feedback on this site.</p>
          <a href="https://discord.gg/xCTnRFtxN" target="_blank" rel="noreferrer" className="resource-link">
            Join Discord Server ↗
          </a>
        </div>

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
          <h3>💬 r/nomic Subreddit</h3>
          <p>Join discussions, start new games, and interact with the Nomic player community on Reddit.</p>
          <a href="https://www.reddit.com/r/nomic/" target="_blank" rel="noreferrer" className="resource-link">
            Visit r/nomic on Reddit ↗
          </a>
        </div>

        <div className="resource-item">
          <h3>📚 Nomic on Wikipedia</h3>
          <p>Read the comprehensive encyclopedia overview of the game of Nomic, its history, and its mechanics.</p>
          <a href="https://en.wikipedia.org/wiki/Nomic" target="_blank" rel="noreferrer" className="resource-link">
            Read Wikipedia Article ↗
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
  );
}

export default ExternalLinks;