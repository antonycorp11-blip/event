import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, RefreshCw } from 'lucide-react';
import { ownerCreateAccount, ownerListOrgs, ownerTestInfinitePay, ownerUpdateOrg } from '../lib/supabase';
import { copyText } from './PixKeyBox';

// Área do dono do sistema: cria o acesso de cada igreja/rede, liga a InfiniteTag
// dela e acompanha os eventos de cada uma (para cobrar por evento).

export const INFINITEPAY_SETUP_URL = 'https://app.infinitepay.io/external-checkout#configuracoes?enabled=true';

const fieldStyle = { display: 'grid', gap: 6, fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-muted)' };
const dateBR = iso => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '');
const inDays = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const appLink = () => window.location.origin;

const infinitePayMessage = () => `Para receber as inscrições direto na sua conta InfinitePay:

1. No app da InfinitePay, cadastre uma chave Pix (Pix > Minhas chaves).
2. Abra este link, logado na sua conta InfinitePay:
${INFINITEPAY_SETUP_URL}
3. Ligue "Habilitar checkout integrado", deixe o Pix marcado e DESLIGUE a "Etapa de endereço". Salve.
4. Me mande a sua InfiniteTag (o nome de usuário que começa com $).`;

const accessMessage = (org, email, password) => `Seu acesso ao sistema de inscrições de ${org} está pronto!

Painel: ${appLink()}
E-mail: ${email}${password ? `\nSenha provisória: ${password}` : ''}

No painel você cria os eventos, copia o link de inscrição e acompanha os inscritos e pagamentos. Ao entrar, troque a senha em "Senha".`;

function statusOf(org) {
  if (org.active === false) return ['Desativada', 'var(--text-muted)'];
  if (org.access_until && org.access_until < new Date().toISOString().slice(0, 10)) return [`Venceu em ${dateBR(org.access_until)}`, '#f87171'];
  if (org.access_until) return [`Acesso até ${dateBR(org.access_until)}`, '#fbbf24'];
  return ['Acesso sem prazo', '#6ee7b7'];
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn-secondary" onClick={async () => {
    if (await copyText(text, 'Copie a mensagem:')) { setDone(true); setTimeout(() => setDone(false), 2000); }
  }}><Copy size={15} /> {done ? 'Copiado!' : label}</button>;
}

function NewAccount({ onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: `Igreja${Math.floor(1000 + Math.random() * 9000)}`, accessUntil: inDays(30) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  if (created) return <div className="glass-card" style={{ display: 'grid', gap: 12 }}>
    <h4 style={{ color: '#6ee7b7', fontWeight: 800 }}>Acesso de {created.name} criado</h4>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Envie as duas mensagens ao pastor. Se este e-mail já tinha login em outro app seu, a senha continua a antiga dele.</p>
    <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-input)', padding: 12, borderRadius: 10, fontSize: '0.85rem' }}>{accessMessage(created.name, created.email, created.password)}</pre>
    <CopyButton text={accessMessage(created.name, created.email, created.password)} label="Copiar mensagem de acesso" />
    <CopyButton text={infinitePayMessage()} label="Copiar instruções da InfinitePay" />
    <button type="button" className="btn-primary" onClick={onCreated}>Concluir</button>
  </div>;

  return <form className="glass-card" style={{ display: 'grid', gap: 12 }} onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await ownerCreateAccount(form);
      setCreated({ ...form });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }}>
    <h4 style={{ fontWeight: 800, color: '#fff' }}>Nova conta</h4>
    <label style={fieldStyle}>Nome da igreja ou rede
      <input className="form-input" value={form.name} onChange={set('name')} maxLength={120} required placeholder="Ex.: Rede Jovem Sede" />
    </label>
    <label style={fieldStyle}>E-mail do pastor (login)
      <input className="form-input" type="email" value={form.email} onChange={set('email')} required placeholder="pastor@email.com" />
    </label>
    <label style={fieldStyle}>Senha provisória
      <input className="form-input" value={form.password} onChange={set('password')} minLength={6} required />
    </label>
    <label style={fieldStyle}>Acesso até (deixe vazio para não vencer)
      <input className="form-input" type="date" value={form.accessUntil} onChange={set('accessUntil')} />
    </label>
    {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
      <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
      <button className="btn-primary" disabled={busy}>{busy ? 'Criando...' : 'Criar acesso'}</button>
    </div>
  </form>;
}

function OrgSettings({ org, onSaved, onCancel }) {
  const [form, setForm] = useState({
    ...org, infinitepay_handle: org.infinitepay_handle ? `$${org.infinitepay_handle}` : '',
    access_until: org.access_until || '', customer_email: org.customer_email || '',
    pix_key: org.pix_key || '', receipt_whatsapp: org.receipt_whatsapp || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null);
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const runTest = async () => {
    setTest({ busy: true });
    try {
      const res = await ownerTestInfinitePay(form.infinitepay_handle);
      setTest(res.ok ? { ok: true, text: 'Tudo certo: a InfinitePay aceitou e o checkout está ativo.' }
        : /external_checkout_not_enabled/.test(res.error || '') ? { ok: false, text: 'A conta existe, mas o checkout integrado ainda não foi ativado. Envie as instruções ao pastor.' }
          : { ok: false, text: `A InfinitePay recusou: ${res.error}` });
    } catch (err) { setTest({ ok: false, text: err.message }); }
  };

  return <form style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--border-glass)', paddingTop: 12 }} onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await ownerUpdateOrg(form); await onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }}>
    <label style={fieldStyle}>Nome da igreja ou rede
      <input className="form-input" value={form.name} onChange={set('name')} maxLength={120} required />
    </label>
    <label style={fieldStyle}>InfiniteTag (Pix automático)
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
        <input className="form-input" value={form.infinitepay_handle} onChange={e => { setTest(null); set('infinitepay_handle')(e); }} placeholder="$nome-da-conta" />
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} disabled={!form.infinitepay_handle.trim() || test?.busy} onClick={runTest}>{test?.busy ? 'Testando...' : 'Testar'}</button>
      </div>
    </label>
    {test && !test.busy && <p style={{ color: test.ok ? '#6ee7b7' : '#fbbf24', fontSize: '0.86rem' }}>{test.text}</p>}
    <label style={fieldStyle}>E-mail enviado ao checkout (recebe os comprovantes da InfinitePay)
      <input className="form-input" type="email" value={form.customer_email} onChange={set('customer_email')} placeholder="email@igreja.com" />
    </label>
    <label style={fieldStyle}>Chave Pix manual (usada só sem InfiniteTag e no atendimento presencial)
      <input className="form-input" value={form.pix_key} onChange={set('pix_key')} />
    </label>
    <label style={fieldStyle}>WhatsApp para comprovante (Pix manual)
      <input className="form-input" inputMode="tel" value={form.receipt_whatsapp} onChange={set('receipt_whatsapp')} placeholder="(65) 99999-9999" />
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <label style={fieldStyle}>Prazo para pagar (min)
        <input className="form-input" type="number" min="10" max="1440" value={form.pix_minutes} onChange={set('pix_minutes')} />
      </label>
      <label style={fieldStyle}>Acesso até
        <input className="form-input" type="date" value={form.access_until} onChange={set('access_until')} />
      </label>
    </div>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-main)' }}>
      <input type="checkbox" checked={form.active !== false} onChange={set('active')} /> Conta ativa
    </label>
    {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
      <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
      <button className="btn-primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
    </div>
  </form>;
}

function OrgCard({ org, onReload }) {
  const [editing, setEditing] = useState(false);
  const [label, color] = statusOf(org);
  const events = org.events || [];
  return <article className="glass-card" style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
      <div>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{org.name}</h4>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{(org.admins || []).join(', ') || 'Sem login ligado'}</div>
      </div>
      <span className="badge" style={{ color, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
    <div style={{ fontSize: '0.86rem', color: org.infinitepay_handle ? '#6ee7b7' : '#fbbf24' }}>
      Pix automático: {org.infinitepay_handle ? `ligado ($${org.infinitepay_handle})` : 'não configurado (usa chave Pix manual)'}
    </div>
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Eventos ({events.length})</div>
      {events.length === 0 && <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>Nenhum evento criado ainda.</div>}
      {events.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.88rem' }}>
        <span style={{ color: e.active ? '#fff' : 'var(--text-muted)' }}>{e.name}{e.active ? '' : ' (encerrado)'} · {dateBR(e.created_at)}</span>
        <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{e.registrations} inscritos · {e.paid} pagos</span>
      </div>)}
    </div>
    {!editing && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <button type="button" className="btn-primary" onClick={() => setEditing(true)}>Configurar</button>
      <CopyButton text={infinitePayMessage()} label="Instruções InfinitePay" />
      <CopyButton text={accessMessage(org.name, (org.admins || [])[0] || '')} label="Mensagem de acesso" />
    </div>}
    {editing && <OrgSettings org={org} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); await onReload(); }} />}
  </article>;
}

export function OwnerPanel() {
  const [orgs, setOrgs] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const load = async () => {
    try { setOrgs(await ownerListOrgs()); setError(''); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>Contas</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Cada igreja só vê os próprios eventos e inscritos.</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={load} aria-label="Atualizar"><RefreshCw size={16} /></button>
        {!creating && <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setCreating(true)}><Plus size={18} /> Nova conta</button>}
      </div>
    </div>
    {creating && <NewAccount onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
    {!orgs && !error && <p style={{ color: 'var(--text-muted)' }}>Carregando contas...</p>}
    {orgs?.map(org => <OrgCard key={org.id} org={org} onReload={load} />)}
    <div className="glass-card" style={{ fontSize: '0.86rem', color: 'var(--text-muted)', display: 'grid', gap: 6 }}>
      <strong style={{ color: '#fff', display: 'flex', gap: 6, alignItems: 'center' }}><KeyRound size={16} /> Link para o pastor configurar a InfinitePay</strong>
      <span style={{ overflowWrap: 'anywhere' }}>{INFINITEPAY_SETUP_URL}</span>
    </div>
  </div>;
}
