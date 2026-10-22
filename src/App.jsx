import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminView } from './components/AdminView';
import {
  getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection,
  getAdminSession, signInAdmin, signOutAdmin, registerAdminAccount, claimFirstAdmin,
  createEventWithSetupCode, createEventWithLots, createEventWithBanner,
  createEventWithLotsAndBanner, saveEventLotsWithSetupCode,
  saveEventBannerWithSetupCode, fetchEventBanner,
  fetchEvents, fetchNetworks, fetchDisciplers, fetchLeaders, fetchRegistrations,
  createRegistration, createSharedRegistration, fetchSharedEvent,
  deleteRegistration, updateRegistrationStatus, addNetwork, deleteNetwork,
  addDiscipler, deleteDiscipler, addLeader, deleteLeader, addEvent
} from './lib/supabase';
import { prepareEventBanner } from './lib/eventImage';

const sharedToken = window.location.pathname.match(/^\/e\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1];
const isSharedPath = window.location.pathname.startsWith('/e/');
const eventPath = /^\/e\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

function namesFromText(value) {
  return [...new Set(value.split(/[\n,;]+/).map(name => name.trim()).filter(Boolean))];
}

function namesFromLink(url, key) {
  try {
    const raw = new URLSearchParams(url.hash.slice(1)).get('equipe');
    const names = raw ? JSON.parse(raw)?.[key] : null;
    return Array.isArray(names) ? names.filter(name => typeof name === 'string').slice(0, 50) : [];
  } catch (_) { return []; }
}

function textFromLink(link, key) {
  try { return namesFromLink(new URL(link), key).join('\n'); }
  catch (_) { return ''; }
}

function eventLink(token, networks, disciplers, leaders) {
  const url = new URL(`/e/${token}`, window.location.origin);
  const equipe = {
    redes: namesFromText(networks),
    discipuladores: namesFromText(disciplers),
    lideres: namesFromText(leaders),
  };
  if (Object.values(equipe).some(names => names.length)) {
    url.hash = new URLSearchParams({ equipe: JSON.stringify(equipe) }).toString();
  }
  return url.toString();
}

function validateTeamLists(networks, disciplers, leaders) {
  for (const [label, names, maxLength] of [
    ['redes', namesFromText(networks), 100],
    ['discipuladores', namesFromText(disciplers), 100],
    ['líderes', namesFromText(leaders), 150],
  ]) {
    if (names.length > 50) throw new Error(`Use até 50 nomes em ${label}.`);
    if (names.some(name => name.length > maxLength)) throw new Error(`Um nome em ${label} está longo demais.`);
  }
}

function listsForSharedEvent(bundle, link = window.location.href) {
  const url = new URL(link);
  const asOptions = names => names.map((name, index) => ({ id: `link-${index}-${name}`, name }));
  const networks = namesFromLink(url, 'redes');
  const disciplers = namesFromLink(url, 'discipuladores');
  const leaders = namesFromLink(url, 'lideres');
  return {
    networks: networks.length ? asOptions(networks) : bundle.networks,
    disciplers: disciplers.length ? asOptions(disciplers) : bundle.disciplers,
    leaders: leaders.length ? asOptions(leaders) : bundle.leaders,
  };
}

const starterLots = () => [
  { name: '1º lote', quantity: '', price: '' },
  { name: '2º lote', quantity: '', price: '' },
];

function checkedLots(rows) {
  if (rows.length < 1 || rows.length > 20) throw new Error('Informe de 1 a 20 lotes.');
  return rows.map((row, index) => {
    const name = row.name.trim();
    const quantity = Number(row.quantity);
    const price = Number(row.price);
    if (!name || name.length > 80) throw new Error(`Nome inválido no ${index + 1}º lote.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error(`Quantidade inválida no ${index + 1}º lote.`);
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(row.price)) || !Number.isFinite(price) || price > 99999999) throw new Error(`Valor inválido no ${index + 1}º lote.`);
    return { ...(row.id ? { id: row.id } : {}), name, quantity, price };
  });
}

function Setup({ initialError = '' }) {
  const config = getSupabaseConfig();
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.anonKey);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const check = await testSupabaseConnection(url.trim(), key.trim());
    if (check.success) {
      saveSupabaseConfig(url.trim(), key.trim());
      window.location.reload();
    } else {
      setError(check.message);
      setBusy(false);
    }
  };
  return <main className="glass-card" style={{ maxWidth: 540, margin: '6vh auto' }}>
    <h2>Conectar ao Supabase</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>Informe a URL e a chave pública do projeto onde o arquivo supabase_schema.sql foi executado.</p>
    {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}
    <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
      <input className="form-input" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Project URL" required />
      <input className="form-input" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Anon public key" required />
      <button className="btn-primary" disabled={busy}>{busy ? 'Verificando...' : 'Conectar'}</button>
    </form>
  </main>;
}

function Login({ onAuthenticate, onConfigure, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="glass-card" style={{ maxWidth: 430, margin: '6vh auto' }}>
    <h2>{creating ? 'Criar acesso da equipe' : 'Acesso da equipe'}</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>{creating ? 'Cadastre seu e-mail, senha e o código inicial mostrado ao executar o SQL.' : 'Entre para criar eventos e administrar inscrições.'}</p>
    {(localError || error) && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{localError || error}</p>}
    {message && <p style={{ color: '#6ee7b7', marginBottom: 12 }}>{message}</p>}
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setLocalError(''); setMessage('');
      try { const notice = await onAuthenticate(email, password, code, creating); if (notice) setMessage(notice); }
      catch (err) { setLocalError(err.message); }
      finally { setBusy(false); }
    }} style={{ display: 'grid', gap: 12 }}>
      <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required />
      <input className="form-input" type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required />
      <input className="form-input" type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="Código inicial (somente no primeiro acesso)" required={creating} />
      <button className="btn-primary" disabled={busy}>{busy ? 'Aguarde...' : creating ? 'Criar acesso' : 'Entrar'}</button>
    </form>
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => { setCreating(!creating); setLocalError(''); setMessage(''); }}>{creating ? 'Já tenho conta' : 'Criar primeiro acesso'}</button>
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onConfigure}>Alterar Supabase</button>
  </main>;
}

function QuickEventSetup({ onAdmin, onConfigure, onBackToEvent, onLinkReady, initialLink = '' }) {
  const setupCodeFromLink = new URLSearchParams(window.location.hash.slice(1)).get('setup') || '';
  const [code, setCode] = useState(setupCodeFromLink);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [networksText, setNetworksText] = useState('');
  const [disciplersText, setDisciplersText] = useState('');
  const [leadersText, setLeadersText] = useState('');
  const [existingLink, setExistingLink] = useState(initialLink);
  const [editingExisting, setEditingExisting] = useState(false);
  const [lotMode, setLotMode] = useState('single');
  const [lotRows, setLotRows] = useState(starterLots);
  const [lotsDirty, setLotsDirty] = useState(false);
  const [hasSavedLots, setHasSavedLots] = useState(false);
  const [bannerData, setBannerData] = useState('');
  const [bannerDirty, setBannerDirty] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const imageInputRef = useRef(null);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!editingExisting || !existingLink.trim()) { setHasSavedLots(false); return; }
    let url;
    try { url = new URL(existingLink.trim()); } catch (_) { return; }
    const token = url.origin === window.location.origin ? url.pathname.match(eventPath)?.[1] : null;
    if (!token) return;
    let cancelled = false;
    fetchSharedEvent(token).then(data => {
      if (cancelled || !data?.event) return;
      const lots = data.ticket_lots || [];
      setHasSavedLots(Boolean(data.has_ticket_lots));
      setLotMode(lots.length ? 'lots' : 'single');
      setLotRows(lots.length ? lots.map(({ id, name, quantity, price, sold }) => ({ id, name, quantity: String(quantity), price: String(price), sold })) : starterLots());
      setLotsDirty(false);
    }).catch(() => {});
    fetchEventBanner(token).then(data => {
      if (!cancelled) { setBannerData(data || ''); setBannerDirty(false); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [editingExisting, existingLink]);
  const changeLot = (index, field, value) => {
    setLotsDirty(true);
    setLotRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };
  const reset = () => {
    setLink(''); setName(''); setPrice('0'); setDate(''); setLocation('');
    setNetworksText(''); setDisciplersText(''); setLeadersText(''); setExistingLink('');
    setEditingExisting(false); setBannerData(''); setBannerDirty(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setLotMode('single'); setLotRows(starterLots()); setLotsDirty(false); setHasSavedLots(false);
  };
  return <main className="glass-card" style={{ maxWidth: 560, margin: '5vh auto' }}>
    <h2>Eventos</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>
      Crie o evento, defina o valor ou os lotes e copie o link de inscrições.
    </p>
    {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}
    {link ? <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ color: '#6ee7b7', fontWeight: 700 }}>Link de inscrições pronto:</p>
      <a href={link} style={{ color: '#a5b4fc', overflowWrap: 'anywhere' }}>{link}</a>
      <p style={{ color: 'var(--text-muted)' }}>Compartilhe este link completo. Se alterar a equipe depois, compartilhe o novo link.</p>
      <button className="btn-primary" onClick={async () => {
        try { await navigator.clipboard.writeText(link); alert('Link copiado.'); }
        catch (_) { window.prompt('Copie o link:', link); }
      }}>Copiar link</button>
      <a className="btn-secondary" href={link} style={{ textAlign: 'center', textDecoration: 'none' }}>Abrir inscrições</a>
      <button className="btn-secondary" onClick={reset}>Preparar outro evento</button>
    </div> : <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try {
        validateTeamLists(networksText, disciplersText, leadersText);
        const lots = lotMode === 'lots' ? checkedLots(lotRows) : [];
        let token;
        if (editingExisting) {
          const url = new URL(existingLink.trim());
          if (url.origin !== window.location.origin) throw new Error('Cole o link deste site para o evento.');
          token = url.pathname.match(eventPath)?.[1];
          if (!token || !(await fetchSharedEvent(token))?.event) throw new Error('Evento não encontrado nesse link.');
          if (lotsDirty && lotMode === 'lots') {
            if (!code.trim()) throw new Error('Informe o código inicial para salvar os lotes.');
            await saveEventLotsWithSetupCode(code, token, lots);
          }
          if (lotsDirty && lotMode === 'single' && hasSavedLots) throw new Error('Um evento com lotes não pode voltar ao preço único.');
          if (bannerDirty) {
            if (!code.trim()) throw new Error('Informe o código inicial para salvar a foto.');
            await saveEventBannerWithSetupCode(code, token, bannerData);
          }
        } else {
          const eventData = { name, price, date, location };
          const saved = lotMode === 'lots'
            ? bannerData
              ? await createEventWithLotsAndBanner(code, eventData, lots, bannerData)
              : await createEventWithLots(code, eventData, lots)
            : bannerData
              ? await createEventWithBanner(code, eventData, bannerData)
              : await createEventWithSetupCode(code, eventData);
          token = saved.share_token;
        }
        const completedLink = eventLink(token, networksText, disciplersText, leadersText);
        localStorage.setItem('event_last_link', completedLink);
        onLinkReady?.(completedLink);
        setLink(completedLink);
      } catch (err) {
        setError(/create_event_with_lots_and_banner|create_event_with_banner|save_event_banner_with_setup_code/i.test(err.message)
          ? 'A foto ainda não está ativa no Supabase. Execute supabase_foto.sql uma vez no SQL Editor.'
          : /create_event_with_lots|save_event_lots_with_setup_code|PGRST202|schema cache/i.test(err.message)
            ? 'A função de lotes ainda não está ativa no Supabase. Execute supabase_lotes.sql uma vez no SQL Editor.'
            : err.message);
      }
      finally { setBusy(false); }
    }} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={!editingExisting ? 'btn-primary' : 'btn-secondary'} onClick={() => { if (editingExisting) reset(); }}>Novo evento</button>
        <button type="button" className={editingExisting ? 'btn-primary' : 'btn-secondary'} onClick={() => {
          setEditingExisting(true);
          setNetworksText(textFromLink(existingLink, 'redes'));
          setDisciplersText(textFromLink(existingLink, 'discipuladores'));
          setLeadersText(textFromLink(existingLink, 'lideres'));
        }}>Editar evento existente</button>
      </div>
      {editingExisting ? <input className="form-input" type="url" value={existingLink} onChange={e => {
        const value = e.target.value;
        setExistingLink(value);
        try {
          const url = new URL(value);
          setNetworksText(namesFromLink(url, 'redes').join('\n'));
          setDisciplersText(namesFromLink(url, 'discipuladores').join('\n'));
          setLeadersText(namesFromLink(url, 'lideres').join('\n'));
        } catch (_) { /* O link ainda está sendo digitado. */ }
      }} placeholder="Cole aqui o link de inscrição do evento" required /> : <>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do novo evento" required />
        <input className="form-input" value={date} onChange={e => setDate(e.target.value)} placeholder="Data (opcional)" />
        <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Local (opcional)" />
      </>}
      <label style={{ fontWeight: 700 }}>Foto horizontal do evento (16:9)
        <input ref={imageInputRef} className="form-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBannerBusy(true); setError('');
          try { setBannerData(await prepareEventBanner(file)); setBannerDirty(true); }
          catch (err) { setError(err.message); }
          finally { setBannerBusy(false); }
        }} style={{ marginTop: 8 }} />
      </label>
      {bannerData && <div style={{ display: 'grid', gap: 8 }}>
        <img src={bannerData} alt="Prévia horizontal do evento" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 10 }} />
        <button type="button" className="btn-secondary" onClick={() => { setBannerData(''); setBannerDirty(true); if (imageInputRef.current) imageInputRef.current.value = ''; }}>Remover foto</button>
      </div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={lotMode === 'single' ? 'btn-primary' : 'btn-secondary'} disabled={hasSavedLots} onClick={() => { setLotMode('single'); setLotsDirty(true); }}>Preço único</button>
        <button type="button" className={lotMode === 'lots' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setLotMode('lots'); setLotsDirty(true); }}>Lotes de ingressos</button>
      </div>
      {lotMode === 'single' && !editingExisting && <label>Valor da inscrição (R$)
        <input className="form-input" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required style={{ marginTop: 6 }} />
      </label>}
      {lotMode === 'lots' && <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ color: 'var(--text-muted)' }}>Os lotes são vendidos em ordem. O próximo preço entra quando o anterior esgotar.</p>
        {lotRows.map((row, index) => <div key={row.id || index} style={{ border: '1px solid var(--border-glass)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
          <strong>Lote {index + 1}{row.sold ? ` · ${row.sold} já inscritos` : ''}</strong>
          <input className="form-input" value={row.name} onChange={e => changeLot(index, 'name', e.target.value)} placeholder="Nome do lote" required maxLength={80} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>Quantidade<input className="form-input" type="number" min={Math.max(1, Number(row.sold) || 1)} max="1000000" step="1" value={row.quantity} onChange={e => changeLot(index, 'quantity', e.target.value)} required /></label>
            <label>Valor (R$)<input className="form-input" type="number" min="0" step="0.01" value={row.price} onChange={e => changeLot(index, 'price', e.target.value)} required /></label>
          </div>
          {lotRows.length > 1 && <button type="button" className="btn-secondary" onClick={() => { setLotsDirty(true); setLotRows(rows => rows.filter((_, rowIndex) => rowIndex !== index)); }}>Remover lote</button>}
        </div>)}
        <button type="button" className="btn-secondary" disabled={lotRows.length >= 20} onClick={() => { setLotsDirty(true); setLotRows(rows => [...rows, { name: `${rows.length + 1}º lote`, quantity: '', price: '' }]); }}>+ Adicionar lote</button>
      </div>}
      <details style={{ border: '1px solid var(--border-glass)', borderRadius: 10, padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Redes, discipuladores e líderes</summary>
        <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>Um nome por linha. As opções ficam no link gerado.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Redes<textarea className="form-input" rows="3" value={networksText} onChange={e => setNetworksText(e.target.value)} placeholder="Uma rede por linha" /></label>
          <label>Discipuladores<textarea className="form-input" rows="3" value={disciplersText} onChange={e => setDisciplersText(e.target.value)} placeholder="Um discipulador por linha" /></label>
          <label>Líderes<textarea className="form-input" rows="3" value={leadersText} onChange={e => setLeadersText(e.target.value)} placeholder="Um líder por linha" /></label>
        </div>
      </details>
      {!setupCodeFromLink && (!editingExisting || (lotMode === 'lots' && lotsDirty) || bannerDirty) && <input className="form-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Código inicial para salvar" required />}
      <button className="btn-primary" disabled={busy || bannerBusy}>{bannerBusy ? 'Preparando foto...' : busy ? 'Salvando...' : editingExisting ? 'Salvar e copiar link' : 'Criar evento e gerar link'}</button>
    </form>}
    {initialLink && <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onBackToEvent}>Voltar às inscrições</button>}
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onAdmin}>Painel administrativo (e-mail e senha)</button>
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onConfigure}>Alterar Supabase</button>
  </main>;
}

function SharedEventPage({ token = sharedToken, organizer = false, link = window.location.href, onManage }) {
  const [bundle, setBundle] = useState(null);
  const [bannerData, setBannerData] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshEvent = async () => {
    setRefreshing(true);
    try {
      const data = await fetchSharedEvent(token);
      if (!data?.event) throw new Error('Evento não encontrado ou encerrado.');
      setBundle(data);
      fetchEventBanner(token).then(photo => setBannerData(photo || '')).catch(() => {});
      setError('');
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  };
  useEffect(() => {
    if (!token) { setError('Link de evento inválido.'); setLoading(false); return; }
    setBannerData('');
    fetchEventBanner(token).then(photo => setBannerData(photo || '')).catch(() => {});
    fetchSharedEvent(token)
      .then(data => { if (!data?.event) throw new Error('Evento não encontrado ou encerrado.'); setBundle(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);
  if (loading) return <main className="glass-card">Carregando evento...</main>;
  if (error) return <main className="glass-card" role="alert">{error}</main>;
  const lists = listsForSharedEvent(bundle, link);
  const currentLot = [...(bundle.ticket_lots || [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .find(lot => Number(lot.remaining) > 0);
  const displayEvent = { ...bundle.event, price: currentLot?.price ?? bundle.event.price };
  return <div className="app-container">
    {organizer
      ? <Header event={displayEvent} soldOut={Boolean(bundle.has_ticket_lots && !currentLot)} attendeeCount={null} onOpenAdmin={onManage} onRefresh={refreshEvent} isRefreshing={refreshing} />
      : <header className="kiosk-header"><div className="event-info-pill"><div className="event-title-line">{bundle.event.name}</div><div className="event-meta-line">{bundle.event.date || ''} {bundle.event.location || ''}</div></div></header>}
    {bannerData && <img className="event-banner" src={bannerData} alt={`Foto do evento ${bundle.event.name}`} />}
    <main style={{ flex: 1 }}>
      <RegistrationForm
        key={bundle.event.id}
        events={[bundle.event]} networks={lists.networks} disciplers={lists.disciplers} leaders={lists.leaders}
        ticketLots={bundle.ticket_lots || []} hasTicketLots={Boolean(bundle.has_ticket_lots)}
        onRefreshAvailability={refreshEvent}
        publicMode onSubmit={async reg => {
          const saved = await createSharedRegistration(token, reg);
          fetchSharedEvent(token).then(setBundle).catch(() => {});
          return saved;
        }}
      />
    </main>
  </div>;
}

export function App() {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [currentScreen, setCurrentScreen] = useState('kiosk');
  const [events, setEvents] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [disciplers, setDisciplers] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [localLink, setLocalLink] = useState(() => localStorage.getItem('event_last_link') || '');
  const [adminLotBundle, setAdminLotBundle] = useState(null);
  const [canReturnAdmin, setCanReturnAdmin] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(() => localStorage.getItem('event_selected_id'));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };

  const loadAllData = useCallback(async () => {
    const [evts, nets, discs, lead, regs] = await Promise.all([
      fetchEvents(), fetchNetworks(), fetchDisciplers(), fetchLeaders(), fetchRegistrations()
    ]);
    setEvents(evts); setNetworks(nets); setDisciplers(discs); setLeaders(lead); setRegistrations(regs);
  }, []);

  useEffect(() => {
    if (isSharedPath) return;
    let cancelled = false;
    (async () => {
      const check = await testSupabaseConnection();
      if (cancelled) return;
      if (!check.success) { setError(check.message); setStatus('setup'); return; }
      const admin = await getAdminSession();
      if (cancelled) return;
      if (admin) {
        try { await loadAllData(); setStatus('ready'); }
        catch (e) { setError(e.message); setStatus('data-error'); }
      } else {
        const setupRequested = new URLSearchParams(window.location.hash.slice(1)).has('setup');
        const savedLink = localStorage.getItem('event_last_link') || '';
        if (!setupRequested && savedLink) {
          try {
            const url = new URL(savedLink);
            const token = url.origin === window.location.origin ? url.pathname.match(eventPath)?.[1] : null;
            if (token && (await fetchSharedEvent(token))?.event) {
              setLocalLink(savedLink); setStatus('local-event'); return;
            }
          } catch (_) { /* Link salvo não está mais disponível. */ }
        }
        setStatus('quickstart');
      }
    })();
    return () => { cancelled = true; };
  }, [loadAllData]);

  useEffect(() => {
    if (status !== 'ready') return;
    const interval = setInterval(() => loadAllData().catch(e => setError(e.message)), 15000);
    return () => clearInterval(interval);
  }, [status, loadAllData]);

  const refresh = async () => {
    setIsRefreshing(true);
    try { await loadAllData(); setError(''); showToast('Dados atualizados.'); }
    catch (e) { setError(e.message); showToast(e.message, 'error'); }
    finally { setIsRefreshing(false); }
  };
  const onAuthenticate = async (email, password, code, creating) => {
    if (creating) {
      if (!code.trim()) throw new Error('Informe o código inicial exibido no SQL Editor.');
      const hasSession = await registerAdminAccount(email, password);
      if (!hasSession) return 'Conta criada. Confirme o e-mail recebido e depois entre com a senha e o código inicial.';
      await claimFirstAdmin(code);
    } else {
      const isAdmin = await signInAdmin(email, password);
      if (!isAdmin) {
        if (!code.trim()) throw new Error('Esta conta ainda não é administradora. Informe o código inicial.');
        await claimFirstAdmin(code);
      }
    }
    await loadAllData(); setError(''); setStatus('ready');
    return '';
  };
  const selectEvent = id => { setSelectedEventId(id); localStorage.setItem('event_selected_id', id); };
  const activeEvent = events.find(e => e.id === selectedEventId) || events[0];
  useEffect(() => {
    if (status !== 'ready' || !activeEvent?.share_token) { setAdminLotBundle(null); return; }
    let cancelled = false;
    fetchSharedEvent(activeEvent.share_token)
      .then(data => { if (!cancelled) setAdminLotBundle(data); })
      .catch(() => { if (!cancelled) setAdminLotBundle(null); });
    return () => { cancelled = true; };
  }, [status, activeEvent?.share_token]);
  const adminCurrentLot = [...(adminLotBundle?.ticket_lots || [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .find(lot => Number(lot.remaining) > 0);

  if (isSharedPath) return <SharedEventPage />;
  if (status === 'checking') return <main className="glass-card">Verificando Supabase...</main>;
  if (status === 'setup') return <Setup initialError={error} />;
  if (status === 'local-event') {
    const token = new URL(localLink).pathname.match(eventPath)?.[1];
    return <SharedEventPage token={token} organizer link={localLink} onManage={() => setStatus('quickstart')} />;
  }
  if (status === 'quickstart') return <QuickEventSetup initialLink={localLink} onLinkReady={setLocalLink} onBackToEvent={() => setStatus(canReturnAdmin ? 'ready' : 'local-event')} onAdmin={() => setStatus(canReturnAdmin ? 'ready' : 'login')} onConfigure={() => setStatus('setup')} />;
  if (status === 'login') return <Login onAuthenticate={onAuthenticate} onConfigure={() => setStatus('setup')} error={error} />;
  if (status === 'data-error') return <main className="glass-card" role="alert"><h2>Falha ao carregar dados</h2><p>{error}</p><button className="btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button><button className="btn-secondary" onClick={() => setStatus('setup')}>Configurar Supabase</button></main>;

  return <div className="app-container">
    {error && <div className="toast-container"><div className="toast error" role="alert">{error}</div></div>}
    {currentScreen === 'kiosk' ? <>
      <Header event={adminCurrentLot ? { ...activeEvent, price: adminCurrentLot.price } : activeEvent} soldOut={Boolean(adminLotBundle?.has_ticket_lots && !adminCurrentLot)} attendeeCount={registrations.filter(r => r.event_id === activeEvent?.id).length} onOpenAdmin={() => setCurrentScreen('admin')} onRefresh={refresh} isRefreshing={isRefreshing} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeEvent?.banner_data && <img className="event-banner" src={activeEvent.banner_data} alt={`Foto do evento ${activeEvent.name}`} />}
        {activeEvent ? <RegistrationForm key={activeEvent.id} events={[activeEvent]} networks={networks} disciplers={disciplers} leaders={leaders}
          ticketLots={adminLotBundle?.ticket_lots || []} hasTicketLots={Boolean(adminLotBundle?.has_ticket_lots)}
          onRefreshAvailability={() => fetchSharedEvent(activeEvent.share_token).then(setAdminLotBundle).catch(() => {})}
          onSubmit={async reg => {
            const item = adminLotBundle?.has_ticket_lots
              ? { ...reg, id: await createSharedRegistration(activeEvent.share_token, reg) }
              : await createRegistration(reg);
            setRegistrations(prev => [item, ...prev]);
            if (adminLotBundle?.has_ticket_lots) fetchSharedEvent(activeEvent.share_token).then(setAdminLotBundle).catch(() => {});
            return item;
          }}
          onConfirmPaymentStatus={async (id, state) => { await updateRegistrationStatus(id, state); setRegistrations(prev => prev.map(r => r.id === id ? { ...r, payment_status: state } : r)); }} />
          : <div className="glass-card">Nenhum evento cadastrado. Abra o painel Admin para criar o primeiro.</div>}
      </main>
    </> : <main style={{ flex: 1 }}>
      <AdminView
        onBack={() => setCurrentScreen('kiosk')} onRefresh={refresh} isRefreshing={isRefreshing}
        registrations={registrations} events={events} networks={networks} disciplers={disciplers} leaders={leaders}
        selectedEventId={activeEvent?.id} onSelectEvent={selectEvent}
        onManageLots={event => {
          const saved = localStorage.getItem('event_last_link') || '';
          const matching = saved.includes(`/e/${event.share_token}`);
          const eventUrl = matching ? saved : `${window.location.origin}/e/${event.share_token}`;
          setLocalLink(eventUrl);
          setCanReturnAdmin(true);
          setStatus('quickstart');
        }}
        onDeleteRegistration={async id => { await deleteRegistration(id); setRegistrations(prev => prev.filter(r => r.id !== id)); }}
        onToggleStatus={async (id, state) => { await updateRegistrationStatus(id, state); setRegistrations(prev => prev.map(r => r.id === id ? { ...r, payment_status: state } : r)); }}
        onAddNetwork={async name => { const item = await addNetwork(name); setNetworks(prev => [...prev, item]); }}
        onDeleteNetwork={async id => { await deleteNetwork(id); setNetworks(prev => prev.filter(x => x.id !== id)); }}
        onAddDiscipler={async name => { const item = await addDiscipler(name); setDisciplers(prev => [...prev, item]); }}
        onDeleteDiscipler={async id => { await deleteDiscipler(id); setDisciplers(prev => prev.filter(x => x.id !== id)); }}
        onAddLeader={async name => { const item = await addLeader(name); setLeaders(prev => [...prev, item]); }}
        onDeleteLeader={async id => { await deleteLeader(id); setLeaders(prev => prev.filter(x => x.id !== id)); }}
        onAddEvent={async data => { const item = await addEvent(data); setEvents(prev => [item, ...prev.filter(x => x.id !== item.id)]); selectEvent(item.id); return item; }}
        onSignOut={async () => { await signOutAdmin(); setCurrentScreen('kiosk'); setStatus('quickstart'); }}
      />
    </main>}
    {toast && <div className="toast-container"><div className={`toast ${toast.type}`}><span>{toast.message}</span></div></div>}
  </div>;
}

export default App;
