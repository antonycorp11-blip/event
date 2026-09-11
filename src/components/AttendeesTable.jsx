import React from 'react';
import { User, Phone, Trash2, Check, Clock } from 'lucide-react';
import { formatDateBR, calculateAge } from '../lib/exportUtils';

export const AttendeesTable = ({
  registrations = [],
  onDeleteRegistration,
  onToggleStatus
}) => {
  if (registrations.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
        <User size={42} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px' }}>
          Nenhum inscrito encontrado
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Tente alterar ou limpar os filtros de pesquisa para visualizar outros participantes.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Visualização em Tabela para Desktop / Tablets */}
      <div className="table-container desktop-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Data Nasc. / Idade</th>
              <th>Rede</th>
              <th>Discipulador</th>
              <th>Líder</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((item, idx) => {
              const isPaid = item.payment_status === 'Confirmado' || item.payment_status === 'Pago';
              return (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{item.name}</div>
                    {item.phone && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Phone size={12} />
                        {item.phone}
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{formatDateBR(item.birth_date)}</div>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {calculateAge(item.birth_date)}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-network">{item.network}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{item.discipler}</td>
                  <td>
                    {item.leader ? (
                      <span style={{ color: '#e2e8f0' }}>{item.leader}</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        (Em branco)
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-payment">{item.payment_method}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(item.id, isPaid ? 'Pendente' : 'Confirmado')}
                      className={`badge ${isPaid ? 'badge-status-confirmado' : 'badge-status-pendente'}`}
                      style={{ cursor: 'pointer', border: 'none' }}
                      title="Clique para alternar o status do pagamento"
                    >
                      {isPaid ? <Check size={12} /> : <Clock size={12} />}
                      <span>{item.payment_status || 'Pendente'}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remover a inscrição de ${item.name}?`)) {
                          onDeleteRegistration(item.id);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px'
                      }}
                      title="Excluir inscrição"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visualização em Cartões Otimizados para Celular (Mobile) */}
      <div className="mobile-attendees-list">
        {registrations.map((item, idx) => {
          const isPaid = item.payment_status === 'Confirmado' || item.payment_status === 'Pago';
          return (
            <div key={item.id} className="attendee-card">
              <div className="attendee-card-top">
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                    #{idx + 1} • {item.event_name || 'Evento'}
                  </div>
                  <div className="attendee-card-title">{item.name}</div>
                  {item.phone && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Phone size={12} />
                      {item.phone}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remover a inscrição de ${item.name}?`)) {
                      onDeleteRegistration(item.id);
                    }
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="attendee-card-details">
                <div>
                  <span className="detail-label">Nascimento / Idade</span>
                  <span className="detail-val">
                    {formatDateBR(item.birth_date)} ({calculateAge(item.birth_date)})
                  </span>
                </div>
                <div>
                  <span className="detail-label">Rede</span>
                  <span className="badge badge-network" style={{ marginTop: '2px' }}>{item.network}</span>
                </div>
                <div>
                  <span className="detail-label">Discipulador</span>
                  <span className="detail-val">{item.discipler}</span>
                </div>
                <div>
                  <span className="detail-label">Líder</span>
                  <span className="detail-val">
                    {item.leader ? item.leader : <em style={{ color: 'var(--text-dim)' }}>(Em branco)</em>}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                <span className="badge badge-payment">{item.payment_method}</span>

                <button
                  type="button"
                  onClick={() => onToggleStatus(item.id, isPaid ? 'Pendente' : 'Confirmado')}
                  className={`badge ${isPaid ? 'badge-status-confirmado' : 'badge-status-pendente'}`}
                  style={{ cursor: 'pointer', border: 'none', padding: '5px 12px' }}
                >
                  {isPaid ? <Check size={12} /> : <Clock size={12} />}
                  <span>{item.payment_status || 'Pendente'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
