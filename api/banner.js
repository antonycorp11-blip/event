import { rpc, validToken } from './_supabase.js';

// Entrega a foto do evento como arquivo JPEG para a prévia do link.
export default async function handler(req, res) {
  const token = String(req.query.token || '');
  try {
    const data = validToken(token) ? await rpc('get_event_banner', { p_token: token }) : null;
    const match = typeof data === 'string' && data.match(/^data:(image\/(?:jpeg|webp));base64,(.+)$/);
    if (!match) return res.status(404).send('Foto não encontrada');
    res.setHeader('Content-Type', match[1]);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(Buffer.from(match[2], 'base64'));
  } catch (_) {
    return res.status(502).send('Foto indisponível');
  }
}
