import React from 'react';
import { Calendar, Settings, Flame } from 'lucide-react';

export const Header = ({
  event,
  attendeeCount,
  onOpenAdmin
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

      {/* Botão de Admin no Canto */}
      <button
        type="button"
        className="btn-admin-pill"
        onClick={onOpenAdmin}
        title="Painel de Administração (Listas, Filtros, Exportação)"
      >
        <Settings size={15} />
        <span>Admin</span>
      </button>
    </header>
  );
};
