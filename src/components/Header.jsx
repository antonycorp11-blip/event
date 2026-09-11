import React from 'react';
import { Calendar, Settings, Flame, RefreshCw } from 'lucide-react';

export const Header = ({
  event,
  attendeeCount,
  onOpenAdmin,
  onRefresh,
  isRefreshing
}) => {
  const activeEvent = event || { name: 'Conferência 2026', price: 0 };
  const priceFormatted = Number(activeEvent.price) > 0 
    ? `R$ ${Number(activeEvent.price).toFixed(2).replace('.', ',')}` 
    : 'Gratuito';

  return (
    <header className="kiosk-header">
      {/* Informações do Evento em Atendimento */}
      <div className="event-info-pill">
        <div className="event-title-line" title={activeEvent.name}>
          {activeEvent.name}
        </div>
        <div className="event-meta-line">
          <span className="price-pill">{priceFormatted}</span>
          <span className="counter-pill">
            <Flame size={12} style={{ color: '#f59e0b' }} />
            <span>{attendeeCount} {attendeeCount === 1 ? 'inscrito' : 'inscritos'}</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Botão de Atualizar em Tempo Real (Essencial para PWA iPhone) */}
        <button
          type="button"
          className="btn-refresh-pill"
          onClick={onRefresh}
          title="Atualizar dados em tempo real"
          disabled={isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
          <span>{isRefreshing ? '...' : 'Atualizar'}</span>
        </button>

        {/* Botão de Admin */}
        <button
          type="button"
          className="btn-admin-pill"
          onClick={onOpenAdmin}
          title="Painel de Administração (Listas, Filtros, Exportação)"
        >
          <Settings size={15} />
          <span>Admin</span>
        </button>
      </div>
    </header>
  );
};
