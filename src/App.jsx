import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminView } from './components/AdminView';
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
  const [currentScreen, setCurrentScreen] = useState('kiosk'); // 'kiosk' | 'admin'
  const [events, setEvents] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [disciplers, setDisciplers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Carregar dados
  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
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
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // Carga inicial e auto-polling suave a cada 15 segundos para atualizar entre aparelhos
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      loadAllData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  // Atualização manual sob demanda (Botão Atualizar para PWA iPhone)
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAllData(true);
      showToast('Dados atualizados com sucesso!');
    } catch (e) {
      showToast('Erro ao atualizar dados.', 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Ações de Inscrição
  const handleRegistrationSubmit = async (regData) => {
    const saved = await createRegistration(regData);
    setRegistrations((prev) => [saved, ...prev]);
    return saved;
  };

  const handleConfirmPaymentStatus = async (id, status) => {
    await updateRegistrationStatus(id, status);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, payment_status: status } : r))
    );
    showToast('Pagamento confirmado no Supabase!');
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
      {currentScreen === 'kiosk' ? (
        <>
          {/* Topo do Quiosque com Info do Evento, Botão Atualizar e Botão Admin */}
          <Header
            event={activeEvent}
            attendeeCount={registrations.length}
            onOpenAdmin={() => setCurrentScreen('admin')}
            onRefresh={handleManualRefresh}
            isRefreshing={isRefreshing}
          />

          {/* O app abre DIRETO no modo inscrição rápida de atendimento */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <RegistrationForm
              events={events}
              networks={networks}
              disciplers={disciplers}
              onSubmit={handleRegistrationSubmit}
              onConfirmPaymentStatus={handleConfirmPaymentStatus}
            />
          </main>
        </>
      ) : (
        /* Tela Completa de Administração */
        <main style={{ flex: 1 }}>
          <AdminView
            onBack={() => setCurrentScreen('kiosk')}
            onRefresh={handleManualRefresh}
            isRefreshing={isRefreshing}
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
        </main>
      )}

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
