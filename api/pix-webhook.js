import { rpc, validToken } from './_supabase.js';

// Aviso de pagamento aprovado da InfinitePay. O banco consulta a própria InfinitePay
// (payment_check) antes de confirmar, então um aviso falso não confirma nada.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  const body = req.body || {};
  const orderNsu = String(body.order_nsu || '');
  if (!validToken(orderNsu) || !body.transaction_nsu || !(body.invoice_slug || body.slug)) {
    return res.status(400).json({ error: 'Pagamento inválido' });
  }
  try {
    const result = await rpc('confirm_registration_payment', {
      p_order_nsu: orderNsu,
      p_transaction_nsu: String(body.transaction_nsu),
      p_slug: String(body.invoice_slug || body.slug),
      p_receipt_url: body.receipt_url ? String(body.receipt_url) : null,
    });
    return res.status(200).json({ status: result?.status });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Não foi possível confirmar' });
  }
}
