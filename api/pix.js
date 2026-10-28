import { hasServiceKey, table, validToken } from './_supabase.js';
import { cents, confirmIfPaid, createCharge, getCharge, pixMinutes, wooviReady } from './_woovi.js';

const fields = 'id,event_name,name,payment_method,payment_status,ticket_price,pix_charge_id,pix_br_code,pix_expires_at';

// Gera (uma única vez) a cobrança Pix da inscrição ou devolve a que já existe,
// conferindo na Woovi se ela já foi paga.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const token = String(req.body?.access_token || '');
  if (!validToken(token)) return res.status(400).json({ error: 'Inscrição inválida' });
  if (!wooviReady() || !hasServiceKey()) return res.status(503).json({ configured: false });
  try {
    const [registration] = await table(`registrations?access_token=eq.${token}&select=${fields}`);
    if (!registration) return res.status(404).json({ error: 'Inscrição não encontrada' });
    const value = cents(registration.ticket_price);
    if (registration.payment_status !== 'Pendente' || registration.payment_method !== 'PIX' || value <= 0) {
      return res.json({ status: registration.payment_status });
    }
    if (registration.pix_charge_id) {
      const charge = await getCharge(registration.pix_charge_id).catch(() => null);
      if (await confirmIfPaid(registration, charge)) return res.json({ status: 'Confirmado' });
      return res.json({ status: 'Pendente', brCode: registration.pix_br_code, expiresAt: registration.pix_expires_at });
    }
    let charge;
    try {
      charge = await createCharge({ correlationID: registration.id, value, comment: `Inscrição ${registration.event_name}`.slice(0, 140) });
    } catch (error) {
      charge = await getCharge(registration.id); // outra aba já criou esta cobrança
    }
    if (!charge?.brCode) throw new Error('Woovi não devolveu o código Pix');
    const expiresAt = charge.expiresDate || new Date(Date.now() + pixMinutes * 60000).toISOString();
    await table(`registrations?id=eq.${registration.id}&pix_charge_id=is.null`, {
      method: 'PATCH',
      body: { pix_charge_id: registration.id, pix_br_code: charge.brCode, pix_expires_at: expiresAt },
    });
    return res.json({ status: 'Pendente', brCode: charge.brCode, expiresAt });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: 'Não foi possível gerar o Pix agora. Tente novamente.' });
  }
}
