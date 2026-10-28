import React, { useEffect, useState } from 'react';
import { Archive, Copy, Pencil, Plus, Share2, Trash2, Users } from 'lucide-react';
import { fetchSharedEvent } from '../lib/supabase';

const money = value => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const isPaid = r => r.payment_status === 'Confirmado' || r.payment_status === 'Pago';
const eventLink = event => `${window.location.origin}/e/${event.share_token}`;

function Metric({ label, value, color = '#fff' }) {
  return <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '8px 10px' }}>
    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>;
}

function LotProgress({ lots }) {
  const ordered = [...lots].sort((a, b) => Number(a.position) - Number(b.position));
  const current = ordered.find(lot => Number(lot.remaining) > 0);
  const sold = ordered.reduce((sum, lot) => sum + Number(lot.sold), 0);
  const total = ordered.reduce((sum, lot) => sum + Number(lot.quantity), 0);
  return <div style={{ display: 'grid', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
      <span>{current ? `${current.name}: ${current.remaining} vagas · ${money(current.price)}` : 'Ingressos esgotados'}</span>
      <span>{sold}/{total}</span>
    </div>
    <div style={{ height: 6, borderRadius: 999, background: 'rgba(148, 163, 184, 0.2)', overflow: 'hidden' }}>
      <div style={{ width: `${total ? Math.min(100, (sold / total) * 100) : 0}%`, height: '100%', background: 'var(--primary-gradient)' }} />
    </div>
  </div>;
}

function EventCard({ event, registrations, lots, selected, onEdit, onSelect, onShowAttendees, onSetEventActive, onDeleteEvent }) {
  const archived = event.active === false;
  const regs = registrations.filter(r => r.event_id === event.id && r.payment_status !== 'Expirado');
  const paid = regs.filter(isPaid);
  const revenue = paid.reduce((sum, r) => sum + Number(r.ticket_price ?? event.price ?? 0), 0);
  const entered = regs.filter(r => r.checked_in_at).length;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(eventLink(event)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (_) { window.prompt('Copie o link do evento:', eventLink(event)); }
  };
  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: event.name, text: event.share_text || `Inscrições: ${event.name}`, url: eventLink(event) }); }
      catch (_) { /* compartilhamento cancelado */ }
    } else copyLink();
  };

  return <article className="glass-card" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${selected ? 'var(--primary)' : 'var(--border-glass)'}`, opacity: archived ? 0.8 : 1 }}>
    {event.banner_data && <img src={event.banner_data} alt="" style={{ width: '100%', aspectRatio: '16 / 6', objectFit: 'cover', display: 'block' }} />}
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{event.name}</h4>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{[event.date, event.location].filter(Boolean).join(' · ') || 'Sem data e local'}</div>
        </div>
        <span className="badge" style={{ whiteSpace: 'nowrap', background: archived ? 'rgba(148, 163, 184, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: archived ? 'var(--text-muted)' : '#6ee7b7' }}>
          {archived ? 'Encerrado' : 'Inscrições abertas'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Metric label="Inscritos" value={regs.length} />
        <Metric label="Pagos" value={paid.length} color="#34d399" />
        <Metric label="Pendentes" value={regs.length - paid.length} color="#fbbf24" />
        <Metric label="Arrecadado" value={money(revenue)} color="#34d399" />
        <Metric label="Entradas" value={`${entered}/${paid.length}`} color="#a5b4fc" />
        <Metric label="Valor" value={lots?.length ? 'Lotes' : money(event.price)} />
      </div>
      {lots?.length > 0 && <LotProgress lots={lots} />}

      {!archived && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className="btn-primary" onClick={copyLink}><Copy size={16} /> {copied ? 'Copiado!' : 'Copiar link'}</button>
        <button type="button" className="btn-secondary" onClick={shareLink}><Share2 size={16} /> Enviar link</button>
      </div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => onEdit(event)}><Pencil size={15} /> Editar</button>
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => onShowAttendees(event.id)}><Users size={15} /> Inscritos</button>
        {!archived && <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => onSelect(event.id)}>
          {selected ? 'Em atendimento ✓' : 'Usar no atendimento'}
        </button>}
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => {
          if (archived) { onSetEventActive(event.id, true); return; }
          if (confirm(`Encerrar inscrições de "${event.name}"?\n\nO link para de aceitar inscrições. Inscritos, pagamentos e check-in ficam guardados.`)) onSetEventActive(event.id, false);
        }}><Archive size={15} /> {archived ? 'Reabrir' : 'Encerrar'}</button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)' }} onClick={() => {
          if (!confirm(`Apagar "${event.name}" e as ${regs.length} inscrições dele?\n\nIsso não pode ser desfeito.`)) return;
          if (paid.length > 0 && window.prompt(`Este evento tem ${paid.length} inscrições PAGAS. Para guardar como histórico, use Encerrar.\n\nPara apagar mesmo assim, digite APAGAR:`)?.trim().toUpperCase() !== 'APAGAR') return;
          onDeleteEvent(event.id);
        }}><Trash2 size={15} /> Apagar</button>
      </div>
    </div>
  </article>;
}

// Painel de eventos do administrador: números de cada evento e todas as ações.
export function EventsManager({ events, registrations, selectedEventId, onSelectEvent, onEdit, onShowAttendees, onSetEventActive, onDeleteEvent }) {
  const [lotsByEvent, setLotsByEvent] = useState({});
  const [showClosed, setShowClosed] = useState(false);
  const open = events.filter(e => e.active !== false);
  const closed = events.filter(e => e.active === false);
  const tokens = open.map(e => e.share_token).filter(Boolean).join(',');

  useEffect(() => {
    let cancelled = false;
    open.filter(e => e.share_token).forEach(event => {
      fetchSharedEvent(event.share_token)
        .then(data => { if (!cancelled && data) setLotsByEvent(prev => ({ ...prev, [event.id]: data.ticket_lots || [] })); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, registrations.length]);

  const card = event => <EventCard key={event.id} event={event} registrations={registrations} lots={lotsByEvent[event.id]}
    selected={event.id === selectedEventId} onEdit={onEdit} onSelect={onSelectEvent} onShowAttendees={onShowAttendees}
    onSetEventActive={onSetEventActive} onDeleteEvent={onDeleteEvent} />;

  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>Eventos</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{open.length} com inscrições abertas</p>
      </div>
      <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => onEdit(null)}><Plus size={18} /> Novo evento</button>
    </div>
    {open.length === 0 && <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum evento com inscrições abertas. Toque em <strong>Novo evento</strong> para criar.</div>}
    {open.map(card)}
    {closed.length > 0 && <button type="button" className="btn-secondary" onClick={() => setShowClosed(v => !v)}>
      {showClosed ? 'Esconder encerrados' : `Ver encerrados (${closed.length})`}
    </button>}
    {showClosed && closed.map(card)}
  </div>;
}
