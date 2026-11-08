export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle Nomicron API route
    if (url.pathname.startsWith('/api/nomicron-players')) {
      try {
        const externalResponse = await fetch('https://nomicron.org/players', {
          headers: { 'User-Agent': 'Nomicinfra-App' },
        });

        if (!externalResponse.ok) {
          return new Response(JSON.stringify({ error: `Upstream HTTP ${externalResponse.status}` }), {
            status: externalResponse.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const htmlText = await externalResponse.text();
        const cleanText = htmlText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

        // Matches phrase like "Active Players (10)" case-insensitively
        const match = cleanText.match(/active\s+players\s*\((\d+)\)/i);

        if (match && match[1]) {
          const playerCount = parseInt(match[1], 10);
          return new Response(JSON.stringify({ players: playerCount }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }

        return new Response(JSON.stringify({ error: 'Player count not found on Nomicron players page' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed to fetch or parse Nomicron players', details: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname.startsWith('/api/nomicron')) {
      try {
        const externalResponse = await fetch('https://nomicron.org/rules/', {
          headers: { 'User-Agent': 'Nomicinfra-App' },
        });

        if (!externalResponse.ok) {
          return new Response(JSON.stringify({ error: `Upstream HTTP ${externalResponse.status}` }), {
            status: externalResponse.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const htmlText = await externalResponse.text();
        const regex = /<div class="rule-card__body[^"]*">([\s\S]*?)<\/div>/g;
        let match;
        let extractedText = '';

        while ((match = regex.exec(htmlText)) !== null) {
          const cleanBlock = match[1].replace(/<[^>]*>/g, ' ');
          extractedText += cleanBlock + '\n\n';
        }

        if (!extractedText.trim()) {
          extractedText = htmlText.replace(/<[^>]*>/g, ' ');
        }

        const finalCleanText = extractedText.replace(/\s+/g, ' ').trim();

        return new Response(finalCleanText, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed to fetch or parse rules', details: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 1.5 Handle BlogNomic API route (extracts player count)
    if (url.pathname.startsWith('/api/blognomic')) {
      try {
        const externalResponse = await fetch('https://blognomic.com/', {
          headers: { 'User-Agent': 'Nomicinfra-App' },
        });

        if (!externalResponse.ok) {
          return new Response(JSON.stringify({ error: `Upstream HTTP ${externalResponse.status}` }), {
            status: externalResponse.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const htmlText = await externalResponse.text();
        const cleanText = htmlText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

        // Matches phrase like "There are 10 Players" case-insensitively
        const match = cleanText.match(/there\s+are\s+(\d+)\s+players/i);

        if (match && match[1]) {
          const playerCount = parseInt(match[1], 10);
          return new Response(JSON.stringify({ players: playerCount }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }

        return new Response(JSON.stringify({ error: 'Player count not found on page' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed to fetch or parse BlogNomic', details: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Explicitly handle your multi-page entry point from Vite config
    if (url.pathname === '/dice' || url.pathname === '/dice.html') {
      return env.ASSETS.fetch(new Request(new URL('/dice.html', request.url), request));
    }

    // 3. Serve other static assets (JS, CSS chunks generated by rollupOptions)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // 4. Fallback to main SPA index.html for client-side routing
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
  },
};