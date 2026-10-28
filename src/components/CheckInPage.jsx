import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { fetchTicketByCode, setCheckIn } from '../lib/supabase';
import { calculateAge } from '../lib/exportUtils';

const time = value => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Aberta pela equipe ao ler o QR Code do ingresso com a câmera do celular.
export function CheckInPage({ code, onDone }) {
  const [ticket, setTicket] = useState(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [justEntered, setJustEntered] = useState(false);

  useEffect(() => {
    fetchTicketByCode(code).then(setTicket).catch(e => setError(e.message));
  }, [code]);

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const [row] = await setCheckIn(ticket.id, true);
      if (row) { setTicket(t => ({ ...t, checked_in_at: row.checked_in_at })); setJustEntered(true); }
      else setTicket(await fetchTicketByCode(code));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const paid = ticket && (ticket.payment_status === 'Confirmado' || ticket.payment_status === 'Pago');
  const banner = !ticket ? null
    : justEntered ? { color: '#34d399', icon: <CheckCircle2 size={56} />, title: 'Entrada liberada' }
    : ticket.checked_in_at ? { color: '#f87171', icon: <XCircle size={56} />, title: `Já entrou em ${time(ticket.checked_in_at)}` }
    : paid ? { color: '#34d399', icon: <CheckCircle2 size={56} />, title: 'Ingresso válido' }
    : { color: '#fbbf24', icon: <AlertTriangle size={56} />, title: `Pagamento ${String(ticket.payment_status || 'Pendente').toLowerCase()}` };

  return <main className="glass-card" style={{ maxWidth: 460, margin: '5vh auto', textAlign: 'center', display: 'grid', gap: 14 }}>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Check-in · ingresso {code.toUpperCase()}</div>
    {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
    {ticket === undefined && !error && <p>Consultando ingresso...</p>}
    {ticket === null && <>
      <XCircle size={56} style={{ color: '#f87171', margin: '0 auto' }} />
      <h2>Ingresso não encontrado</h2>
      <p style={{ color: 'var(--text-muted)' }}>Este QR Code não corresponde a nenhuma inscrição.</p>
    </>}
    {ticket && <>
      <div style={{ color: banner.color, margin: '0 auto' }}>{banner.icon}</div>
      <h2 style={{ color: banner.color }}>{banner.title}</h2>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{ticket.name}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        {ticket.event_name}{ticket.ticket_lot_name ? ` · ${ticket.ticket_lot_name}` : ''}<br />
        {ticket.network} · {ticket.discipler} · {calculateAge(ticket.birth_date)}
      </div>
      {!ticket.checked_in_at && <button type="button" className="btn-primary" disabled={busy} onClick={confirm}
        style={paid ? undefined : { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
        {busy ? 'Registrando...' : paid ? 'Confirmar entrada' : 'Liberar entrada mesmo assim'}
      </button>}
    </>}
    <button type="button" className="btn-secondary" onClick={onDone}>Ir para o painel</button>
  </main>;
}
