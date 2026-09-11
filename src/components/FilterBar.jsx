import React, { useMemo } from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';

export const FilterBar = ({
  filters,
  onFilterChange,
  onClearFilters,
  events = [],
  networks = [],
  disciplers = [],
  registrations = []
}) => {
  // Coletar líderes existentes na lista de inscritos para permitir filtro
  const uniqueLeaders = useMemo(() => {
    const set = new Set();
    registrations.forEach((r) => {
      if (r.leader && r.leader.trim()) {
        set.add(r.leader.trim());
      }
    });
    return Array.from(set).sort();
  }, [registrations]);

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.eventId ||
    filters.network ||
    filters.discipler ||
    filters.leader ||
    filters.paymentMethod ||
    filters.paymentStatus
  );

  return (
    <div className="glass-card" style={{ padding: '18px 20px', marginBottom: '20px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
          <Filter size={18} style={{ color: 'var(--primary)' }} />
          <span>Filtros de Pesquisa & Extração</span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="icon-btn"
            onClick={onClearFilters}
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <RotateCcw size={14} />
            <span>Limpar Filtros</span>
          </button>
        )}
      </div>

      {/* Barra de Busca Principal */}
      <div className="filter-search-box" style={{ marginBottom: '12px' }}>
        <Search size={18} className="filter-search-icon" />
        <input
          type="text"
          className="filter-search-input"
          placeholder="Buscar por nome do inscrito ou telefone..."
          value={filters.search || ''}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>

      {/* Grid de Filtros */}
      <div className="filter-grid">
        {/* Filtro por Evento */}
        <select
          className="form-select"
          value={filters.eventId || ''}
          onChange={(e) => onFilterChange('eventId', e.target.value)}
          style={{ fontSize: '0.84rem', minHeight: '40px', padding: '8px 12px' }}
        >
          <option value="">Todos os Eventos</option>
          {events.map((evt) => (
            <option key={evt.id} value={evt.id}>
              {evt.name}
            </option>
          ))}
        </select>

        {/* Filtro por Rede */}
        <select
          className="form-select"
          value={filters.network || ''}
          onChange={(e) => onFilterChange('network', e.target.value)}
          style={{ fontSize: '0.84rem', minHeight: '40px', padding: '8px 12px' }}
        >
          <option value="">Todas as Redes</option>
          {networks.map((net) => (
            <option key={net.id} value={net.name}>
              Rede {net.name}
            </option>
          ))}
        </select>

        {/* Filtro por Discipulador */}
        <select
          className="form-select"
          value={filters.discipler || ''}
          onChange={(e) => onFilterChange('discipler', e.target.value)}
          style={{ fontSize: '0.84rem', minHeight: '40px', padding: '8px 12px' }}
        >
          <option value="">Todos os Discipuladores</option>
          {disciplers.map((disc) => (
            <option key={disc.id} value={disc.name}>
              {disc.name}
            </option>
          ))}
        </select>

        {/* Filtro por Líder */}
        <select
          className="form-select"
          value={filters.leader || ''}
          onChange={(e) => onFilterChange('leader', e.target.value)}
          style={{ fontSize: '0.84rem', minHeight: '40px', padding: '8px 12px' }}
        >
          <option value="">Todos os Líderes</option>
          <option value="__blank__">Sem Líder (Em branco)</option>
          {uniqueLeaders.map((lead) => (
            <option key={lead} value={lead}>
              Líder {lead}
            </option>
          ))}
        </select>

        {/* Filtro por Forma de Pagamento */}
        <select
          className="form-select"
          value={filters.paymentMethod || ''}
          onChange={(e) => onFilterChange('paymentMethod', e.target.value)}
          style={{ fontSize: '0.84rem', minHeight: '40px', padding: '8px 12px' }}
        >
          <option value="">Todas Formas de Pgto</option>
          <option value="PIX">PIX</option>
          <option value="Cartão de Crédito">Cartão de Crédito</option>
          <option value="Cartão de Débito">Cartão de Débito</option>
          <option value="Dinheiro">Dinheiro</option>
        </select>

        {/* Filtro por Status do Pagamento */}
        <select
          className="form-select"
          value={filters.paymentStatus || ''}
          onChange={(e) => onFilterChange('paymentStatus', e.target.value)}
          style={{ fontSize: '0.84rem', minHeight: '40px', padding: '8px 12px' }}
        >
          <option value="">Todos os Status</option>
          <option value="Confirmado">Confirmado / Pago</option>
          <option value="Pendente">Pendente</option>
        </select>
      </div>
    </div>
  );
};
