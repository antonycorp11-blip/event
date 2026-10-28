import { hasServiceKey, table, validToken } from './_supabase.js';
import { confirmIfPaid, getCharge, wooviReady } from './_woovi.js';

// Aviso da Woovi. O corpo só serve para saber qual cobrança olhar: o status e o
// valor são sempre consultados de novo na API da Woovi antes de confirmar.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (!wooviReady() || !hasServiceKey()) return res.status(503).json({ configured: false });
  const body = req.body || {};
  const id = body.charge?.correlationID || body.pix?.charge?.correlationID || body.correlationID;
  if (!validToken(id)) return res.status(200).json({ ignored: true }); // teste do painel ou outro evento
  try {
    const [registration] = await table(`registrations?id=eq.${id}&select=id,payment_status,ticket_price`);
    if (!registration) return res.status(200).json({ ignored: true });
    const charge = await getCharge(id);
    if (await confirmIfPaid(registration, charge)) return res.status(200).json({ status: 'Confirmado' });
    if (charge?.status === 'EXPIRED') {
      await table(`registrations?id=eq.${id}&payment_status=eq.Pendente`, { method: 'PATCH', body: { payment_status: 'Expirado' } });
    }
    return res.status(200).json({ status: charge?.status });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Falha ao processar' }); // a Woovi tenta de novo
  }
}
