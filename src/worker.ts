import '@cloudflare/workers-types';

export interface Env {
  KV: KVNamespace;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  // 1. Cron Trigger Handler (Runs on your scheduled Friday cron config)
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },

  // 2. Fetch Handler
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- Handle Agora Players API route (Reads directly from KV) ---
    if (url.pathname.startsWith('/api/agora-players')) {
      try {
        const playerCountStr = await env.KV.get('agora_player_count');
        
        if (playerCountStr !== null) {
          const playerCount = parseInt(playerCountStr, 10);
          return Response.json({ players: playerCount }, {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }

        return Response.json({ error: 'Agora player count not found in KV' }, { status: 404 });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: 'Failed to read Agora players from KV', details: errorMessage }, { status: 500 });
      }
    }

    // 1. Handle Nomicron Players API route
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
          return Response.json({ players: playerCount }, {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }

        return Response.json({ error: 'Player count not found on Nomicron players page' }, { status: 404 });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: 'Failed to fetch or parse Nomicron players', details: errorMessage }, { status: 500 });
      }
    }

    // 2. Handle Nomicron Rules API route
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
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: 'Failed to fetch or parse rules', details: errorMessage }, { status: 500 });
      }
    }

    // 3. Handle BlogNomic API route (extracts player count)
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
          return Response.json({ players: playerCount }, {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }

        return Response.json({ error: 'Player count not found on page' }, { status: 404 });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: 'Failed to fetch or parse BlogNomic', details: errorMessage }, { status: 500 });
      }
    }

    // 4. Explicitly handle your multi-page entry point from Vite config
    if (url.pathname === '/dice' || url.pathname === '/dice.html') {
      return env.ASSETS.fetch(new Request(new URL('/dice.html', request.url), request));
    }

    // 5. Serve other static assets (JS, CSS chunks generated by rollupOptions)
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // 6. Fallback to main SPA index.html for client-side routing
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
  },
};

// --- Cron Handler: Runs on Fridays to parse RSS feed and update KV storage ---
async function handleCron(env: Env) {
  try {
    // 1. Fetch the Agora official mailing list RSS feed
    const feedRes = await fetch('https://www.mail-archive.com/agora-official@agoranomic.org/maillist.xml', {
      headers: { 'User-Agent': 'Nomicinfra-App' },
    });

    if (!feedRes.ok) {
      console.error(`Failed to fetch RSS feed: Upstream HTTP ${feedRes.status}`);
      return;
    }

    const xmlText = await feedRes.text();

    // 2. Find the first occurrence of "[Registrar] Weekly report" in the item titles
    // We can use regex to locate matching item blocks or search the title strings
    const itemRegex = /<item>[\s\S]*?<title>([^<]*\[Registrar\]\s+Weekly\s+report[^<]*)<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/i;
    const match = xmlText.match(itemRegex);

    if (!match || !match[2]) {
      console.log('No [Registrar] Weekly report item found in feed.');
      return;
    }

    const reportUrl = match[2].trim();
    console.log(`Found Weekly Report URL: ${reportUrl}`);

    // 3. Fetch the specific email archive page
    const emailRes = await fetch(reportUrl, {
      headers: { 'User-Agent': 'Nomicinfra-App' },
    });

    if (!emailRes.ok) {
      console.error(`Failed to fetch email report page: HTTP ${emailRes.status}`);
      return;
    }

    const emailHtml = await emailRes.text();
    const cleanEmailText = emailHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // 4. Look for phrase like "Active players: 19/23" or similar and extract the first number
    // Matches patterns like "Active players: 19" or "Active players 19/23"
    const playerMatch = cleanEmailText.match(/active\s+players[:\s]*(\d+)(?:\/\d+)?/i);

    if (playerMatch && playerMatch[1]) {
      const playerCount = parseInt(playerMatch[1], 10);
      
      // 5. Save the parsed player count into KV
      await env.KV.put('agora_player_count', (playerCount + 4).toString());
      console.log(`Successfully updated Agora player count to KV: ${playerCount}`);
    } else {
      console.log('Could not find active players count pattern in the weekly report email text.');
    }

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Failed to execute Friday cron tasks:", errorMessage);
    throw err;
  }
}