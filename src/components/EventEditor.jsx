import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react';
import {
  addEvent, createEventWithSetupCode, createEventWithLots, createEventWithBanner,
  createEventWithLotsAndBanner, saveEventLotsWithSetupCode, saveEventBannerWithSetupCode,
  saveEventShareText, fetchSharedEvent
} from '../lib/supabase';
import { prepareEventBanner } from '../lib/eventImage';
import { checkedLots, starterLots } from '../lib/lots';

const fieldStyle = { display: 'grid', gap: 6, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-muted)' };

function Section({ title, hint, children }) {
  return <section className="glass-card" style={{ display: 'grid', gap: 12 }}>
    <div>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{title}</h4>
      {hint && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>{hint}</p>}
    </div>
    {children}
  </section>;
}

function Toggle({ value, options, onChange, disabled }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
    {options.map(([key, label]) => <button key={String(key)} type="button" disabled={disabled}
      className={value === key ? 'btn-primary' : 'btn-secondary'} aria-pressed={value === key}
      onClick={() => onChange(key)}>{label}</button>)}
  </div>;
}

// Criação e edição de evento numa tela só: dados, foto, mensagem do link,
// preço único ou lotes e se as inscrições estão abertas.
export function EventEditor({ event, onClose, onSaved }) {
  const isNew = !event;
  const [name, setName] = useState(event?.name || '');
  const [date, setDate] = useState(event?.date || '');
  const [location, setLocation] = useState(event?.location || '');
  const [shareText, setShareText] = useState(event?.share_text || '');
  const [bannerData, setBannerData] = useState(event?.banner_data || '');
  const [bannerDirty, setBannerDirty] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [price, setPrice] = useState(String(event?.price ?? '0'));
  const [mode, setMode] = useState('single');
  const [lotRows, setLotRows] = useState(starterLots);
  const [lotsDirty, setLotsDirty] = useState(false);
  const [hasSavedLots, setHasSavedLots] = useState(false);
  const [lotsLoaded, setLotsLoaded] = useState(isNew);
  const [active, setActive] = useState(event?.active !== false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const wasActive = event?.active !== false;

  useEffect(() => {
    if (isNew || !wasActive || !event.share_token) return;
    let cancelled = false;
    fetchSharedEvent(event.share_token).then(data => {
      if (cancelled || !data) return;
      const lots = data.ticket_lots || [];
      setHasSavedLots(Boolean(data.has_ticket_lots));
      if (lots.length) {
        setMode('lots');
        setLotRows(lots.map(({ id, name: lotName, quantity, price: lotPrice, sold }) => ({ id, name: lotName, quantity: String(quantity), price: String(lotPrice), sold })));
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLotsLoaded(true); });
    return () => { cancelled = true; };
  }, [isNew, wasActive, event?.share_token]);

  const changeLot = (index, field, value) => {
    setLotsDirty(true);
    setLotRows(rows => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const save = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (!name.trim()) throw new Error('Informe o nome do evento.');
      const lots = mode === 'lots' ? checkedLots(lotRows) : [];
      const basePrice = mode === 'lots' ? lots[0].price : Number(price);
      if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('Valor inválido.');
      const details = { name, price: basePrice, date, location };
      let id = event?.id;
      if (isNew) {
        const saved = mode === 'lots'
          ? bannerData ? await createEventWithLotsAndBanner('', details, lots, bannerData) : await createEventWithLots('', details, lots)
          : bannerData ? await createEventWithBanner('', details, bannerData) : await createEventWithSetupCode('', details);
        id = saved.id;
        if (shareText.trim()) await saveEventShareText(saved.share_token, shareText);
      } else {
        const token = event.share_token;
        const needsOpenLink = (lotsDirty && mode === 'lots') || bannerDirty;
        if (needsOpenLink && !active) throw new Error('Para alterar lotes ou foto, deixe as inscrições abertas ao salvar.');
        if (mode === 'single' && hasSavedLots && lotsDirty) throw new Error('Um evento com lotes não pode voltar ao preço único.');
        // Lotes e foto só podem ser gravados com o link ativo; fechar as inscrições vem por último.
        await addEvent({ id, ...details, active: active || wasActive });
        if (lotsDirty && mode === 'lots') await saveEventLotsWithSetupCode('', token, lots);
        if (bannerDirty) await saveEventBannerWithSetupCode('', token, bannerData);
        await saveEventShareText(token, shareText);
        if (!active && wasActive) await addEvent({ id, ...details, active: false });
      }
      await onSaved(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" className="btn-secondary" onClick={onClose} aria-label="Voltar" style={{ width: 'auto' }}><ArrowLeft size={18} /></button>
      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{isNew ? 'Novo evento' : 'Editar evento'}</h3>
    </div>

    <Section title="Informações">
      <label style={fieldStyle}>Nome do evento *
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} maxLength={150} required placeholder="Ex.: Batismo + Comunhão" />
      </label>
      <label style={fieldStyle}>Data
        <input className="form-input" value={date} onChange={e => setDate(e.target.value)} maxLength={150} placeholder="Ex.: Sábado, 31/10 às 19h" />
      </label>
      <label style={fieldStyle}>Local
        <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} maxLength={200} placeholder="Ex.: Templo sede" />
      </label>
    </Section>

    <Section title="Foto do evento" hint="Horizontal (16:9). Aparece no topo da inscrição e na prévia do link no WhatsApp.">
      {bannerData
        ? <img src={bannerData} alt="Prévia da foto do evento" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12 }} />
        : <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', borderStyle: 'dashed' }}>
          <span style={{ display: 'grid', placeItems: 'center', gap: 6 }}><ImageIcon size={28} />{bannerBusy ? 'Preparando foto...' : 'Escolher foto'}</span>
        </button>}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBannerBusy(true); setError('');
        try { setBannerData(await prepareEventBanner(file)); setBannerDirty(true); }
        catch (err) { setError(err.message); }
        finally { setBannerBusy(false); e.target.value = ''; }
      }} />
      {bannerData && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>Trocar foto</button>
        <button type="button" className="btn-secondary" onClick={() => { setBannerData(''); setBannerDirty(true); }}>Remover</button>
      </div>}
    </Section>

    <Section title="Mensagem do link" hint="Texto que aparece junto com a foto quando o link é enviado no WhatsApp.">
      <textarea className="form-input" rows="3" maxLength={300} value={shareText} onChange={e => setShareText(e.target.value)}
        placeholder="Ex.: Inscrições abertas para o Batismo! Garanta sua vaga." />
    </Section>

    <Section title="Ingressos" hint={mode === 'lots' ? 'Os lotes são vendidos em ordem: o próximo começa quando o anterior esgota.' : 'Mesmo valor para todos. Use 0 para evento gratuito.'}>
      {!lotsLoaded ? <p style={{ color: 'var(--text-muted)' }}>Carregando lotes...</p> : <>
        {!isNew && !wasActive
          ? <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Reabra as inscrições para ver e alterar lotes.</p>
          : <Toggle value={mode} options={[['single', 'Preço único'], ['lots', 'Lotes']]} disabled={hasSavedLots}
            onChange={value => { setMode(value); setLotsDirty(true); }} />}
        {mode === 'single' && <label style={fieldStyle}>Valor da inscrição (R$)
          <input className="form-input" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} required />
        </label>}
        {mode === 'lots' && <div style={{ display: 'grid', gap: 10 }}>
          {lotRows.map((row, index) => {
            const sold = Number(row.sold) || 0;
            return <div key={row.id || index} style={{ border: '1px solid var(--border-glass)', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <input className="form-input" value={row.name} onChange={e => changeLot(index, 'name', e.target.value)} maxLength={80} required aria-label={`Nome do lote ${index + 1}`} />
                <button type="button" className="btn-secondary" style={{ width: 'auto', color: '#f87171', opacity: lotRows.length === 1 || sold > 0 ? 0.35 : 1 }} disabled={lotRows.length === 1 || sold > 0}
                  title={sold > 0 ? 'Lote com inscrições não pode ser removido' : 'Remover lote'} aria-label="Remover lote"
                  onClick={() => { setLotsDirty(true); setLotRows(rows => rows.filter((_, i) => i !== index)); }}><Trash2 size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={fieldStyle}>Vagas
                  <input className="form-input" type="number" min={Math.max(1, sold)} step="1" inputMode="numeric" value={row.quantity} onChange={e => changeLot(index, 'quantity', e.target.value)} required />
                </label>
                <label style={fieldStyle}>Valor (R$)
                  <input className="form-input" type="number" min="0" step="0.01" inputMode="decimal" value={row.price} onChange={e => changeLot(index, 'price', e.target.value)} required />
                </label>
              </div>
              {sold > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sold} inscrições neste lote</div>}
            </div>;
          })}
          <button type="button" className="btn-secondary" disabled={lotRows.length >= 20}
            onClick={() => { setLotsDirty(true); setLotRows(rows => [...rows, { name: `${rows.length + 1}º lote`, quantity: '', price: '' }]); }}>
            <Plus size={16} /> Adicionar lote
          </button>
        </div>}
      </>}
    </Section>

    {!isNew && <Section title="Inscrições" hint="Encerradas: o link para de aceitar inscrições, e o evento fica no histórico.">
      <Toggle value={active} options={[[true, 'Abertas'], [false, 'Encerradas']]} onChange={setActive} />
    </Section>}

    {error && <p role="alert" style={{ color: '#fca5a5', textAlign: 'center' }}>{error}</p>}
    <div style={{ position: 'sticky', bottom: 0, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, padding: '12px 0 calc(12px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(to top, var(--bg-main) 70%, transparent)' }}>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
      <button className="btn-primary" disabled={busy || bannerBusy}><Save size={18} /> {busy ? 'Salvando...' : isNew ? 'Criar evento' : 'Salvar'}</button>
    </div>
  </form>;
}
