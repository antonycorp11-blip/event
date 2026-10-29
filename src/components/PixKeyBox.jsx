import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Telefone com DDD (só dígitos) -> (65) 99278-6131
export const formatPhone = digits => {
  const d = String(digits || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : d;
};

export async function copyText(text, label) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (_) { window.prompt(label, text); return false; }
}

// Chave Pix manual da igreja (organização), usada quando não há Pix automático.
export function PixKeyBox({ pixKey }) {
  const [copied, setCopied] = useState(false);
  if (!pixKey) return <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>A chave Pix da igreja ainda não foi cadastrada. Fale com a organização do evento.</p>;
  const copy = async () => {
    if (await copyText(pixKey, 'Copie a chave PIX:')) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };
  return <div style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Chave PIX</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.04em', color: '#fff', overflowWrap: 'anywhere' }}>{pixKey}</div>
    <button type="button" className="btn-primary" onClick={copy}>{copied ? 'Chave copiada!' : 'Copiar chave PIX'}</button>
  </div>;
}

export function QrImage({ text, size = 240, alt }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { width: size * 2, margin: 1 })
      .then(url => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [text, size]);
  return <div style={{ width: size, height: size, background: '#fff', borderRadius: 12, padding: 8, margin: '0 auto', boxSizing: 'content-box' }}>
    {src && <img src={src} alt={alt} width={size} height={size} style={{ display: 'block' }} />}
  </div>;
}
