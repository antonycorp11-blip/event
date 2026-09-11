import React, { useState } from 'react';
import { Users, HeartHandshake, Plus, Trash2, Shield, Info } from 'lucide-react';

export const ListsManager = ({
  networks = [],
  disciplers = [],
  onAddNetwork,
  onDeleteNetwork,
  onAddDiscipler,
  onDeleteDiscipler
}) => {
  const [newNetworkName, setNewNetworkName] = useState('');
  const [newDisciplerName, setNewDisciplerName] = useState('');
  const [isSubmittingNet, setIsSubmittingNet] = useState(false);
  const [isSubmittingDisc, setIsSubmittingDisc] = useState(false);

  const handleAddNetwork = async (e) => {
    e.preventDefault();
    if (!newNetworkName.trim()) return;
    setIsSubmittingNet(true);
    try {
      await onAddNetwork(newNetworkName.trim());
      setNewNetworkName('');
    } catch (err) {
      alert('Erro ao adicionar rede');
    } finally {
      setIsSubmittingNet(false);
    }
  };

  const handleAddDiscipler = async (e) => {
    e.preventDefault();
    if (!newDisciplerName.trim()) return;
    setIsSubmittingDisc(true);
    try {
      await onAddDiscipler(newDisciplerName.trim());
      setNewDisciplerName('');
    } catch (err) {
      alert('Erro ao adicionar discipulador');
    } finally {
      setIsSubmittingDisc(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Informação sobre os campos */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#c7d2fe',
        fontSize: '0.9rem'
      }}>
        <Info size={22} style={{ flexShrink: 0, color: 'var(--primary)' }} />
        <div>
          <strong>Configuração dos Campos:</strong> As <strong>Redes</strong> e os <strong>Discipuladores</strong> são gerenciados por você nas listas abaixo e aparecem no formulário. O campo <strong>Líder</strong> fica em branco no formulário para preenchimento livre ou opcional pelo inscrito.
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* 1. GERENCIAR REDES */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                Lista de Redes ({networks.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Opções disponíveis no formulário
              </span>
            </div>
          </div>

          <form onSubmit={handleAddNetwork} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Jovens, Casais, Mulheres..."
              value={newNetworkName}
              onChange={(e) => setNewNetworkName(e.target.value)}
              disabled={isSubmittingNet}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto', minHeight: '44px', marginTop: 0, padding: '0 16px' }}
              disabled={isSubmittingNet || !newNetworkName.trim()}
            >
              <Plus size={18} />
              <span>Adicionar</span>
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            {networks.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                Nenhuma rede cadastrada. Adicione a primeira acima.
              </p>
            ) : (
              networks.map((net) => (
                <div
                  key={net.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.92rem' }}>
                    {net.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Excluir a rede "${net.name}"?`)) {
                        onDeleteNetwork(net.id);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title="Excluir rede"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. GERENCIAR DISCIPULADORES */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(236, 72, 153, 0.2)',
              color: '#f472b6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <HeartHandshake size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                Lista de Discipuladores ({disciplers.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Opções disponíveis no formulário
              </span>
            </div>
          </div>

          <form onSubmit={handleAddDiscipler} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Pastor Marcos, Líder João..."
              value={newDisciplerName}
              onChange={(e) => setNewDisciplerName(e.target.value)}
              disabled={isSubmittingDisc}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ width: 'auto', minHeight: '44px', marginTop: 0, padding: '0 16px' }}
              disabled={isSubmittingDisc || !newDisciplerName.trim()}
            >
              <Plus size={18} />
              <span>Adicionar</span>
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            {disciplers.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                Nenhum discipulador cadastrado. Adicione o primeiro acima.
              </p>
            ) : (
              disciplers.map((disc) => (
                <div
                  key={disc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.92rem' }}>
                    {disc.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Excluir o discipulador "${disc.name}"?`)) {
                        onDeleteDiscipler(disc.id);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title="Excluir discipulador"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
