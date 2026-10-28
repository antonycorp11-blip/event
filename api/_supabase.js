// Chave pública (anon) do mesmo projeto usado pelo app; ela já vai no JavaScript do site.
const url = process.env.VITE_SUPABASE_URL || 'https://ojfnqcajbhvlqtprrfxg.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qZm5xY2FqYmh2bHF0cHJyZnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNTI2MDMsImV4cCI6MjEwMjkyODYwM30.5yGrdipKkLNO6xx3whdE-6a2ub5MjEfVFEdxfqHlIbg';

export async function rpc(name, args) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.json();
}

export const validToken = token => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '');

// Chave secreta do Supabase (service_role ou sb_secret_...). Só existe nas funções
// do servidor, para gravar o resultado do Pix; nunca vai para o navegador.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const hasServiceKey = () => Boolean(serviceKey);

export async function table(path, { method = 'GET', body } = {}) {
  const headers = { apikey: serviceKey, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (!serviceKey.startsWith('sb_')) headers.Authorization = `Bearer ${serviceKey}`;
  const response = await fetch(`${url}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.json();
}
