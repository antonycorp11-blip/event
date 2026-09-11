import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, X, ExternalLink, Copy, Check } from 'lucide-react';
import { testSupabaseConnection, saveSupabaseConfig, getSupabaseConfig } from '../lib/supabase';

export const SupabaseConfigModal = ({ isOpen, onClose, onConfigSaved }) => {
  if (!isOpen) return null;

  const current = getSupabaseConfig();
  const [url, setUrl] = useState(current.url || '');
  const [anonKey, setAnonKey] = useState(current.anonKey || '');
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [copied, setCopied] = useState(false);

  const handleTestAndSave = async (e) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setStatus({ state: 'error', message: 'Preencha a URL e a Anon Key do Supabase.' });
      return;
    }

    setStatus({ state: 'testing', message: 'Testando conexão com o Supabase...' });

    const result = await testSupabaseConnection(url.trim(), anonKey.trim());
    if (result.success) {
      saveSupabaseConfig(url.trim(), anonKey.trim());
      setStatus({ state: 'success', message: 'Conectado com sucesso! Dados salvos.' });
      setTimeout(() => {
        onConfigSaved();
        onClose();
      }, 1200);
    } else {
      // Salvar mesmo se der aviso de tabela ausente, orientando a rodar o SQL
      saveSupabaseConfig(url.trim(), anonKey.trim());
      setStatus({
        state: 'warning',
        message: `Credenciais salvas, mas verifique se executou o script supabase_schema.sql no SQL Editor do Supabase. (${result.message})`
      });
      setTimeout(() => {
        onConfigSaved();
      }, 2000);
    }
  };

  const handleCopySchemaNotice = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.2)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                Conectar Banco de Dados Supabase
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Sincronização automática em nuvem
              </span>
            </div>
          </div>

          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Guia Rápido */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          marginBottom: '20px',
          fontSize: '0.84rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Como conectar seu Supabase:</div>
          <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>Acesse seu projeto no <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>supabase.com</a></li>
            <li>Vá em <strong>SQL Editor</strong> e execute o código do arquivo <code>supabase_schema.sql</code> já gerado na raiz do projeto.</li>
            <li>Vá em <strong>Project Settings &gt; API</strong>, copie a <strong>Project URL</strong> e a chave <strong>anon public</strong> e cole abaixo.</li>
          </ol>
        </div>

        {status.message && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: status.state === 'success' ? 'rgba(16, 185, 129, 0.15)' : status.state === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${status.state === 'success' ? 'rgba(16, 185, 129, 0.3)' : status.state === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: status.state === 'success' ? '#6ee7b7' : status.state === 'warning' ? '#fcd34d' : '#fca5a5'
          }}>
            {status.state === 'success' && <CheckCircle2 size={18} />}
            {status.state !== 'success' && <AlertTriangle size={18} />}
            <span>{status.message}</span>
          </div>
        )}

        <form onSubmit={handleTestAndSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">
              <span>Project URL</span>
            </label>
            <input
              type="url"
              className="form-input"
              placeholder="https://exemplo.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Anon Public Key</span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: 0 }}
              disabled={status.state === 'testing'}
            >
              {status.state === 'testing' ? 'Conectando...' : 'Salvar e Conectar'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
