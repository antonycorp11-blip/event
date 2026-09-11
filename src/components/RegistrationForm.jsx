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
  const [birthDate, setBirthDate] = useState(''); // Armazenado como DD/MM/AAAA
  const [network, setNetwork] = useState('');
  const [discipler, setDiscipler] = useState('');
  const [leader, setLeader] = useState(''); // Livre / pode ficar em branco
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRegistered, setLastRegistered] = useState(null);

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
    return true;
  }, [birthDate]);

  // Focar no input correto ao mudar de passo
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
    const raw = e.target.value.replace(/\D/g, ''); // apenas números
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
    setTimeout(() => {
      setStep(4);
    }, 180);
  };

  // 4. Discipulador (1 toque avança!)
  const handleSelectDiscipler = (selectedDisc) => {
    setDiscipler(selectedDisc);
    setTimeout(() => {
      setStep(5);
    }, 180);
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
  const handlePhoneSubmit = (e) => {
    if (e) e.preventDefault();
    nextStep();
  };

  const handleSkipPhone = () => {
    setPhone('');
    nextStep();
  };

  // 7. Pagamento & Finalização
  const handleSelectPaymentAndSubmit = async (selectedPayment) => {
    setPaymentMethod(selectedPayment);
    setIsSubmitting(true);

    // Formatar data para YYYY-MM-DD para o Postgres
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
      leader: leader.trim(), // fica em branco se não informado
      payment_method: selectedPayment,
      payment_status: 'Pendente',
      phone: phone.trim()
    };

    try {
      const result = await onSubmit(regData);
      setLastRegistered(result || regData);

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

  // Reset para atender próximo da fila
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

  // TELA DE SUCESSO RELÂMPAGO
  if (lastRegistered) {
    return (
      <div className="wizard-card">
        <div className="kiosk-success-view">
          <div className="success-icon-badge">
            <CheckCircle2 size={42} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Inscrição Confirmada!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '18px' }}>
            {lastRegistered.name} salvo(a) no banco de dados.
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

          <button
            type="button"
            className="btn-next-person-hero"
            onClick={handleStartNextPerson}
          >
            <Sparkles size={20} />
            <span>⚡ Próxima Inscrição</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="wizard-card">
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
            <h2 className="step-title">Qual é o seu nome completo?</h2>
            <p className="step-subtitle">Digite o nome e sobrenome do participante</p>
          </div>

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

      {/* PASSO 2: DATA DE NASCIMENTO (DIGITADA DIRETO) */}
      {step === 2 && (
        <form onSubmit={handleBirthDateSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <Calendar size={15} />
              <span>Data de Nascimento</span>
            </div>
            <h2 className="step-title">Qual sua data de nascimento?</h2>
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
            <h2 className="step-title">Qual é a sua Rede?</h2>
            <p className="step-subtitle">Toque na opção para avançar</p>
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
                  <span className="option-card-label">{net.name}</span>
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

      {/* PASSO 4: DISCIPULADOR */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <HeartHandshake size={15} />
              <span>Discipulado</span>
            </div>
            <h2 className="step-title">Quem é seu Discipulador?</h2>
            <p className="step-subtitle">Toque no nome para avançar</p>
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
                  <span className="option-card-label">{disc.name}</span>
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

      {/* PASSO 5: LÍDER */}
      {step === 5 && (
        <form onSubmit={handleLeaderSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <Shield size={15} />
              <span>Liderança</span>
            </div>
            <h2 className="step-title">Quem é o seu Líder?</h2>
            <p className="step-subtitle">Pode deixar em branco caso não tenha ou não lembre</p>
          </div>

          <div className="wizard-input-wrap">
            <input
              ref={leaderInputRef}
              type="text"
              className="wizard-input-lg"
              placeholder="Nome do líder (ou pule)..."
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
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
            >
              <span>{leader.trim() ? 'Continuar' : 'Deixar em branco'}</span>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Atalho direto de pular */}
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
            <h2 className="step-title">Qual o seu WhatsApp?</h2>
            <p className="step-subtitle">Opcional para avisos e envio de comprovante</p>
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
            >
              <span>{phone.trim() ? 'Continuar' : 'Pular sem telefone'}</span>
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            type="button"
            className="btn-skip-action"
            onClick={handleSkipPhone}
          >
            <FastForward size={16} style={{ marginRight: '6px' }} />
            <span>Pular sem telefone</span>
          </button>
        </form>
      )}

      {/* PASSO 7: FORMA DE PAGAMENTO */}
      {step === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="step-header">
            <div className="step-label">
              <CreditCard size={15} />
              <span>Finalizar</span>
            </div>
            <h2 className="step-title">Forma de Pagamento</h2>
            <p className="step-subtitle">Toque na opção para concluir a inscrição</p>
          </div>

          <div className="options-grid">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="option-card-btn"
                style={{ minHeight: '66px' }}
                onClick={() => handleSelectPaymentAndSubmit(opt.id)}
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
