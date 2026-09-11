import React from 'react';
import { CheckCircle2, Calendar, User, Users, HeartHandshake, CreditCard, X } from 'lucide-react';
import { formatDateBR, calculateAge } from '../lib/exportUtils';

export const SuccessModal = ({ registration, onClose, onViewAttendees }) => {
  if (!registration) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }}>
          <CheckCircle2 size={36} />
        </div>

        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
          Inscrição Confirmada!
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Sua presença foi registrada com sucesso no sistema.
        </p>

        {/* Cartão de comprovante / resumo */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px dashed var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Evento</span>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{registration.event_name}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Inscrito</span>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>{registration.name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Idade</span>
              <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{calculateAge(registration.birth_date)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Rede</span>
              <div style={{ color: '#a5b4fc', fontWeight: 600, fontSize: '0.9rem' }}>{registration.network}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Discipulador</span>
              <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{registration.discipler}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Líder</span>
              <div style={{ color: registration.leader ? '#e2e8f0' : 'var(--text-dim)', fontSize: '0.9rem' }}>
                {registration.leader ? registration.leader : '(Em branco)'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Pagamento</span>
              <div style={{ color: '#67e8f9', fontWeight: 600, fontSize: '0.9rem' }}>{registration.payment_method}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn-primary" onClick={onClose}>
            Fazer Nova Inscrição
          </button>
          <button className="btn-secondary" style={{ justifyContent: 'center' }} onClick={onViewAttendees}>
            Ver Lista de Inscritos
          </button>
        </div>
      </div>
    </div>
  );
};
