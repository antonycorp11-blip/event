import { table } from './_supabase.js';

// Woovi (OpenPix). WOOVI_API_URL permite usar o sandbox: https://api.woovi-sandbox.com
const appId = process.env.WOOVI_APP_ID;
const baseUrl = process.env.WOOVI_API_URL || 'https://api.openpix.com.br';
export const pixMinutes = Math.max(10, Number(process.env.PIX_EXPIRES_MINUTES) || 60);
export const wooviReady = () => Boolean(appId);

async function call(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: appId, 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Woovi ${response.status}: ${data.error || ''}`);
  return data.charge || data;
}

export const createCharge = ({ correlationID, value, comment }) => call('/api/v1/charge', {
  method: 'POST',
  body: JSON.stringify({ correlationID, value, comment, expiresIn: pixMinutes * 60 }),
});
export const getCharge = correlationID => call(`/api/v1/charge/${encodeURIComponent(correlationID)}`);

export const cents = price => Math.round(Number(price || 0) * 100);

// Confirma só com a cobrança consultada na própria Woovi e no valor exato do ingresso.
export async function confirmIfPaid(registration, charge) {
  if (charge?.status !== 'COMPLETED' || Number(charge.value) !== cents(registration.ticket_price)) return false;
  const filter = `registrations?id=eq.${registration.id}&payment_status=in.(Pendente,Expirado)`;
  try {
    await table(filter, { method: 'PATCH', body: { payment_status: 'Confirmado' } });
  } catch (error) {
    // Pagou depois de a vaga expirar e o lote esgotou: registra o pagamento para a equipe resolver.
    console.error(error);
    await table(filter, { method: 'PATCH', body: { paid_at: new Date().toISOString() } });
  }
  return true;
}
