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
  Check
} from 'lucide-react';
import { calculateAge } from '../lib/exportUtils';
import confetti from 'canvas-confetti';

const TOTAL_STEPS = 7;

const PAYMENT_OPTIONS = [
  { id: 'PIX', label: 'PIX', icon: '⚡', subtitle: 'Pagamento instantâneo' },
  { id: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: '💳', subtitle: 'À vista ou parcelado' },
  { id: 'Cartão de Débito', label: 'Cartão de Débito', icon: '💳', subtitle: 'Débito em conta' },
  { id: 'Dinheiro', label: 'Dinheiro', icon: '💵', subtitle: 'Pagamento em espécie' }
];

export const RegistrationForm = ({
  events = [],
  networks = [],
  disciplers = [],
  onSubmit
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [network, setNetwork] = useState('');
  const [discipler, setDiscipler] = useState('');
  const [leader, setLeader] = useState(''); // Livre / pode ficar em branco
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRegistered, setLastRegistered] = useState(null);

  const nameInputRef = useRef(null);
  const leaderInputRef = useRef(null);

  // Evento ativo
  const activeEvent = useMemo(() => {
    return events[0] || {
      name: 'Conferência do Reino 2026',
      price: 80.00
    };
  }, [events]);

  const calculatedAge = useMemo(() => {
    return calculateAge(birthDate);
  }, [birthDate]);

  // Focar automaticamente no input de nome ao iniciar
  useEffect(() => {
    if (step === 1 && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [step]);

  // Avançar passo
  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  // Voltar passo
  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // 1. Passo Nome
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    nextStep();
  };

  // 2. Passo Nascimento
  const handleBirthDateSubmit = (e) => {
    e.preventDefault();
    if (!birthDate) return;
    nextStep();
  };

  // 3. Passo Rede (1 toque avança direto!)
  const handleSelectNetwork = (selectedNet) => {
    setNetwork(selectedNet);
    setTimeout(() => {
      setStep(4);
    }, 180);
  };

  // 4. Passo Discipulador (1 toque avança direto!)
  const handleSelectDiscipler = (selectedDisc) => {
    setDiscipler(selectedDisc);
    setTimeout(() => {
      setStep(5);
    }, 180);
  };

  // 5. Passo Líder
  const handleLeaderSubmit = (e) => {
    if (e) e.preventDefault();
    nextStep();
  };

  const handleSkipLeader = () => {
    setLeader('');
    nextStep();
  };

  // 6. Passo WhatsApp
  const handlePhoneSubmit = (e) => {
    if (e) e.preventDefault();
    nextStep();
  };

  const handleSkipPhone = () => {
    setPhone('');
    nextStep();
  };

  // 7. Passo Pagamento & Finalização (1 toque conclui!)
  const handleSelectPaymentAndSubmit = async (selectedPayment) => {
    setPaymentMethod(selectedPayment);
    setIsSubmitting(true);

    const regData = {
      event_id: activeEvent.id,
      event_name: activeEvent.name,
      name: name.trim(),
      birth_date: birthDate,
      network,
      discipler,
      leader: leader.trim(), // string vazia se pulado
      payment_method: selectedPayment,
      payment_status: 'Pendente',
      phone: phone.trim()
    };

    try {
      const result = await onSubmit(regData);
      setLastRegistered(result || regData);

      // Disparar confetes
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}
    } catch (err) {
      alert('Erro ao gravar inscrição: ' + (err.message || 'tente novamente.'));
      setIsSubmitting(false);
    }
  };

  // Resetar para o próximo atendimento relâmpago
  const handleStartNextPerson = () => {
    setName('');
    setBirthDate('');
    setNetwork('');
    setDiscipler('');
    setLeader('');
    setPhone('');
    setPaymentMethod('');
    setLastRegistered(null);
    setIsSubmitting(false);
    setStep(1);
  };

  // TELA DE SUCESSO RELÂMPAGO (Modo Quiosque)
  if (lastRegistered) {
    return (
      <div className="wizard-card">
        <div className="kiosk-success-view">
          <div className="success-icon-badge">
            <CheckCircle2 size={44} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            Inscrição Confirmada!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '22px' }}>
            {lastRegistered.name} está inscrito(a) com sucesso.
          </p>

          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px dashed var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            width: '100%',
            maxWidth: '420px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.88rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Rede:</span>
              <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{lastRegistered.network}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Discipulador:</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{lastRegistered.discipler}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Líder:</span>
              <span style={{ color: lastRegistered.leader ? '#f1f5f9' : 'var(--text-dim)' }}>
                {lastRegistered.leader || '(Em branco)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Pagamento:</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>{lastRegistered.payment_method}</span>
            </div>
          </div>

          {/* BOTÃO HERO PARA ATENDER A PRÓXIMA PESSOA DA FILA */}
          <button
            type="button"
            className="btn-next-person-hero"
            onClick={handleStartNextPerson}
          >
            <Sparkles size={22} />
            <span>⚡ Próxima Inscrição</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="wizard-card">
      {/* Barra de Progresso Superior */}
      <div className="progress-container">
        <div className="progress-header">
          <span>Passo {step} de {TOTAL_STEPS}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* ========================================================= */}
      {/* PASSO 1: NOME COMPLETO */}
      {/* ========================================================= */}
      {step === 1 && (
        <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <User size={16} />
              <span>Identificação</span>
            </div>
            <h2 className="step-title">Qual é o seu nome completo?</h2>
            <p className="step-subtitle">Digite o nome e sobrenome do participante</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              ref={nameInputRef}
              type="text"
              className="wizard-input-lg"
              placeholder="Ex: Lucas Gabriel Oliveira"
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

      {/* ========================================================= */}
      {/* PASSO 2: DATA DE NASCIMENTO */}
      {/* ========================================================= */}
      {step === 2 && (
        <form onSubmit={handleBirthDateSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <Calendar size={16} />
              <span>Idade</span>
            </div>
            <h2 className="step-title">Qual sua data de nascimento?</h2>
            <p className="step-subtitle">Para organizarmos as salas e faixas etárias</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              type="date"
              className="wizard-input-lg"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />

            {birthDate && (
              <div style={{
                marginTop: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                color: '#c7d2fe',
                fontSize: '0.92rem',
                fontWeight: 600,
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
              disabled={!birthDate}
            >
              <span>Continuar</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PASSO 3: REDE (1 toque avança!) */}
      {/* ========================================================= */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <Users size={16} />
              <span>Comunidade</span>
            </div>
            <h2 className="step-title">Qual é a sua Rede?</h2>
            <p className="step-subtitle">Toque na sua rede para avançar</p>
          </div>

          <div className="options-grid">
            {networks.map((net) => {
              const isSelected = network === net.name;
              return (
                <button
                  key={net.id}
                  type="button"
                  className={`option-card-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectNetwork(net.name)}
                >
                  <span className="option-card-label">
                    <span>{net.name}</span>
                  </span>
                  <div className="option-card-check">
                    {isSelected && <Check size={14} />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PASSO 4: DISCIPULADOR (1 toque avança!) */}
      {/* ========================================================= */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <HeartHandshake size={16} />
              <span>Discipulado</span>
            </div>
            <h2 className="step-title">Quem é seu Discipulador?</h2>
            <p className="step-subtitle">Selecione na lista cadastrada</p>
          </div>

          <div className="options-grid">
            {disciplers.map((disc) => {
              const isSelected = discipler === disc.name;
              return (
                <button
                  key={disc.id}
                  type="button"
                  className={`option-card-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDiscipler(disc.name)}
                >
                  <span className="option-card-label">
                    <span>{disc.name}</span>
                  </span>
                  <div className="option-card-check">
                    {isSelected && <Check size={14} />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn-back-action" onClick={prevStep}>
              <ChevronLeft size={20} />
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PASSO 5: LÍDER (Pode ficar em branco!) */}
      {/* ========================================================= */}
      {step === 5 && (
        <form onSubmit={handleLeaderSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <Shield size={16} />
              <span>Liderança Direta</span>
            </div>
            <h2 className="step-title">Quem é o seu Líder?</h2>
            <p className="step-subtitle">Pode deixar em branco caso você não tenha ou não lembre</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              ref={leaderInputRef}
              type="text"
              className="wizard-input-lg"
              placeholder="Nome do seu líder..."
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
            />

            {/* BOTÃO RÁPIDO DE PULAR / DEIXAR EM BRANCO */}
            <button
              type="button"
              className="btn-skip-action"
              onClick={handleSkipLeader}
            >
              <FastForward size={18} style={{ marginRight: '6px' }} />
              <span>Pular / Deixar em branco</span>
            </button>
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
              <span>{leader.trim() ? 'Confirmar Líder' : 'Continuar'}</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PASSO 6: WHATSAPP / CELULAR */}
      {/* ========================================================= */}
      {step === 6 && (
        <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <Phone size={16} />
              <span>Contato</span>
            </div>
            <h2 className="step-title">Qual seu WhatsApp?</h2>
            <p className="step-subtitle">Opcional para avisos e comprovante</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              type="tel"
              className="wizard-input-lg"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <button
              type="button"
              className="btn-skip-action"
              onClick={handleSkipPhone}
            >
              <FastForward size={18} style={{ marginRight: '6px' }} />
              <span>Pular sem telefone</span>
            </button>
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
              <span>Continuar</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* PASSO 7: FORMA DE PAGAMENTO (1 toque conclui a inscrição!) */}
      {/* ========================================================= */}
      {step === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="step-header">
            <div className="step-label">
              <CreditCard size={16} />
              <span>Finalização</span>
            </div>
            <h2 className="step-title">Forma de Pagamento</h2>
            <p className="step-subtitle">Toque na opção desejada para concluir a inscrição</p>
          </div>

          <div className="options-grid">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="option-card-btn"
                style={{ minHeight: '68px' }}
                onClick={() => handleSelectPaymentAndSubmit(opt.id)}
                disabled={isSubmitting}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="option-card-icon">{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{opt.subtitle}</div>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--primary)' }} />
              </button>
            ))}
          </div>

          {isSubmitting && (
            <div style={{ textAlign: 'center', color: '#a5b4fc', padding: '10px', fontSize: '0.95rem' }}>
              Gravando inscrição no Supabase...
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
