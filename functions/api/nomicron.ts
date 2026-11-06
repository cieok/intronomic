export const onRequest: PagesFunction = async (context) => {
  const targetUrl = 'https://nomicron.org/rules/';

  try {
    // Cloudflare fetches the rules server-to-server, bypassing CORS completely
    const externalResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Nomicinfra-App'
      }
    });

    const data = await externalResponse.arrayBuffer();
    
    // Pass the response back to your frontend
    return new Response(data, {
      status: externalResponse.status,
      headers: {
        'Content-Type': externalResponse.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=36000' // Cache for ten hours
      }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch rules', 
      details: err.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};