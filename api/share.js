import { rpc, validToken } from './_supabase.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Serve o app em /e/:token com título, texto e foto do evento para a prévia do WhatsApp.
export default async function handler(req, res) {
  const token = String(req.query.token || '');
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  let html = await fetch(`${origin}/index.html`).then(r => r.text());
  try {
    const event = validToken(token) ? await rpc('get_event_share', { p_token: token }) : null;
    if (event?.name) {
      const description = event.share_text?.trim() || [event.date, event.location].filter(Boolean).join(' · ') || 'Faça sua inscrição.';
      const pageUrl = `${origin}/e/${token}`;
      const tags = [
        `<title>${escape(event.name)}</title>`,
        `<meta name="description" content="${escape(description)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${escape(pageUrl)}" />`,
        `<meta property="og:title" content="${escape(event.name)}" />`,
        `<meta property="og:description" content="${escape(description)}" />`,
        ...(event.has_banner ? [
          `<meta property="og:image" content="${escape(`${origin}/api/banner?token=${token}&v=${event.banner_version.slice(0, 8)}`)}" />`,
          `<meta property="og:image:type" content="image/jpeg" />`,
          `<meta property="og:image:width" content="1200" />`,
          `<meta property="og:image:height" content="675" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
        ] : []),
      ].join('\n    ');
      html = html.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace('</head>', `    ${tags}\n  </head>`);
    }
  } catch (_) { /* Sem prévia personalizada, o app abre normalmente. */ }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.status(200).send(html);
}
