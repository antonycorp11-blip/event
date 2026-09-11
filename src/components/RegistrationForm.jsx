import React, { useState, useMemo } from 'react';
import { Calendar, User, Users, HeartHandshake, ShieldCheck, CreditCard, Send, Sparkles, MapPin } from 'lucide-react';
import { calculateAge } from '../lib/exportUtils';
import confetti from 'canvas-confetti';

const PAYMENT_METHODS = [
  { id: 'PIX', label: 'PIX', icon: '⚡' },
  { id: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: '💳' },
  { id: 'Cartão de Débito', label: 'Cartão de Débito', icon: '💳' },
  { id: 'Dinheiro', label: 'Dinheiro', icon: '💵' }
];

export const RegistrationForm = ({
  events = [],
  networks = [],
  disciplers = [],
  onSubmit,
  onNavigateToLists
}) => {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || '');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [network, setNetwork] = useState('');
  const [leader, setLeader] = useState(''); // Líder pode ficar em branco conforme solicitado
  const [discipler, setDiscipler] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Evento selecionado
  const activeEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0] || {
      name: 'Conferência Geral 2026',
      date: 'Em breve',
      location: 'Auditório',
      price: 0
    };
  }, [events, selectedEventId]);

  // Idade calculada dinamicamente
  const calculatedAge = useMemo(() => {
    return calculateAge(birthDate);
  }, [birthDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    if (!birthDate) {
      setErrorMessage('Por favor, informe sua data de nascimento.');
      return;
    }

    if (!network) {
      setErrorMessage('Por favor, selecione sua rede.');
      return;
    }

    if (!discipler) {
      setErrorMessage('Por favor, selecione seu discipulador.');
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationData = {
        event_id: activeEvent.id,
        event_name: activeEvent.name,
        name: name.trim(),
        birth_date: birthDate,
        network,
        leader: leader.trim(), // Salva o que foi digitado ou string vazia (em branco)
        discipler,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'PIX' ? 'Pendente' : 'Pendente',
        phone: phone.trim()
      };

      await onSubmit(registrationData);

      // Disparar confetes celebratórios
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      // Limpar formulário (preservando evento)
      setName('');
      setBirthDate('');
      setNetwork('');
      setLeader('');
      setDiscipler('');
      setPhone('');
    } catch (err) {
      setErrorMessage(err.message || 'Erro ao realizar inscrição.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <div className="form-header">
        <h2>Inscrição para Evento</h2>
        <p>Preencha os dados abaixo para confirmar sua presença</p>
      </div>

      {/* Seleção do Evento Ativo */}
      <div style={{ marginBottom: '22px' }}>
        <label className="form-label" style={{ marginBottom: '8px' }}>
          <span>Evento Selecionado</span>
          {events.length > 1 && <span className="label-hint">Toque para alterar</span>}
        </label>
        
        {events.length > 1 ? (
          <select
            className="form-select"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{ marginBottom: '10px' }}
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} {evt.date ? `(${evt.date})` : ''}
              </option>
            ))}
          </select>
        ) : null}

        <div className="event-selector-card">
          <div className="event-details">
            <h3>{activeEvent.name}</h3>
            <p>
              {activeEvent.date && (
                <span>
                  <Calendar size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {activeEvent.date}
                </span>
              )}
              {activeEvent.location && (
                <span>
                  <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {activeEvent.location}
                </span>
              )}
            </p>
          </div>
          {Number(activeEvent.price) > 0 ? (
            <div className="event-price-badge">
              R$ {Number(activeEvent.price).toFixed(2).replace('.', ',')}
            </div>
          ) : (
            <div className="event-price-badge" style={{ color: '#6ee7b7' }}>Gratuito</div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '0.88rem'
        }}>
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-section">
        {/* 1. Nome Completo */}
        <div className="form-group">
          <label className="form-label">
            <span>Nome Completo *</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Ex: João da Silva Santos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        {/* 2. Data de Nascimento & Idade */}
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">
              <span>Data de Nascimento *</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">
              <span>Idade</span>
              <span className="label-hint">Cálculo automático</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={calculatedAge}
              readOnly
              style={{ opacity: 0.8, cursor: 'default' }}
            />
          </div>
        </div>

        {/* 3. Rede (Cadastrada pelo usuário) */}
        <div className="form-group">
          <div className="form-label">
            <span>Sua Rede *</span>
            {networks.length === 0 && (
              <button
                type="button"
                onClick={onNavigateToLists}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                + Cadastrar Redes
              </button>
            )}
          </div>
          <select
            className="form-select"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            required
          >
            <option value="">Selecione sua rede...</option>
            {networks.map((net) => (
              <option key={net.id} value={net.name}>
                {net.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Discipulador (Cadastrado pelo usuário) */}
        <div className="form-group">
          <div className="form-label">
            <span>Seu Discipulador *</span>
            {disciplers.length === 0 && (
              <button
                type="button"
                onClick={onNavigateToLists}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                + Cadastrar Discipuladores
              </button>
            )}
          </div>
          <select
            className="form-select"
            value={discipler}
            onChange={(e) => setDiscipler(e.target.value)}
            required
          >
            <option value="">Selecione seu discipulador...</option>
            {disciplers.map((disc) => (
              <option key={disc.id} value={disc.name}>
                {disc.name}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Líder (Fica em branco conforme solicitado pelo usuário) */}
        <div className="form-group">
          <label className="form-label">
            <span>Líder</span>
            <span className="label-hint">Pode ficar em branco</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Nome do seu líder (ou deixe em branco)"
            value={leader}
            onChange={(e) => setLeader(e.target.value)}
          />
        </div>

        {/* 6. Telefone / WhatsApp */}
        <div className="form-group">
          <label className="form-label">
            <span>WhatsApp / Celular</span>
            <span className="label-hint">Opcional para avisos</span>
          </label>
          <input
            type="tel"
            className="form-input"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {/* 7. Forma de Pagamento */}
        <div className="form-group">
          <label className="form-label">
            <span>Forma de Pagamento *</span>
          </label>
          <div className="chips-grid">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  className={`chip-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <span>{method.icon}</span>
                  <span>{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Botão de Envio */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span>Processando Inscrição...</span>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Confirmar Minha Inscrição</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
