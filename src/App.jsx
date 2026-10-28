import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminView } from './components/AdminView';
import {
  getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection,
  getAdminSession, signInAdmin, signOutAdmin, registerAdminAccount, claimFirstAdmin,
  createEventWithSetupCode, createEventWithLots, createEventWithBanner,
  createEventWithLotsAndBanner, saveEventLotsWithSetupCode,
  saveEventBannerWithSetupCode, fetchEventBanner, fetchEventShareText, saveEventShareText,
  fetchEvents, fetchNetworks, fetchDisciplers, fetchLeaders, fetchRegistrations,
  createRegistration, createSharedRegistration, fetchSharedEvent,
  deleteRegistration, updateRegistrationStatus, addNetwork, deleteNetwork,
  addDiscipler, deleteDiscipler, addLeader, deleteLeader, addEvent,
  registerPublic, fetchMyRegistrations, findMyRegistrations, setCheckIn, confirmPayment,
  setEventActive, deleteEventWithRegistrations
} from './lib/supabase';
import { prepareEventBanner } from './lib/eventImage';
import { loadMyTokens, saveMyTokens } from './lib/myRegistrations';
import { MyRegistrations, FindRegistration } from './components/MyRegistrations';
import { CheckInPage } from './components/CheckInPage';
import confetti from 'canvas-confetti';

const sharedToken = window.location.pathname.match(/^\/e\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1];
const isSharedPath = window.location.pathname.startsWith('/e/');
const checkInPath = window.location.pathname.match(/^\/c\/([0-9A-F]{10})\/?$/i)?.[1];
const eventPath = /^\/e\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

function eventLink(token) {
  return new URL(`/e/${token}`, window.location.origin).toString();
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

function Login({ onAuthenticate, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState('');
  const submit = creating => async e => {
    e?.preventDefault();
    setBusy(creating ? 'create' : 'login'); setLocalError('');
    try { await onAuthenticate(email, password, creating); }
    catch (err) { setLocalError(err.message); }
    finally { setBusy(''); }
  };
  return <main className="glass-card" style={{ maxWidth: 430, margin: '6vh auto' }}>
    <h2>Entrar no painel</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>Use seu e-mail e senha. No primeiro uso, toque em <strong>Criar acesso</strong>: você entra na hora, sem confirmar e-mail.</p>
    {(localError || error) && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{localError || error}</p>}
    <form onSubmit={submit(false)} style={{ display: 'grid', gap: 12 }}>
      <input className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required />
      <input className="form-input" type="password" autoComplete="current-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mínimo 6 caracteres)" required />
      <button className="btn-primary" disabled={Boolean(busy)}>{busy === 'login' ? 'Entrando...' : 'Entrar'}</button>
      <button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={e => {
        const form = e.currentTarget.form;
        if (form.reportValidity()) submit(true)();
      }}>{busy === 'create' ? 'Criando...' : 'Criar acesso'}</button>
    </form>
  </main>;
}

function QuickEventSetup({ onAdmin, onLinkReady, initialLink = '' }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [existingLink, setExistingLink] = useState(initialLink);
  const [editingExisting, setEditingExisting] = useState(Boolean(initialLink));
  const [lotMode, setLotMode] = useState('single');
  const [lotRows, setLotRows] = useState(starterLots);
  const [lotsDirty, setLotsDirty] = useState(false);
  const [hasSavedLots, setHasSavedLots] = useState(false);
  const [bannerData, setBannerData] = useState('');
  const [bannerDirty, setBannerDirty] = useState(false);
  const [shareText, setShareText] = useState('');
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
    fetchEventShareText(token).then(text => { if (!cancelled) setShareText(text); }).catch(() => {});
    return () => { cancelled = true; };
  }, [editingExisting, existingLink]);
  const changeLot = (index, field, value) => {
    setLotsDirty(true);
    setLotRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };
  const reset = () => {
    setLink(''); setName(''); setPrice('0'); setDate(''); setLocation('');
    setExistingLink('');
    setEditingExisting(false); setBannerData(''); setBannerDirty(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setLotMode('single'); setLotRows(starterLots()); setLotsDirty(false); setHasSavedLots(false);
  };
  return <main className="glass-card" style={{ maxWidth: 560, margin: '5vh auto' }}>
    <h2>{editingExisting ? 'Lotes e foto do evento' : 'Novo evento'}</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>
      {editingExisting ? 'Ajuste os lotes ou a foto e salve.' : 'Preencha o nome, escolha preço único ou lotes e gere o link de inscrições.'}
    </p>
    {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}
    {link ? <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ color: '#6ee7b7', fontWeight: 700 }}>Link de inscrições pronto:</p>
      <a href={link} style={{ color: '#a5b4fc', overflowWrap: 'anywhere' }}>{link}</a>
      <button className="btn-primary" onClick={async () => {
        try { await navigator.clipboard.writeText(link); alert('Link copiado.'); }
        catch (_) { window.prompt('Copie o link:', link); }
      }}>Copiar link</button>
      <a className="btn-secondary" href={link} style={{ textAlign: 'center', textDecoration: 'none' }}>Abrir inscrições</a>
      <button className="btn-secondary" onClick={onAdmin}>Voltar ao painel</button>
    </div> : <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try {
        const lots = lotMode === 'lots' ? checkedLots(lotRows) : [];
        let token;
        if (editingExisting) {
          const url = new URL(existingLink.trim());
          if (url.origin !== window.location.origin) throw new Error('Cole o link deste site para o evento.');
          token = url.pathname.match(eventPath)?.[1];
          if (!token || !(await fetchSharedEvent(token))?.event) throw new Error('Evento não encontrado nesse link.');
          if (lotsDirty && lotMode === 'lots') await saveEventLotsWithSetupCode('', token, lots);
          if (lotsDirty && lotMode === 'single' && hasSavedLots) throw new Error('Um evento com lotes não pode voltar ao preço único.');
          if (bannerDirty) await saveEventBannerWithSetupCode('', token, bannerData);
        } else {
          const eventData = { name, price, date, location };
          const saved = lotMode === 'lots'
            ? bannerData
              ? await createEventWithLotsAndBanner('', eventData, lots, bannerData)
              : await createEventWithLots('', eventData, lots)
            : bannerData
              ? await createEventWithBanner('', eventData, bannerData)
              : await createEventWithSetupCode('', eventData);
          token = saved.share_token;
        }
        await saveEventShareText(token, shareText);
        const completedLink = eventLink(token);
        onLinkReady?.();
        setLink(completedLink);
      } catch (err) {
        setError(err.message);
      }
      finally { setBusy(false); }
    }} style={{ display: 'grid', gap: 12 }}>
      {editingExisting ? null : <>
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
      <label style={{ fontWeight: 700 }}>Texto do link no WhatsApp
        <textarea className="form-input" rows="3" maxLength={300} value={shareText} onChange={e => setShareText(e.target.value)}
          placeholder="Ex.: Inscrições abertas para o Encontro de Jovens! Garanta sua vaga." style={{ marginTop: 8, fontWeight: 400 }} />
        <span style={{ display: 'block', fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Aparece com a foto quando o link é enviado no WhatsApp.</span>
      </label>
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
      <button className="btn-primary" disabled={busy || bannerBusy}>{bannerBusy ? 'Preparando foto...' : busy ? 'Salvando...' : editingExisting ? 'Salvar e copiar link' : 'Criar evento e gerar link'}</button>
    </form>}
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onAdmin}>Voltar ao painel</button>
  </main>;
}

function SharedEventPage({ token = sharedToken }) {
  const [bundle, setBundle] = useState(null);
  const [bannerData, setBannerData] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [myTokens, setMyTokens] = useState(() => (token ? loadMyTokens(token) : []));
  const [myRegs, setMyRegs] = useState([]);
  const [view, setView] = useState('form');
  const paidIds = useRef(null);
  const refreshEvent = async () => {
    try {
      const data = await fetchSharedEvent(token);
      if (!data?.event) throw new Error('Evento não encontrado ou encerrado.');
      setBundle(data);
      setError('');
    } catch (e) { setError(e.message); }
  };
  const loadMine = useCallback(async (tokens = myTokens) => {
    const regs = await fetchMyRegistrations(tokens);
    // Comemora quando um pagamento é confirmado com a página aberta.
    const paid = regs.filter(r => r.ticket_code).map(r => r.id);
    if (paidIds.current && paid.some(id => !paidIds.current.includes(id))) {
      try { confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } }); } catch (_) {}
    }
    paidIds.current = paid;
    setMyRegs(regs);
    return regs;
  }, [myTokens]);
  // A InfinitePay volta para o link com os dados do pagamento na URL; o banco
  // confere o pagamento e, se aprovado, este aparelho passa a ver o ingresso.
  const returnFromCheckout = async () => {
    const params = new URLSearchParams(window.location.search);
    const payment = {
      orderNsu: params.get('order_nsu'), transactionNsu: params.get('transaction_nsu'),
      slug: params.get('slug') || params.get('invoice_slug'), receiptUrl: params.get('receipt_url')
    };
    if (!payment.orderNsu || !payment.transactionNsu || !payment.slug) return myTokens;
    window.history.replaceState(null, '', window.location.pathname);
    try {
      const confirmed = await confirmPayment(payment);
      if (!confirmed?.access_token) return myTokens;
      if (confirmed.status === 'Confirmado') {
        try { confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } }); } catch (_) {}
      }
      const tokens = saveMyTokens(token, [confirmed.access_token, ...myTokens]);
      setMyTokens(tokens);
      return tokens;
    } catch (_) {
      return myTokens; // o aviso automático da InfinitePay ainda confirma
    }
  };
  useEffect(() => {
    if (!token) { setError('Link de evento inválido.'); setLoading(false); return; }
    setBannerData('');
    fetchEventBanner(token).then(photo => setBannerData(photo || '')).catch(() => {});
    Promise.all([fetchSharedEvent(token), returnFromCheckout().then(tokens => loadMine(tokens)).catch(() => [])])
      .then(([data, regs]) => {
        if (!data?.event) throw new Error('Evento não encontrado ou encerrado.');
        setBundle(data);
        if (regs.length) setView('mine');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    if (view !== 'mine' || !myRegs.some(r => r.payment_status === 'Pendente')) return;
    const timer = setInterval(() => loadMine().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [view, myRegs, loadMine]);
  useEffect(() => { if (!loading) loadMine().catch(() => {}); }, [myTokens]); // eslint-disable-line react-hooks/exhaustive-deps
  const remember = tokens => setMyTokens(prev => saveMyTokens(token, [...tokens, ...prev]));
  const finder = <FindRegistration onFind={async (name, birthDate) => {
    const found = await findMyRegistrations(token, name, birthDate);
    if (!found.length) return false;
    remember(found);
    setView('mine');
    return true;
  }} />;

  if (loading) return <main className="glass-card">Carregando evento...</main>;
  if (error) return <main className="glass-card" role="alert">{error}</main>;
  return <div className="app-container">
    <header className="kiosk-header"><div className="event-info-pill"><div className="event-title-line">{bundle.event.name}</div><div className="event-meta-line">{bundle.event.date || ''} {bundle.event.location || ''}</div></div></header>
    {bannerData && <img className="event-banner" src={bannerData} alt={`Foto do evento ${bundle.event.name}`} />}
    <main style={{ flex: 1 }}>
      {view === 'mine' && myRegs.length
        ? <MyRegistrations registrations={myRegs} finder={finder}
            onChanged={() => loadMine().catch(() => {})}
            onNew={() => { refreshEvent(); setView('form'); }} />
        : <>
          <RegistrationForm
            key={bundle.event.id}
            events={[bundle.event]} networks={bundle.networks} disciplers={bundle.disciplers} leaders={bundle.leaders}
            ticketLots={bundle.ticket_lots || []} hasTicketLots={Boolean(bundle.has_ticket_lots)}
            onRefreshAvailability={refreshEvent}
            publicMode onSubmit={async reg => {
              const saved = await registerPublic(token, reg);
              remember([saved.access_token]);
              setView('mine');
              refreshEvent();
              return saved;
            }}
          />
          {myRegs.length > 0 && <button type="button" className="btn-secondary" style={{ display: 'block', margin: '12px auto' }} onClick={() => setView('mine')}>Ver minhas inscrições</button>}
          <div style={{ textAlign: 'center' }}>{finder}</div>
        </>}
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
  const [localLink, setLocalLink] = useState('');
  const [adminLotBundle, setAdminLotBundle] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(() => localStorage.getItem('event_selected_id'));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [checkInCode, setCheckInCode] = useState(checkInPath);
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
      if (!admin) { setStatus('login'); return; }
      try { await loadAllData(); setStatus('ready'); }
      catch (e) { setError(e.message); setStatus('data-error'); }
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
  const onAuthenticate = async (email, password, creating) => {
    await (creating ? registerAdminAccount(email, password) : signInAdmin(email, password));
    await claimFirstAdmin();
    await loadAllData(); setError(''); setStatus('ready');
  };
  const selectEvent = id => { setSelectedEventId(id); localStorage.setItem('event_selected_id', id); };
  const activeEvent = events.find(e => e.id === selectedEventId) || events.find(e => e.active !== false) || events[0];
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
  if (status === 'quickstart') return <QuickEventSetup initialLink={localLink} onLinkReady={() => loadAllData().catch(() => {})} onAdmin={() => setStatus('ready')} />;
  if (status === 'login') return <Login onAuthenticate={onAuthenticate} error={error} />;
  if (checkInCode && status === 'ready') return <CheckInPage code={checkInCode} onDone={() => {
    window.history.replaceState(null, '', '/'); setCheckInCode(null); loadAllData().catch(() => {});
  }} />;
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
        onManageLots={event => { setLocalLink(eventLink(event.share_token)); setStatus('quickstart'); }}
        onNewEvent={() => { setLocalLink(''); setStatus('quickstart'); }}
        onDeleteRegistration={async id => { await deleteRegistration(id); setRegistrations(prev => prev.filter(r => r.id !== id)); }}
        onSetEventActive={async (id, active) => {
          try { await setEventActive(id, active); setEvents(prev => prev.map(e => e.id === id ? { ...e, active } : e)); showToast(active ? 'Inscrições reabertas.' : 'Evento arquivado: o link não aceita mais inscrições.'); }
          catch (e) { showToast(e.message, 'error'); }
        }}
        onDeleteEvent={async id => {
          try {
            await deleteEventWithRegistrations(id);
            setEvents(prev => prev.filter(e => e.id !== id));
            setRegistrations(prev => prev.filter(r => r.event_id !== id));
            showToast('Evento apagado.');
          } catch (e) { showToast(e.message, 'error'); }
        }}
        onToggleStatus={async (id, state) => {
          try { await updateRegistrationStatus(id, state); setRegistrations(prev => prev.map(r => r.id === id ? { ...r, payment_status: state } : r)); }
          catch (e) { showToast(e.message, 'error'); }
        }}
        onCheckIn={async (id, checkedIn) => {
          try {
            const [row] = await setCheckIn(id, checkedIn);
            if (!row) { showToast('Esta pessoa já tinha entrada registrada.', 'error'); await loadAllData(); return; }
            setRegistrations(prev => prev.map(r => r.id === id ? { ...r, checked_in_at: row.checked_in_at } : r));
          } catch (e) { showToast(e.message, 'error'); }
        }}
        onAddNetwork={async name => { const item = await addNetwork(name); setNetworks(prev => [...prev, item]); }}
        onDeleteNetwork={async id => { await deleteNetwork(id); setNetworks(prev => prev.filter(x => x.id !== id)); }}
        onAddDiscipler={async name => { const item = await addDiscipler(name); setDisciplers(prev => [...prev, item]); }}
        onDeleteDiscipler={async id => { await deleteDiscipler(id); setDisciplers(prev => prev.filter(x => x.id !== id)); }}
        onAddLeader={async name => { const item = await addLeader(name); setLeaders(prev => [...prev, item]); }}
        onDeleteLeader={async id => { await deleteLeader(id); setLeaders(prev => prev.filter(x => x.id !== id)); }}
        onAddEvent={async data => { const item = await addEvent(data); setEvents(prev => [item, ...prev.filter(x => x.id !== item.id)]); selectEvent(item.id); return item; }}
        onSignOut={async () => { await signOutAdmin(); setCurrentScreen('kiosk'); setStatus('login'); }}
      />
    </main>}
    {toast && <div className="toast-container"><div className={`toast ${toast.type}`}><span>{toast.message}</span></div></div>}
  </div>;
}

export default App;
