import React, { useState } from 'react';
import { Calendar, Plus, X, MapPin, DollarSign } from 'lucide-react';

export const EventManagerModal = ({ isOpen, onClose, events = [], onAddEvent }) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddEvent({
        name: name.trim(),
        date: date.trim(),
        location: location.trim(),
        price: parseFloat(price) || 0,
        active: true
      });
      setName('');
      setDate('');
      setLocation('');
      setPrice('');
      onClose();
    } catch (err) {
      alert('Erro ao cadastrar evento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.2)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                Gerenciar Eventos
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Crie novos eventos para inscrições
              </span>
            </div>
          </div>

          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Formulário de Novo Evento */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Nome do Evento *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Retiro de Jovens 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Data do Evento</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 15 a 17 de Outubro"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="Ex: 120.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Local</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Sítio Vale Encantado / Auditório"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{ marginTop: '6px' }}
          >
            <Plus size={18} />
            <span>Cadastrar Evento</span>
          </button>
        </form>

        {/* Lista de Eventos Existentes */}
        <div>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Eventos Ativos ({events.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {events.map((evt) => (
              <div
                key={evt.id}
                style={{
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.92rem' }}>{evt.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                    {evt.date || 'Sem data definida'} {evt.location ? `• ${evt.location}` : ''}
                  </div>
                </div>
                <span className="badge badge-payment">
                  {Number(evt.price) > 0 ? `R$ ${Number(evt.price).toFixed(2)}` : 'Gratuito'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
