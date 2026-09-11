import React from 'react';
import { Calendar, Users, ListPlus, Database, PlusCircle } from 'lucide-react';

export const Header = ({
  activeTab,
  setActiveTab,
  attendeeCount,
  isSupabaseConnected,
  onOpenSupabaseConfig,
  onOpenEventManager
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <div className="logo-icon">
            <Calendar size={24} />
          </div>
          <div className="brand-info">
            <h1>Event</h1>
            <span>Inscrições & Gestão</span>
          </div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          <Calendar size={18} />
          <span>Fazer Inscrição</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'attendees' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendees')}
        >
          <Users size={18} />
          <span>Inscritos</span>
          <span className="badge-count">{attendeeCount}</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'lists' ? 'active' : ''}`}
          onClick={() => setActiveTab('lists')}
        >
          <ListPlus size={18} />
          <span>Gerenciar Listas</span>
        </button>
      </nav>

      <div className="header-actions">
        <button
          className="icon-btn"
          onClick={onOpenEventManager}
          title="Criar ou alterar eventos"
        >
          <PlusCircle size={16} />
          <span className="desktop-only">Eventos</span>
        </button>

        <button
          className="icon-btn"
          onClick={onOpenSupabaseConfig}
          title="Configuração do Banco Supabase"
        >
          <span className={`status-dot ${isSupabaseConnected ? '' : 'offline'}`} />
          <Database size={16} />
          <span className="desktop-only">
            {isSupabaseConnected ? 'Supabase' : 'Conectar BD'}
          </span>
        </button>
      </div>
    </header>
  );
};
