import React, { useState, useMemo } from 'react';
import { FilterBar } from './FilterBar';
import { AttendeesTable } from './AttendeesTable';
import { FileSpreadsheet, FileText, Users, CheckCircle, Clock, PieChart } from 'lucide-react';
import { exportToExcel, exportToCSV } from '../lib/exportUtils';

export const AdminDashboard = ({
  registrations = [],
  events = [],
  networks = [],
  disciplers = [],
  onDeleteRegistration,
  onToggleStatus
}) => {
  const [filters, setFilters] = useState({
    search: '',
    eventId: '',
    network: '',
    discipler: '',
    leader: '',
    paymentMethod: '',
    paymentStatus: ''
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      eventId: '',
      network: '',
      discipler: '',
      leader: '',
      paymentMethod: '',
      paymentStatus: ''
    });
  };

  // Filtragem combinada de todos os campos
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((item) => {
      // 1. Busca textual (nome ou telefone)
      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(query);
        const matchPhone = item.phone?.toLowerCase().includes(query);
        if (!matchName && !matchPhone) return false;
      }

      // 2. Filtro de Evento
      if (filters.eventId && item.event_id !== filters.eventId) {
        return false;
      }

      // 3. Filtro de Rede
      if (filters.network && item.network !== filters.network) {
        return false;
      }

      // 4. Filtro de Discipulador
      if (filters.discipler && item.discipler !== filters.discipler) {
        return false;
      }

      // 5. Filtro de Líder
      if (filters.leader) {
        if (filters.leader === '__blank__') {
          if (item.leader && item.leader.trim().length > 0) return false;
        } else if (item.leader?.toLowerCase().trim() !== filters.leader.toLowerCase().trim()) {
          return false;
        }
      }

      // 6. Filtro de Forma de Pagamento
      if (filters.paymentMethod && item.payment_method !== filters.paymentMethod) {
        return false;
      }

      // 7. Filtro de Status de Pagamento
      if (filters.paymentStatus) {
        const itemStatus = item.payment_status || 'Pendente';
        if (filters.paymentStatus === 'Confirmado') {
          if (itemStatus !== 'Confirmado' && itemStatus !== 'Pago') return false;
        } else if (itemStatus !== filters.paymentStatus) {
          return false;
        }
      }

      return true;
    });
  }, [registrations, filters]);

  // Métricas
  const stats = useMemo(() => {
    const total = registrations.length;
    const confirmed = registrations.filter(
      (r) => r.payment_status === 'Confirmado' || r.payment_status === 'Pago'
    ).length;
    const pending = total - confirmed;

    // Rede com mais inscritos
    const networkCounts = {};
    registrations.forEach((r) => {
      if (r.network) {
        networkCounts[r.network] = (networkCounts[r.network] || 0) + 1;
      }
    });

    let topNetwork = '-';
    let maxCount = 0;
    Object.entries(networkCounts).forEach(([net, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topNetwork = `${net} (${count})`;
      }
    });

    return { total, confirmed, pending, topNetwork };
  }, [registrations]);

  // Identificador legível para o nome do arquivo exportado
  const exportLabel = useMemo(() => {
    const parts = [];
    if (filters.network) parts.push(filters.network);
    if (filters.paymentMethod) parts.push(filters.paymentMethod);
    if (filters.leader) parts.push(filters.leader === '__blank__' ? 'SemLider' : filters.leader);
    return parts.length > 0 ? parts.join('_') : 'Todos';
  }, [filters]);

  const handleExportExcel = () => {
    exportToExcel(filteredRegistrations, exportLabel);
  };

  const handleExportCSV = () => {
    exportToCSV(filteredRegistrations, exportLabel);
  };

  return (
    <div>
      {/* Cards de Métricas */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-title">Total de Inscritos</span>
          <span className="stat-number">{stats.total}</span>
        </div>

        <div className="stat-card">
          <span className="stat-title">Confirmados / Pagos</span>
          <span className="stat-number" style={{ color: '#34d399' }}>
            {stats.confirmed}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-title">Pendentes</span>
          <span className="stat-number" style={{ color: '#fbbf24' }}>
            {stats.pending}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-title">Maior Rede</span>
          <span className="stat-number" style={{ fontSize: '1.25rem', color: '#a5b4fc', marginTop: '4px' }}>
            {stats.topNetwork}
          </span>
        </div>
      </div>

      {/* Barra de Ações & Extração */}
      <div className="actions-bar">
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Mostrando <strong style={{ color: '#fff' }}>{filteredRegistrations.length}</strong> de{' '}
          <strong>{registrations.length}</strong> inscritos
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary btn-export-excel"
            onClick={handleExportExcel}
            title="Exportar lista filtrada para planilha Excel"
          >
            <FileSpreadsheet size={18} />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            className="btn-secondary btn-export-csv"
            onClick={handleExportCSV}
            title="Exportar lista filtrada para CSV"
          >
            <FileText size={18} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        events={events}
        networks={networks}
        disciplers={disciplers}
        registrations={registrations}
      />

      {/* Tabela de Inscritos */}
      <AttendeesTable
        registrations={filteredRegistrations}
        onDeleteRegistration={onDeleteRegistration}
        onToggleStatus={onToggleStatus}
      />
    </div>
  );
};
