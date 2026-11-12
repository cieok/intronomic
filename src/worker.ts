import '@cloudflare/workers-types';

export interface Env {
  KV: KVNamespace;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  // 1. Cron Trigger Handler
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },

  // 2. Fetch Handler
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- Manifest API route: /api/manifest ---
    if (url.pathname === '/api/manifest') {
      try {
        const manifestStr = await env.KV.get('manifest');
        if (manifestStr !== null) {
          const manifestData = JSON.parse(manifestStr);
          return Response.json(manifestData, {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
        return Response.json({}, { status: 200 }); // Return empty object if not set yet
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: 'Failed to read manifest from KV', details: errorMessage }, { status: 500 });
      }
    }

    // --- Dynamic Query Parameter Players API route: /api/players?id={id} ---
    if (url.pathname === '/api/players') {
      const id = url.searchParams.get('id');

      if (!id || !/^[a-z0-9_-]+$/.test(id)) {
        return Response.json({ error: 'Valid id parameter is required' }, { status: 400 });
      }

      const kvKey = `${id}_players`; // e.g. 'agora' -> 'agora_players'

      try {
        const playerCountStr = await env.KV.get(kvKey);
        
        if (playerCountStr !== null) {
          const playerCount = parseInt(playerCountStr, 10);
          return Response.json({ players: playerCount }, {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }

        return Response.json({ error: `${id} player count not found in KV` }, { status: 404 });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: `Failed to read ${id} players from KV`, details: errorMessage }, { status: 500 });
      }
    }

    // --- Handle Nomicron Rules API route ---
    if (url.pathname.startsWith('/api/nomicron')) {
      try {
        let nomicronStr = await env.KV.get('nomicron');

        if (nomicronStr === null) {
          const finalCleanText = await fetchAndParseNomicronRules();
          const payload = { rules: finalCleanText };
          await env.KV.put('nomicron', JSON.stringify(payload));
          nomicronStr = JSON.stringify(payload);
        }

        // Parse JSON object to return via Response.json or extract rules string depending on preference.
        // If clients expect pure text or JSON, we can serve it safely:
        const nomicronData = JSON.parse(nomicronStr)['rules'] // this is temporary the ['rules'] will be removed after improving data model in frontend direction

        return Response.json(nomicronData, {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ error: 'Failed to fetch or parse rules', details: errorMessage }, { status: 500 });
      }
    }

    // 4. Explicitly handle your multi-page entry point from Vite config
    if (url.pathname === '/dice' || url.pathname === '/dice.html') {
      return env.ASSETS.fetch(new Request(new URL('/dice.html', request.url), request));
    }

    // 5. Serve other static assets
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // 6. Fallback to main SPA index.html for client-side routing
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
  },
};

// --- Helper: Update or merge into the 'manifest' KV key object ---
async function updateManifest(env: Env, id: string, playerCount: number) {
  let manifest: Record<string, { players: number }> = {};

  try {
    const existing = await env.KV.get('manifest', { type: 'json' });
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      manifest = existing as Record<string, { players: number }>;
    }
  } catch {
    manifest = {};
  }

  manifest[id] = { players: playerCount };
  await env.KV.put('manifest', JSON.stringify(manifest));
}

// --- Helper: Fetch and parse Nomicron rules ---
async function fetchAndParseNomicronRules(): Promise<string> {
  const externalResponse = await fetch('https://nomicron.org/rules/', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Upstream HTTP ${externalResponse.status}`);
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

  return extractedText.replace(/\s+/g, ' ').trim();
}

// --- Task Helper: Update Nomicron Rules in KV ---
async function updateNomicronRules(env: Env) {
  const finalCleanText = await fetchAndParseNomicronRules();
  const payload = { rules: finalCleanText };
  await env.KV.put('nomicron', JSON.stringify(payload));
  console.log('Successfully updated Nomicron rules KV under key "nomicron" with format {"rules": ...}.');
}

// --- Cron Handler ---
async function handleCron(env: Env) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); 
  // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday

  try {
    // Runs every 5th hour: 0, 5, 10, 15, 20 UTC
    switch (currentHour) {
      case 0:
        console.log('Executing Cron Task for Hour 0 UTC (Players Update)');
        
        if (dayOfWeek === 5) {
          console.log('Executing Friday task: Agora Players Update');
          await updateAgoraPlayers(env);
        } else if (dayOfWeek === 1) {
          console.log('Executing Monday task: Nomicron Players Update');
          await updateNomicronPlayers(env);
        } else if (dayOfWeek === 3) {
          console.log('Executing Wednesday task: BlogNomic Players Update');
          await updateBlogNomicPlayers(env);
        }
        break;

      case 5:
        console.log('Executing Cron Task for Hour 5 UTC (Nomicron Rules Update)');
        await updateNomicronRules(env);
        break;

      case 10:
        console.log('Executing Cron Task for Hour 10 UTC');
        // TODO: Fill in your slot for Hour 10 here
        break;

      case 15:
        console.log('Executing Cron Task for Hour 15 UTC');
        // TODO: Fill in your slot for Hour 15 here
        break;

      case 20:
        console.log('Executing Cron Task for Hour 20 UTC');
        // TODO: Fill in your slot for Hour 20 here
        break;

      default:
        console.log(`Cron triggered at unexpected hour: ${currentHour} UTC`);
        break;
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Failed to execute scheduled cron task:", errorMessage);
    throw err;
  }
}

// --- Task Helper: Update Agora Players ---
async function updateAgoraPlayers(env: Env) {
  const feedRes = await fetch('https://www.mail-archive.com/agora-official@agoranomic.org/maillist.xml', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!feedRes.ok) {
    throw new Error(`Failed to fetch Agora RSS feed: Upstream HTTP ${feedRes.status}`);
  }

  const xmlText = await feedRes.text();
  const itemRegex = /<item>[\s\S]*?<title>([^<]*\[Registrar\]\s+Weekly\s+report[^<]*)<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/i;
  const match = xmlText.match(itemRegex);

  if (!match || !match[2]) {
    console.log('No [Registrar] Weekly report item found in feed.');
    return;
  }

  const reportUrl = match[2].trim();
  console.log(`Found Weekly Report URL: ${reportUrl}`);

  const emailRes = await fetch(reportUrl, {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!emailRes.ok) {
    throw new Error(`Failed to fetch email report page: HTTP ${emailRes.status}`);
  }

  const emailHtml = await emailRes.text();
  const cleanEmailText = emailHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const playerMatch = cleanEmailText.match(/active\s+players[:\s]*(\d+)(?:\/\d+)?/i);

  if (playerMatch && playerMatch[1]) {
    const playerCount = parseInt(playerMatch[1], 10);
    await env.KV.put('agora_players', playerCount.toString());
    await updateManifest(env, 'agora', playerCount);
    console.log(`Successfully updated Agora player count to KV and manifest: ${playerCount}`);
  } else {
    console.log('Could not find active players count pattern in the weekly report email text.');
  }
}

// --- Task Helper: Update Nomicron Players ---
async function updateNomicronPlayers(env: Env) {
  const externalResponse = await fetch('https://nomicron.org/players', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Failed to fetch Nomicron players page: Upstream HTTP ${externalResponse.status}`);
  }

  const htmlText = await externalResponse.text();
  const cleanText = htmlText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const match = cleanText.match(/active\s+players\s*\((\d+)\)/i);

  if (match && match[1]) {
    const playerCount = parseInt(match[1], 10);
    await env.KV.put('nomicron_players', playerCount.toString());
    await updateManifest(env, 'nomicron', playerCount);
    console.log(`Successfully updated Nomicron player count to KV and manifest: ${playerCount}`);
  } else {
    console.log('Player count not found on Nomicron players page.');
  }
}

// --- Task Helper: Update BlogNomic Players ---
async function updateBlogNomicPlayers(env: Env) {
  const externalResponse = await fetch('https://blognomic.com/', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Failed to fetch BlogNomic page: Upstream HTTP ${externalResponse.status}`);
  }

  const htmlText = await externalResponse.text();
  const cleanText = htmlText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const match = cleanText.match(/there\s+are\s+(\d+)\s+players/i);

  if (match && match[1]) {
    const playerCount = parseInt(match[1], 10);
    await env.KV.put('blognomic_players', playerCount.toString());
    await updateManifest(env, 'blognomic', playerCount);
    console.log(`Successfully updated BlogNomic player count to KV and manifest: ${playerCount}`);
  } else {
    console.log('Player count not found on BlogNomic page.');
  }
}