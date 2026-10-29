import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminView } from './components/AdminView';
import {
  getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection, getAccess, signInAdmin,
  signOutAdmin, changeMyPassword, fetchEventBanner, fetchEvents,
  fetchNetworks, fetchDisciplers, fetchLeaders, fetchRegistrations, createRegistration,
  createSharedRegistration, fetchSharedEvent, deleteRegistration, updateRegistrationStatus,
  addNetwork, deleteNetwork, addDiscipler, deleteDiscipler, addLeader, deleteLeader,
  registerPublic, fetchMyRegistrations, findMyRegistrations, setCheckIn, confirmPayment,
  setEventActive, deleteEventWithRegistrations
} from './lib/supabase';
import { loadMyTokens, saveMyTokens } from './lib/myRegistrations';
import { MyRegistrations, FindRegistration } from './components/MyRegistrations';
import { ChatRegistration } from './components/ChatRegistration';
import { CheckInPage } from './components/CheckInPage';
import confetti from 'canvas-confetti';

const sharedToken = window.location.pathname.match(/^\/e\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)?.[1];
const isSharedPath = window.location.pathname.startsWith('/e/');
const checkInPath = window.location.pathname.match(/^\/c\/([0-9A-F]{10})\/?$/i)?.[1];


// Motivo para recusar o painel, ou null quando o login pode entrar.
function accessProblem(current) {
  if (!current) return 'Entre com seu e-mail e senha.';
  if (!current.org_id && !current.super) return 'Este e-mail não tem acesso ao painel. Fale com o responsável pelo sistema.';
  if (current.blocked) {
    const until = current.access_until ? ` em ${new Date(`${current.access_until}T12:00:00`).toLocaleDateString('pt-BR')}` : '';
    return `O acesso de ${current.org_name} terminou${until}. Fale com o responsável pelo sistema para renovar.`;
  }
  return null;
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
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setLocalError('');
    try { await onAuthenticate(email, password); }
    catch (err) { setLocalError(err.message); }
    finally { setBusy(false); }
  };
  return <main className="glass-card" style={{ maxWidth: 430, margin: '6vh auto' }}>
    <h2>Entrar no painel</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>Use o e-mail e a senha que você recebeu para administrar os eventos da sua igreja.</p>
    {(localError || error) && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{localError || error}</p>}
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <input className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" required />
      <input className="form-input" type="password" autoComplete="current-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required />
      <button className="btn-primary" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
    </form>
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
  // Dados da última inscrição deste aparelho: a próxima pessoa (ex.: da mesma família) já vem preenchida.
  const [lastAnswers, setLastAnswers] = useState(null);
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
      const paidTokens = confirmed?.access_tokens || (confirmed?.access_token ? [confirmed.access_token] : []);
      if (!paidTokens.length) return myTokens;
      if (confirmed.status === 'Confirmado') {
        try { confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } }); } catch (_) {}
      }
      const tokens = saveMyTokens(token, [...paidTokens, ...myTokens]);
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
        ? <MyRegistrations registrations={myRegs} finder={finder} organization={bundle.organization}
            onChanged={() => loadMine().catch(() => {})}
            onNew={() => { refreshEvent(); setView('form'); }} />
        : <>
          <ChatRegistration
            key={`${bundle.event.id}-${myTokens.length}`}
            event={bundle.event} networks={bundle.networks} disciplers={bundle.disciplers} leaders={bundle.leaders}
            ticketLots={bundle.ticket_lots || []} hasTicketLots={Boolean(bundle.has_ticket_lots)}
            onRefreshAvailability={refreshEvent}
            defaults={lastAnswers} onSubmit={async reg => {
              const saved = await registerPublic(token, reg);
              setLastAnswers({ network: reg.network, discipler: reg.discipler, leader: reg.leader, phone: reg.phone });
              remember([saved.access_token]);
              setView('mine');
              refreshEvent();
              return saved;
            }}
            footer={<div style={{ display: 'grid', gap: 8, marginTop: 12, textAlign: 'center' }}>
              {myRegs.length > 0 && <button type="button" className="btn-secondary" onClick={() => setView('mine')}>Ver minhas inscrições</button>}
              {finder}
            </div>}
          />
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
  const [adminLotBundle, setAdminLotBundle] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(() => localStorage.getItem('event_selected_id'));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [checkInCode, setCheckInCode] = useState(checkInPath);
  // Organização do login (nome, chave Pix manual) e se é o dono do sistema.
  const [access, setAccess] = useState(null);
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
      const current = await getAccess().catch(() => null);
      if (cancelled) return;
      const problem = accessProblem(current);
      if (problem) { if (current) { await signOutAdmin().catch(() => {}); setError(problem); } setStatus('login'); return; }
      setAccess(current);
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
  const onAuthenticate = async (email, password) => {
    await signInAdmin(email, password);
    const current = await getAccess();
    const problem = accessProblem(current);
    if (problem) { await signOutAdmin().catch(() => {}); throw new Error(problem); }
    setAccess(current);
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
          pixKey={access?.pix_key}
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
        onReload={loadAllData}
        onDeleteRegistration={async id => { await deleteRegistration(id); setRegistrations(prev => prev.filter(r => r.id !== id)); }}
        onSetEventActive={async (id, active) => {
          try { await setEventActive(id, active); setEvents(prev => prev.map(e => e.id === id ? { ...e, active } : e)); showToast(active ? 'Inscrições reabertas.' : 'Inscrições encerradas: o link não aceita mais inscrições.'); }
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
        onSignOut={async () => { await signOutAdmin(); setAccess(null); setCurrentScreen('kiosk'); setStatus('login'); }}
        access={access}
        onChangePassword={changeMyPassword}
      />
    </main>}
    {toast && <div className="toast-container"><div className={`toast ${toast.type}`}><span>{toast.message}</span></div></div>}
  </div>;
}

export default App;
