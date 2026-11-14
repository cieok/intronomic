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

  // 2. Fetch Handler with API Traffic Logging
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();
    const isApiRoute = url.pathname.startsWith('/api/');

    let response: Response;

    try {
      response = await handleRouting(request, env, url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      response = Response.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }

    // Log traffic for all /api/* routes (without timestamp)
    if (isApiRoute) {
      const duration = Date.now() - startTime;
      const logEntry = {
        type: 'api_traffic',
        method: request.method,
        path: url.pathname,
        search: url.search,
        status: response.status,
        durationMs: duration,
        rayId: request.headers.get('cf-ray') || null,
        userAgent: request.headers.get('user-agent') || null,
      };
      console.log(JSON.stringify(logEntry));
    }

    return response;
  },
};

// --- Core Routing Handler ---
async function handleRouting(request: Request, env: Env, url: URL): Promise<Response> {
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
        const { text, lastModified } = await fetchAndParseNomicronRules();
        const payload = { rules: text };
        await env.KV.put('nomicron', JSON.stringify(payload));
        await updateManifest(env, 'nomicron', { lastModified });
        nomicronStr = JSON.stringify(payload);
      }

      const nomicronData = JSON.parse(nomicronStr);

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

  // --- Handle Agora Rules API route ---
  if (url.pathname.startsWith('/api/agora')) {
    try {
      let agoraRulesStr = await env.KV.get('agora');

      if (agoraRulesStr === null) {
        const { text, lastModified } = await fetchAndParseAgoraRules();
        const payload = { rules: text };
        await env.KV.put('agora', JSON.stringify(payload));
        await updateManifest(env, 'agora', { lastModified });
        agoraRulesStr = JSON.stringify(payload);
      }

      const agoraRulesData = JSON.parse(agoraRulesStr);

      return Response.json(agoraRulesData, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return Response.json({ error: 'Failed to fetch or parse Agora rules', details: errorMessage }, { status: 500 });
    }
  }

  // --- Handle BlogNomic Rules API route ---
  if (url.pathname.startsWith('/api/blognomic')) {
    try {
      let blognomicRulesStr = await env.KV.get('blognomic');

      if (blognomicRulesStr === null) {
        const { text, lastModified } = await fetchAndParseBlogNomicRules();
        const payload = { rules: text };
        await env.KV.put('blognomic', JSON.stringify(payload));
        await updateManifest(env, 'blognomic', { lastModified });
        blognomicRulesStr = JSON.stringify(payload);
      }

      const blognomicRulesData = JSON.parse(blognomicRulesStr);

      return Response.json(blognomicRulesData, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return Response.json({ error: 'Failed to fetch or parse BlogNomic rules', details: errorMessage }, { status: 500 });
    }
  }

  // --- Handle Infinite Nomic Rules API route ---
  if (url.pathname.startsWith('/api/infinite')) {
    try {
      let infiniteRulesStr = await env.KV.get('infinite');

      if (infiniteRulesStr === null) {
        const { text } = await fetchAndParseInfiniteNomicRules();
        const payload = { rules: text };
        await env.KV.put('infinite', JSON.stringify(payload));
        infiniteRulesStr = JSON.stringify(payload);
      }

      const infiniteRulesData = JSON.parse(infiniteRulesStr);

      return Response.json(infiniteRulesData, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return Response.json({ error: 'Failed to fetch or parse Infinite Nomic rules', details: errorMessage }, { status: 500 });
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
}

// --- Helper: Update or merge into the 'manifest' KV key object ---
async function updateManifest(env: Env, id: string, updates: { players?: number; lastModified?: string | null }) {
  let manifest: Record<string, { players?: number; lastModified?: string | null }> = {};

  try {
    const existing = await env.KV.get('manifest', { type: 'json' });
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      manifest = existing as Record<string, { players?: number; lastModified?: string | null }>;
    }
  } catch {
    manifest = {};
  }

  manifest[id] = {
    ...(manifest[id] || {}),
    ...updates,
  };
  
  await env.KV.put('manifest', JSON.stringify(manifest));
}

// --- Helper: Fetch and parse Nomicron rules ---
async function fetchAndParseNomicronRules(): Promise<{ text: string; lastModified: string | null }> {
  const externalResponse = await fetch('https://nomicron.org/rules/', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Upstream HTTP ${externalResponse.status}`);
  }

  const rawDateString = externalResponse.headers.get('Last-Modified');
  let lastModified: string | null = null;

  if (rawDateString) {
    const parsedDate = new Date(rawDateString);
    if (!isNaN(parsedDate.getTime())) {
      lastModified = parsedDate.toISOString();
    }
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

  const text = extractedText.replace(/\s+/g, ' ').trim();
  return { text, lastModified };
}

// --- Helper: Fetch and parse Agora rules from slr.txt ---
async function fetchAndParseAgoraRules(): Promise<{ text: string; lastModified: string | null }> {
  const externalResponse = await fetch('https://agoranomic.org/ruleset/slr.txt', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Upstream HTTP ${externalResponse.status}`);
  }

  const rawDateString = externalResponse.headers.get('Last-Modified');
  let lastModified: string | null = null;

  if (rawDateString) {
    const parsedDate = new Date(rawDateString);
    if (!isNaN(parsedDate.getTime())) {
      lastModified = parsedDate.toISOString();
    }
  }

  const rawText = await externalResponse.text();
  const text = rawText.replace(/\s+/g, ' ').trim();

  return { text, lastModified };
}

// --- Helper: Fetch and parse BlogNomic rules from MediaWiki API ---
async function fetchAndParseBlogNomicRules(): Promise<{ text: string; lastModified: string | null }> {
  const externalResponse = await fetch('https://wiki.blognomic.com/api.php?action=query&titles=Ruleset&prop=revisions&rvprop=content|timestamp&rvslots=main&format=json&origin=*', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Upstream HTTP ${externalResponse.status}`);
  }

  const data = (await externalResponse.json()) as any;
  const pages = data?.query?.pages;

  if (!pages) {
    throw new Error('Invalid MediaWiki API response structure');
  }

  const pageId = Object.keys(pages)[0];
  const page = pages[pageId];
  const revision = page?.revisions?.[0];

  if (!revision) {
    throw new Error('No revisions found for Ruleset on BlogNomic wiki');
  }

  const rawDateString = revision.timestamp;
  let lastModified: string | null = null;

  if (rawDateString) {
    const parsedDate = new Date(rawDateString);
    if (!isNaN(parsedDate.getTime())) {
      lastModified = parsedDate.toISOString();
    }
  }

  const rawText = revision.slots?.main?.['*'] || revision['*'] || '';
  const text = cleanBlogNomicWikitext(String(rawText));

  return { text, lastModified };
}

// Minimal BlogNomic cleaner: removes only obvious templates, HTML comments, and HTML tags
export function cleanBlogNomicWikitext(raw: string): string {
  let text = raw;

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // Remove templates (like {{TOCRight}})
  text = text.replace(/\{\{[^{}]*\}\}/g, ' ');

  // Remove raw HTML tags (like <div ...> and </div>)
  text = text.replace(/<\/?\s*[a-zA-Z][^>]*>/g, ' ');

  // Normalize multiple spaces into single spaces
  return text.replace(/\s+/g, ' ').trim();
}

// --- Helper: Fetch and parse Infinite Nomic rules from MediaWiki API ---
async function fetchAndParseInfiniteNomicRules(): Promise<{ text: string }> {
  const externalResponse = await fetch('https://infinite.nomic.space/wiki/api.php?action=query&titles=Metaruleset&prop=revisions&rvprop=content|timestamp&rvslots=main&format=json&origin=*', {
    headers: { 'User-Agent': 'Nomicinfra-App' },
  });

  if (!externalResponse.ok) {
    throw new Error(`Upstream HTTP ${externalResponse.status}`);
  }

  const data = (await externalResponse.json()) as any;
  const pages = data?.query?.pages;

  if (!pages) {
    throw new Error('Invalid MediaWiki API response structure');
  }

  const pageId = Object.keys(pages)[0];
  const page = pages[pageId];
  const revision = page?.revisions?.[0];

  if (!revision) {
    throw new Error('No revisions found for Metaruleset on Infinite Nomic wiki');
  }

  const rawText = revision.slots?.main?.['*'] || revision['*'] || '';
  const text = String(rawText).replace(/\s+/g, ' ').trim();

  return { text };
}

// --- Task Helper: Update Nomicron Rules in KV ---
async function updateNomicronRules(env: Env) {
  const { text, lastModified } = await fetchAndParseNomicronRules();
  const payload = { rules: text };
  await env.KV.put('nomicron', JSON.stringify(payload));
  await updateManifest(env, 'nomicron', { lastModified });
  console.log(`Successfully updated Nomicron rules KV and manifest lastModified: ${lastModified}`);
}

// --- Task Helper: Update Agora Rules in KV ---
async function updateAgoraRules(env: Env) {
  const { text, lastModified } = await fetchAndParseAgoraRules();
  const payload = { rules: text };
  
  await env.KV.put('agora', JSON.stringify(payload));
  await updateManifest(env, 'agora', { lastModified });
  
  console.log(`Successfully updated Agora rules KV and manifest lastModified: ${lastModified}`);
}

// --- Task Helper: Update BlogNomic Rules in KV ---
async function updateBlogNomicRules(env: Env) {
  const { text, lastModified } = await fetchAndParseBlogNomicRules();
  const payload = { rules: text };

  await env.KV.put('blognomic', JSON.stringify(payload));
  await updateManifest(env, 'blognomic', { lastModified });

  console.log(`Successfully updated BlogNomic rules KV and manifest lastModified: ${lastModified}`);
}

// --- Task Helper: Update Infinite Nomic Rules in KV ---
async function updateInfiniteNomicRules(env: Env) {
  const { text } = await fetchAndParseInfiniteNomicRules();
  const payload = { rules: text };

  await env.KV.put('infinite', JSON.stringify(payload));

  console.log('Successfully updated Infinite Nomic rules KV (omitting manifest update).');
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
    await updateManifest(env, 'agora', { players: playerCount });
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
    await updateManifest(env, 'nomicron', { players: playerCount });
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
    await updateManifest(env, 'blognomic', { players: playerCount });
    console.log(`Successfully updated BlogNomic player count to KV and manifest: ${playerCount}`);
  } else {
    console.log('Player count not found on BlogNomic page.');
  }
}

// --- Cron Handler ---
async function handleCron(env: Env) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();

  try {
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
        console.log('Executing Cron Task for Hour 10 UTC (Agora Rules Update)');
        await updateAgoraRules(env);
        break;

      case 15:
        console.log('Executing Cron Task for Hour 15 UTC (BlogNomic Rules Update)');
        await updateBlogNomicRules(env);
        break;

      case 20:
        console.log('Executing Cron Task for Hour 20 UTC (Infinite Nomic Rules Update)');
        await updateInfiniteNomicRules(env);
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