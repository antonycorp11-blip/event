import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Clock, Download, Search, Ticket, XCircle } from 'lucide-react';
import { requestPixCharge } from '../lib/supabase';
import { PixKeyBox, QrImage, RECEIPT_WHATSAPP, RECEIPT_WHATSAPP_LABEL, copyText } from './PixKeyBox';

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

// Gera uma imagem do ingresso para a pessoa guardar na galeria.
async function downloadTicket(registration) {
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
  const link = document.createElement('a');
  link.download = `ingresso-${registration.ticket_code}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
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
    <button type="button" className="btn-primary" onClick={() => downloadTicket(registration).catch(() => alert('Não foi possível salvar. Tire um print da tela.'))}>
      <Download size={18} /> Salvar ingresso
    </button>
  </div>;
}

function ManualPix({ registration }) {
  return <div style={{ textAlign: 'center' }}>
    <p>Faça o PIX de <strong style={{ color: '#34d399' }}>{money(registration.ticket_price)}</strong>:</p>
    <PixKeyBox />
    <p style={{ color: 'var(--text-muted)' }}>Depois envie o comprovante no WhatsApp <strong>{RECEIPT_WHATSAPP_LABEL}</strong>. A equipe confirma e o seu ingresso aparece aqui.</p>
    <a className="btn-primary" style={{ marginTop: 12, display: 'block', textAlign: 'center', textDecoration: 'none', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
      href={`https://wa.me/${RECEIPT_WHATSAPP}?text=${encodeURIComponent(`Olá! Segue o comprovante do PIX de ${money(registration.ticket_price)} da inscrição de ${registration.name} no evento ${registration.event_name}.`)}`}
      target="_blank" rel="noreferrer">Enviar comprovante no WhatsApp</a>
  </div>;
}

function PendingPix({ registration, onChanged }) {
  // undefined: carregando · null: Pix automático ainda não configurado · objeto: cobrança
  const [charge, setCharge] = useState(undefined);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await requestPixCharge(registration.access_token);
      setError('');
      if (data && data.status !== 'Pendente') { onChanged(); return; }
      setCharge(data);
    } catch (err) {
      setError(err.message);
    }
  }, [registration.access_token, onChanged]);
  useEffect(() => { load(); }, [load]);
  // O aviso da Woovi confirma sozinho; esta conferência a cada 30 s cobre um aviso atrasado.
  useEffect(() => {
    if (!charge) return;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [charge, load]);
  const now = useNow(Boolean(charge?.expiresAt));

  if (charge === null) return <ManualPix registration={registration} />;
  if (error) return <div style={{ textAlign: 'center', display: 'grid', gap: 10 }}>
    <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>
    <button type="button" className="btn-primary" onClick={() => { setError(''); setCharge(undefined); load(); }}>Tentar novamente</button>
  </div>;
  if (!charge) return <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Gerando o Pix...</p>;

  const left = charge.expiresAt ? new Date(charge.expiresAt).getTime() - now : Infinity;
  if (left <= 0) return <p style={{ textAlign: 'center', color: '#fca5a5' }}>O prazo deste Pix acabou. Se você já pagou, aguarde alguns instantes; senão, faça uma nova inscrição.</p>;

  return <div style={{ textAlign: 'center', display: 'grid', gap: 12 }}>
    <p>Pague <strong style={{ color: '#34d399', fontSize: '1.15rem' }}>{money(registration.ticket_price)}</strong> com o Pix abaixo:</p>
    <QrImage text={charge.brCode} size={220} alt="QR Code do Pix para pagamento" />
    <button type="button" className="btn-primary" onClick={async () => {
      if (await copyText(charge.brCode, 'Copie o código Pix:')) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
    }}>{copied ? 'Código copiado!' : 'Copiar código Pix (copia e cola)'}</button>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
      No app do banco, escolha Pix › Pix copia e cola. Assim que o pagamento cair, sua inscrição é confirmada e o ingresso aparece aqui, sem precisar enviar comprovante.
    </p>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fcd34d', fontWeight: 700 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', animation: 'pulseSuccess 1.5s infinite' }} />
      Aguardando pagamento{Number.isFinite(left) ? ` · expira em ${remainingText(left)}` : ''}
    </div>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Pode fechar esta página e pagar depois: ao voltar neste link, o Pix estará aqui.</p>
    <button type="button" className="btn-secondary" disabled={checking} onClick={async () => {
      setChecking(true); await load(); onChanged(); setChecking(false);
    }}>{checking ? 'Conferindo...' : 'Já paguei'}</button>
  </div>;
}

function RegistrationCard({ registration, onChanged }) {
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
      : registration.payment_method === 'PIX' && Number(registration.ticket_price) > 0
        ? <>
          <div style={{ color: '#fcd34d', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={18} /> Pagamento pendente</div>
          <PendingPix registration={registration} onChanged={onChanged} />
        </>
        : <div style={{ color: '#fcd34d', fontWeight: 700 }}>Aguardando confirmação da equipe.</div>}
  </div>;
}

export function MyRegistrations({ registrations, onNew, onChanged, finder }) {
  const pending = registrations.some(r => r.payment_status === 'Pendente');
  return <div className="wizard-card" style={{ display: 'grid', gap: 16 }}>
    <div className="step-header" style={{ marginBottom: 0 }}>
      <div className="step-label"><Ticket size={15} /><span>{pending ? 'Pagamento pendente' : 'Seus ingressos'}</span></div>
      <h2 className="step-title">{registrations.length > 1 ? 'Suas inscrições' : 'Sua inscrição'}</h2>
    </div>
    {registrations.map(registration => <RegistrationCard key={registration.id} registration={registration} onChanged={onChanged} />)}
    <button type="button" className="btn-secondary" onClick={onNew}>Fazer outra inscrição</button>
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
