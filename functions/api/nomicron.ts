export const onRequest: PagesFunction = async (context) => {
  const targetUrl = 'https://nomicron.org/rules/';

  try {
    const externalResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Nomicinfra-App'
      }
    });

    if (!externalResponse.ok) {
      return new Response(JSON.stringify({ error: `Upstream HTTP ${externalResponse.status}` }), {
        status: externalResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const htmlText = await externalResponse.text();

    // Cloudflare Workers run on V8, which has regular expressions, 
    // or you can use a lightweight regex extractor to grab text inside rule cards.
    // Here we strip out all HTML tags and target the rule contents cleanly:
    
    // 1. Extract everything inside .rule-card__body .markdown-body blocks using regex
    const regex = /<div class="rule-card__body[^"]*">([\s\S]*?)<\/div>/g;
    let match;
    let extractedText = '';

    while ((match = regex.exec(htmlText)) !== null) {
      // Strip HTML tags from each block
      const cleanBlock = match[1].replace(/<[^>]*>/g, ' ');
      extractedText += cleanBlock + '\n\n';
    }

    // Fallback if regex pattern changes on the upstream site
    if (!extractedText.trim()) {
      extractedText = htmlText.replace(/<[^>]*>/g, ' ');
    }

    // Clean up extra whitespace/newlines
    const finalCleanText = extractedText.replace(/\s+/g, ' ').trim();

    return new Response(finalCleanText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for an hour
      }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch or parse rules', 
      details: err.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};