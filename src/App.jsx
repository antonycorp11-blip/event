import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminModal } from './components/AdminModal';
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
  const [events, setEvents] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [disciplers, setDisciplers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Painel Administrativo
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Carregar dados
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
    showToast('Inscrição confirmada no Supabase!');
    return saved;
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
    setEvents((prev) => [item, ...prev.filter((e) => e.id !== item.id)]);
    showToast(`Evento "${eventData.name}" salvo.`);
  };

  const activeEvent = events[0] || {
    name: 'Conferência do Reino 2026',
    price: 80.00
  };

  return (
    <div className="app-container">
      {/* Topo do Quiosque com Info do Evento e Botão Admin */}
      <Header
        event={activeEvent}
        attendeeCount={registrations.length}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* O app abre DIRETO no modo inscrição rápida de atendimento */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RegistrationForm
          events={events}
          networks={networks}
          disciplers={disciplers}
          onSubmit={handleRegistrationSubmit}
        />
      </main>

      {/* Modal Completo de Administração */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        registrations={registrations}
        events={events}
        networks={networks}
        disciplers={disciplers}
        onDeleteRegistration={handleDeleteRegistration}
        onToggleStatus={handleToggleStatus}
        onAddNetwork={handleAddNetwork}
        onDeleteNetwork={handleDeleteNetwork}
        onAddDiscipler={handleAddDiscipler}
        onDeleteDiscipler={handleDeleteDiscipler}
        onAddEvent={handleAddEvent}
        isSupabaseConnected={isSupabaseReady()}
      />

      {/* Toast Feedback */}
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
