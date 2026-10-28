import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Calendar,
  Users,
  HeartHandshake,
  Shield,
  CreditCard,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Phone,
  FastForward,
  Check,
  QrCode,
  Smartphone,
  Banknote,
  RotateCcw
} from 'lucide-react';
import { calculateAge } from '../lib/exportUtils';
import confetti from 'canvas-confetti';
import { PixKeyBox } from './PixKeyBox';

const TOTAL_STEPS = 7;

// No link público só existe PIX; cartão e dinheiro ficam para o atendimento presencial no dia.
const PAYMENT_OPTIONS = [
  { id: 'PIX', label: 'PIX', icon: '⚡', subtitle: 'QR Code ou copia e cola' },
  { id: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: '💳', subtitle: 'Continue na maquininha' },
  { id: 'Cartão de Débito', label: 'Cartão de Débito', icon: '💳', subtitle: 'Continue na maquininha' },
  { id: 'Dinheiro', label: 'Dinheiro', icon: '💵', subtitle: 'Recebimento em espécie' }
];

export const RegistrationForm = ({
  events = [],
  networks = [],
  disciplers = [],
  leaders = [],
  ticketLots = [],
  hasTicketLots = false,
  publicMode = false,
  onSubmit,
  onRefreshAvailability,
  onConfirmPaymentStatus
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(''); // Armazenado como DD/MM/AAAA
  const [network, setNetwork] = useState('');
  const [discipler, setDiscipler] = useState('');
  const [leader, setLeader] = useState(''); // Livre / pode ficar em branco
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  // Link público: a inscrição pode ser feita por outra pessoa (quem paga) para quem vai participar.
  const [forOther, setForOther] = useState(false);
  const who = (mine, other) => (publicMode && forOther ? other : mine);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Controle do fluxo de pagamento
  // 'idle' | 'waiting_payment' | 'completed'
  const [paymentFlowState, setPaymentFlowState] = useState('idle');
  const [currentRegistration, setCurrentRegistration] = useState(null);

  const nameInputRef = useRef(null);
  const birthInputRef = useRef(null);
  const leaderInputRef = useRef(null);

  // Evento ativo
  const activeEvent = useMemo(() => {
    return events[0] || {
      name: 'Conferência do Reino 2026',
      price: 80.00
    };
  }, [events]);

  const activeLot = useMemo(() => [...ticketLots]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .find(lot => Number(lot.remaining) > 0), [ticketLots]);
  const soldOut = hasTicketLots && !activeLot;
  const currentPrice = activeLot ? activeLot.price : activeEvent.price;

  const shownPrice = currentRegistration?.ticket_price ?? currentPrice;
  const priceFormatted = Number(shownPrice) > 0
    ? `R$ ${Number(shownPrice).toFixed(2).replace('.', ',')}`
    : 'Gratuito';

  const calculatedAge = useMemo(() => {
    return calculateAge(birthDate);
  }, [birthDate]);

  // Validação da data digitada
  const isBirthDateValid = useMemo(() => {
    if (!birthDate || birthDate.length !== 10) return false;
    const parts = birthDate.split('/');
    if (parts.length !== 3) return false;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1920 || year > new Date().getFullYear()) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date <= new Date();
  }, [birthDate]);

  useEffect(() => {
    if (step === 1 && nameInputRef.current) {
      nameInputRef.current.focus();
    } else if (step === 2 && birthInputRef.current) {
      birthInputRef.current.focus();
    } else if (step === 5 && leaderInputRef.current) {
      leaderInputRef.current.focus();
    }
  }, [step]);

  // Máscara de digitação da Data de Nascimento (DD/MM/AAAA)
  const handleBirthDateChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    let formatted = raw;
    if (raw.length > 2 && raw.length <= 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    } else if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
    }
    setBirthDate(formatted);
  };

  // Máscara de Telefone
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    let formatted = raw;
    if (raw.length > 2 && raw.length <= 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    } else if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    }
    setPhone(formatted);
  };

  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // 1. Nome
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    nextStep();
  };

  // 2. Data de Nascimento
  const handleBirthDateSubmit = (e) => {
    e.preventDefault();
    if (!isBirthDateValid) return;
    nextStep();
  };

  // 3. Rede (1 toque avança!)
  const handleSelectNetwork = (selectedNet) => {
    setNetwork(selectedNet);
    setTimeout(() => setStep(4), 180);
  };

  // 4. Discipulador (1 toque avança!)
  const handleSelectDiscipler = (selectedDisc) => {
    setDiscipler(selectedDisc);
    setTimeout(() => setStep(5), 180);
  };

  // 5. Líder
  const handleLeaderSubmit = (e) => {
    if (e) e.preventDefault();
    nextStep();
  };

  const handleSkipLeader = () => {
    setLeader('');
    nextStep();
  };

  // 6. WhatsApp
  // No link público o WhatsApp é obrigatório: a InfinitePay manda nele o código de confirmação do Pix.
  const phoneRequired = publicMode && Number(currentPrice) > 0;
  const phoneValid = [10, 11].includes(phone.replace(/\D/g, '').length);

  const handlePhoneSubmit = (e) => {
    if (e) e.preventDefault();
    if (phoneRequired && !phoneValid) return;
    nextStep();
  };

  const handleSkipPhone = () => {
    setPhone('');
    nextStep();
  };

  // 7. Pagamento Selecionado -> Salva no banco e abre a tela de espera do pagamento
  const handleSelectPayment = async (selectedPayment) => {
    setPaymentMethod(selectedPayment);
    setIsSubmitting(true);

    let isoDate = birthDate;
    if (birthDate.includes('/')) {
      const parts = birthDate.split('/');
      if (parts.length === 3) {
        isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const regData = {
      event_id: activeEvent.id,
      event_name: activeEvent.name,
      name: name.trim(),
      birth_date: isoDate,
      network,
      discipler,
      leader: leader.trim(),
      payment_method: selectedPayment,
      payment_status: 'Pendente',
      phone: phone.trim(),
      ticket_lot_id: activeLot?.id || null,
      ticket_lot_name: activeLot?.name || null,
      ticket_price: currentPrice
    };

    try {
      const saved = await onSubmit(regData);
      // No link público a página passa a mostrar "Minhas inscrições" com o Pix.
      if (publicMode) return;
      setCurrentRegistration(saved || regData);
      setPaymentFlowState('waiting_payment');
    } catch (err) {
      alert('Erro ao iniciar inscrição: ' + (err.message || 'tente novamente.'));
      if (/lote mudou|ingressos esgotados/i.test(err.message || '')) onRefreshAvailability?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmação do pagamento (PIX feito / Maquininha confirmada)
  const handleConfirmPayment = async () => {
    if (currentRegistration?.id && onConfirmPaymentStatus) {
      await onConfirmPaymentStatus(currentRegistration.id, 'Confirmado');
    }
    setCurrentRegistration((prev) => ({ ...prev, payment_status: 'Confirmado' }));
    setPaymentFlowState('completed');

    try {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (err) {}
  };

  // Reset total para atender a próxima pessoa
  const handleStartNextPerson = () => {
    setName('');
    setBirthDate('');
    setNetwork('');
    setDiscipler('');
    setLeader('');
    setPhone('');
    setPaymentMethod('');
    setCurrentRegistration(null);
    setPaymentFlowState('idle');
    setIsSubmitting(false);
    setStep(1);
  };

  if (soldOut && paymentFlowState === 'idle') {
    return <div className="wizard-card" style={{ textAlign: 'center' }}>
      <h2>Ingressos esgotados</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 10 }}>Não há vagas disponíveis para este evento no momento.</p>
      <button className="btn-secondary" style={{ marginTop: 18 }} onClick={() => window.location.reload()}>Atualizar disponibilidade</button>
    </div>;
  }

  // =========================================================================
  // TELA 1: AGUARDANDO PAGAMENTO (PIX QR CODE OU MAQUININHA DE CARTÃO)
  // =========================================================================
  if (paymentFlowState === 'waiting_payment' && currentRegistration) {
    const isPix = currentRegistration.payment_method === 'PIX';
    const isCard = currentRegistration.payment_method?.includes('Cartão');
    const isCash = currentRegistration.payment_method === 'Dinheiro';

    return (
      <div className="wizard-card">
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          
          {/* CASO 1: PIX COM QR CODE */}
          {isPix && (
            <div>
              <div className="step-label" style={{ justifyContent: 'center', marginBottom: '8px' }}>
                <span>⚡ Pagamento Instantâneo</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                Pague com a chave PIX
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Copie a chave e cole no app do seu banco
              </p>

              <PixKeyBox />

              {/* Valor a Pagar */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px'
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Valor a Pagar:</span>
                <strong style={{ color: '#34d399', fontSize: '1.15rem' }}>{priceFormatted}</strong>
              </div>

              {/* Botão Esperar Usuário Clicar em Pagamento Feito */}
              <button
                type="button"
                className="btn-next-action"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
                  fontSize: '1.15rem',
                  padding: '18px 22px'
                }}
                onClick={handleConfirmPayment}
              >
                <CheckCircle2 size={24} />
                <span>Pagamento Feito</span>
              </button>
            </div>
          )}

          {/* CASO 2: CARTÃO -> CONTINUE NA MAQUININHA */}
          {isCard && (
            <div>
              <div style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '2px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '10px auto 18px auto'
              }}>
                <CreditCard size={38} />
              </div>

              <div className="step-label" style={{ justifyContent: 'center', marginBottom: '6px' }}>
                <span>{currentRegistration.payment_method}</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Continue na Maquininha
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '340px', margin: '0 auto 20px auto', lineHeight: '1.4' }}>
                Insira, aproxime ou passe o cartão na maquininha para concluir o pagamento de <strong>{priceFormatted}</strong>.
              </p>

              {/* Status animado da maquininha */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '24px'
              }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  boxShadow: '0 0 10px #f59e0b',
                  animation: 'pulseSuccess 1.5s infinite'
                }} />
                <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.92rem' }}>
                  Aguardando confirmação na maquininha...
                </span>
              </div>

              {/* Botão para Confirmar e Liberar a Tela */}
              <button
                type="button"
                className="btn-next-action"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
                  fontSize: '1.15rem',
                  padding: '18px 22px'
                }}
                onClick={handleConfirmPayment}
              >
                <CheckCircle2 size={24} />
                <span>Confirmar Pagamento na Maquininha</span>
              </button>
            </div>
          )}

          {/* CASO 3: DINHEIRO */}
          {isCash && (
            <div>
              <div style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '2px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '10px auto 18px auto'
              }}>
                <Banknote size={38} />
              </div>

              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Pagamento em Dinheiro
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
                Receba o valor de <strong>{priceFormatted}</strong> em espécie.
              </p>

              <button
                type="button"
                className="btn-next-action"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  fontSize: '1.15rem',
                  padding: '18px 22px'
                }}
                onClick={handleConfirmPayment}
              >
                <CheckCircle2 size={24} />
                <span>Confirmar Recebimento</span>
              </button>
            </div>
          )}

          {/* Opção de Voltar para alterar forma de pagamento caso necessário */}
          <button
            type="button"
            className="btn-skip-action"
            style={{ marginTop: '14px', border: 'none', background: 'transparent' }}
            onClick={() => setPaymentFlowState('idle')}
          >
            <RotateCcw size={15} style={{ marginRight: '6px' }} />
            <span>Mudar forma de pagamento</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA 2: INSCRIÇÃO E PAGAMENTO CONFIRMADOS -> LIBERA TELA PRÓXIMA INSCRIÇÃO
  // =========================================================================
  if (paymentFlowState === 'completed' && currentRegistration) {
    return (
      <div className="wizard-card">
        <div className="kiosk-success-view">
          <div className="success-icon-badge">
            <CheckCircle2 size={42} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Inscrição & Pagamento Confirmados!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '18px' }}>
            {currentRegistration.name} foi confirmado(a) no banco de dados.
          </p>

          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px dashed var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            width: '100%',
            maxWidth: '380px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.86rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Rede:</span>
              <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{currentRegistration.network}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Discipulador:</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{currentRegistration.discipler}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Líder:</span>
              <span style={{ color: currentRegistration.leader ? '#f1f5f9' : 'var(--text-dim)' }}>
                {currentRegistration.leader || '(Em branco)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Pagamento:</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>
                {currentRegistration.payment_method} (Confirmado)
              </span>
            </div>
          </div>

          {/* BOTÃO HERO PARA LIBERAR A TELA PARA A PRÓXIMA PESSOA */}
          <button
            type="button"
            className="btn-next-person-hero"
            onClick={handleStartNextPerson}
          >
            <Sparkles size={20} />
            <span>⚡ Liberar para Próxima Inscrição</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="wizard-card">
      {activeLot && <div style={{ color: '#a5b4fc', fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
        {activeLot.name} · {Number(activeLot.remaining)} {Number(activeLot.remaining) === 1 ? 'vaga' : 'vagas'} · {priceFormatted}
      </div>}
      {/* Progresso Superior */}
      <div className="progress-container">
        <div className="progress-header">
          <span>Etapa {step} de {TOTAL_STEPS}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* PASSO 1: NOME */}
      {step === 1 && (
        <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <User size={15} />
              <span>Nome Completo</span>
            </div>
            <h2 className="step-title">{who('Qual é o seu nome completo?', 'Nome completo de quem vai participar')}</h2>
            <p className="step-subtitle">{who('Digite o nome e sobrenome do participante', 'O ingresso sai no nome desta pessoa')}</p>
          </div>

          {publicMode && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }} role="group" aria-label="Para quem é o ingresso">
            {[[false, 'Para mim'], [true, 'Para outra pessoa']].map(([value, label]) => <button key={label} type="button"
              className={`option-card-btn ${forOther === value ? 'selected' : ''}`}
              style={{ minHeight: 48, justifyContent: 'center' }} aria-pressed={forOther === value}
              onClick={() => { setForOther(value); nameInputRef.current?.focus(); }}>
              <span className="option-card-label">{label}</span>
            </button>)}
          </div>}

          <div className="wizard-input-wrap">
            <input
              ref={nameInputRef}
              type="text"
              className="wizard-input-lg"
              placeholder="Ex: Lucas Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="wizard-actions">
            <button
              type="submit"
              className="btn-next-action"
              disabled={!name.trim()}
            >
              <span>Continuar</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </form>
      )}

      {/* PASSO 2: DATA DE NASCIMENTO (DIGITADA) */}
      {step === 2 && (
        <form onSubmit={handleBirthDateSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <Calendar size={15} />
              <span>Data de Nascimento</span>
            </div>
            <h2 className="step-title">{who('Qual sua data de nascimento?', 'Data de nascimento do participante')}</h2>
            <p className="step-subtitle">Digite os números (dia, mês e ano)</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              ref={birthInputRef}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="wizard-input-lg"
              placeholder="DD/MM/AAAA"
              value={birthDate}
              onChange={handleBirthDateChange}
              required
            />

            {isBirthDateValid && (
              <div style={{
                marginTop: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                color: '#6ee7b7',
                fontSize: '0.92rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎂 Idade calculada: <strong style={{ color: '#fff' }}>{calculatedAge}</strong>
              </div>
            )}
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>

            <button
              type="submit"
              className="btn-next-action"
              disabled={!isBirthDateValid}
            >
              <span>Continuar</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </form>
      )}

      {/* PASSO 3: REDE */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <Users size={15} />
              <span>Rede</span>
            </div>
            <h2 className="step-title">{who('Qual é a sua Rede?', 'Qual é a Rede do participante?')}</h2>
            <p className="step-subtitle">Toque na opção para avançar</p>
          </div>

          {networks.length === 0 ? <form onSubmit={e => { e.preventDefault(); if (network.trim()) setStep(4); }}>
            <input className="wizard-input-lg" type="text" placeholder="Digite sua rede" value={network} onChange={e => setNetwork(e.target.value)} required />
            <button className="btn-next-action" type="submit" disabled={!network.trim()} style={{ marginTop: 16 }}>Continuar <ChevronRight size={20} /></button>
          </form> : <div className="options-grid">
            {networks.map((net) => {
              const isSelected = network === net.name;
              return (
                <button
                  key={net.id}
                  type="button"
                  className={`option-card-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectNetwork(net.name)}
                >
                  <span className="option-card-label">{net.name}</span>
                  <div className="option-card-check">
                    {isSelected && <Check size={14} />}
                  </div>
                </button>
              );
            })}
          </div>}

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}

      {/* PASSO 4: DISCIPULADOR */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <HeartHandshake size={15} />
              <span>Discipulado</span>
            </div>
            <h2 className="step-title">{who('Quem é seu Discipulador?', 'Quem é o Discipulador do participante?')}</h2>
            <p className="step-subtitle">Toque no nome para avançar</p>
          </div>

          {disciplers.length === 0 ? <form onSubmit={e => { e.preventDefault(); if (discipler.trim()) setStep(5); }}>
            <input className="wizard-input-lg" type="text" placeholder="Digite o nome do discipulador" value={discipler} onChange={e => setDiscipler(e.target.value)} required />
            <button className="btn-next-action" type="submit" disabled={!discipler.trim()} style={{ marginTop: 16 }}>Continuar <ChevronRight size={20} /></button>
          </form> : <div className="options-grid">
            {disciplers.map((disc) => {
              const isSelected = discipler === disc.name;
              return (
                <button
                  key={disc.id}
                  type="button"
                  className={`option-card-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDiscipler(disc.name)}
                >
                  <span className="option-card-label">{disc.name}</span>
                  <div className="option-card-check">
                    {isSelected && <Check size={14} />}
                  </div>
                </button>
              );
            })}
          </div>}

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}

      {/* PASSO 5: LÍDER */}
      {step === 5 && (
        <form onSubmit={handleLeaderSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <Shield size={15} />
              <span>Liderança</span>
            </div>
            <h2 className="step-title">{who('Quem é o seu Líder?', 'Quem é o Líder do participante?')}</h2>
            <p className="step-subtitle">Pode deixar em branco caso não tenha ou não lembre</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              ref={leaderInputRef}
              type="text"
              list="leader-options"
              className="wizard-input-lg"
              placeholder="Nome do líder (ou pule)..."
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
            />
            <datalist id="leader-options">{leaders.map(item => <option key={item.id} value={item.name} />)}</datalist>
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>

            <button
              type="submit"
              className="btn-next-action"
            >
              <span>{leader.trim() ? 'Continuar' : 'Deixar em branco'}</span>
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            type="button"
            className="btn-skip-action"
            onClick={handleSkipLeader}
          >
            <FastForward size={16} style={{ marginRight: '6px' }} />
            <span>Pular Líder</span>
          </button>
        </form>
      )}

      {/* PASSO 6: WHATSAPP */}
      {step === 6 && (
        <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <Phone size={15} />
              <span>WhatsApp</span>
            </div>
            <h2 className="step-title">{who('Qual o seu WhatsApp?', 'Qual é o SEU WhatsApp?')}</h2>
            <p className="step-subtitle">{phoneRequired
              ? who('Obrigatório: o código de confirmação do Pix chega neste WhatsApp', 'De quem está fazendo a inscrição e pagando: o código de confirmação do Pix chega aqui')
              : 'Opcional para avisos e envio de comprovante'}</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              type="tel"
              inputMode="numeric"
              maxLength={15}
              className="wizard-input-lg"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
            />
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>

            <button
              type="submit"
              className="btn-next-action"
              disabled={phoneRequired && !phoneValid}
            >
              <span>{phone.trim() || phoneRequired ? 'Continuar' : 'Pular sem telefone'}</span>
              <ChevronRight size={20} />
            </button>
          </div>

          {!phoneRequired && <button
            type="button"
            className="btn-skip-action"
            onClick={handleSkipPhone}
          >
            <FastForward size={16} style={{ marginRight: '6px' }} />
            <span>Pular sem telefone</span>
          </button>}
        </form>
      )}

      {/* PASSO 7: FORMA DE PAGAMENTO */}
      {step === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <CreditCard size={15} />
              <span>Finalizar Inscrição</span>
            </div>
            <h2 className="step-title">Forma de Pagamento</h2>
            <p className="step-subtitle">Toque na opção desejada</p>
          </div>

          <div className="options-grid">
            {PAYMENT_OPTIONS.filter(opt => !publicMode || opt.id === 'PIX').map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="option-card-btn"
                style={{ minHeight: '66px' }}
                onClick={() => handleSelectPayment(opt.id)}
                disabled={isSubmitting}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="option-card-icon">{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{opt.subtitle}</div>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--primary)' }} />
              </button>
            ))}
          </div>

          {isSubmitting && (
            <div style={{ textAlign: 'center', color: '#a5b4fc', padding: '8px', fontSize: '0.95rem' }}>
              Gravando no Supabase...
            </div>
          )}

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep} disabled={isSubmitting}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
