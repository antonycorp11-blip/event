import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const PIX_KEY = '05902198127';
export const RECEIPT_WHATSAPP = '5565992786131';
export const RECEIPT_WHATSAPP_LABEL = '(65) 99278-6131';

export async function copyText(text, label) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (_) { window.prompt(label, text); return false; }
}

export function PixKeyBox() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(PIX_KEY, 'Copie a chave PIX:')) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };
  return <div style={{ display: 'grid', gap: 10, margin: '16px 0' }}>
    <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Chave PIX</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.04em', color: '#fff' }}>{PIX_KEY}</div>
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
