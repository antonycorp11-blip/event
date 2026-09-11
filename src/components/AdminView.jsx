import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Calendar,
  Settings,
  Database,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Trash2,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Save,
  Phone,
  Plus,
  CloudUpload
} from 'lucide-react';
import { exportToExcel, exportToCSV, formatDateBR, calculateAge } from '../lib/exportUtils';
import { ListsManager } from './ListsManager';
import { syncLocalToCloud } from '../lib/supabase';

export const AdminView = ({
  onBack,
  registrations = [],
  events = [],
  networks = [],
  disciplers = [],
  onDeleteRegistration,
  onToggleStatus,
  onAddNetwork,
  onDeleteNetwork,
  onAddDiscipler,
  onDeleteDiscipler,
  onAddEvent,
  isSupabaseConnected
}) => {
  const [activeTab, setActiveTab] = useState('attendees'); // 'attendees' | 'event' | 'lists' | 'database'
  const [showFilters, setShowFilters] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    search: '',
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
      network: '',
      discipler: '',
      leader: '',
      paymentMethod: '',
      paymentStatus: ''
    });
  };

  // Coletar líderes existentes na lista
  const uniqueLeaders = useMemo(() => {
    const set = new Set();
    registrations.forEach((r) => {
      if (r.leader && r.leader.trim()) {
        set.add(r.leader.trim());
      }
    });
    return Array.from(set).sort();
  }, [registrations]);

  // Filtragem
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((item) => {
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchPhone = item.phone?.toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }
      if (filters.network && item.network !== filters.network) return false;
      if (filters.discipler && item.discipler !== filters.discipler) return false;
      if (filters.leader) {
        if (filters.leader === '__blank__') {
          if (item.leader && item.leader.trim().length > 0) return false;
        } else if (item.leader?.toLowerCase().trim() !== filters.leader.toLowerCase().trim()) {
          return false;
        }
      }
      if (filters.paymentMethod && item.payment_method !== filters.paymentMethod) return false;
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
    return { total, confirmed, pending };
  }, [registrations]);

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.network ||
    filters.discipler ||
    filters.leader ||
    filters.paymentMethod ||
    filters.paymentStatus
  );

  // Estado edição do evento
  const currentEvent = events[0] || { name: '', price: 0, date: '', location: '' };
  const [eventName, setEventName] = useState(currentEvent.name || '');
  const [eventPrice, setEventPrice] = useState(currentEvent.price || 0);
  const [eventDate, setEventDate] = useState(currentEvent.date || '');
  const [eventLocation, setEventLocation] = useState(currentEvent.location || '');
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncLocal = async () => {
    setIsSyncing(true);
    try {
      const count = await syncLocalToCloud();
      if (count > 0) {
        alert(`${count} item(ns) deste aparelho foram salvos na nuvem do Supabase!`);
        window.location.reload();
      } else {
        alert('Este aparelho já está 100% sincronizado com a nuvem do Supabase.');
      }
    } catch (err) {
      alert('Erro ao sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setIsSavingEvent(true);
    try {
      await onAddEvent({
        id: currentEvent.id,
        name: eventName.trim(),
        price: parseFloat(eventPrice) || 0,
        date: eventDate.trim(),
        location: eventLocation.trim(),
        active: true
      });
      alert('Evento e valor salvos com sucesso!');
    } catch (err) {
      alert('Erro ao salvar evento.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Topo com botão de voltar para o modo quiosque de atendimento */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--primary-gradient)',
            border: 'none',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}
        >
          <ArrowLeft size={18} />
          <span>Voltar ao Atendimento</span>
        </button>

        <button
          type="button"
          onClick={handleSyncLocal}
          disabled={isSyncing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-glass)',
            color: '#c7d2fe',
            padding: '8px 12px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: 'pointer'
          }}
          title="Salvar na nuvem o que foi digitado neste celular"
        >
          <CloudUpload size={14} />
          <span>{isSyncing ? 'Sincronizando...' : 'Recuperar Dados deste Celular'}</span>
        </button>
      </div>

      {/* Abas Horizontais Limpas */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        scrollbarWidth: 'none'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('attendees')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'attendees' ? 'var(--primary)' : 'var(--border-subtle)',
            background: activeTab === 'attendees' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.7)',
            color: activeTab === 'attendees' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={16} />
          <span>Inscritos ({registrations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('event')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'event' ? 'var(--primary)' : 'var(--border-subtle)',
            background: activeTab === 'event' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.7)',
            color: activeTab === 'event' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Calendar size={16} />
          <span>Evento & Valor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lists')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'lists' ? 'var(--primary)' : 'var(--border-subtle)',
            background: activeTab === 'lists' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.7)',
            color: activeTab === 'lists' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Settings size={16} />
          <span>Redes & Discipuladores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('database')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'database' ? 'var(--primary)' : 'var(--border-subtle)',
            background: activeTab === 'database' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.7)',
            color: activeTab === 'database' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Database size={16} />
          <span>Supabase {isSupabaseConnected ? '🟢' : '🟡'}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: LISTA DE INSCRITOS & EXTRAÇÃO                      */}
      {/* ========================================================= */}
      {activeTab === 'attendees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Linha Compacta de Métricas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid var(--border-subtle)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Total</span>
              <strong style={{ fontSize: '1.4rem', color: '#fff' }}>{stats.total}</strong>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.72rem', color: '#6ee7b7', textTransform: 'uppercase', display: 'block' }}>Pagos</span>
              <strong style={{ fontSize: '1.4rem', color: '#34d399' }}>{stats.confirmed}</strong>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.72rem', color: '#fcd34d', textTransform: 'uppercase', display: 'block' }}>Pendentes</span>
              <strong style={{ fontSize: '1.4rem', color: '#fbbf24' }}>{stats.pending}</strong>
            </div>
          </div>

          {/* Botões de Exportação e Toggle de Filtros */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary btn-export-excel"
                style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                onClick={() => exportToExcel(filteredRegistrations, 'Inscritos')}
              >
                <FileSpreadsheet size={16} />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                className="btn-secondary btn-export-csv"
                style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                onClick={() => exportToCSV(filteredRegistrations, 'Inscritos')}
              >
                <FileText size={16} />
                <span>CSV</span>
              </button>
            </div>

            {/* Botão para Expandir/Recolher Filtros (evita scroll excessivo!) */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: hasActiveFilters ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid',
                borderColor: hasActiveFilters ? 'var(--primary)' : 'var(--border-subtle)',
                color: hasActiveFilters ? '#a5b4fc' : 'var(--text-muted)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Filter size={15} />
              <span>{showFilters ? 'Ocultar Filtros' : 'Filtrar'}</span>
              {hasActiveFilters && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }} />}
              {showFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>

          {/* Área Recolhível de Filtros */}
          {showFilters && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por nome ou telefone..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  style={{ paddingLeft: '38px', minHeight: '40px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select
                  className="form-select"
                  value={filters.network}
                  onChange={(e) => handleFilterChange('network', e.target.value)}
                  style={{ minHeight: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                >
                  <option value="">Todas as Redes</option>
                  {networks.map((n) => (
                    <option key={n.id} value={n.name}>{n.name}</option>
                  ))}
                </select>

                <select
                  className="form-select"
                  value={filters.discipler}
                  onChange={(e) => handleFilterChange('discipler', e.target.value)}
                  style={{ minHeight: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                >
                  <option value="">Todos Discipuladores</option>
                  {disciplers.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>

                <select
                  className="form-select"
                  value={filters.paymentMethod}
                  onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                  style={{ minHeight: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                >
                  <option value="">Todas Formas Pgto</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>

                <select
                  className="form-select"
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                  style={{ minHeight: '38px', fontSize: '0.82rem', padding: '6px 10px' }}
                >
                  <option value="">Todos Status</option>
                  <option value="Confirmado">Confirmados / Pagos</option>
                  <option value="Pendente">Pendentes</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          )}

          {/* Listagem de Inscritos (Scroll nativo, sem travamento!) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
              Exibindo <strong>{filteredRegistrations.length}</strong> participantes
            </div>

            {filteredRegistrations.length === 0 ? (
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '30px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <Users size={32} style={{ color: 'var(--text-dim)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 700, color: '#fff' }}>Nenhum inscrito no momento</div>
                <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  Faça as primeiras inscrições na tela de atendimento!
                </div>
              </div>
            ) : (
              filteredRegistrations.map((item, idx) => {
                const isPaid = item.payment_status === 'Confirmado' || item.payment_status === 'Pago';
                return (
                  <div key={item.id} className="attendee-card">
                    <div className="attendee-card-top">
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                          #{idx + 1}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                          {item.name}
                        </div>
                        {item.phone && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Phone size={12} />
                            <span>{item.phone}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover inscrição de ${item.name}?`)) {
                            onDeleteRegistration(item.id);
                          }
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          padding: '6px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer'
                        }}
                        title="Remover participante"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="attendee-card-details">
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>Nasc. / Idade</span>
                        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                          {formatDateBR(item.birth_date)} ({calculateAge(item.birth_date)})
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>Rede</span>
                        <span className="badge badge-network">{item.network}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>Discipulador</span>
                        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{item.discipler}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>Líder</span>
                        <span style={{ color: item.leader ? '#f1f5f9' : 'var(--text-dim)' }}>
                          {item.leader || '(Em branco)'}
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
                        title="Alternar status do pagamento"
                      >
                        {isPaid ? <Check size={12} /> : <Clock size={12} />}
                        <span>{item.payment_status || 'Pendente'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: CONFIGURAR EVENTO & VALOR                          */}
      {/* ========================================================= */}
      {activeTab === 'event' && (
        <div className="glass-card">
          <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Dados & Valor do Evento
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Altere o nome e valor por inscrição exibido no topo
          </p>

          <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Nome do Evento *</label>
              <input
                type="text"
                className="form-input"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Valor da Inscrição (R$) *</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>
                  {Number(eventPrice) === 0 ? 'Gratuito' : `R$ ${Number(eventPrice).toFixed(2)}`}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={eventPrice}
                onChange={(e) => setEventPrice(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Data</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 14 a 16 de Novembro"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Local</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Auditório Principal"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSavingEvent}
            >
              <Save size={18} />
              <span>{isSavingEvent ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 3: REDES & DISCIPULADORES                             */}
      {/* ========================================================= */}
      {activeTab === 'lists' && (
        <ListsManager
          networks={networks}
          disciplers={disciplers}
          onAddNetwork={onAddNetwork}
          onDeleteNetwork={onDeleteNetwork}
          onAddDiscipler={onAddDiscipler}
          onDeleteDiscipler={onDeleteDiscipler}
        />
      )}

      {/* ========================================================= */}
      {/* ABA 4: SUPABASE                                           */}
      {/* ========================================================= */}
      {activeTab === 'database' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: isSupabaseConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: isSupabaseConnected ? '#34d399' : '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            <Database size={26} />
          </div>

          <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            {isSupabaseConnected ? 'Supabase Conectado' : 'Modo de Armazenamento Local'}
          </h4>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '18px' }}>
            {isSupabaseConnected
              ? 'Tudo o que você cadastra ou altera é salvo diretamente no banco de dados na nuvem.'
              : 'As informações estão gravadas localmente neste navegador.'}
          </p>

          <div style={{
            background: 'rgba(10, 15, 28, 0.7)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
            color: '#e2e8f0',
            textAlign: 'left'
          }}>
            <div><strong>Projeto:</strong> ezzfhqyfxawjmhujffpy</div>
            <div><strong>Endpoint:</strong> https://ezzfhqyfxawjmhujffpy.supabase.co</div>
            <div><strong>Tabelas:</strong> events, networks, disciplers, registrations</div>
          </div>
        </div>
      )}
    </div>
  );
};
