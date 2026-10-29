import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Clock, Download, Search, Share2, Ticket, XCircle } from 'lucide-react';
import { startGroupPayment } from '../lib/supabase';
import { PixKeyBox, QrImage, formatPhone } from './PixKeyBox';

const money = value => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const ticketUrl = code => new URL(`/c/${code}`, window.location.origin).toString();
const isPaid = status => status === 'Confirmado' || status === 'Pago';

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function remainingText(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}h${pad(m)}` : `${pad(m)}:${pad(s)}`;
}

function fitText(ctx, text, maxWidth, size, weight = 'bold') {
  let fontSize = size;
  do { ctx.font = `${weight} ${fontSize}px sans-serif`; fontSize -= 2; } while (ctx.measureText(text).width > maxWidth && fontSize > 14);
}

// Gera a imagem do ingresso para guardar na galeria ou enviar a quem vai participar.
async function ticketCanvas(registration) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 920;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.fillStyle = '#111827';
  fitText(ctx, registration.event_name, 580, 36); ctx.fillText(registration.event_name, 320, 70);
  ctx.fillStyle = '#4b5563';
  const meta = [registration.event_date, registration.event_location].filter(Boolean).join(' · ');
  if (meta) { fitText(ctx, meta, 580, 22, 'normal'); ctx.fillText(meta, 320, 108); }
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, ticketUrl(registration.ticket_code), { width: 460, margin: 1 });
  ctx.drawImage(qr, 90, 140);
  ctx.fillStyle = '#111827';
  fitText(ctx, registration.name, 580, 34); ctx.fillText(registration.name, 320, 660);
  ctx.fillStyle = '#4b5563'; ctx.font = 'normal 24px sans-serif';
  if (registration.ticket_lot_name) ctx.fillText(registration.ticket_lot_name, 320, 700);
  ctx.font = 'bold 30px monospace'; ctx.fillStyle = '#111827';
  ctx.fillText(registration.ticket_code, 320, 760);
  ctx.font = 'normal 20px sans-serif'; ctx.fillStyle = '#6b7280';
  ctx.fillText('Apresente este QR Code na entrada do evento', 320, 820);
  return canvas;
}

async function downloadTicket(registration) {
  const canvas = await ticketCanvas(registration);
  const link = document.createElement('a');
  link.download = `ingresso-${registration.ticket_code}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Abre o compartilhamento do celular (WhatsApp etc.) com a imagem do ingresso.
// Sem suporte a arquivos, baixa a imagem para a pessoa enviar manualmente.
async function shareTicket(registration) {
  const canvas = await ticketCanvas(registration);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], `ingresso-${registration.ticket_code}.png`, { type: 'image/png' });
  const text = `Ingresso de ${registration.name} para ${registration.event_name}. Apresente o QR Code na entrada.`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); }
    catch (err) { if (err?.name !== 'AbortError') throw err; }
    return;
  }
  await downloadTicket(registration);
  alert('A imagem do ingresso foi salva. Envie pelo WhatsApp para quem vai participar.');
}

function TicketCard({ registration }) {
  return <div style={{ textAlign: 'center', display: 'grid', gap: 10 }}>
    <div style={{ color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <CheckCircle2 size={20} /> Inscrição confirmada
    </div>
    <QrImage text={ticketUrl(registration.ticket_code)} size={220} alt={`QR Code do ingresso de ${registration.name}`} />
    <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.1em', color: '#fff' }}>{registration.ticket_code}</div>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Apresente este QR Code na entrada do evento. Salve a imagem ou tire um print.</p>
    {registration.checked_in_at && <p style={{ color: '#a5b4fc', fontWeight: 700 }}>
      Entrada registrada às {new Date(registration.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </p>}
    <button type="button" className="btn-primary" onClick={() => shareTicket(registration).catch(() => alert('Não foi possível enviar. Tire um print da tela.'))}>
      <Share2 size={18} /> Enviar ingresso (WhatsApp)
    </button>
    <button type="button" className="btn-secondary" onClick={() => downloadTicket(registration).catch(() => alert('Não foi possível salvar. Tire um print da tela.'))}>
      <Download size={18} /> Salvar na galeria
    </button>
  </div>;
}

function ManualPix({ registrations, organization }) {
  const total = registrations.reduce((sum, r) => sum + Number(r.ticket_price || 0), 0);
  const names = registrations.map(r => r.name).join(', ');
  const whatsapp = String(organization?.receipt_whatsapp || '').replace(/\D/g, '');
  const waNumber = whatsapp.length === 10 || whatsapp.length === 11 ? `55${whatsapp}` : whatsapp;
  return <div style={{ textAlign: 'center' }}>
    <p>Faça o PIX de <strong style={{ color: '#34d399' }}>{money(total)}</strong>:</p>
    <PixKeyBox pixKey={organization?.pix_key} />
    {whatsapp ? <>
      <p style={{ color: 'var(--text-muted)' }}>Depois envie o comprovante no WhatsApp <strong>{formatPhone(whatsapp)}</strong>. A equipe confirma e os ingressos aparecem aqui.</p>
      <a className="btn-primary" style={{ marginTop: 12, display: 'block', textAlign: 'center', textDecoration: 'none', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Olá! Segue o comprovante do PIX de ${money(total)} da inscrição de ${names} no evento ${registrations[0].event_name}.`)}`}
        target="_blank" rel="noreferrer">Enviar comprovante no WhatsApp</a>
    </> : <p style={{ color: 'var(--text-muted)' }}>Depois envie o comprovante para a organização do evento. A equipe confirma e os ingressos aparecem aqui.</p>}
  </div>;
}

// Um pagamento para um grupo de inscrições: as que já têm link (pagar agora) ou as
// ainda sem link, que viram um único Pix quando a pessoa toca em pagar.
function PaymentBox({ registrations, organization, onChanged }) {
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = registrations[0].payment_url;
  const total = registrations.reduce((sum, r) => sum + Number(r.ticket_price || 0), 0);
  const expires = Math.min(...registrations.map(r => (r.pix_expires_at ? new Date(r.pix_expires_at).getTime() : Infinity)));
  const now = useNow(Number.isFinite(expires));
  const left = expires - now;

  if (manual) return <ManualPix registrations={registrations} organization={organization} />;
  if (left <= 0) return <p style={{ textAlign: 'center', color: '#fca5a5' }}>O prazo para pagar acabou. Se você já pagou, aguarde alguns instantes; senão, faça uma nova inscrição.</p>;

  const pay = async () => {
    if (url) { window.location.href = url; return; }
    setBusy(true); setError('');
    try {
      const data = await startGroupPayment(registrations.map(r => r.access_token));
      if (data.configured === false) { setManual(true); return; }
      if (data.url) { window.location.href = data.url; return; }
      onChanged();
    } catch (_) {
      setError('Não foi possível abrir o pagamento agora. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 14, padding: 16, display: 'grid', gap: 12, textAlign: 'center' }}>
    <div style={{ color: '#fcd34d', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Clock size={18} /> Pagamento pendente</div>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      {registrations.length > 1 ? `${registrations.length} inscrições: ` : ''}{registrations.map(r => r.name).join(', ')}
    </div>
    <p>Total: <strong style={{ color: '#34d399', fontSize: '1.25rem' }}>{money(total)}</strong></p>
    {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
    <button type="button" className="btn-primary" disabled={busy} onClick={pay}
      style={{ display: 'flex', justifyContent: 'center', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
      {busy ? 'Abrindo pagamento...' : `Pagar ${money(total)} com Pix`}
    </button>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
      {registrations.length > 1 ? 'Um único Pix para todos. ' : ''}Você paga na página segura da InfinitePay e volta para cá com {registrations.length > 1 ? 'os ingressos' : 'o ingresso'}, sem precisar enviar comprovante.
    </p>
    {Number.isFinite(left) && <div style={{ color: '#fcd34d', fontWeight: 700, fontSize: '0.9rem' }}>Pague em até {remainingText(left)}; depois a vaga é liberada.</div>}
  </div>;
}

function RegistrationCard({ registration }) {
  const status = registration.payment_status;
  return <div style={{ border: '1px solid var(--border-glass)', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
    <div>
      <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.05rem' }}>{registration.name}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
        {[registration.ticket_lot_name, money(registration.ticket_price)].filter(Boolean).join(' · ')}
      </div>
    </div>
    {isPaid(status) && registration.ticket_code ? <TicketCard registration={registration} />
      : status === 'Expirado' ? <div style={{ color: '#fca5a5', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <XCircle size={20} style={{ flexShrink: 0 }} />
        <span>O prazo para pagar acabou e a vaga foi liberada. Se ainda quiser participar, faça uma nova inscrição.</span>
      </div>
      : <div style={{ color: '#fcd34d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} /> Aguardando pagamento</div>}
  </div>;
}

const awaitingPix = r => r.payment_status === 'Pendente' && r.payment_method === 'PIX' && Number(r.ticket_price) > 0;

export function MyRegistrations({ registrations, organization, onNew, onChanged, finder }) {
  // Agrupa as pendentes por link de pagamento; as ainda sem link formam um único Pix.
  const groups = [];
  registrations.filter(awaitingPix).forEach(r => {
    const key = r.payment_url || 'novo';
    const group = groups.find(g => g.key === key);
    group ? group.items.push(r) : groups.push({ key, items: [r] });
  });
  const unpaidWithoutLink = groups.some(g => g.key === 'novo');
  return <div className="wizard-card" style={{ display: 'grid', gap: 16 }}>
    <div className="step-header" style={{ marginBottom: 0 }}>
      <div className="step-label"><Ticket size={15} /><span>{groups.length ? 'Pagamento pendente' : 'Seus ingressos'}</span></div>
      <h2 className="step-title">{registrations.length > 1 ? 'Suas inscrições' : 'Sua inscrição'}</h2>
    </div>
    {groups.map(g => <PaymentBox key={g.key} registrations={g.items} organization={organization} onChanged={onChanged} />)}
    {registrations.map(registration => <RegistrationCard key={registration.id} registration={registration} />)}
    <button type="button" className="btn-secondary" onClick={onNew}>+ Inscrever outra pessoa</button>
    {unpaidWithoutLink && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: -8 }}>
      Vai inscrever mais alguém? Adicione todos antes de pagar: fica tudo num Pix só.
    </p>}
    {finder}
  </div>;
}

const maskDate = value => {
  const raw = value.replace(/\D/g, '').slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}` : raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
};

// Para quem se inscreveu em outro celular ou limpou o navegador.
export function FindRegistration({ onFind }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" className="btn-skip-action" style={{ border: 'none', background: 'transparent' }} onClick={() => setOpen(true)}>
    <Search size={15} style={{ marginRight: 6 }} /> Já se inscreveu em outro celular? Encontre sua inscrição
  </button>;
  return <form style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--border-glass)', paddingTop: 14 }} onSubmit={async e => {
    e.preventDefault();
    const [d, m, y] = birth.split('/');
    if (!y || y.length !== 4) { setMessage('Digite a data como DD/MM/AAAA.'); return; }
    setBusy(true); setMessage('');
    try {
      const found = await onFind(name, `${y}-${m}-${d}`);
      if (!found) setMessage('Não encontramos inscrição com esse nome e data de nascimento neste evento.');
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }}>
    <strong>Encontrar minha inscrição</strong>
    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo usado na inscrição" autoComplete="name" required />
    <input className="form-input" value={birth} onChange={e => setBirth(maskDate(e.target.value))} placeholder="Data de nascimento (DD/MM/AAAA)" inputMode="numeric" required />
    {message && <p role="alert" style={{ color: '#fca5a5', fontSize: '0.88rem' }}>{message}</p>}
    <button className="btn-primary" disabled={busy}>{busy ? 'Procurando...' : 'Procurar'}</button>
  </form>;
}
