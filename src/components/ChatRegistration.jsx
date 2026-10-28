import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { calculateAge } from '../lib/exportUtils';

// Inscrição pelo link em formato de conversa: o "atendente" pergunta, a pessoa
// responde digitando ou tocando nas opções. Gera os mesmos dados do formulário.

const money = value => (Number(value) > 0 ? `R$ ${Number(value).toFixed(2).replace('.', ',')}` : 'Gratuito');

const maskDate = value => {
  const raw = value.replace(/\D/g, '').slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}` : raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
};

const maskPhone = value => {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  if (raw.length > 7) return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  if (raw.length > 2) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  return raw;
};

function validBirth(value) {
  const [d, m, y] = value.split('/').map(Number);
  if (!d || !m || !y || value.length !== 10 || y < 1920) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && date <= new Date();
}

const FIELDS = [
  ['name', 'Nome'], ['birth', 'Nascimento'], ['network', 'Rede'],
  ['discipler', 'Discipulador'], ['leader', 'Líder'], ['phone', 'WhatsApp'],
];

export function ChatRegistration({
  event, ticketLots = [], hasTicketLots = false, networks = [], disciplers = [], leaders = [],
  defaults = null, onSubmit, onRefreshAvailability, footer
}) {
  const activeLot = useMemo(() => [...ticketLots]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .find(lot => Number(lot.remaining) > 0), [ticketLots]);
  const soldOut = hasTicketLots && !activeLot;
  const price = activeLot ? activeLot.price : event.price;
  const phoneRequired = Number(price) > 0;

  const [answers, setAnswers] = useState(() => ({
    forOther: Boolean(defaults), name: '', birth: '',
    network: '', discipler: '', leader: '', phone: defaults?.phone || '',
  }));
  const [step, setStep] = useState(defaults ? 'name' : 'who');
  const [log, setLog] = useState([]);
  const [typing, setTyping] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fixing, setFixing] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const other = answers.forOther;
  const questions = {
    who: 'Essa inscrição é para você ou para outra pessoa?',
    name: other ? 'Qual é o nome completo de quem vai participar?' : 'Para começar, qual é o seu nome completo?',
    birth: other ? `Qual a data de nascimento de ${answers.name.split(' ')[0]}?` : 'Qual a sua data de nascimento?',
    network: other ? 'De qual rede essa pessoa faz parte?' : 'De qual rede você faz parte?',
    discipler: other ? 'Quem é o discipulador dela?' : 'Quem é o seu discipulador?',
    leader: other ? 'E o líder? Se não tiver, pode pular.' : 'E o seu líder? Se não tiver, pode pular.',
    phone: other
      ? 'Agora o SEU WhatsApp, de quem está fazendo a inscrição.'
      : 'Qual o seu WhatsApp?',
    confirm: 'Confere se está tudo certo:',
  };
  const hints = {
    phone: phoneRequired ? 'O código de confirmação do pagamento chega nele.' : 'Usamos só para avisos do evento.',
  };

  // Mostra a pergunta da etapa com um "digitando..." rápido, como numa conversa.
  useEffect(() => {
    setTyping(true);
    const timer = setTimeout(() => {
      setTyping(false);
      setLog(prev => [...prev, { from: 'bot', text: questions[step], hint: hints[step], step }]);
      const prefill = { name: answers.name, birth: answers.birth, leader: answers.leader, phone: answers.phone }[step];
      setDraft(prefill || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }, log.length ? 450 : 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [log, typing, step]);

  const order = ['who', 'name', 'birth', 'network', 'discipler', 'leader', 'phone', 'confirm'];
  const advance = () => {
    if (fixing) { setFixing(false); setStep('confirm'); return; }
    setStep(order[order.indexOf(step) + 1]);
  };
  const reply = (patch, text, extra) => {
    setError('');
    setAnswers(prev => ({ ...prev, ...patch }));
    setLog(prev => [...prev, { from: 'user', text }, ...(extra ? [{ from: 'bot', text: extra }] : [])]);
    setDraft('');
    advance();
  };

  const submitText = e => {
    e.preventDefault();
    const value = draft.trim();
    if (step === 'name') {
      if (value.split(/\s+/).length < 2) { setError('Digite nome e sobrenome.'); return; }
      reply({ name: value.replace(/\s+/g, ' ') }, value);
    } else if (step === 'birth') {
      if (!validBirth(value)) { setError('Data inválida. Use o formato DD/MM/AAAA.'); return; }
      reply({ birth: value }, value, `🎂 ${calculateAge(value)}`);
    } else if (step === 'network' || step === 'discipler') {
      if (!value) return;
      reply({ [step]: value }, value);
    } else if (step === 'leader') {
      reply({ leader: value }, value || 'Sem líder');
    } else if (step === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (phoneRequired && ![10, 11].includes(digits.length)) { setError('Digite o WhatsApp com DDD.'); return; }
      reply({ phone: value }, value || 'Sem WhatsApp');
    }
  };

  const confirm = async () => {
    setBusy(true); setError('');
    const [d, m, y] = answers.birth.split('/');
    try {
      await onSubmit({
        event_id: event.id, event_name: event.name,
        name: answers.name, birth_date: `${y}-${m}-${d}`,
        network: answers.network, discipler: answers.discipler, leader: answers.leader.trim(),
        payment_method: 'PIX', payment_status: 'Pendente', phone: answers.phone.trim(),
        ticket_lot_id: activeLot?.id || null, ticket_lot_name: activeLot?.name || null, ticket_price: price,
      });
    } catch (err) {
      const message = err.message || 'Tente novamente.';
      setLog(prev => [...prev, { from: 'bot', text: `Não consegui concluir: ${message}`, error: true }]);
      if (/lote mudou|esgotad/i.test(message)) onRefreshAvailability?.();
    } finally {
      setBusy(false);
    }
  };

  if (soldOut) return <div className="chat-card">
    <div className="chat-bubble bot">Os ingressos deste evento esgotaram. 😕</div>
    <button className="btn-secondary" onClick={() => window.location.reload()}>Atualizar disponibilidade</button>
  </div>;

  const options = step === 'who' ? [['Para mim', () => reply({ forOther: false }, 'Para mim')], ['Para outra pessoa', () => reply({ forOther: true }, 'Para outra pessoa')]]
    : step === 'network' && networks.length ? networks.map(n => [n.name, () => reply({ network: n.name }, n.name), n.name === defaults?.network])
    : step === 'discipler' && disciplers.length ? disciplers.map(d => [d.name, () => reply({ discipler: d.name }, d.name), d.name === defaults?.discipler])
    : step === 'leader' ? [
      ...(defaults?.leader ? [[defaults.leader, () => reply({ leader: defaults.leader }, defaults.leader), true]] : []),
      ['Não tenho / pular', () => reply({ leader: '' }, 'Sem líder')],
    ]
    : step === 'phone' && !phoneRequired ? [['Pular', () => reply({ phone: '' }, 'Sem WhatsApp')]]
    : null;
  const textInput = ['name', 'birth', 'leader', 'phone'].includes(step)
    || (step === 'network' && !networks.length) || (step === 'discipler' && !disciplers.length);

  return <div className="chat-card">
    <div className="chat-bubble bot">
      Olá! 👋 Vou te ajudar com a inscrição em <strong>{event.name}</strong>.
      <div className="chat-price">{activeLot ? `${activeLot.name} · ` : ''}{money(price)}</div>
    </div>

    {log.map((item, index) => <div key={index} className={`chat-bubble ${item.from}${item.error ? ' error' : ''}`}>
      {item.text}
      {item.hint && <div className="chat-hint">{item.hint}</div>}
    </div>)}

    {typing && <div className="chat-bubble bot chat-typing" aria-label="Digitando"><span /><span /><span /></div>}

    {!typing && step === 'confirm' && <>
      <div className="chat-summary">
        <div><span>Participante</span><strong>{answers.name}</strong></div>
        <div><span>Nascimento</span><strong>{answers.birth} ({calculateAge(answers.birth)})</strong></div>
        <div><span>Rede</span><strong>{answers.network}</strong></div>
        <div><span>Discipulador</span><strong>{answers.discipler}</strong></div>
        <div><span>Líder</span><strong>{answers.leader || '—'}</strong></div>
        <div><span>WhatsApp</span><strong>{answers.phone || '—'}</strong></div>
        <div><span>Valor</span><strong className="chat-money">{money(price)}</strong></div>
      </div>
      {!fixing ? <div className="chat-options">
        <button type="button" className="chat-chip primary" disabled={busy} onClick={confirm}>{busy ? 'Enviando...' : 'Está tudo certo ✓'}</button>
        <button type="button" className="chat-chip" disabled={busy} onClick={() => setFixing('choose')}>Corrigir algo</button>
      </div> : <div className="chat-options">
        {FIELDS.map(([field, label]) => <button key={field} type="button" className="chat-chip" onClick={() => {
          setLog(prev => [...prev, { from: 'user', text: `Corrigir ${label.toLowerCase()}` }]);
          setFixing(true); setStep(field);
        }}>{label}</button>)}
      </div>}
    </>}

    {!typing && options && <div className="chat-options">
      {options.map(([label, onClick, suggested]) => <button key={label} type="button" className={`chat-chip${suggested ? ' suggested' : ''}`} onClick={onClick}>
        {label}
      </button>)}
    </div>}

    {!typing && textInput && <form className="chat-input" onSubmit={submitText}>
      <input ref={inputRef} value={draft} list={step === 'leader' ? 'chat-leaders' : undefined}
        onChange={e => { setError(''); setDraft(step === 'birth' ? maskDate(e.target.value) : step === 'phone' ? maskPhone(e.target.value) : e.target.value); }}
        placeholder={{ name: 'Nome e sobrenome', birth: 'DD/MM/AAAA', leader: 'Nome do líder', phone: '(00) 00000-0000' }[step] || 'Digite aqui'}
        inputMode={step === 'birth' || step === 'phone' ? 'numeric' : 'text'}
        autoComplete={step === 'name' && !other ? 'name' : step === 'phone' ? 'tel' : 'off'}
        aria-label={questions[step]} />
      {step === 'leader' && <datalist id="chat-leaders">{leaders.map(l => <option key={l.id} value={l.name} />)}</datalist>}
      <button type="submit" aria-label="Enviar" disabled={!draft.trim() && step !== 'leader'}><Send size={18} /></button>
    </form>}
    {error && <div className="chat-error" role="alert">{error}</div>}
    <div ref={endRef} />
    {footer}
  </div>;
}
