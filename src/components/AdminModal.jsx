import React, { useState } from 'react';
import {
  Users,
  Settings,
  Calendar,
  Database,
  X,
  Plus,
  Save,
  FileSpreadsheet,
  FileText,
  DollarSign
} from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { ListsManager } from './ListsManager';
import { SupabaseConfigModal } from './SupabaseConfigModal';

export const AdminModal = ({
  isOpen,
  onClose,
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
  onUpdateEvent,
  onAddEvent,
  isSupabaseConnected
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('attendees'); // 'attendees' | 'event' | 'lists' | 'database'

  // Estado para edição do evento ativo
  const currentEvent = events[0] || { name: '', price: 0, date: '', location: '' };
  const [eventName, setEventName] = useState(currentEvent.name || '');
  const [eventPrice, setEventPrice] = useState(currentEvent.price || 0);
  const [eventDate, setEventDate] = useState(currentEvent.date || '');
  const [eventLocation, setEventLocation] = useState(currentEvent.location || '');
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  const handleSaveEventDetails = async (e) => {
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
      alert('Configurações do evento atualizadas com sucesso!');
    } catch (err) {
      alert('Erro ao atualizar evento.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Topbar */}
        <div className="admin-modal-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Settings size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Painel Administrativo</h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Gestão de Inscritos, Listas e Evento
              </span>
            </div>
          </div>

          <button className="close-btn" onClick={onClose} title="Fechar">
            <X size={22} />
          </button>
        </div>

        {/* Abas Internas */}
        <div className="admin-modal-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'attendees' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendees')}
          >
            <Users size={16} />
            <span>Inscritos ({registrations.length})</span>
          </button>

          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'event' ? 'active' : ''}`}
            onClick={() => setActiveTab('event')}
          >
            <Calendar size={16} />
            <span>Configurar Evento & Valor</span>
          </button>

          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'lists' ? 'active' : ''}`}
            onClick={() => setActiveTab('lists')}
          >
            <Settings size={16} />
            <span>Redes & Discipuladores</span>
          </button>

          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveTab('database')}
          >
            <Database size={16} />
            <span>Banco Supabase {isSupabaseConnected ? '🟢' : '🟡'}</span>
          </button>
        </div>

        {/* Corpo da Aba */}
        <div className="admin-modal-body">
          {activeTab === 'attendees' && (
            <AdminDashboard
              registrations={registrations}
              events={events}
              networks={networks}
              disciplers={disciplers}
              onDeleteRegistration={onDeleteRegistration}
              onToggleStatus={onToggleStatus}
            />
          )}

          {activeTab === 'event' && (
            <div className="glass-card" style={{ maxWidth: '580px', margin: '0 auto' }}>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                  Dados e Valor do Evento Ativo
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Defina o nome, valor por inscrição e informações exibidas no topo do quiosque
                </p>
              </div>

              <form onSubmit={handleSaveEventDetails} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    <span>Valor por Inscrição (R$) *</span>
                    <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700 }}>
                      {Number(eventPrice) === 0 ? 'Gratuito' : `R$ ${Number(eventPrice).toFixed(2)}`}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="Ex: 80.00"
                    value={eventPrice}
                    onChange={(e) => setEventPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Data do Evento</label>
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
                  style={{ marginTop: '8px' }}
                >
                  <Save size={18} />
                  <span>{isSavingEvent ? 'Salvando...' : 'Salvar Informações do Evento'}</span>
                </button>
              </form>
            </div>
          )}

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

          {activeTab === 'database' && (
            <div className="glass-card" style={{ maxWidth: '580px', margin: '0 auto', textAlign: 'center', padding: '30px' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: isSupabaseConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isSupabaseConnected ? '#34d399' : '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <Database size={28} />
              </div>

              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                {isSupabaseConnected ? 'Supabase Conectado e Sincronizado' : 'Modo de Armazenamento Local Ativo'}
              </h4>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                {isSupabaseConnected
                  ? 'Todas as inscrições, redes e discipuladores estão sendo sincronizados em tempo real no seu banco de dados em nuvem do Supabase.'
                  : 'As informações estão salvas localmente neste dispositivo. Para sincronizar na nuvem, conecte as chaves do Supabase.'}
              </p>

              <div style={{
                background: 'rgba(10, 15, 28, 0.7)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                color: '#e2e8f0',
                textAlign: 'left',
                marginBottom: '20px'
              }}>
                <div><strong>Projeto:</strong> ezzfhqyfxawjmhujffpy</div>
                <div><strong>Endpoint:</strong> https://ezzfhqyfxawjmhujffpy.supabase.co</div>
                <div><strong>Tabelas:</strong> events, networks, disciplers, registrations</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
