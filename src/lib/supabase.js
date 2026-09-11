import { createClient } from '@supabase/supabase-js';

// Credenciais padrão do Supabase do projeto oficial
const DEFAULT_SUPABASE_URL = 'https://ezzfhqyfxawjmhujffpy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6emZocXlmeGF3am1odWpmZnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjExNTIsImV4cCI6MjEwNDY5NzE1Mn0.AEMcd-NCqEAge5Y6tRTqdyjLjU2jkPO3C4zaAxVdPM8';

// Obter configurações do .env, localStorage ou padrão oficial
const getSavedConfig = () => {
  try {
    const local = localStorage.getItem('event_supabase_config');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch (e) {}

  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

  return {
    url: (envUrl && !envUrl.includes('seu-projeto')) ? envUrl : DEFAULT_SUPABASE_URL,
    anonKey: (envKey && !envKey.includes('sua-chave')) ? envKey : DEFAULT_SUPABASE_ANON_KEY
  };
};

let currentConfig = getSavedConfig();
export const supabase = createClient(currentConfig.url, currentConfig.anonKey);

// Testar conexão
export const testSupabaseConnection = async (url, anonKey) => {
  try {
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('events').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Conectado com sucesso ao Supabase!' };
  } catch (err) {
    return { success: false, message: err.message || 'Falha ao conectar' };
  }
};

export const saveSupabaseConfig = (url, anonKey) => {
  localStorage.setItem('event_supabase_config', JSON.stringify({ url, anonKey }));
  currentConfig = { url, anonKey };
};

export const getSupabaseConfig = () => currentConfig;

export const isSupabaseReady = () => !!supabase;

// ==========================================
// FUNÇÕES DE EVENTOS (SINCRONIZAÇÃO NUVEM)
// ==========================================
export const fetchEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch (e) {
    console.error('Erro ao buscar eventos no Supabase:', e);
  }
  return [];
};

export const addEvent = async (event) => {
  const payload = {
    name: event.name.trim(),
    price: parseFloat(event.price) || 0,
    date: event.date ? event.date.trim() : null,
    location: event.location ? event.location.trim() : null,
    active: true
  };

  if (event.id) {
    payload.id = event.id;
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .upsert([payload], { onConflict: 'id' })
      .select();

    if (error) throw error;
    if (data?.[0]) return data[0];
  } catch (e) {
    console.error('Erro ao salvar evento no Supabase:', e);
    throw e;
  }
  return { ...payload, id: event.id || 'temp-id' };
};

// ==========================================
// FUNÇÕES DE REDES (SINCRONIZAÇÃO NUVEM)
// ==========================================
export const fetchNetworks = async () => {
  try {
    const { data, error } = await supabase
      .from('networks')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    if (data) return data;
  } catch (e) {
    console.error('Erro ao buscar redes no Supabase:', e);
  }
  return [];
};

export const addNetwork = async (name) => {
  const trimmed = name.trim();
  try {
    const { data, error } = await supabase
      .from('networks')
      .insert([{ name: trimmed }])
      .select();

    if (error) throw error;
    if (data?.[0]) return data[0];
  } catch (e) {
    console.error('Erro ao adicionar rede no Supabase:', e);
    throw e;
  }
  return { id: Math.random().toString(), name: trimmed };
};

export const deleteNetwork = async (id) => {
  try {
    const { error } = await supabase.from('networks').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao deletar rede no Supabase:', e);
    throw e;
  }
};

// ==========================================
// FUNÇÕES DE DISCIPULADORES (SINCRONIZAÇÃO NUVEM)
// ==========================================
export const fetchDisciplers = async () => {
  try {
    const { data, error } = await supabase
      .from('disciplers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    if (data) return data;
  } catch (e) {
    console.error('Erro ao buscar discipuladores no Supabase:', e);
  }
  return [];
};

export const addDiscipler = async (name) => {
  const trimmed = name.trim();
  try {
    const { data, error } = await supabase
      .from('disciplers')
      .insert([{ name: trimmed }])
      .select();

    if (error) throw error;
    if (data?.[0]) return data[0];
  } catch (e) {
    console.error('Erro ao adicionar discipulador no Supabase:', e);
    throw e;
  }
  return { id: Math.random().toString(), name: trimmed };
};

export const deleteDiscipler = async (id) => {
  try {
    const { error } = await supabase.from('disciplers').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao deletar discipulador no Supabase:', e);
    throw e;
  }
};

// ==========================================
// FUNÇÕES DE INSCRIÇÕES (SINCRONIZAÇÃO NUVEM)
// ==========================================
export const fetchRegistrations = async () => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data) return data;
  } catch (e) {
    console.error('Erro ao buscar inscrições no Supabase:', e);
  }
  return [];
};

export const createRegistration = async (registration) => {
  const payload = {
    event_name: registration.event_name,
    name: registration.name.trim(),
    birth_date: registration.birth_date,
    network: registration.network,
    leader: registration.leader ? registration.leader.trim() : '',
    discipler: registration.discipler,
    payment_method: registration.payment_method,
    payment_status: registration.payment_status || 'Pendente',
    phone: registration.phone ? registration.phone.trim() : ''
  };

  if (registration.event_id) {
    payload.event_id = registration.event_id;
  }

  try {
    const { data, error } = await supabase
      .from('registrations')
      .insert([payload])
      .select();

    if (error) throw error;
    if (data?.[0]) return data[0];
  } catch (e) {
    console.error('Erro ao salvar inscrição no Supabase:', e);
    throw e;
  }
  return { ...payload, id: Math.random().toString() };
};

export const updateRegistrationStatus = async (id, status) => {
  try {
    const { error } = await supabase
      .from('registrations')
      .update({ payment_status: status })
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao atualizar status no Supabase:', e);
    throw e;
  }
};

export const deleteRegistration = async (id) => {
  try {
    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Erro ao deletar inscrição no Supabase:', e);
    throw e;
  }
};
