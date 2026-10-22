import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminView } from './components/AdminView';
import {
  getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection,
  getAdminSession, signInAdmin, signOutAdmin, registerAdminAccount, claimFirstAdmin,
  createEventWithSetupCode,
  fetchEvents, fetchNetworks, fetchDisciplers, fetchLeaders, fetchRegistrations,
  createRegistration, createSharedRegistration, fetchSharedEvent,
  deleteRegistration, updateRegistrationStatus, addNetwork, deleteNetwork,
  addDiscipler, deleteDiscipler, addLeader, deleteLeader, addEvent
} from './lib/supabase';

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

function listsForSharedEvent(bundle) {
  const url = new URL(window.location.href);
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

function QuickEventSetup({ onAdmin, onConfigure }) {
  const setupCodeFromLink = new URLSearchParams(window.location.hash.slice(1)).get('setup') || '';
  const [code, setCode] = useState(setupCodeFromLink);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [networksText, setNetworksText] = useState('');
  const [disciplersText, setDisciplersText] = useState('');
  const [leadersText, setLeadersText] = useState('');
  const [existingLink, setExistingLink] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="glass-card" style={{ maxWidth: 560, margin: '5vh auto' }}>
    <h2>Criar evento e liberar inscrições</h2>
    <p style={{ color: 'var(--text-muted)', margin: '12px 0' }}>
      Cadastre o evento e as opções da equipe que aparecerão no formulário de inscrições.
    </p>
    {error && <p role="alert" style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}
    {link ? <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ color: '#6ee7b7', fontWeight: 700 }}>Evento criado. Este é o link de inscrições:</p>
      <a href={link} style={{ color: '#a5b4fc', overflowWrap: 'anywhere' }}>{link}</a>
      <p style={{ color: 'var(--text-muted)' }}>Compartilhe este link completo. Se alterar a equipe depois, compartilhe o novo link.</p>
      <button className="btn-primary" onClick={async () => {
        try { await navigator.clipboard.writeText(link); alert('Link copiado.'); }
        catch (_) { window.prompt('Copie o link:', link); }
      }}>Copiar link</button>
      <button className="btn-secondary" onClick={() => { setLink(''); setName(''); setPrice('0'); setDate(''); setLocation(''); setNetworksText(''); setDisciplersText(''); setLeadersText(''); setExistingLink(''); }}>Preparar outro link</button>
    </div> : <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try {
        validateTeamLists(networksText, disciplersText, leadersText);
        let token;
        if (existingLink.trim()) {
          const url = new URL(existingLink.trim());
          if (url.origin !== window.location.origin) throw new Error('Cole o link deste site para o evento.');
          token = url.pathname.match(eventPath)?.[1];
          if (!token || !(await fetchSharedEvent(token))?.event) throw new Error('Evento não encontrado nesse link.');
        } else {
          const saved = await createEventWithSetupCode(code, { name, price, date, location });
          token = saved.share_token;
        }
        setLink(eventLink(token, networksText, disciplersText, leadersText));
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
    }} style={{ display: 'grid', gap: 12 }}>
      <label style={{ fontWeight: 700 }}>Evento</label>
      <input className="form-input" type="url" value={existingLink} onChange={e => {
        const value = e.target.value;
        setExistingLink(value);
        try {
          const url = new URL(value);
          setNetworksText(namesFromLink(url, 'redes').join('\n'));
          setDisciplersText(namesFromLink(url, 'discipuladores').join('\n'));
          setLeadersText(namesFromLink(url, 'lideres').join('\n'));
        } catch (_) { /* O link ainda está sendo digitado. */ }
      }} placeholder="Já tem um evento? Cole o link aqui" />
      {!existingLink.trim() && <>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do novo evento" required />
        <input className="form-input" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Valor da inscrição (R$)" required />
        <input className="form-input" value={date} onChange={e => setDate(e.target.value)} placeholder="Data (opcional)" />
        <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Local (opcional)" />
        {!setupCodeFromLink && <input className="form-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Código inicial" required />}
      </>}
      <h3 style={{ marginTop: 8 }}>Equipe do evento</h3>
      <p style={{ color: 'var(--text-muted)' }}>Escreva um nome por linha. As listas serão incluídas no link de inscrições.</p>
      <label>Redes
        <textarea className="form-input" rows="3" value={networksText} onChange={e => setNetworksText(e.target.value)} placeholder="Uma rede por linha" style={{ width: '100%', marginTop: 6 }} />
      </label>
      <label>Discipuladores
        <textarea className="form-input" rows="3" value={disciplersText} onChange={e => setDisciplersText(e.target.value)} placeholder="Um discipulador por linha" style={{ width: '100%', marginTop: 6 }} />
      </label>
      <label>Líderes
        <textarea className="form-input" rows="3" value={leadersText} onChange={e => setLeadersText(e.target.value)} placeholder="Um líder por linha" style={{ width: '100%', marginTop: 6 }} />
      </label>
      <button className="btn-primary" disabled={busy}>{busy ? 'Preparando...' : existingLink.trim() ? 'Atualizar link com a equipe' : 'Criar evento e gerar link'}</button>
    </form>}
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onAdmin}>Cadastrar ou entrar como equipe</button>
    <button className="btn-secondary" style={{ marginTop: 12 }} onClick={onConfigure}>Alterar Supabase</button>
  </main>;
}

function SharedEventPage() {
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!sharedToken) { setError('Link de evento inválido.'); setLoading(false); return; }
    fetchSharedEvent(sharedToken)
      .then(data => { if (!data?.event) throw new Error('Evento não encontrado ou encerrado.'); setBundle(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <main className="glass-card">Carregando evento...</main>;
  if (error) return <main className="glass-card" role="alert">{error}</main>;
  const lists = listsForSharedEvent(bundle);
  return <div className="app-container">
    <header className="kiosk-header"><div className="event-info-pill"><div className="event-title-line">{bundle.event.name}</div><div className="event-meta-line">{bundle.event.date || ''} {bundle.event.location || ''}</div></div></header>
    <main style={{ flex: 1 }}>
      <RegistrationForm
        key={bundle.event.id}
        events={[bundle.event]} networks={lists.networks} disciplers={lists.disciplers} leaders={lists.leaders}
        publicMode onSubmit={reg => createSharedRegistration(sharedToken, reg)}
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
      } else setStatus('quickstart');
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

  if (isSharedPath) return <SharedEventPage />;
  if (status === 'checking') return <main className="glass-card">Verificando Supabase...</main>;
  if (status === 'setup') return <Setup initialError={error} />;
  if (status === 'quickstart') return <QuickEventSetup onAdmin={() => setStatus('login')} onConfigure={() => setStatus('setup')} />;
  if (status === 'login') return <Login onAuthenticate={onAuthenticate} onConfigure={() => setStatus('setup')} error={error} />;
  if (status === 'data-error') return <main className="glass-card" role="alert"><h2>Falha ao carregar dados</h2><p>{error}</p><button className="btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button><button className="btn-secondary" onClick={() => setStatus('setup')}>Configurar Supabase</button></main>;

  return <div className="app-container">
    {error && <div className="toast-container"><div className="toast error" role="alert">{error}</div></div>}
    {currentScreen === 'kiosk' ? <>
      <Header event={activeEvent} attendeeCount={registrations.filter(r => r.event_id === activeEvent?.id).length} onOpenAdmin={() => setCurrentScreen('admin')} onRefresh={refresh} isRefreshing={isRefreshing} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeEvent ? <RegistrationForm key={activeEvent.id} events={[activeEvent]} networks={networks} disciplers={disciplers} leaders={leaders}
          onSubmit={async reg => { const item = await createRegistration(reg); setRegistrations(prev => [item, ...prev]); return item; }}
          onConfirmPaymentStatus={async (id, state) => { await updateRegistrationStatus(id, state); setRegistrations(prev => prev.map(r => r.id === id ? { ...r, payment_status: state } : r)); }} />
          : <div className="glass-card">Nenhum evento cadastrado. Abra o painel Admin para criar o primeiro.</div>}
      </main>
    </> : <main style={{ flex: 1 }}>
      <AdminView
        onBack={() => setCurrentScreen('kiosk')} onRefresh={refresh} isRefreshing={isRefreshing}
        registrations={registrations} events={events} networks={networks} disciplers={disciplers} leaders={leaders}
        selectedEventId={activeEvent?.id} onSelectEvent={selectEvent}
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
