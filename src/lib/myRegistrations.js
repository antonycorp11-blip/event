// Lembra neste aparelho as inscrições feitas pelo link de cada evento.
const key = eventToken => `event_my_regs_${eventToken}`;

export function loadMyTokens(eventToken) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(eventToken)) || '[]');
    return Array.isArray(saved) ? saved.filter(item => typeof item === 'string').slice(0, 20) : [];
  } catch (_) {
    return [];
  }
}

export function saveMyTokens(eventToken, tokens) {
  const unique = [...new Set(tokens)].slice(0, 20);
  try { localStorage.setItem(key(eventToken), JSON.stringify(unique)); } catch (_) {}
  return unique;
}
