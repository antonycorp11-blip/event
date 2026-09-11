import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminDashboard } from './components/AdminDashboard';
import { ListsManager } from './components/ListsManager';
import { SuccessModal } from './components/SuccessModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { EventManagerModal } from './components/EventManagerModal';
import {
  fetchEvents,
  fetchNetworks,
  fetchDisciplers,
  fetchRegistrations,
  createRegistration,
  deleteRegistration,
  updateRegistrationStatus,
  addNetwork,
  deleteNetwork,
  addDiscipler,
  deleteDiscipler,
  addEvent,
  isSupabaseReady
} from './lib/supabase';

export function App() {
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'attendees' | 'lists'
  const [events, setEvents] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [disciplers, setDisciplers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modais
  const [lastRegistration, setLastRegistration] = useState(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isEventManagerOpen, setIsEventManagerOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Carregar todos os dados
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [evts, nets, discs, regs] = await Promise.all([
        fetchEvents(),
        fetchNetworks(),
        fetchDisciplers(),
        fetchRegistrations()
      ]);
      setEvents(evts);
      setNetworks(nets);
      setDisciplers(discs);
      setRegistrations(regs);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Ações de Inscrição
  const handleRegistrationSubmit = async (regData) => {
    const saved = await createRegistration(regData);
    setRegistrations((prev) => [saved, ...prev]);
    setLastRegistration(saved);
    showToast('Inscrição confirmada com sucesso!');
  };

  const handleDeleteRegistration = async (id) => {
    await deleteRegistration(id);
    setRegistrations((prev) => prev.filter((r) => r.id !== id));
    showToast('Inscrição removida.', 'error');
  };

  const handleToggleStatus = async (id, newStatus) => {
    await updateRegistrationStatus(id, newStatus);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, payment_status: newStatus } : r))
    );
    showToast(`Status atualizado para: ${newStatus}`);
  };

  // Ações de Redes
  const handleAddNetwork = async (name) => {
    const item = await addNetwork(name);
    setNetworks((prev) => [...prev, item]);
    showToast(`Rede "${name}" adicionada.`);
  };

  const handleDeleteNetwork = async (id) => {
    await deleteNetwork(id);
    setNetworks((prev) => prev.filter((n) => n.id !== id));
    showToast('Rede removida.', 'error');
  };

  // Ações de Discipuladores
  const handleAddDiscipler = async (name) => {
    const item = await addDiscipler(name);
    setDisciplers((prev) => [...prev, item]);
    showToast(`Discipulador "${name}" adicionado.`);
  };

  const handleDeleteDiscipler = async (id) => {
    await deleteDiscipler(id);
    setDisciplers((prev) => prev.filter((d) => d.id !== id));
    showToast('Discipulador removido.', 'error');
  };

  // Ações de Eventos
  const handleAddEvent = async (eventData) => {
    const item = await addEvent(eventData);
    setEvents((prev) => [item, ...prev]);
    showToast(`Evento "${eventData.name}" criado.`);
  };

  return (
    <div className="app-container">
      {/* Cabeçalho */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        attendeeCount={registrations.length}
        isSupabaseConnected={isSupabaseReady()}
        onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
        onOpenEventManager={() => setIsEventManagerOpen(true)}
      />

      {/* Conteúdo da Aba Ativa */}
      <main style={{ flex: 1 }}>
        {activeTab === 'register' && (
          <RegistrationForm
            events={events}
            networks={networks}
            disciplers={disciplers}
            onSubmit={handleRegistrationSubmit}
            onNavigateToLists={() => setActiveTab('lists')}
          />
        )}

        {activeTab === 'attendees' && (
          <AdminDashboard
            registrations={registrations}
            events={events}
            networks={networks}
            disciplers={disciplers}
            onDeleteRegistration={handleDeleteRegistration}
            onToggleStatus={handleToggleStatus}
          />
        )}

        {activeTab === 'lists' && (
          <ListsManager
            networks={networks}
            disciplers={disciplers}
            onAddNetwork={handleAddNetwork}
            onDeleteNetwork={handleDeleteNetwork}
            onAddDiscipler={handleAddDiscipler}
            onDeleteDiscipler={handleDeleteDiscipler}
          />
        )}
      </main>

      {/* Modal de Sucesso na Inscrição */}
      <SuccessModal
        registration={lastRegistration}
        onClose={() => setLastRegistration(null)}
        onViewAttendees={() => {
          setLastRegistration(null);
          setActiveTab('attendees');
        }}
      />

      {/* Modal de Configuração do Supabase */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={loadAllData}
      />

      {/* Modal de Gerenciamento de Eventos */}
      <EventManagerModal
        isOpen={isEventManagerOpen}
        onClose={() => setIsEventManagerOpen(false)}
        events={events}
        onAddEvent={handleAddEvent}
      />

      {/* Toast de Notificação */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
